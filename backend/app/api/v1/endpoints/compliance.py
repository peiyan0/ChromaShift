import os
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.db.models import MediaJob, ComplianceReport, User, VisionProfile
from app.services.storage import storage_service
from app.services.compliance_analyzer import analyze_media_compliance

router = APIRouter()

class ComplianceIssue(BaseModel):
    sc_id: str # e.g., "1.4.3"
    severity: str # "Error", "Warning"
    description: str
    suggestion: str

class ComplianceReportResponse(BaseModel):
    job_id: str
    status: str # "pass", "fail", "needs_review"
    score: float
    issues: List[ComplianceIssue]

@router.post("/{job_id}/check", response_model=ComplianceReportResponse)
async def run_compliance_check(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Run WCAG 2.1 analysis (SC 1.4.1, 1.4.3, 1.4.11) on processed media.
    Saves and returns detailed report with actionable suggestions.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "completed" or not job.s3_key_processed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Media processing is not complete. Cannot run compliance check."
        )

    # Check if report already exists
    existing_report = db.query(ComplianceReport).filter(ComplianceReport.media_job_id == job.id).first()
    if existing_report:
        # Return existing report
        return {
            "job_id": job.job_id,
            "status": existing_report.status,
            "score": existing_report.score,
            "issues": existing_report.issues
        }

    # Fetch user's active Vision Profile for CVD context
    profile = db.query(VisionProfile).filter(VisionProfile.user_id == current_user.id).first()
    cvd_type = profile.cvd_type if profile else "deuteranopia"

    # Setup temporary paths
    file_ext = os.path.splitext(job.s3_key_processed)[1] if job.s3_key_processed else ".jpg"
    local_path = f"/tmp/{job_id}_compliance{file_ext}"
    local_orig_path = f"/tmp/{job_id}_compliance_orig{file_ext}"
    os.makedirs("/tmp", exist_ok=True)

    try:
        # Download both original and processed files from storage
        storage_service.download_file(job.s3_key_processed, local_path)
        storage_service.download_file(job.s3_key_original, local_orig_path)
        
        # Analyze real visual compliance of both media versions
        result = analyze_media_compliance(local_path, job.media_type, cvd_type)
        orig_result = analyze_media_compliance(local_orig_path, job.media_type, cvd_type)
        
        # Calculate differential improvement and add it to issues
        improvement = round(result["score"] - orig_result["score"], 1)
        result["issues"].append({
            "sc_id": "Improvement",
            "severity": "Info",
            "description": f"Original Contrast Score: {orig_result['score']} -> Processed Contrast Score: {result['score']}.",
            "suggestion": f"Accessibility enhancement achieved: +{improvement} points contrast improvement."
        })
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compliance check failed: {str(e)}"
        )
    finally:
        # Cleanup temporary files
        if os.path.exists(local_path):
            os.remove(local_path)
        if os.path.exists(local_orig_path):
            os.remove(local_orig_path)

    new_report = ComplianceReport(
        media_job_id=job.id,
        status=result["status"],
        score=result["score"],
        issues=result["issues"]
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    return {
        "job_id": job.job_id,
        "status": new_report.status,
        "score": new_report.score,
        "issues": new_report.issues
    }

@router.get("/{job_id}/report", response_model=ComplianceReportResponse)
async def get_compliance_report(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Retrieve previously generated compliance report from database.
    """
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    report = db.query(ComplianceReport).filter(ComplianceReport.media_job_id == job.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Compliance report not found for this job. Run check first.")

    return {
        "job_id": job.job_id,
        "status": report.status,
        "score": report.score,
        "issues": report.issues
    }

@router.get("/{job_id}/report")
async def get_accessibility_report(
    job_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Export the detailed Accessibility Report (JSON) for a completed media job.
    """
    from app.services.compliance_analyzer import generate_accessibility_report
    
    job = db.query(MediaJob).filter(MediaJob.job_id == job_id, MediaJob.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.status != "completed" or not job.s3_key_processed:
        raise HTTPException(status_code=400, detail="Job is not complete")
        
    profile = db.query(VisionProfile).filter(VisionProfile.user_id == current_user.id).first()
    cvd_type = profile.cvd_type if profile else "deuteranopia"
    
    file_ext = os.path.splitext(job.s3_key_processed)[1] if job.s3_key_processed else ".jpg"
    local_path = f"/tmp/{job_id}_report{file_ext}"
    local_orig_path = f"/tmp/{job_id}_report_orig{file_ext}"
    os.makedirs("/tmp", exist_ok=True)
    
    try:
        storage_service.download_file(job.s3_key_processed, local_path)
        storage_service.download_file(job.s3_key_original, local_orig_path)
        report = generate_accessibility_report(local_path, job.media_type, cvd_type, local_orig_path=local_orig_path)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)
        if os.path.exists(local_orig_path):
            os.remove(local_orig_path)
