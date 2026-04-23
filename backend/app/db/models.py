from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    
    # 1:1 relationship
    vision_profile = relationship("VisionProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

class VisionProfile(Base):
    __tablename__ = "vision_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Standard settings
    cvd_type = Column(String, nullable=False) # e.g. "protanopia", "deuteranopia", "tritanopia"
    severity = Column(Float, default=1.0)
    
    # Adjusted rendering parameters
    contrast_multiplier = Column(Float, default=1.0)
    saturation_multiplier = Column(Float, default=1.0)
    intensity = Column(Float, default=1.0)
    
    user = relationship("User", back_populates="vision_profile")
