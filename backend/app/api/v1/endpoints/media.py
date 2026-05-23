from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Any
import uuid
import time
import os
from datetime import datetime

from app.api import deps
from app import schemas
from app.db.session import SessionLocal
from app.db.models import MediaJob, User
from app.services.storage import storage_service
from app.services.media_processor import MediaProcessor

router = APIRouter()
processor = MediaProcessor()

def background_process_media(job_id: str, s3_key: str, cvd_type: str, severity: float):
    """
    Background task to process media using the AI models.
    """
    print(f"Background task started for job {job_id}")
    
    # 1. Setup paths
    file_ext = os.path.splitext(s3_key)[1] if s3_key else ".jpg"
    local_input = f"/tmp/{job_id}{file_ext}"
    local_output = f"/tmp/{job_id}_processed{file_ext}"
    processed_key = f"processed/{job_id}_processed{file_ext}"
    
    # Create tmp dir if not exists (inside container /tmp is usually fine)
    os.makedirs("/tmp", exist_ok=True)
    
    try:
        # 2. Download from S3
        storage_service.download_file(s3_key, local_input)
        print(f"File downloaded for processing: {local_input}")
        
        # 3. Process using AI models
        # Determine media type for processing
        if file_ext.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
            processor.process_image(local_input, local_output, cvd_type, severity)
        elif file_ext.lower() in ['.mp4', '.webm']:
            processor.process_video(local_input, local_output, cvd_type, severity)
        elif file_ext.lower() == '.pdf':
            processor.process_pdf(local_input, local_output, cvd_type, severity)
        else:
            # Fallback for unknown types
            import shutil
            shutil.copy2(local_input, local_output)
            
        print(f"File processed: {local_output}")
        
        # 4. Upload back to S3
        storage_service.upload_from_path(local_output, processed_key)
        print(f"Processed file uploaded to {processed_key}")
        
        # 4b. Generate PDF page-1 thumbnail
        if file_ext.lower() == '.pdf':
            try:
                import pypdfium2 as pdfium
                pdf = pdfium.PdfDocument(local_output)
                first_page = pdf[0]
                bitmap = first_page.render(scale=2)
                pil_img = bitmap.to_pil()
                
                local_thumb = f"/tmp/{job_id}_thumb.png"
                pil_img.save(local_thumb, "PNG")
                pdf.close()
                
                thumb_key = f"processed/{job_id}_processed_thumb.png"
                storage_service.upload_from_path(local_thumb, thumb_key)
                print(f"PDF page-1 thumbnail generated and uploaded to {thumb_key}")
                
                if os.path.exists(local_thumb):
                    os.remove(local_thumb)
            except Exception as thumb_err:
                print(f"Error generating PDF thumbnail: {thumb_err}")
        
        # 5. Update Database Job Status to 'completed'
        db = SessionLocal()
        try:
            job = db.query(MediaJob).filter(MediaJob.job_id == job_id).first()
            if job:
                job.status = "completed"
                job.s3_key_processed = processed_key
                db.commit()
                print(f"Background task completed for job {job_id}")
        except Exception as e:
            print(f"Error updating job status: {e}")
            db.rollback()
        finally:
            db.close()
            
    except Exception as e:
        print(f"Error in background processing: {e}")
        # Update job to failed
        db = SessionLocal()
        try:
            job = db.query(MediaJob).filter(MediaJob.job_id == job_id).first()
            if job:
                job.status = "failed"
                db.commit()
        except:
            db.rollback()
        finally:
            db.close()
    finally:
        # Cleanup local files
        if os.path.exists(local_input): os.remove(local_input)
        if os.path.exists(local_output): os.remove(local_output)


@router.post("/upload", response_model=schemas.MediaUploadResponse)
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Validate and store media to S3; Create database record; return job_id.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format"
        )
        
    try:
        s3_key = storage_service.upload_file(file)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Storage upload failed")
        
    # Determine type
    media_type = "image"
    if "video" in file.content_type: media_type = "video"
    if "pdf" in file.content_type: media_type = "pdf"
        
    job_id = str(uuid.uuid4())
    new_job = MediaJob(
        job_id=job_id,
        user_id=current_user.id,
        filename=file.filename,
        media_type=media_type,
        status="uploaded",
        s3_key_original=s3_key
    )
    db.add(new_job)
    db.commit()
    
    return {
        "job_id": job_id,
        "filename": file.filename,
        "status": "uploaded"
    }

