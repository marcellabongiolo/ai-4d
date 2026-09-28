from uuid import uuid4
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_predict():
    csv = """timestamp,signal_a,signal_b
2026-01-01,10,5
2026-01-02,11,6
2026-01-03,12,7
2026-01-04,13,8
2026-01-05,14,9
2026-01-06,15,10
2026-01-07,16,11
2026-01-08,17,12
2026-01-09,18,13
2026-01-10,19,14
"""
    response = client.post("/predict", files={"file": ("sample.csv", csv.encode("utf-8"), "text/csv")})
    assert response.status_code == 200
    body = response.json()
    assert body["signal"] == "signal_a"
    assert "next_prediction" in body
    assert "mae" in body
    assert "rmse" in body

def test_register_and_login():
    email = f"test-{uuid4().hex}@example.com"
    password = "TestPassword123!"
    register = client.post("/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    body = register.json()
    assert body["token_type"] == "bearer"
    assert body["user_id"] > 0
    assert body["access_token"]

    duplicate = client.post("/auth/register", json={"email": email, "password": password})
    assert duplicate.status_code == 409

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    assert login.json()["access_token"]

    bad_login = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert bad_login.status_code == 401

def test_register_validates_email_and_password():
    short_password = client.post("/auth/register", json={"email": "valid@example.com", "password": "short"})
    assert short_password.status_code == 422
    invalid_email = client.post("/auth/register", json={"email": "not-an-email", "password": "long-enough"})
    assert invalid_email.status_code == 422
