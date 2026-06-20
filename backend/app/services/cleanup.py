from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.db import models
from app.services.storage import storage_service

def cleanup_guest_accounts(db: Session, max_age_hours: int = 24) -> int:
    """
    Finds guest accounts older than max_age_hours, deletes their associated
    S3 files from storage, and deletes the user records from the database
    (triggering a cascade delete on vision profiles, media jobs, and compliance reports).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    
    guests = db.query(models.User).filter(
        models.User.username.like("guest_%")
    ).all()
    
    cleaned_count = 0
    for guest in guests:
        # Robust timezone-aware comparison
        user_created_at = guest.created_at
        if user_created_at is not None:
            if user_created_at.tzinfo is None:
                user_created_at = user_created_at.replace(tzinfo=timezone.utc)
            
            if user_created_at < cutoff:
                # Delete all associated files in S3
                for job in guest.media_jobs:
                    if job.s3_key_original:
                        try:
                            storage_service.delete_file(job.s3_key_original)
                        except Exception as e:
                            print(f"Could not delete S3 original key {job.s3_key_original}: {e}")
                    if job.s3_key_processed:
                        try:
                            storage_service.delete_file(job.s3_key_processed)
                        except Exception as e:
                            print(f"Could not delete S3 processed key {job.s3_key_processed}: {e}")
                
                # Delete user (cascades database relations)
                db.delete(guest)
                cleaned_count += 1
                
    if cleaned_count > 0:
        db.commit()
        
    return cleaned_count

def cleanup_expired_media(db: Session, max_age_days: int = 7) -> int:
    """
    Finds MediaJobs older than max_age_days where is_saved_permanently is False.
    Deletes their physical files in S3 and prunes the DB records.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    
    jobs = db.query(models.MediaJob).filter(
        models.MediaJob.is_saved_permanently == False
    ).all()
    
    cleaned_count = 0
    for job in jobs:
        created_at = job.created_at
        if created_at is not None:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            if created_at < cutoff:
                # Delete files
                if job.s3_key_original:
                    try:
                        storage_service.delete_file(job.s3_key_original)
                    except Exception as e:
                        print(f"Could not delete expired original key {job.s3_key_original}: {e}")
                if job.s3_key_processed:
                    try:
                        storage_service.delete_file(job.s3_key_processed)
                    except Exception as e:
                        print(f"Could not delete expired processed key {job.s3_key_processed}: {e}")
                        
                db.delete(job)
                cleaned_count += 1
                
    if cleaned_count > 0:
        db.commit()
        
    return cleaned_count
