import pytest
import os
import cv2
import numpy as np
import tempfile
import shutil
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.db.models import Base, User, MediaJob, VisionProfile, ComplianceReport
from app.services.compliance_analyzer import (
    calculate_relative_luminance,
    analyze_image_contrast,
    analyze_media_compliance,
    generate_suggestions
)

# Test Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_compliance.db"
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

# Use TestClient
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
    if os.path.exists("./test_compliance.db"):
        try:
            os.remove("./test_compliance.db")
        except:
            pass

@pytest.fixture
def temp_dir():
    path = tempfile.mkdtemp(prefix="test_compliance_")
    yield path
    if os.path.exists(path):
        shutil.rmtree(path)

# 1. Test Core Math Functions
def test_calculate_relative_luminance():
    # White image should have max relative luminance of 1.0
    white = np.ones((10, 10, 3), dtype=np.uint8) * 255
    lum_white = calculate_relative_luminance(white)
    assert np.allclose(lum_white, 1.0, atol=0.01)
    
    # Black image should have relative luminance of 0.0
    black = np.zeros((10, 10, 3), dtype=np.uint8)
    lum_black = calculate_relative_luminance(black)
    assert np.allclose(lum_black, 0.0, atol=0.01)
    
    # Pure red, green, blue luminances
    red = np.zeros((1, 1, 3), dtype=np.uint8)
    red[0, 0, 2] = 255 # BGR -> Red is index 2
    lum_red = calculate_relative_luminance(red)[0, 0]
    # WCAG sRGB luminance weight for red is ~0.2126
    assert abs(lum_red - 0.2126) < 0.01

def test_analyze_image_contrast():
    # 1. High contrast image (white box in black background)
    high_contrast = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(high_contrast, (20, 20), (80, 80), (255, 255, 255), -1) # White block
    
    score, crit, warn, sampled = analyze_image_contrast(high_contrast)
    assert score > 90.0
    assert crit == 0
    
    # 2. Low contrast image (low-contrast grey block that still exceeds Canny's 50 threshold)
    low_contrast = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.rectangle(low_contrast, (20, 20), (80, 80), (60, 60, 60), -1) # Sharp but low-contrast block
    
    score_low, crit_low, warn_low, sampled_low = analyze_image_contrast(low_contrast)
    assert score_low < 90.0
    assert crit_low > 0

def test_generate_suggestions():
    # Test error suggestions for each CVD type
    protan_sug = generate_suggestions("protanopia", 10, 5)
    assert any("Protanopia" in s["suggestion"] for s in protan_sug)
    
    deuter_sug = generate_suggestions("deuteranopia", 10, 5)
    assert any("Deuteranopia" in s["suggestion"] for s in deuter_sug)
    
    tritan_sug = generate_suggestions("tritanopia", 10, 5)
    assert any("Tritanopia" in s["suggestion"] for s in tritan_sug)

# 2. Test Router Endpoint Integrations
@patch("app.services.storage.storage_service.download_file")
def test_compliance_endpoints(mock_download, temp_dir):
    # Setup mock file generation on download
    def fake_download(s3_key, local_path):
        # Create a simple high-contrast test image
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        cv2.rectangle(img, (20, 20), (80, 80), (255, 255, 255), -1)
        cv2.imwrite(local_path, img)
        return local_path
    
    mock_download.side_effect = fake_download
    
    # 1. Register and login user via API to ensure proper hashed password creation
    reg_resp = client.post("/api/v1/auth/register", json={"email": "tester@example.com", "password": "password123"})
    assert reg_resp.status_code == 200
    
    login_resp = client.post("/api/v1/auth/login", data={"username": "tester@example.com", "password": "password123"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Insert mock job and vision profile directly in test DB matching user ID
    db = TestingSessionLocal()
    db_user = db.query(User).filter(User.email == "tester@example.com").first()
    assert db_user is not None
    
    profile = VisionProfile(user_id=db_user.id, cvd_type="protanopia", severity=1.0)
    db.add(profile)
    
    job = MediaJob(
        job_id="test-job-uuid",
        user_id=db_user.id,
        filename="test.jpg",
        media_type="image",
        status="completed",
        s3_key_original="uploads/test.jpg",
        s3_key_processed="processed/test_processed.jpg"
    )
    db.add(job)
    db.commit()
    db.close()
    
    # 3. Call compliance check
    resp = client.post("/api/v1/compliance/test-job-uuid/check", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == "test-job-uuid"
    assert "score" in data
    assert "status" in data
    assert "issues" in data
    
    # 4. Call get compliance report
    resp_report = client.get("/api/v1/compliance/test-job-uuid/report", headers=headers)
    assert resp_report.status_code == 200
    data_report = resp_report.json()
    assert data_report["job_id"] == "test-job-uuid"
    assert data_report["score"] == data["score"]
    assert data_report["status"] == data["status"]
