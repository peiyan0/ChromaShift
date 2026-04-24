from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, List
from pydantic import BaseModel

from app.api import deps
from app.db.models import MediaJob, ComplianceReport, User

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

    # Simulate running WCAG analysis on the processed file
    issues = [
        {
            "sc_id": "1.4.3",
            "severity": "Error",
            "description": "Contrast ratio of text to background is 3.1:1, requiring 4.5:1.",
            "suggestion": "Increase the contrast slider by 15% in your Vision Profile."
        },
        {
            "sc_id": "1.4.1",
            "severity": "Warning",
            "description": "Color is used as the only visual means of conveying information on a chart line.",
            "suggestion": "Enable 'pattern overlays' in the advanced accessibility settings."
        }
    ]

    new_report = ComplianceReport(
        media_job_id=job.id,
        status="fail",
        score=82.5,
        issues=issues
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
