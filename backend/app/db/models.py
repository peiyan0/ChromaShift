from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    vision_profile = relationship("VisionProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    media_jobs = relationship("MediaJob", back_populates="user", cascade="all, delete-orphan")

class VisionProfile(Base):
    __tablename__ = "vision_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Standard settings
    cvd_type = Column(String, nullable=False) # e.g. "protanopia", "deuteranopia", "tritanopia"
    severity = Column(Float, default=1.0)
    
    # Adjusted rendering parameters
    contrast_multiplier = Column(Float, default=1.0)
    saturation_multiplier = Column(Float, default=1.0)
    intensity = Column(Float, default=1.0)
    
    # Telemetry
    calibration_steps_taken = Column(Integer, nullable=True)
    calibration_method = Column(String, nullable=True)
    
    user = relationship("User", back_populates="vision_profile")

class MediaJob(Base):
    __tablename__ = "media_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    filename = Column(String, nullable=False)
    media_type = Column(String, nullable=False) # 'image', 'video', 'pdf'
    status = Column(String, default="uploaded") # uploaded, processing, completed, failed
    
    is_saved_permanently = Column(Boolean, default=False)
    
    # Storage references
    s3_key_original = Column(String, nullable=True)
    s3_key_processed = Column(String, nullable=True)
    share_id = Column(String, unique=True, index=True, nullable=True)
    
    # Telemetry
    cvd_type = Column(String, nullable=True)
    severity = Column(Float, nullable=True)
    processing_mode = Column(String, nullable=True)
    processing_duration_ms = Column(Integer, nullable=True)
    upload_latency_ms = Column(Integer, nullable=True)
    pdf_page_count = Column(Integer, nullable=True)
    pdf_vector_complexity = Column(Integer, nullable=True)
    original_size_bytes = Column(Integer, nullable=True)
    processed_size_bytes = Column(Integer, nullable=True)
    video_fps = Column(Float, nullable=True)
    
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
    
    # Telemetry
    original_delta_e = Column(Float, nullable=True)
    remapped_delta_e = Column(Float, nullable=True)
    luminance_drift = Column(Float, nullable=True)
    audit_accuracy_verified = Column(Boolean, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    media_job = relationship("MediaJob", back_populates="compliance_report")


class ResearchParticipant(Base):
    __tablename__ = "research_participants"

    id = Column(Integer, primary_key=True, index=True)
    participant_uuid = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    education_level = Column(String, nullable=True)
    cvd_type = Column(String, nullable=True)
    is_diagnosed = Column(String, nullable=True)
    prior_tool_use = Column(String, nullable=True)
    color_glasses_frequency = Column(String, nullable=True)
    web_app_comfort = Column(String, nullable=True)
    device_use_frequency = Column(String, nullable=True)
    selected_mode = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sessions = relationship("VisionTestSession", back_populates="participant", cascade="all, delete-orphan")
    surveys = relationship("SurveyResponse", back_populates="participant", cascade="all, delete-orphan")


class VisionTestSession(Base):
    __tablename__ = "vision_test_sessions"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("research_participants.id"), nullable=False)
    
    # Task 1 (Line Chart)
    task1_original_time = Column(Float, nullable=True)
    task1_original_correct = Column(Boolean, nullable=True)
    task1_corrected_time = Column(Float, nullable=True)
    task1_corrected_correct = Column(Boolean, nullable=True)
    
    # Task 2 (Bar Chart)
    task2_original_time = Column(Float, nullable=True)
    task2_original_correct = Column(Boolean, nullable=True)
    task2_corrected_time = Column(Float, nullable=True)
    task2_corrected_correct = Column(Boolean, nullable=True)
    
    # Task 3 (Heatmap Grid)
    task3_original_time = Column(Float, nullable=True)
    task3_original_correct = Column(Boolean, nullable=True)
    task3_corrected_time = Column(Float, nullable=True)
    task3_corrected_correct = Column(Boolean, nullable=True)
    
    # Task 4 (Video Anomaloscope Tracking)
    video_original_time = Column(Float, nullable=True)
    video_original_clicks = Column(Integer, default=0)
    video_original_accuracy = Column(Float, default=0.0)
    video_corrected_time = Column(Float, nullable=True)
    video_corrected_clicks = Column(Integer, default=0)
    video_corrected_accuracy = Column(Float, default=0.0)
    # Task 5 (PDF Document Comprehension)
    document_original_time = Column(Float, nullable=True)
    document_original_correct = Column(Boolean, nullable=True)
    document_corrected_time = Column(Float, nullable=True)
    document_corrected_correct = Column(Boolean, nullable=True)

    # Task 6 (Orchard Photo MCQ)
    task6_original_time = Column(Float, nullable=True)
    task6_original_correct = Column(Boolean, nullable=True)
    task6_corrected_time = Column(Float, nullable=True)
    task6_corrected_correct = Column(Boolean, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    participant = relationship("ResearchParticipant", back_populates="sessions")


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("research_participants.id"), nullable=False)
    
    # SUS Q1-10
    sus_q1 = Column(Integer, nullable=True)
    sus_q2 = Column(Integer, nullable=True)
    sus_q3 = Column(Integer, nullable=True)
    sus_q4 = Column(Integer, nullable=True)
    sus_q5 = Column(Integer, nullable=True)
    sus_q6 = Column(Integer, nullable=True)
    sus_q7 = Column(Integer, nullable=True)
    sus_q8 = Column(Integer, nullable=True)
    sus_q9 = Column(Integer, nullable=True)
    sus_q10 = Column(Integer, nullable=True)
    
    # NASA Task Load (0-20)
    nasa_mental = Column(Integer, nullable=True)
    nasa_physical = Column(Integer, nullable=True)
    nasa_temporal = Column(Integer, nullable=True)
    nasa_performance = Column(Integer, nullable=True)
    nasa_effort = Column(Integer, nullable=True)
    nasa_frustration = Column(Integer, nullable=True)
    
    # Custom Visual Comfort (1-5)
    comfort_q1 = Column(Integer, nullable=True)
    comfort_q2 = Column(Integer, nullable=True)
    comfort_q3 = Column(Integer, nullable=True)
    comfort_q4 = Column(Integer, nullable=True)
    comfort_q5 = Column(Integer, nullable=True)
    
    # Qualitative notes / interview notes
    interview_visual_transitions = Column(String, nullable=True)
    interview_naturalness = Column(String, nullable=True)
    interview_wizard_onboarding = Column(String, nullable=True)
    interview_frustrating_aspects = Column(String, nullable=True)
    interview_helpful_aspects = Column(String, nullable=True)
    interview_open_feedback = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    participant = relationship("ResearchParticipant", back_populates="surveys")
