from fastapi import APIRouter
from app.api.v1.endpoints import auth, profile, media, compliance

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(compliance.router, prefix="/compliance", tags=["compliance"])
