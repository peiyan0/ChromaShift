from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.db import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            is_supabase_jwt = False
        except JWTError:
            is_placeholder = lambda val: not val or any(p in val for p in ["your-supabase-jwt-secret", "replace_me"])
            supabase_secret = settings.SUPABASE_JWT_SECRET
            
            if not supabase_secret or is_placeholder(supabase_secret):
                raise credentials_exception
                
            payload = jwt.decode(token, supabase_secret, algorithms=["HS256"], options={"verify_aud": False})
            is_supabase_jwt = True
            
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        # Enforce that Supabase tokens have the correct audience claim if present
        aud = payload.get("aud")
        if is_supabase_jwt and aud and aud not in ["authenticated", "anon"]:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        username = payload.get("email") or f"supabase_{user_id[:8]}"
        user = models.User(id=user_id, username=username, hashed_password="")
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            # If user was created concurrently, fetch it
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if not user:
                raise credentials_exception
                
    return user

def get_current_active_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_admin_user(current_user: models.User = Depends(get_current_active_user)) -> models.User:
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user


oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_current_user_or_guest(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional)
) -> models.User:
    if not token:
        # Fetch or create seed guest user
        guest_user = db.query(models.User).filter(models.User.id == "guest").first()
        if not guest_user:
            guest_user = models.User(id="guest", username="guest", hashed_password="")
            db.add(guest_user)
            db.commit()
            db.refresh(guest_user)
        return guest_user
        
    try:
        return get_current_user(db, token)
    except Exception:
        # Fallback to guest user on any token validation failure
        guest_user = db.query(models.User).filter(models.User.id == "guest").first()
        if not guest_user:
            guest_user = models.User(id="guest", username="guest", hashed_password="")
            db.add(guest_user)
            db.commit()
            db.refresh(guest_user)
        return guest_user

