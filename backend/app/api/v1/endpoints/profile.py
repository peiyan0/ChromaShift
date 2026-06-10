from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.db import models
from app import schemas

router = APIRouter()

@router.get("", response_model=schemas.VisionProfileResponse)
def get_user_profile(
    current_user: models.User = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db)
):
    profile = current_user.vision_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Vision profile not found")
    return profile

@router.post("", response_model=schemas.VisionProfileResponse)
def create_user_profile(
    profile_in: schemas.VisionProfileCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db)
):
    if current_user.vision_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has a vision profile. Use PUT to update.",
        )
    
    profile = models.VisionProfile(
        **profile_in.model_dump(),
        user_id=current_user.id
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

@router.put("", response_model=schemas.VisionProfileResponse)
def update_user_profile(
    profile_in: schemas.VisionProfileUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: Session = Depends(deps.get_db)
):
    profile = current_user.vision_profile
    if not profile:
        raise HTTPException(
            status_code=404, 
            detail="Vision profile not found. Use POST to create one first."
        )
    
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
        
    db.commit()
    db.refresh(profile)
    return profile
