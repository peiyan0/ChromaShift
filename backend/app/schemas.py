from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str

# Profile Schemas
class VisionProfileBase(BaseModel):
    cvd_type: str
    severity: float = 1.0
    contrast_multiplier: float = 1.0
    saturation_multiplier: float = 1.0
    intensity: float = 1.0

class VisionProfileCreate(VisionProfileBase):
    pass

class VisionProfileUpdate(VisionProfileBase):
    pass

class VisionProfileResponse(VisionProfileBase):
    id: int
    user_id: int
    
    model_config = ConfigDict(from_attributes=True)

# Media Schemas
class MediaUploadResponse(BaseModel):
    job_id: str
    filename: str
    status: str

class MediaProcessRequest(BaseModel):
    # Optional overrides; defaults to user profile if not provided
    cvd_type: Optional[str] = None
    severity: Optional[float] = None

class MediaProcessResponse(BaseModel):
    task_id: str
    status: str

class MediaStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: float
    download_url: Optional[str] = None

class MediaHistoryResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    created_at: str
    type: str # 'image', 'video', 'pdf'
