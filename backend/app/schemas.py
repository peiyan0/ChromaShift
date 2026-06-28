from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

# Auth Schemas
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
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
    calibration_steps_taken: Optional[int] = None
    calibration_method: Optional[str] = None

class VisionProfileCreate(VisionProfileBase):
    pass

class VisionProfileUpdate(VisionProfileBase):
    pass

class VisionProfileResponse(VisionProfileBase):
    id: int
    user_id: str
    
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
    compression_level: Optional[str] = None
    
    # Telemetry
    processing_mode: Optional[str] = None
    processing_duration_ms: Optional[int] = None
    upload_latency_ms: Optional[int] = None
    pdf_page_count: Optional[int] = None
    pdf_vector_complexity: Optional[int] = None
    original_size_bytes: Optional[int] = None
    processed_size_bytes: Optional[int] = None
    video_fps: Optional[float] = None

class MediaProcessResponse(BaseModel):
    task_id: str
    status: str

class MediaStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: float
    download_url: Optional[str] = None
    download_url_original: Optional[str] = None
    thumbnail_url: Optional[str] = None
    filename: Optional[str] = None
    media_type: Optional[str] = None

class MediaHistoryResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    created_at: str
    type: str # 'image', 'video', 'pdf'
    download_url: Optional[str] = None
    download_url_original: Optional[str] = None
    thumbnail_url: Optional[str] = None


# Research Survey & Metrics Schemas

class ResearchDemographicSchema(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    occupation: Optional[str] = None
    education_level: Optional[str] = None
    cvd_type: Optional[str] = None
    is_diagnosed: Optional[str] = None
    prior_tool_use: Optional[str] = None
    color_glasses_frequency: Optional[str] = None
    web_app_comfort: Optional[str] = None
    device_use_frequency: Optional[str] = None
    selected_mode: Optional[str] = None


class VisionTaskPerformanceSchema(BaseModel):
    original_time: Optional[float] = None
    original_correct: Optional[bool] = None
    corrected_time: Optional[float] = None
    corrected_correct: Optional[bool] = None


class VideoTrackingPerformanceSchema(BaseModel):
    original_time: Optional[float] = None
    original_clicks: Optional[int] = 0
    original_accuracy: Optional[float] = 0.0
    corrected_time: Optional[float] = None
    corrected_clicks: Optional[int] = 0
    corrected_accuracy: Optional[float] = 0.0


class ResearchSessionPerformanceSchema(BaseModel):
    task1: Optional[VisionTaskPerformanceSchema] = None
    task2: Optional[VisionTaskPerformanceSchema] = None
    task3: Optional[VisionTaskPerformanceSchema] = None
    video: Optional[VideoTrackingPerformanceSchema] = None
    document: Optional[VisionTaskPerformanceSchema] = None
    task6: Optional[VisionTaskPerformanceSchema] = None


class ResearchSurveySchema(BaseModel):
    # SUS Q1-10
    sus_q1: Optional[int] = None
    sus_q2: Optional[int] = None
    sus_q3: Optional[int] = None
    sus_q4: Optional[int] = None
    sus_q5: Optional[int] = None
    sus_q6: Optional[int] = None
    sus_q7: Optional[int] = None
    sus_q8: Optional[int] = None
    sus_q9: Optional[int] = None
    sus_q10: Optional[int] = None
    
    # NASA Task Load (0-20)
    nasa_mental: Optional[int] = None
    nasa_physical: Optional[int] = None
    nasa_temporal: Optional[int] = None
    nasa_performance: Optional[int] = None
    nasa_effort: Optional[int] = None
    nasa_frustration: Optional[int] = None
    
    # Custom Visual Comfort (1-5)
    comfort_q1: Optional[int] = None
    comfort_q2: Optional[int] = None
    comfort_q3: Optional[int] = None
    comfort_q4: Optional[int] = None
    comfort_q5: Optional[int] = None
    
    # Qualitative notes / interview notes
    interview_visual_transitions: Optional[str] = None
    interview_naturalness: Optional[str] = None
    interview_wizard_onboarding: Optional[str] = None
    interview_frustrating_aspects: Optional[str] = None
    interview_helpful_aspects: Optional[str] = None
    interview_open_feedback: Optional[str] = None


class ResearchSubmissionSchema(BaseModel):
    demographics: ResearchDemographicSchema
    performance: ResearchSessionPerformanceSchema
    surveys: ResearchSurveySchema

