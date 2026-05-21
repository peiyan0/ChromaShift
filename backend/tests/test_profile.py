import pytest
import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.db.models import Base, User, VisionProfile

# Test Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_profile.db"
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
    if os.path.exists("./test_profile.db"):
        try:
            os.remove("./test_profile.db")
        except:
            pass

def test_profile_lifecycle():
    # 1. Register and login a user to get auth headers
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": "profile_tester@example.com", "password": "password123"}
    )
    assert reg_resp.status_code == 200
    
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "profile_tester@example.com", "password": "password123"}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get profile before it is created -> should be 404
    get_resp = client.get("/api/v1/profile/", headers=headers)
    assert get_resp.status_code == 404
    assert get_resp.json()["detail"] == "Vision profile not found"
    
    # 3. Create a vision profile -> should be 200
    profile_payload = {
        "cvd_type": "deuteranopia",
        "severity": 0.8,
        "contrast_multiplier": 1.1,
        "saturation_multiplier": 1.2,
        "intensity": 0.9
    }
    create_resp = client.post("/api/v1/profile/", json=profile_payload, headers=headers)
    assert create_resp.status_code == 200
    created_data = create_resp.json()
    assert created_data["cvd_type"] == "deuteranopia"
    assert created_data["severity"] == 0.8
    assert created_data["contrast_multiplier"] == 1.1
    assert created_data["saturation_multiplier"] == 1.2
    assert created_data["intensity"] == 0.9
    assert "id" in created_data
    assert "user_id" in created_data
    
    # 4. Attempting to create again should conflict -> 409
    create_dup_resp = client.post("/api/v1/profile/", json=profile_payload, headers=headers)
    assert create_dup_resp.status_code == 409
    assert "already has a vision profile" in create_dup_resp.json()["detail"]
    
    # 5. Fetch profile now -> should succeed
    get_success_resp = client.get("/api/v1/profile/", headers=headers)
    assert get_success_resp.status_code == 200
    get_data = get_success_resp.json()
    assert get_data["id"] == created_data["id"]
    assert get_data["cvd_type"] == "deuteranopia"
    
    # 6. Update profile with new coefficients -> should succeed
    update_payload = {
        "cvd_type": "protanopia",
        "severity": 1.2,
        "contrast_multiplier": 1.3,
        "saturation_multiplier": 1.0,
        "intensity": 1.0
    }
    update_resp = client.put("/api/v1/profile/", json=update_payload, headers=headers)
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["cvd_type"] == "protanopia"
    assert updated_data["severity"] == 1.2
    assert updated_data["contrast_multiplier"] == 1.3
    
    # 7. Fetch again to verify updates persisted
    get_updated_resp = client.get("/api/v1/profile/", headers=headers)
    assert get_updated_resp.status_code == 200
    final_data = get_updated_resp.json()
    assert final_data["cvd_type"] == "protanopia"
    assert final_data["severity"] == 1.2
