from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.db import models
from app import schemas
from typing import Dict, Any, List

router = APIRouter()

@router.post("/submit", status_code=status.HTTP_201_CREATED)
def submit_research(
    payload: schemas.ResearchSubmissionSchema,
    db: Session = Depends(deps.get_db)
):
    try:
        # 1. Create Demographic Participant Record
        demo = payload.demographics
        participant = models.ResearchParticipant(
            age=demo.age,
            gender=demo.gender,
            occupation=demo.occupation,
            education_level=demo.education_level,
            cvd_type=demo.cvd_type,
            is_diagnosed=demo.is_diagnosed,
            prior_tool_use=demo.prior_tool_use,
            color_glasses_frequency=demo.color_glasses_frequency,
            web_app_comfort=demo.web_app_comfort,
            device_use_frequency=demo.device_use_frequency,
            selected_mode=demo.selected_mode
        )
        db.add(participant)
        db.commit()
        db.refresh(participant)

        # 2. Save Vision Test Performance Records
        perf = payload.performance
        task1 = perf.task1 or schemas.VisionTaskPerformanceSchema()
        task2 = perf.task2 or schemas.VisionTaskPerformanceSchema()
        task3 = perf.task3 or schemas.VisionTaskPerformanceSchema()
        video = perf.video or schemas.VideoTrackingPerformanceSchema()
        doc = perf.document or schemas.VisionTaskPerformanceSchema()
        task6 = perf.task6 or schemas.VisionTaskPerformanceSchema()

        session_record = models.VisionTestSession(
            participant_id=participant.id,
            
            task1_original_time=task1.original_time,
            task1_original_correct=task1.original_correct,
            task1_corrected_time=task1.corrected_time,
            task1_corrected_correct=task1.corrected_correct,
            
            task2_original_time=task2.original_time,
            task2_original_correct=task2.original_correct,
            task2_corrected_time=task2.corrected_time,
            task2_corrected_correct=task2.corrected_correct,
            
            task3_original_time=task3.original_time,
            task3_original_correct=task3.original_correct,
            task3_corrected_time=task3.corrected_time,
            task3_corrected_correct=task3.corrected_correct,
            
            video_original_time=video.original_time,
            video_original_clicks=video.original_clicks,
            video_original_accuracy=video.original_accuracy,
            video_corrected_time=video.corrected_time,
            video_corrected_clicks=video.corrected_clicks,
            video_corrected_accuracy=video.corrected_accuracy,
            
            document_original_time=doc.original_time,
            document_original_correct=doc.original_correct,
            document_corrected_time=doc.corrected_time,
            document_corrected_correct=doc.corrected_correct,

            task6_original_time=task6.original_time,
            task6_original_correct=task6.original_correct,
            task6_corrected_time=task6.corrected_time,
            task6_corrected_correct=task6.corrected_correct
        )
        db.add(session_record)

        # 3. Save Survey Responses
        srv = payload.surveys
        survey_record = models.SurveyResponse(
            participant_id=participant.id,
            sus_q1=srv.sus_q1,
            sus_q2=srv.sus_q2,
            sus_q3=srv.sus_q3,
            sus_q4=srv.sus_q4,
            sus_q5=srv.sus_q5,
            sus_q6=srv.sus_q6,
            sus_q7=srv.sus_q7,
            sus_q8=srv.sus_q8,
            sus_q9=srv.sus_q9,
            sus_q10=srv.sus_q10,
            
            nasa_mental=srv.nasa_mental,
            nasa_physical=srv.nasa_physical,
            nasa_temporal=srv.nasa_temporal,
            nasa_performance=srv.nasa_performance,
            nasa_effort=srv.nasa_effort,
            nasa_frustration=srv.nasa_frustration,
            
            comfort_q1=srv.comfort_q1,
            comfort_q2=srv.comfort_q2,
            comfort_q3=srv.comfort_q3,
            comfort_q4=srv.comfort_q4,
            comfort_q5=srv.comfort_q5,
            
            interview_visual_transitions=srv.interview_visual_transitions,
            interview_naturalness=srv.interview_naturalness,
            interview_wizard_onboarding=srv.interview_wizard_onboarding,
            interview_frustrating_aspects=srv.interview_frustrating_aspects,
            interview_helpful_aspects=srv.interview_helpful_aspects,
            interview_open_feedback=srv.interview_open_feedback
        )
        db.add(survey_record)
        db.commit()

        return {
            "status": "success",
            "participant_uuid": participant.participant_uuid
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database submission failed: {str(e)}"
        )

