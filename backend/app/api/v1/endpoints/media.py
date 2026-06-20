from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Any, Optional
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

def background_process_media(job_id: str, s3_key: str, cvd_type: str, severity: float, compression_level: str = "medium", auto_loop: bool = True):
    """
    Background task to process media using the AI models.
    """
    print(f"Background task started for job {job_id}")
    
    # Query database to retrieve media_type for fallback
    db = SessionLocal()
    db_media_type = None
    try:
        job = db.query(MediaJob).filter(MediaJob.job_id == job_id).first()
        if job:
            db_media_type = job.media_type
    except Exception as db_err:
        print(f"Failed to query job media_type from database: {db_err}")
    finally:
        db.close()

    # 1. Setup paths
    file_ext = os.path.splitext(s3_key)[1] if s3_key else ""
    if not file_ext and db_media_type:
        if db_media_type == "pdf":
            file_ext = ".pdf"
        elif db_media_type == "video":
            file_ext = ".mp4"
        elif db_media_type == "image":
            file_ext = ".jpg"

    if not file_ext:
        file_ext = ".jpg"
    
    # Force processed video extension to .mp4 to ensure ffmpeg libx264/aac compatibility
    processed_ext = file_ext
    if file_ext.lower() in ['.webm', '.mov', '.avi', '.mkv', '.m4v']:
        processed_ext = ".mp4"
        
    local_input = f"/tmp/{job_id}{file_ext}"
    local_output = f"/tmp/{job_id}_processed{processed_ext}"
    processed_key = f"processed/{job_id}_processed{processed_ext}"
    
    # Create tmp dir if not exists (inside container /tmp is usually fine)
    os.makedirs("/tmp", exist_ok=True)
    
    # Explicitly remove any existing local files from a previous run to avoid re-processing the processed file
    if os.path.exists(local_input):
        os.remove(local_input)
    if os.path.exists(local_output):
        os.remove(local_output)
    
    try:
        # 2. Download from S3
        storage_service.download_file(s3_key, local_input)
        print(f"File downloaded for processing: {local_input}")
        
        # Determine media type for processing
        media_type = db_media_type or "image"
        if file_ext.lower() in ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v']:
            media_type = "video"
        elif file_ext.lower() == '.pdf':
            media_type = "pdf"
            
        # 3. Process using AI models with Automated WCAG Iterative Loop
        from app.services.compliance_analyzer import analyze_media_compliance
        
        max_iterations = 5
        iteration = 0
        current_severity = severity
        passed = False
        
        while iteration < max_iterations and not passed:
            iteration += 1
            if media_type == "image":
                processor.process_image(local_input, local_output, cvd_type, current_severity, compression_level)
            elif media_type == "video":
                processor.process_video(local_input, local_output, cvd_type, current_severity, compression_level)
            elif media_type == "pdf":
                processor.process_pdf(local_input, local_output, cvd_type, current_severity, compression_level)
            else:
                import shutil
                shutil.copy2(local_input, local_output)
                passed = True
                break
                
            try:
                report = analyze_media_compliance(local_output, media_type, cvd_type)
                
                if not auto_loop:
                    passed = True
                    print(f"Manual severity used. WCAG score {report.get('score')} at severity {current_severity}")
                elif report["status"] == "pass" or current_severity >= 2.0:
                    passed = True
                    print(f"WCAG loop completed: Passed with score {report.get('score')} at severity {current_severity}")
                else:
                    current_severity += 0.25
                    print(f"WCAG loop: Iteration {iteration} failed (score {report.get('score')}). Increasing severity to {current_severity}...")
            except Exception as e:
                print(f"WCAG check failed during loop: {e}")
                passed = True # Break out safely
            
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
        
        # 4c. Generate Video thumbnail
        elif file_ext.lower() in ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v']:
            try:
                import cv2
                cap = cv2.VideoCapture(local_input)
                ret, frame = cap.read()
                cap.release()
                if ret:
                    local_thumb = f"/tmp/{job_id}_thumb.png"
                    os.makedirs('/tmp', exist_ok=True)
                    cv2.imwrite(local_thumb, frame)
                    thumb_key = f"processed/{job_id}_processed_thumb.png"
                    storage_service.upload_from_path(local_thumb, thumb_key)
                    print(f"Video thumbnail generated and uploaded to {thumb_key}")
                    if os.path.exists(local_thumb):
                        os.remove(local_thumb)
            except Exception as thumb_err:
                print(f"Error generating Video thumbnail: {thumb_err}")

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
    current_user: User = Depends(deps.get_current_user_or_guest)
) -> Any:
    """
    Validate and store media to S3; Create database record; return job_id.
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format"
        )
        
    # 1. Size Check using seek/tell (no memory bloat)
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0, 0)
    
    # 2. Magic byte / signature check
    header = file.file.read(262)
    file.file.seek(0, 0)
    
    is_valid_sig = False
    if file.content_type in ["image/jpeg", "image/jpg"] and header.startswith(b"\xff\xd8"):
        is_valid_sig = True
        if file_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image size exceeds 50MB limit")
    elif file.content_type == "image/png" and header.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid_sig = True
        if file_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image size exceeds 50MB limit")
    elif file.content_type == "image/webp" and b"WEBP" in header[8:16]:
        is_valid_sig = True
        if file_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image size exceeds 50MB limit")
    elif file.content_type == "image/avif" and (b"ftypavif" in header[4:12] or b"avif" in header[8:16]):
        is_valid_sig = True
        if file_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image size exceeds 50MB limit")
    elif file.content_type == "application/pdf" and header.startswith(b"%PDF"):
        is_valid_sig = True
        if file_size > 100 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF size exceeds 100MB limit")
    elif file.content_type == "video/mp4" and (b"ftyp" in header[4:12] or b"ftyp" in header[0:20]):
        is_valid_sig = True
        if file_size > 500 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video size exceeds 500MB limit")
    elif file.content_type == "video/webm" and header.startswith(b"\x1a\x45\xdf\xa3"):
        is_valid_sig = True
        if file_size > 500 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video size exceeds 500MB limit")

    if not is_valid_sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File signature verification failed"
        )

    # Determine type
    media_type = "image"
    if "video" in file.content_type: media_type = "video"
    if "pdf" in file.content_type: media_type = "pdf"

    # 3. Video Duration Check
    if media_type == "video":
        import tempfile
        import cv2
        fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(file.filename)[1])
        try:
            with os.fdopen(fd, 'wb') as tmp:
                shutil_file = file.file
                shutil_file.seek(0)
                # chunked copy to avoid RAM blowup
                while True:
                    chunk = shutil_file.read(8192)
                    if not chunk:
                        break
                    tmp.write(chunk)
            
            # reset uploaded file position for subsequent S3 upload
            file.file.seek(0)
            
            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                raise HTTPException(status_code=400, detail="Cannot parse video file structure")
            fps = cap.get(cv2.CAP_PROP_FPS)
            frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            cap.release()
            
            if fps > 0 and frames > 0:
                duration = frames / fps
                if duration > 600: # 10 minutes
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Video duration exceeds 10 minutes limit"
                    )
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        
    try:
        s3_key = storage_service.upload_file(file)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Storage upload failed")
        
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
    current_user: User = Depends(deps.get_current_user_or_guest)
) -> Any:
    """
    Trigger server-side AI transformation asynchronously.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.status == "processing":
        raise HTTPException(status_code=400, detail="Job is already processing")

    cvd_type = request.cvd_type
    severity = request.severity
    
    # Fallback to current user's vision profile if not explicitly requested
    if (not cvd_type or severity is None) and current_user.vision_profile:
        if not cvd_type:
            cvd_type = current_user.vision_profile.cvd_type
        if severity is None:
            severity = current_user.vision_profile.severity
            
    # Default fallback values
    cvd_type = cvd_type or "deuteranopia"
    severity = severity if severity is not None else 1.0
    
    # Delete existing compliance report if any, since we are reprocessing
    if job.compliance_report:
        db.delete(job.compliance_report)
        
    job.status = "processing"
    db.commit()
    
    compression_level = request.compression_level or "medium"
    
    background_tasks.add_task(
        background_process_media, 
        job_id=job.job_id, 
        s3_key=job.s3_key_original, 
        cvd_type=cvd_type, 
        severity=severity,
        compression_level=compression_level,
        auto_loop=False
    )
    
    return {
        "task_id": job.job_id,
        "status": "processing"
    }

