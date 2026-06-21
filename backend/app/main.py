from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.session import engine
from app.db import models

if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
        )
    except ImportError:
        print("sentry-sdk not installed, skipping monitoring initialization")

# Database tables and columns are now managed via Alembic migrations.
# Run migrations with 'alembic upgrade head' before running the app.

import asyncio
from contextlib import asynccontextmanager
from app.db.session import SessionLocal
from app.services.cleanup import cleanup_expired_media, cleanup_guest_accounts

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.core.limiter import limiter

def _sync_cleanup():
    db = SessionLocal()
    try:
        cleanup_expired_media(db)
        cleanup_guest_accounts(db)
    finally:
        db.close()

async def run_periodic_cleanup():
    """Runs database and file cleanup operations hourly in the background."""
    while True:
        try:
            await asyncio.to_thread(_sync_cleanup)
        except Exception as e:
            print(f"Error running periodic cleanup: {e}")
        # Run every hour
        await asyncio.sleep(3600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    task = asyncio.create_task(run_periodic_cleanup())
    yield
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME, 
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENABLE_OPENAPI else None,
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"status": "ok", "message": "ChromaShift API is running"}
