import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.db.models import Base, User, ResearchParticipant, VisionTestSession, SurveyResponse

# Test Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_research.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup test tables
    Base.metadata.create_all(bind=engine)
    # Override database dependency for the duration of these tests
    app.dependency_overrides[get_db] = override_get_db
    yield
    # Clean up dependency overrides
    app.dependency_overrides.pop(get_db, None)
    # Drop test tables
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_research.db"):
        try:
            os.remove("./test_research.db")
        except:
            pass

def test_research_survey_and_telemetry_flow():
    # 1. Register a normal user and an admin user
    # Normal user
    reg_normal = client.post(
        "/api/v1/auth/register",
        json={"email": "normal_tester@example.com", "password": "password123"}
    )
    assert reg_normal.status_code == 200
    
    login_normal = client.post(
        "/api/v1/auth/login",
        data={"username": "normal_tester@example.com", "password": "password123"}
    )
    assert login_normal.status_code == 200
    token_normal = login_normal.json()["access_token"]
    headers_normal = {"Authorization": f"Bearer {token_normal}"}

    # Admin user (uses admin@chromashift.com as the email)
    reg_admin = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@chromashift.com", "password": "password123"}
    )
    assert reg_admin.status_code == 200
    
    login_admin = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@chromashift.com", "password": "password123"}
    )
    assert login_admin.status_code == 200
    token_admin = login_admin.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    # 2. Submit a valid research study session payload (demographics + timed tests + SUS/NASA-TLX surveys)
    research_payload = {
        "demographics": {
            "age": 28,
            "gender": "Male",
            "occupation": "Software Engineer",
            "education_level": "Bachelor's",
            "cvd_type": "deuteranopia",
            "is_diagnosed": "Yes",
            "prior_tool_use": "EnChroma",
            "color_glasses_frequency": "Never",
            "web_app_comfort": "Very Comf.",
            "device_use_frequency": ">30 hrs"
        },
        "performance": {
            "task1": {
                "original_time": 8.52,
                "original_correct": False,
                "corrected_time": 3.41,
                "corrected_correct": True
            },
            "task2": {
                "original_time": 12.45,
                "original_correct": True,
                "corrected_time": 4.12,
                "corrected_correct": True
            },
            "task3": {
                "original_time": 6.81,
                "original_correct": False,
                "corrected_time": 2.15,
                "corrected_correct": True
            },
            "video": {
                "original_time": 15.00,
                "original_clicks": 10,
                "original_accuracy": 0.40,
                "corrected_time": 15.00,
                "corrected_clicks": 18,
                "corrected_accuracy": 0.95
            },
            "document": {
                "original_time": 18.22,
                "original_correct": False,
                "corrected_time": 8.44,
                "corrected_correct": True
            }
        },
        "surveys": {
            # SUS Q1-10 (mixture of odds and evens)
            "sus_q1": 5, "sus_q2": 1, "sus_q3": 5, "sus_q4": 1, "sus_q5": 5,
            "sus_q6": 1, "sus_q7": 5, "sus_q8": 1, "sus_q9": 5, "sus_q10": 1,
            
            # NASA TLX
            "nasa_mental": 4,
            "nasa_physical": 2,
            "nasa_temporal": 5,
            "nasa_performance": 18,
            "nasa_effort": 6,
            "nasa_frustration": 3,
            
            # Comfort
            "comfort_q1": 5,
            "comfort_q2": 1,
            "comfort_q3": 1,
            "comfort_q4": 5,
            "comfort_q5": 4,
            
            # Qualitative
            "interview_visual_transitions": "Instant remapping without visual latency.",
            "interview_naturalness": "Correction was extremely vibrant and natural.",
            "interview_wizard_onboarding": "Perfect timing.",
            "interview_frustrating_aspects": "None.",
            "interview_helpful_aspects": "Real-time Daltonization for video was incredibly cool.",
            "interview_open_feedback": "Highly recommend the platform to anyone with CVD."
        }
    }

    submit_resp = client.post("/api/v1/research/submit", json=research_payload)
    assert submit_resp.status_code == 201
    submit_data = submit_resp.json()
    assert submit_data["status"] == "success"
    assert "participant_uuid" in submit_data

    # 3. Accessing analytics as a normal user should result in 403 Forbidden
    norm_analytics_resp = client.get("/api/v1/research/analytics", headers=headers_normal)
    assert norm_analytics_resp.status_code == 403
    assert norm_analytics_resp.json()["detail"] == "The user does not have enough privileges"

    # 4. Accessing participants as a normal user should result in 403 Forbidden
    norm_parts_resp = client.get("/api/v1/research/participants", headers=headers_normal)
    assert norm_parts_resp.status_code == 403

    # 5. Accessing analytics as an administrator should succeed and return calculated telemetry
    admin_analytics_resp = client.get("/api/v1/research/analytics", headers=headers_admin)
    assert admin_analytics_resp.status_code == 200
    analytics_data = admin_analytics_resp.json()
    
    assert analytics_data["total_participants"] == 1
    
    # Calculate SUS Score (all odds 5, evens 1 -> (4+4+4+4+4) * 2.5 = 100.0)
    assert analytics_data["avg_sus_score"] == 100.0
    
    # Check demographics
    assert analytics_data["demographics"]["cvd_types"]["deuteranopia"] == 1
    assert analytics_data["demographics"]["genders"]["Male"] == 1

    # Check task performance
    assert analytics_data["task_performance"]["task1"]["avg_original_time"] == 8.52
    assert analytics_data["task_performance"]["task1"]["avg_corrected_time"] == 3.41
    assert analytics_data["task_performance"]["task1"]["avg_original_accuracy"] == 0.0
    assert analytics_data["task_performance"]["task1"]["avg_corrected_accuracy"] == 1.0

    # Check NASA-TLX workload
    assert analytics_data["nasa_tlx"]["mental"] == 4.0
    assert analytics_data["nasa_tlx"]["frustration"] == 3.0

    # Check qualitative feedback notes
    assert len(analytics_data["interview_feedback"]) == 1
    assert analytics_data["interview_feedback"][0]["helpful"] == "Real-time Daltonization for video was incredibly cool."

    # 6. Accessing participants list as an admin should succeed
    admin_parts_resp = client.get("/api/v1/research/participants", headers=headers_admin)
    assert admin_parts_resp.status_code == 200
    parts_data = admin_parts_resp.json()
    assert len(parts_data) == 1
    assert parts_data[0]["cvd_type"] == "deuteranopia"
    assert parts_data[0]["age"] == 28
