import secrets
from typing import Optional
from pydantic import Field, field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "ChromaShift API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = Field(default="fallback_secret_key_change_in_production")
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_SECRET_KEY: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ENABLE_OPENAPI: bool = False

    # Standard PostgreSQL Configurations (Fallback/Local)
    POSTGRES_SERVER: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_PORT: str = "5432"
    
    # Supabase Connection URLs (Direct strings from .env)
    DATABASE_DIRECT_URL: Optional[str] = None
    DATABASE_SESSION_URL: Optional[str] = None
    DATABASE_TRANSACTION_URL: Optional[str] = None

    # Storage (MinIO / S3 / Supabase S3)
    MINIO_SERVER: Optional[str] = None
    MINIO_ROOT_USER: Optional[str] = None
    MINIO_ROOT_PASSWORD: Optional[str] = None
    STORAGE_BUCKET_NAME: str = Field(default="cvd-media", validation_alias="MINIO_BUCKET_NAME")
    
    SUPABASE_S3_ENDPOINT: Optional[str] = None
    SUPABASE_S3_ACCESS_KEY: Optional[str] = None
    SUPABASE_S3_SECRET_KEY: Optional[str] = None
    SUPABASE_S3_REGION: Optional[str] = None

    # Infrastructure & Monitoring
    REDIS_HOST: str = "localhost"
    REDIS_PORT: str = "6379"
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1
    HF_TOKEN: Optional[str] = None

    @field_validator('SECRET_KEY')
    @classmethod
    def secret_key_must_have_entropy(cls, v: str) -> str:
        _placeholders = ('replace_me', 'changeme', 'secret', 'your_secret')
        if len(v) < 32:
            raise ValueError('SECRET_KEY must be at least 32 characters long')
        if any(p in v.lower() for p in _placeholders):
            raise ValueError('SECRET_KEY looks like a placeholder. Generate one with: openssl rand -hex 32')
        return v

    @computed_field
    @property
    def ALLOWED_ORIGINS_LIST(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        """Get the primary database URI (transaction mode preferred)"""
        if self.DATABASE_TRANSACTION_URL:
            return self._normalize_postgres_url(self.DATABASE_TRANSACTION_URL)
        if self.DATABASE_SESSION_URL:
            return self._normalize_postgres_url(self.DATABASE_SESSION_URL)
        if self.DATABASE_DIRECT_URL:
            return self._normalize_postgres_url(self.DATABASE_DIRECT_URL)
        return self._build_local_uri()

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_DIRECT_URI(self) -> str:
        """Get the direct database URI"""
        if self.DATABASE_DIRECT_URL:
            return self._normalize_postgres_url(self.DATABASE_DIRECT_URL)
        return self.SQLALCHEMY_DATABASE_URI

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_SESSION_URI(self) -> str:
        """Get the session pooler URI"""
        if self.DATABASE_SESSION_URL:
            return self._normalize_postgres_url(self.DATABASE_SESSION_URL)
        return self.SQLALCHEMY_DATABASE_URI

    def _normalize_postgres_url(self, url: str) -> str:
        """Ensure URL uses 'postgresql://' prefix for SQLAlchemy compatibility"""
        url = url.strip("'\" ")
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
            
        # Add connect_timeout to prevent hanging if Supabase/Postgres is paused or unreachable
        if "?" in url:
            if "connect_timeout" not in url:
                url += "&connect_timeout=10"
        else:
            url += "?connect_timeout=10"
            
        return url

    def _build_local_uri(self) -> str:
        """Build local PostgreSQL URI from individual components"""
        if not all([self.POSTGRES_USER, self.POSTGRES_SERVER, self.POSTGRES_PASSWORD]):
            return "sqlite:///./app.db"
        
        # Import here to avoid circular imports
        import urllib.parse
        
        user = self.POSTGRES_USER.strip("'\" ")
        host = self.POSTGRES_SERVER.strip("'\" ")
        password = urllib.parse.quote_plus(self.POSTGRES_PASSWORD.strip("'\" "))
        port = self.POSTGRES_PORT.strip("'\" ")
        db = (self.POSTGRES_DB or "postgres").strip("'\" ")
        
        uri = f"postgresql://{user}:{password}@{host}:{port}/{db}?connect_timeout=10"
        
        # Add sslmode for Supabase hosts
        if "supabase" in host.lower() and "sslmode" not in uri:
            uri += "&sslmode=require"
        
        return uri

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()