@router.get("/{job_id}/status", response_model=schemas.MediaStatusResponse)
async def get_media_status(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user_or_guest)
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
            
    # Calculate elapsed progress estimation for processing status
    if job.status == "completed":
        progress = 100.0
    elif job.status == "processing":
        # Estimate progress: start at 10% and increment by 15% every 5 seconds, capping at 90%
        import datetime
        elapsed = 0.0
        if job.updated_at:
            now = datetime.datetime.now(job.updated_at.tzinfo) if job.updated_at.tzinfo else datetime.datetime.now()
            elapsed = (now - job.updated_at).total_seconds()
        progress = min(10.0 + (elapsed / 5.0) * 15.0, 90.0)
    else:
        progress = 0.0
    
    return {
        "job_id": job.job_id,
        "status": job.status,
        "progress": progress,
        "download_url": download_url,
        "download_url_original": download_url_original,
        "thumbnail_url": thumbnail_url,
        "filename": job.filename,
        "media_type": job.media_type
    }

@router.get("/{job_id}/download")
async def get_download_url(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user_or_guest)
) -> Any:
    """
    Return presigned S3 download URL for completed jobs.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job or job.status != "completed" or not job.s3_key_processed:
        raise HTTPException(status_code=404, detail="Processed file not found or not completed")
        
    # Generate download filename: [original_basename]_processed.[original_ext]
    base, ext = os.path.splitext(job.filename)
    download_filename = f"{base}_processed{ext}"
    
    url = storage_service.generate_presigned_url(
        job.s3_key_processed, 
        expiration=3600, 
        download_filename=download_filename
    )
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")
        
    return {"url": url}

@router.post("/{job_id}/share")
async def generate_share_link(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user_or_guest)
) -> Any:
    """
    Generate time-limited public share link for completed jobs.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job or job.status != "completed" or not job.s3_key_processed:
        raise HTTPException(status_code=404, detail="Processed file not found or not completed")
        
    share_id = str(uuid.uuid4())[:8]
    job.share_id = share_id
    db.commit()
    
    # Generate long-lived (7 days) presigned URL
    share_url = storage_service.generate_presigned_url(job.s3_key_processed, expiration=7*24*3600)
    
    return {
        "share_id": share_id,
        "share_url": share_url
    }

@router.get("/history", response_model=List[schemas.MediaHistoryResponse])
async def get_media_history(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user_or_guest),
    job_ids: Optional[str] = None
) -> Any:
    """
    Return upload/processing history for the authenticated user's dashboard.
    """
    if current_user.id == "guest":
        if not job_ids:
            return []
        job_id_list = [jid.strip() for jid in job_ids.split(",") if jid.strip()]
        jobs = db.query(MediaJob).filter(MediaJob.job_id.in_(job_id_list), MediaJob.user_id == "guest").order_by(MediaJob.created_at.desc()).all()
    else:
        query = db.query(MediaJob).filter(MediaJob.user_id == current_user.id)
        if job_ids:
            job_id_list = [jid.strip() for jid in job_ids.split(",") if jid.strip()]
            query = query.filter(MediaJob.job_id.in_(job_id_list))
        jobs = query.order_by(MediaJob.created_at.desc()).all()
    
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
    current_user: User = Depends(deps.get_current_user_or_guest)
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
    current_user: User = Depends(deps.get_current_user_or_guest)
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


