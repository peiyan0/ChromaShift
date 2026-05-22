import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import get_db
from app.db.models import Base

# Test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: create clean tables and local database overrides
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    # Teardown: clear overrides and drop tables
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)

def test_register_user():
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "test@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

def test_login_user():
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={"email": "login@example.com", "password": "password123"}
    )
    
    # Then login (Form data required for OAuth2PasswordRequestForm)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "login@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_guest_login():
    response = client.post("/api/v1/auth/guest")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_guest_promotion():
    # 1. Login as guest
    guest_resp = client.post("/api/v1/auth/guest")
    assert guest_resp.status_code == 200
    guest_token = guest_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {guest_token}"}
    
    # 2. Promote guest to permanent email/password
    promote_payload = {"email": "promoted@example.com", "password": "newpassword123"}
    promote_resp = client.post("/api/v1/auth/promote", json=promote_payload, headers=headers)
    assert promote_resp.status_code == 200
    promote_data = promote_resp.json()
    assert promote_data["email"] == "promoted@example.com"
    
    # 3. Verify they can now log in using standard credentials
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "promoted@example.com", "password": "newpassword123"}
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()

def test_non_guest_promotion_fails():
    # 1. Register regular user
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": "regular@example.com", "password": "password123"}
    )
    assert reg_resp.status_code == 200
    
    # 2. Login to get token
    login_resp = client.post(
        "/api/v1/auth/login",
        data={"username": "regular@example.com", "password": "password123"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Try to promote a regular user -> should fail 400
    promote_payload = {"email": "another@example.com", "password": "newpassword"}
    promote_resp = client.post("/api/v1/auth/promote", json=promote_payload, headers=headers)
    assert promote_resp.status_code == 400
    assert "Only guest accounts can be promoted." in promote_resp.json()["detail"]

def test_guest_promotion_duplicate_email_fails():
    # 1. Register a regular user to occupy the email
    client.post(
        "/api/v1/auth/register",
        json={"email": "occupied@example.com", "password": "password123"}
    )
    
    # 2. Login as guest
    guest_resp = client.post("/api/v1/auth/guest")
    guest_token = guest_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {guest_token}"}
    
    # 3. Try to promote guest to the occupied email -> should fail 400
    promote_payload = {"email": "occupied@example.com", "password": "newpassword"}
    promote_resp = client.post("/api/v1/auth/promote", json=promote_payload, headers=headers)
    assert promote_resp.status_code == 400
    assert "The user with this email already exists" in promote_resp.json()["detail"]

def test_guest_cleanup():
    from datetime import datetime, timedelta, timezone
    from app.db import models
    
    # 1. Login as guest to create a guest account
    guest_resp = client.post("/api/v1/auth/guest")
    assert guest_resp.status_code == 200
    
    # 2. Access testing database and set created_at to 48 hours ago
    db = next(override_get_db())
    guest_user = db.query(models.User).filter(
        models.User.email.like("%@chromashift.guest")
    ).first()
    assert guest_user is not None
    
    guest_user.created_at = datetime.now(timezone.utc) - timedelta(hours=48)
    db.add(guest_user)
    db.commit()
    
    # 3. Trigger cleanup for users older than 24 hours
    cleanup_resp = client.post("/api/v1/auth/cleanup?max_age_hours=24")
    assert cleanup_resp.status_code == 200
    assert cleanup_resp.json()["cleaned_count"] == 1
    
    # 4. Verify user is deleted
    db_new = next(override_get_db())
    deleted_user = db_new.query(models.User).filter(
        models.User.email.like("%@chromashift.guest")
    ).first()
    assert deleted_user is None



