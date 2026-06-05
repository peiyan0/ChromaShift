from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, Field
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "ChromaShift API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day (reduced for security)
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ENABLE_OPENAPI: bool = False  # Disabled by default; set True only for local dev

    @field_validator('SECRET_KEY')
    @classmethod
    def secret_key_must_have_entropy(cls, v: str) -> str:
        _placeholders = ('replace_me', 'changeme', 'secret', 'your_secret')
        if len(v) < 32:
            raise ValueError('SECRET_KEY must be at least 32 characters long')
        if any(p in v.lower() for p in _placeholders):
            raise ValueError(
                'SECRET_KEY looks like a placeholder. '
                'Generate one with: openssl rand -hex 32'
            )
        return v

    @property
    def ALLOWED_ORIGINS_LIST(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
    
    # Database
    DATABASE_URL: Optional[str] = None
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_PORT: str = "5432"
    
    # Supabase split DB configurations
    DB_HOST: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_NAME: Optional[str] = None
    DB_PORT: Optional[str] = None
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        is_placeholder = lambda val: not val or any(p in val for p in ["your-project-ref", "your-supabase-url", "your-secure-password"])
        
        # 1. Resolve split DB configurations, prioritizing DB_* then falling back to POSTGRES_*
        db_user = self.DB_USER or self.POSTGRES_USER
        db_pass = self.DB_PASSWORD or self.POSTGRES_PASSWORD
        db_host = self.DB_HOST or self.POSTGRES_SERVER
        db_port = self.DB_PORT or self.POSTGRES_PORT
        db_name = self.DB_NAME or self.POSTGRES_DB
        
        if db_host and not is_placeholder(db_host) and db_user and not is_placeholder(db_user):
            return f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
            
        # 2. Fall back to DATABASE_URL if explicitly provided
        if self.DATABASE_URL and not is_placeholder(self.DATABASE_URL):
            if self.DATABASE_URL.startswith("postgres://"):
                return self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
            return self.DATABASE_URL
            
        # 3. Default to local fallback settings
        return f"postgresql://{db_user or 'admin'}:{db_pass or 'password'}@{db_host or 'localhost'}:{db_port or '5432'}/{db_name or 'antigravity'}"
    
    # MinIO / S3 emulation / Supabase S3
    MINIO_SERVER: Optional[str] = None
    MINIO_ROOT_USER: Optional[str] = None
    MINIO_ROOT_PASSWORD: Optional[str] = None
    STORAGE_BUCKET_NAME: Optional[str] = Field(default=None, validation_alias="MINIO_BUCKET_NAME")
    MINIO_BUCKET_NAME: str = "cvd-media"
    
    SUPABASE_S3_ENDPOINT: Optional[str] = None
    SUPABASE_S3_ACCESS_KEY: Optional[str] = None
    SUPABASE_S3_SECRET_KEY: Optional[str] = None

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: str = "6379"
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()

