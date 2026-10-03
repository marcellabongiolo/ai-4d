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
    payload={"signal":"signal_a","points":10,"current_value":19,"prediction":20,"trend":"Subindo","behavior":"Estável","anomalies":0,"signals":["signal_a"],"dataset_text":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12"}
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


def test_session_can_be_reopened_with_dataset():
    _,_,token=make_user()
    headers={"Authorization":f"Bearer {token}"}
    payload={"signal":"signal_a","points":3,"current_value":12,"prediction":13,
             "trend":"Subindo","behavior":"Estável","anomalies":0,
             "signals":["signal_a"],
             "dataset_text":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12"}
    created=client.post("/sessions",json=payload,headers=headers)
    assert created.status_code==201
    session_id=created.json()["id"]
    reopened=client.get(f"/sessions/{session_id}",headers=headers)
    assert reopened.status_code==200
    assert reopened.json()["dataset_text"]==payload["dataset_text"]

def test_session_reopen_is_private():
    _,_,token1=make_user()
    _,_,token2=make_user()
    payload={"signal":"signal_a","points":3,"current_value":12,"prediction":13,
             "trend":"Subindo","behavior":"Estável","anomalies":0,
             "signals":["signal_a"],"dataset_text":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12"}
    created=client.post("/sessions",json=payload,headers={"Authorization":f"Bearer {token1}"})
    session_id=created.json()["id"]
    assert client.get(f"/sessions/{session_id}",headers={"Authorization":f"Bearer {token2}"}).status_code==404


def test_datasets_are_private_and_project_scoped():
    _,_,token1=make_user()
    _,_,token2=make_user()
    h1={"Authorization":f"Bearer {token1}"}
    h2={"Authorization":f"Bearer {token2}"}

    project=client.post("/projects",json={"name":"Dataset project"},headers=h1).json()
    payload={
        "project_id":project["id"],
        "name":"sensor-data",
        "content":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12",
        "signal_count":1,
        "point_count":3
    }
    created=client.post("/datasets",json=payload,headers=h1)
    assert created.status_code==201
    dataset=created.json()
    assert dataset["name"]=="sensor-data"
    assert client.get(f"/datasets?project_id={project['id']}",headers=h1).json()[0]["id"]==dataset["id"]
    assert client.get(f"/datasets?project_id={project['id']}",headers=h2).status_code==404
    assert client.get(f"/datasets/{dataset['id']}",headers=h2).status_code==404
    assert client.delete(f"/datasets/{dataset['id']}",headers=h2).status_code==404
    assert client.delete(f"/datasets/{dataset['id']}",headers=h1).status_code==204
    assert client.get(f"/datasets?project_id={project['id']}",headers=h1).json()==[]


def test_deleting_project_removes_datasets():
    _,_,token=make_user()
    headers={"Authorization":f"Bearer {token}"}
    project=client.post("/projects",json={"name":"Delete project"},headers=headers).json()
    payload={
        "project_id":project["id"],
        "name":"temporary",
        "content":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12",
        "signal_count":1,
        "point_count":3
    }
    created=client.post("/datasets",json=payload,headers=headers)
    assert created.status_code==201
    dataset_id=created.json()["id"]
    assert client.delete(f"/projects/{project['id']}",headers=headers).status_code==204
    assert client.get(f"/datasets/{dataset_id}",headers=headers).status_code==404


def test_sessions_can_be_linked_to_owned_datasets():
    _,_,token=make_user()
    headers={"Authorization":f"Bearer {token}"}
    project=client.post("/projects",json={"name":"Linked project"},headers=headers).json()
    dataset=client.post("/datasets",json={
        "project_id":project["id"],
        "name":"linked-data",
        "content":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12",
        "signal_count":1,
        "point_count":3
    },headers=headers).json()
    payload={"project_id":project["id"],"dataset_id":dataset["id"],"signal":"signal_a","points":3,
             "current_value":12,"prediction":13,"trend":"Subindo","behavior":"Estável","anomalies":0,
             "signals":["signal_a"],"dataset_text":dataset["content"]}
    created=client.post("/sessions",json=payload,headers=headers)
    assert created.status_code==201
    assert created.json()["dataset_id"]==dataset["id"]
    assert client.get(f"/sessions?dataset_id={dataset['id']}",headers=headers).json()[0]["dataset_id"]==dataset["id"]

def test_session_cannot_attach_dataset_from_another_project():
    _,_,token=make_user()
    headers={"Authorization":f"Bearer {token}"}
    project1=client.post("/projects",json={"name":"Project A"},headers=headers).json()
    project2=client.post("/projects",json={"name":"Project B"},headers=headers).json()
    dataset=client.post("/datasets",json={
        "project_id":project2["id"],
        "name":"other-project-data",
        "content":"timestamp,signal_a\n2026-01-01,10\n2026-01-02,11\n2026-01-03,12",
        "signal_count":1,
        "point_count":3
    },headers=headers).json()
    payload={"project_id":project1["id"],"dataset_id":dataset["id"],"signal":"signal_a","points":3,
             "current_value":12,"prediction":13,"trend":"Subindo","behavior":"Estável","anomalies":0,
             "signals":["signal_a"]}
    assert client.post("/sessions",json=payload,headers=headers).status_code==422
