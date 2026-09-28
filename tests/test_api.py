from uuid import uuid4
from fastapi.testclient import TestClient
from api.main import app
client = TestClient(app)

def make_user():
    email=f"user-{uuid4().hex}@example.com"; password="TestPassword123!"
    r=client.post("/auth/register",json={"email":email,"password":password})
    assert r.status_code==201
    return email,password,r.json()["access_token"]

def test_health():
    r=client.get("/health"); assert r.status_code==200; assert r.json()["status"]=="ok"

def test_predict():
    csv="""timestamp,signal_a,signal_b
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
    r=client.post("/predict",files={"file":("sample.csv",csv.encode(),"text/csv")})
    assert r.status_code==200
    body=r.json()
    assert body["signal"]=="signal_a"
    assert "next_prediction" in body and "mae" in body and "rmse" in body

def test_register_and_login():
    email,password,_=make_user()
    assert client.post("/auth/register",json={"email":email,"password":password}).status_code==409
    r=client.post("/auth/login",json={"email":email,"password":password})
    assert r.status_code==200 and r.json()["access_token"]
    assert client.post("/auth/login",json={"email":email,"password":"wrong-password"}).status_code==401

def test_private_sessions_require_auth():
    assert client.get("/sessions").status_code==401
    assert client.delete("/sessions").status_code==401

def test_sessions_are_user_scoped():
    _,_,token1=make_user()
    _,_,token2=make_user()
    payload={"signal":"signal_a","points":10,"current_value":19,"prediction":20,"trend":"Subindo","behavior":"Estável","anomalies":0,"signals":["signal_a"]}
    r=client.post("/sessions",json=payload,headers={"Authorization":f"Bearer {token1}"})
    assert r.status_code==201
    assert len(client.get("/sessions",headers={"Authorization":f"Bearer {token1}"}).json())>=1
    assert client.get("/sessions",headers={"Authorization":f"Bearer {token2}"}).json()==[]
    assert client.delete("/sessions",headers={"Authorization":f"Bearer {token1}"}).status_code==204
    assert client.get("/sessions",headers={"Authorization":f"Bearer {token1}"}).json()==[]

def test_register_validates_email_and_password():
    assert client.post("/auth/register",json={"email":"valid@example.com","password":"short"}).status_code==422
    assert client.post("/auth/register",json={"email":"not-an-email","password":"long-enough"}).status_code==422


def test_projects_are_private_and_sessions_can_be_attached():
    _,_,token1=make_user()
    _,_,token2=make_user()
    h1={"Authorization":f"Bearer {token1}"}
    h2={"Authorization":f"Bearer {token2}"}

    assert client.get("/projects").status_code==401

    created=client.post("/projects",json={"name":"Projeto principal"},headers=h1)
    assert created.status_code==201
    project=created.json()
    assert project["name"]=="Projeto principal"

    assert client.get("/projects",headers=h1).json()[0]["id"]==project["id"]
    assert client.get("/projects",headers=h2).json()==[]

    payload={"project_id":project["id"],"signal":"signal_a","points":10,"current_value":19,
             "prediction":20,"trend":"Subindo","behavior":"Estável","anomalies":0,
             "signals":["signal_a"]}
    attached=client.post("/sessions",json=payload,headers=h1)
    assert attached.status_code==201
    assert attached.json()["project_id"]==project["id"]

    assert client.get(f"/sessions?project_id={project['id']}",headers=h1).status_code==200
    assert client.get(f"/sessions?project_id={project['id']}",headers=h2).json()==[]
    assert client.post("/sessions",json=payload,headers=h2).status_code==404
    assert client.delete(f"/projects/{project['id']}",headers=h2).status_code==404

    assert client.delete(f"/projects/{project['id']}",headers=h1).status_code==204
    assert client.get(f"/sessions?project_id={project['id']}",headers=h1).json()==[]
    assert client.get("/sessions",headers=h1).json()[0]["project_id"] is None
