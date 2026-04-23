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

