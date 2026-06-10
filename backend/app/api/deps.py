from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.db import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            is_supabase_jwt = False
        except JWTError:
            is_placeholder = lambda val: not val or any(p in val for p in ["your-supabase-jwt-secret", "replace_me"])
            supabase_secret = settings.SUPABASE_JWT_SECRET
            
            if supabase_secret and not is_placeholder(supabase_secret):
                payload = jwt.decode(token, supabase_secret, algorithms=["HS256"])
                is_supabase_jwt = True
            else:
                raise JWTError("Invalid token signature")
            
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        # Enforce that Supabase tokens have the correct audience claim
        if is_supabase_jwt and payload.get("aud") != "authenticated":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        # Auto-provision user record if authenticated via Supabase JWT
        email = payload.get("email") or f"{user_id}@supabase.user"
        user = models.User(id=user_id, email=email, hashed_password="")
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            # If user was created concurrently, fetch it
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if not user:
                raise credentials_exception
                
    return user

def get_current_active_user(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_admin_user(current_user: models.User = Depends(get_current_active_user)) -> models.User:
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user


