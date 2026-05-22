from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    vision_profile = relationship("VisionProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    media_jobs = relationship("MediaJob", back_populates="user", cascade="all, delete-orphan")

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

class MediaJob(Base):
    __tablename__ = "media_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    filename = Column(String, nullable=False)
    media_type = Column(String, nullable=False) # 'image', 'video', 'pdf'
    status = Column(String, default="uploaded") # uploaded, processing, completed, failed
    
    # Storage references
    s3_key_original = Column(String, nullable=True)
    s3_key_processed = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="media_jobs")
    compliance_report = relationship("ComplianceReport", back_populates="media_job", uselist=False, cascade="all, delete-orphan")

class ComplianceReport(Base):
    __tablename__ = "compliance_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    media_job_id = Column(Integer, ForeignKey("media_jobs.id"), unique=True, nullable=False)
    
    status = Column(String, nullable=False) # pass, fail, needs_review
    score = Column(Float, default=0.0)
    
    # Store the list of issues as JSON
    issues = Column(JSON, default=list)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    media_job = relationship("MediaJob", back_populates="compliance_report")
