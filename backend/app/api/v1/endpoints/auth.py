from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import uuid

from app.db.session import get_db
from app.db import models
from app.core.security import get_password_hash, verify_password, create_access_token
from app import schemas
from app.api import deps
from app.core.limiter import limiter

router = APIRouter()

@router.post("/register", response_model=schemas.UserResponse)
@limiter.limit("10/minute")
def register_user(request: Request, user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    hashed_password = get_password_hash(user_in.password)
    user = models.User(email=user_in.email, hashed_password=hashed_password)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@router.post("/login", response_model=schemas.Token)
@limiter.limit("20/minute")
def login_access_token(request: Request, db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/guest", response_model=schemas.Token)
@limiter.limit("10/minute")
def login_guest_user(request: Request, db: Session = Depends(get_db)):
    guest_uuid = str(uuid.uuid4())
    guest_email = f"guest_{guest_uuid}@chromashift.guest"
    # Use a random UUID password for security
    guest_password = str(uuid.uuid4())
    hashed_password = get_password_hash(guest_password)
    
    user = models.User(email=guest_email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/promote", response_model=schemas.UserResponse)
@limiter.limit("10/minute")
def promote_guest_user(
    request: Request,
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    is_guest = current_user.email.endswith("@chromashift.guest") or current_user.email.endswith("@supabase.user")
    if not is_guest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only guest accounts can be promoted."
        )
    
    # Check if target email already exists
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system."
        )
    
    # Update current guest record to permanent account
    current_user.email = user_in.email
    current_user.hashed_password = get_password_hash(user_in.password)
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.post("/cleanup", response_model=dict)
def trigger_cleanup(
    max_age_hours: int = 24,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_admin_user)
):
    from app.services.cleanup import cleanup_guest_accounts
    count = cleanup_guest_accounts(db, max_age_hours=max_age_hours)
    return {"status": "success", "cleaned_count": count}

@router.get("/me", response_model=dict)
def get_me(current_user: models.User = Depends(deps.get_current_active_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_superuser": getattr(current_user, "is_superuser", False),
        "is_guest": current_user.email.endswith("@chromashift.guest")
    }

@router.delete("/me", response_model=dict)
def delete_current_user(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
):
    from app.services.storage import storage_service
    # 1. Permanent removal of any uploaded or processed files from S3/MinIO
    for job in current_user.media_jobs:
        if job.s3_key_original:
            try:
                storage_service.delete_file(job.s3_key_original)
            except Exception as e:
                print(f"Failed to delete S3 key {job.s3_key_original}: {e}")
        if job.s3_key_processed:
            try:
                storage_service.delete_file(job.s3_key_processed)
            except Exception as e:
                print(f"Failed to delete S3 key {job.s3_key_processed}: {e}")
                
    # 2. Database cascades will automatically remove jobs, profiles and reports
    db.delete(current_user)
    db.commit()
    return {"status": "success", "detail": "Account and associated data deleted successfully"}