@router.get("/analytics", response_model=Dict[str, Any])
def get_research_analytics(
    current_admin: models.User = Depends(deps.get_current_admin_user),
    db: Session = Depends(deps.get_db)
):
    # Total Participants
    total_count = db.query(models.ResearchParticipant).count()
    if total_count == 0:
        return {
            "total_participants": 0,
            "avg_sus_score": 0.0,
            "demographics": {},
            "task_performance": {},
            "nasa_tlx": {},
            "visual_comfort": {},
            "interview_feedback": []
        }

    # Demographics Splits
    cvd_splits = db.query(
        models.ResearchParticipant.cvd_type,
        func.count(models.ResearchParticipant.id)
    ).group_by(models.ResearchParticipant.cvd_type).all()
    
    gender_splits = db.query(
        models.ResearchParticipant.gender,
        func.count(models.ResearchParticipant.id)
    ).group_by(models.ResearchParticipant.gender).all()

    # Calculate Average SUS Score
    # Formula: Sum of (Odd item - 1) + (5 - Even item) multiplied by 2.5
    all_surveys = db.query(models.SurveyResponse).all()
    sus_scores = []
    nasa_mental = []
    nasa_physical = []
    nasa_temporal = []
    nasa_performance = []
    nasa_effort = []
    nasa_frustration = []
    comfort_strain = []
    comfort_fatigue = []
    comfort_headache = []
    comfort_remapped = []
    comfort_reading = []
    feedbacks = []

    for s in all_surveys:
        # Calculate SUS
        try:
            q_odd = [s.sus_q1, s.sus_q3, s.sus_q5, s.sus_q7, s.sus_q9]
            q_even = [s.sus_q2, s.sus_q4, s.sus_q6, s.sus_q8, s.sus_q10]
            if all(v is not None for v in q_odd + q_even):
                odd_sum = sum(v - 1 for v in q_odd)
                even_sum = sum(5 - v for v in q_even)
                sus_scores.append((odd_sum + even_sum) * 2.5)
        except Exception:
            pass

        # Calculate NASA-TLX averages (0 to 20 scale)
        if s.nasa_mental is not None: nasa_mental.append(s.nasa_mental)
        if s.nasa_physical is not None: nasa_physical.append(s.nasa_physical)
        if s.nasa_temporal is not None: nasa_temporal.append(s.nasa_temporal)
        if s.nasa_performance is not None: nasa_performance.append(s.nasa_performance)
        if s.nasa_effort is not None: nasa_effort.append(s.nasa_effort)
        if s.nasa_frustration is not None: nasa_frustration.append(s.nasa_frustration)

        # Custom Visual Comfort averages (1 to 5 scale)
        if s.comfort_q1 is not None: comfort_strain.append(s.comfort_q1)
        if s.comfort_q2 is not None: comfort_fatigue.append(s.comfort_q2)
        if s.comfort_q3 is not None: comfort_headache.append(s.comfort_q3)
        if s.comfort_q4 is not None: comfort_remapped.append(s.comfort_q4)
        if s.comfort_q5 is not None: comfort_reading.append(s.comfort_q5)

        # Interview text logs
        p_uuid = db.query(models.ResearchParticipant.participant_uuid).filter(
            models.ResearchParticipant.id == s.participant_id
        ).scalar()
        if s.interview_open_feedback or s.interview_frustrating_aspects or s.interview_helpful_aspects:
            feedbacks.append({
                "participant_uuid": p_uuid[:8] if p_uuid else "unknown",
                "transitions_feedback": s.interview_visual_transitions,
                "wizard_feedback": s.interview_wizard_onboarding,
                "comfort_feedback": s.interview_naturalness,
                "frustrating": s.interview_frustrating_aspects,
                "helpful": s.interview_helpful_aspects,
                "general": s.interview_open_feedback
            })

    # Performance analytics
    all_sessions = db.query(models.VisionTestSession).all()
    task_times = {
        "task1_orig": [], "task1_corr": [], "task1_orig_acc": [], "task1_corr_acc": [],
        "task2_orig": [], "task2_corr": [], "task2_orig_acc": [], "task2_corr_acc": [],
        "task3_orig": [], "task3_corr": [], "task3_orig_acc": [], "task3_corr_acc": [],
        "video_orig": [], "video_corr": [], "video_orig_acc": [], "video_corr_acc": [],
        "doc_orig": [], "doc_corr": [], "doc_orig_acc": [], "doc_corr_acc": []
    }

    for ses in all_sessions:
        if ses.task1_original_time is not None: task_times["task1_orig"].append(ses.task1_original_time)
        if ses.task1_corrected_time is not None: task_times["task1_corr"].append(ses.task1_corrected_time)
        if ses.task1_original_correct is not None: task_times["task1_orig_acc"].append(1.0 if ses.task1_original_correct else 0.0)
        if ses.task1_corrected_correct is not None: task_times["task1_corr_acc"].append(1.0 if ses.task1_corrected_correct else 0.0)

        if ses.task2_original_time is not None: task_times["task2_orig"].append(ses.task2_original_time)
        if ses.task2_corrected_time is not None: task_times["task2_corr"].append(ses.task2_corrected_time)
        if ses.task2_original_correct is not None: task_times["task2_orig_acc"].append(1.0 if ses.task2_original_correct else 0.0)
        if ses.task2_corrected_correct is not None: task_times["task2_corr_acc"].append(1.0 if ses.task2_corrected_correct else 0.0)

        if ses.task3_original_time is not None: task_times["task3_orig"].append(ses.task3_original_time)
        if ses.task3_corrected_time is not None: task_times["task3_corr"].append(ses.task3_corrected_time)
        if ses.task3_original_correct is not None: task_times["task3_orig_acc"].append(1.0 if ses.task3_original_correct else 0.0)
        if ses.task3_corrected_correct is not None: task_times["task3_corr_acc"].append(1.0 if ses.task3_corrected_correct else 0.0)

        if ses.video_original_time is not None: task_times["video_orig"].append(ses.video_original_time)
        if ses.video_corrected_time is not None: task_times["video_corr"].append(ses.video_corrected_time)
        if ses.video_original_accuracy is not None: task_times["video_orig_acc"].append(ses.video_original_accuracy)
        if ses.video_corrected_accuracy is not None: task_times["video_corr_acc"].append(ses.video_corrected_accuracy)

        if ses.document_original_time is not None: task_times["doc_orig"].append(ses.document_original_time)
        if ses.document_corrected_time is not None: task_times["doc_corr"].append(ses.document_corrected_time)
        if ses.document_original_correct is not None: task_times["doc_orig_acc"].append(1.0 if ses.document_original_correct else 0.0)
        if ses.document_corrected_correct is not None: task_times["doc_corr_acc"].append(1.0 if ses.document_corrected_correct else 0.0)

        # Task 6 (Orchard Photo MCQ)
        if hasattr(ses, 'task6_original_time') and ses.task6_original_time is not None: 
            task_times.setdefault("task6_orig", []).append(ses.task6_original_time)
        if hasattr(ses, 'task6_corrected_time') and ses.task6_corrected_time is not None: 
            task_times.setdefault("task6_corr", []).append(ses.task6_corrected_time)
        if hasattr(ses, 'task6_original_correct') and ses.task6_original_correct is not None: 
            task_times.setdefault("task6_orig_acc", []).append(1.0 if ses.task6_original_correct else 0.0)
        if hasattr(ses, 'task6_corrected_correct') and ses.task6_corrected_correct is not None: 
            task_times.setdefault("task6_corr_acc", []).append(1.0 if ses.task6_corrected_correct else 0.0)

    # Compute Averages
    def get_avg(lst):
        return sum(lst) / len(lst) if lst else 0.0

    perf_report = {
        "task1": {
            "avg_original_time": get_avg(task_times["task1_orig"]),
            "avg_corrected_time": get_avg(task_times["task1_corr"]),
            "avg_original_accuracy": get_avg(task_times["task1_orig_acc"]),
            "avg_corrected_accuracy": get_avg(task_times["task1_corr_acc"])
        },
        "task2": {
            "avg_original_time": get_avg(task_times["task2_orig"]),
            "avg_corrected_time": get_avg(task_times["task2_corr"]),
            "avg_original_accuracy": get_avg(task_times["task2_orig_acc"]),
            "avg_corrected_accuracy": get_avg(task_times["task2_corr_acc"])
        },
        "task3": {
            "avg_original_time": get_avg(task_times["task3_orig"]),
            "avg_corrected_time": get_avg(task_times["task3_corr"]),
            "avg_original_accuracy": get_avg(task_times["task3_orig_acc"]),
            "avg_corrected_accuracy": get_avg(task_times["task3_corr_acc"])
        },
        "video": {
            "avg_original_time": get_avg(task_times["video_orig"]),
            "avg_corrected_time": get_avg(task_times["video_corr"]),
            "avg_original_accuracy": get_avg(task_times["video_orig_acc"]),
            "avg_corrected_accuracy": get_avg(task_times["video_corr_acc"])
        },
        "document": {
            "avg_original_time": get_avg(task_times["doc_orig"]),
            "avg_corrected_time": get_avg(task_times["doc_corr"]),
            "avg_original_accuracy": get_avg(task_times["doc_orig_acc"]),
            "avg_corrected_accuracy": get_avg(task_times["doc_corr_acc"])
        },
        "task6": {
            "avg_original_time": get_avg(task_times.get("task6_orig", [])),
            "avg_corrected_time": get_avg(task_times.get("task6_corr", [])),
            "avg_original_accuracy": get_avg(task_times.get("task6_orig_acc", [])),
            "avg_corrected_accuracy": get_avg(task_times.get("task6_corr_acc", []))
        }
    }

    # === Out of Survey / Platform Stats ===
    total_users = db.query(models.User).count()
    
    # Vision Profiles split
    profiles = db.query(models.VisionProfile).all()
    profile_splits = {}
    severity_sum = 0.0
    for p in profiles:
        profile_splits[p.cvd_type] = profile_splits.get(p.cvd_type, 0) + 1
        severity_sum += p.severity
    avg_severity = severity_sum / len(profiles) if profiles else 0.0
    
    # Media jobs
    total_jobs = db.query(models.MediaJob).count()
    completed_jobs = db.query(models.MediaJob).filter(models.MediaJob.status == "completed").count()
    media_type_splits_raw = db.query(
        models.MediaJob.media_type,
        func.count(models.MediaJob.id)
    ).group_by(models.MediaJob.media_type).all()
    media_type_splits = {m_type: count for m_type, count in media_type_splits_raw}
    
    # Compliance reports
    total_reports = db.query(models.ComplianceReport).count()
    avg_compliance_score = db.query(func.avg(models.ComplianceReport.score)).scalar() or 0.0
    pass_reports = db.query(models.ComplianceReport).filter(models.ComplianceReport.status == "pass").count()
    
    platform_stats = {
        "total_users": total_users,
        "total_vision_profiles": len(profiles),
        "avg_profile_severity": avg_severity,
        "vision_profile_types": profile_splits,
        "total_media_jobs": total_jobs,
        "completed_media_jobs": completed_jobs,
        "media_type_distributions": media_type_splits,
        "total_compliance_reports": total_reports,
        "avg_compliance_score": float(avg_compliance_score),
        "pass_compliance_reports": pass_reports,
    }

    return {
        "total_participants": total_count,
        "avg_sus_score": get_avg(sus_scores),
        "demographics": {
            "cvd_types": {cvd: count for cvd, count in cvd_splits},
            "genders": {gen: count for gen, count in gender_splits}
        },
        "task_performance": perf_report,
        "nasa_tlx": {
            "mental": get_avg(nasa_mental),
            "physical": get_avg(nasa_physical),
            "temporal": get_avg(nasa_temporal),
            "performance": get_avg(nasa_performance),
            "effort": get_avg(nasa_effort),
            "frustration": get_avg(nasa_frustration)
        },
        "visual_comfort": {
            "dry_eyes_comfort": get_avg(comfort_strain),
            "strain_fatigue": get_avg(comfort_fatigue),
            "headaches": get_avg(comfort_headache),
            "remapped_comfort": get_avg(comfort_remapped),
            "long_reading": get_avg(comfort_reading)
        },
        "interview_feedback": feedbacks, 
        "platform_stats": platform_stats
    }

@router.get("/participants", response_model=List[Dict[str, Any]])
def get_research_participants(
    current_admin: models.User = Depends(deps.get_current_admin_user),
    db: Session = Depends(deps.get_db)
):
    parts = db.query(models.ResearchParticipant).order_by(models.ResearchParticipant.created_at.desc()).all()
    res = []
    for p in parts:
        res.append({
            "uuid": p.participant_uuid,
            "age": p.age,
            "gender": p.gender,
            "occupation": p.occupation,
            "education_level": p.education_level,
            "cvd_type": p.cvd_type,
            "is_diagnosed": p.is_diagnosed,
            "prior_tool_use": p.prior_tool_use,
            "color_glasses_frequency": p.color_glasses_frequency,
            "web_app_comfort": p.web_app_comfort,
            "device_use_frequency": p.device_use_frequency,
            "selected_mode": p.selected_mode,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return res