@router.post("/{job_id}/process", response_model=schemas.MediaProcessResponse)
async def process_media(
    job_id: str,
    request: schemas.MediaProcessRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Trigger server-side AI transformation asynchronously.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.status == "processing":
        raise HTTPException(status_code=400, detail="Job is already processing")

    cvd_type = request.cvd_type or "deuteranopia"
    severity = request.severity or 1.0
    
    job.status = "processing"
    db.commit()
    
    background_tasks.add_task(
        background_process_media, 
        job_id=job.job_id, 
        s3_key=job.s3_key_original, 
        cvd_type=cvd_type, 
        severity=severity
    )
    
    return {
        "task_id": job.job_id,
        "status": "processing"
    }

@router.get("/{job_id}/status", response_model=schemas.MediaStatusResponse)
async def get_media_status(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Poll actual processing status from the database.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    download_url = None
    if job.status == "completed" and job.s3_key_processed:
        download_url = storage_service.generate_presigned_url(job.s3_key_processed)
        
    download_url_original = None
    if job.s3_key_original:
        download_url_original = storage_service.generate_presigned_url(job.s3_key_original)
        
    thumbnail_url = None
    if job.status == "completed":
        if job.media_type == "pdf":
            thumbnail_url = storage_service.generate_presigned_url(f"processed/{job.job_id}_processed_thumb.png")
        elif job.media_type == "image":
            thumbnail_url = download_url
            
    # Mock progress calculation
    progress = 100.0 if job.status == "completed" else (50.0 if job.status == "processing" else 0.0)
    
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress": progress,
        "download_url": download_url,
        "download_url_original": download_url_original,
        "thumbnail_url": thumbnail_url
    }

@router.get("/{job_id}/download")
async def get_download_url(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Return presigned S3 download URL for completed jobs.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job or job.status != "completed" or not job.s3_key_processed:
        raise HTTPException(status_code=404, detail="Processed file not found or not completed")
        
    url = storage_service.generate_presigned_url(job.s3_key_processed, expiration=3600)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")
        
    return {"url": url}

@router.post("/{job_id}/share")
async def generate_share_link(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Generate time-limited public share link for completed jobs.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job or job.status != "completed" or not job.s3_key_processed:
        raise HTTPException(status_code=404, detail="Processed file not found or not completed")
        
    share_url = storage_service.generate_presigned_url(job.s3_key_processed, expiration=7*24*3600)
    share_id = str(uuid.uuid4())[:8] # In a real app, save this mapping in the DB
    
    return {"share_url": share_url}

@router.get("/history", response_model=List[schemas.MediaHistoryResponse])
async def get_media_history(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Return upload/processing history for the authenticated user's dashboard.
    """
    jobs = db.query(MediaJob).filter(MediaJob.user_id == current_user.id).order_by(MediaJob.created_at.desc()).all()
    
    result = []
    for job in jobs:
        download_url = storage_service.generate_presigned_url(job.s3_key_processed) if job.status == "completed" and job.s3_key_processed else None
        download_url_original = storage_service.generate_presigned_url(job.s3_key_original) if job.s3_key_original else None
        
        thumbnail_url = None
        if job.status == "completed":
            if job.media_type == "pdf":
                thumbnail_url = storage_service.generate_presigned_url(f"processed/{job.job_id}_processed_thumb.png")
            elif job.media_type == "image":
                thumbnail_url = download_url
                
        result.append({
            "job_id": job.job_id,
            "filename": job.filename,
            "status": job.status,
            "created_at": job.created_at.isoformat() if job.created_at else datetime.now().isoformat(),
            "type": job.media_type,
            "download_url": download_url,
            "download_url_original": download_url_original,
            "thumbnail_url": thumbnail_url
        })
    return result

@router.delete("/clear-all")
async def clear_all_media(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Delete all media jobs and physical S3 files for the authenticated user.
    """
    jobs = db.query(MediaJob).filter(MediaJob.user_id == current_user.id).all()
    for job in jobs:
        # Delete original file physically
        if job.s3_key_original:
            try:
                storage_service.delete_file(job.s3_key_original)
            except Exception as e:
                print(f"Failed to delete original key {job.s3_key_original}: {e}")
        # Delete processed file physically
        if job.s3_key_processed:
            try:
                storage_service.delete_file(job.s3_key_processed)
            except Exception as e:
                print(f"Failed to delete processed key {job.s3_key_processed}: {e}")
        # Delete job from DB
        db.delete(job)
    
    db.commit()
    return {"status": "ok", "message": f"Successfully deleted {len(jobs)} jobs."}

@router.delete("/{job_id}")
async def delete_media_job(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Delete a single media job and its physical files by job ID.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Delete original file physically
    if job.s3_key_original:
        try:
            storage_service.delete_file(job.s3_key_original)
        except Exception as e:
            print(f"Failed to delete original key {job.s3_key_original}: {e}")
            
    # Delete processed file physically
    if job.s3_key_processed:
        try:
            storage_service.delete_file(job.s3_key_processed)
        except Exception as e:
            print(f"Failed to delete processed key {job.s3_key_processed}: {e}")
            
    db.delete(job)
    db.commit()
    return {"status": "ok", "message": "Job successfully deleted."}


