"""AI 4D experimental inference, persistence, and authentication API."""
import json
import os
from io import StringIO
import numpy as np
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sqlalchemy.orm import Session
from api.auth import create_access_token, get_current_user, hash_password, verify_password
from api.database import Base, engine, get_db
from api.models import AnalysisSession, Dataset, Project, User
from api.schemas import DatasetCreate, DatasetResponse, LoginRequest, ProjectCreate, ProjectResponse, RegisterRequest, SessionCreate, SessionResponse, TokenResponse

if os.getenv("AI4D_ENV", "development").lower() != "production":
    Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI 4D API", version="0.6.0")
_default_origins = "http://localhost:8000,http://127.0.0.1:8000,https://marcellabongiolo.github.io"
CORS_ORIGINS = [origin.strip() for origin in os.getenv("AI4D_CORS_ORIGINS", _default_origins).split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root() -> dict[str, str]:
    return {"name": "AI 4D API", "status": "online", "docs": "/docs"}

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": "linear-regression-lag-baseline"}

@app.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered.")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user_id": user.id}

@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user_id": user.id}

@app.get("/projects", response_model=list[ProjectResponse])
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Project).filter(Project.user_id == current_user.id).order_by(Project.created_at.asc()).all()

@app.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Project name cannot be empty.")
    project = Project(user_id=current_user.id, name=name)
    db.add(project); db.commit(); db.refresh(project)
    return project

@app.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    db.query(AnalysisSession).filter(AnalysisSession.project_id == project.id, AnalysisSession.user_id == current_user.id).update({AnalysisSession.project_id: None})
    db.query(AnalysisSession).filter(AnalysisSession.dataset_id.in_(db.query(Dataset.id).filter(Dataset.project_id == project.id, Dataset.user_id == current_user.id))).update({AnalysisSession.dataset_id: None}, synchronize_session=False)
    db.query(Dataset).filter(Dataset.project_id == project.id, Dataset.user_id == current_user.id).delete()
    db.delete(project); db.commit()

@app.get("/datasets", response_model=list[DatasetResponse])
def list_datasets(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first() is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return db.query(Dataset).filter(Dataset.project_id == project_id, Dataset.user_id == current_user.id).order_by(Dataset.created_at.desc()).all()

@app.post("/datasets", response_model=DatasetResponse, status_code=201)
def create_dataset(payload: DatasetCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == payload.project_id, Project.user_id == current_user.id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Dataset name cannot be empty.")
    dataset = Dataset(user_id=current_user.id, project_id=project.id, name=name, content=payload.content,
                      signal_count=payload.signal_count, point_count=payload.point_count)
    db.add(dataset); db.commit(); db.refresh(dataset)
    return dataset

@app.get("/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return dataset

@app.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.user_id == current_user.id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    db.query(AnalysisSession).filter(AnalysisSession.dataset_id == dataset.id, AnalysisSession.user_id == current_user.id).update({AnalysisSession.dataset_id: None}, synchronize_session=False)
    db.delete(dataset); db.commit()

@app.get("/sessions", response_model=list[SessionResponse])
def list_sessions(project_id: int | None = None, dataset_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(AnalysisSession).filter(AnalysisSession.user_id == current_user.id)
    if project_id is not None:
        query = query.filter(AnalysisSession.project_id == project_id)
    if dataset_id is not None:
        query = query.filter(AnalysisSession.dataset_id == dataset_id)
    return query.order_by(AnalysisSession.created_at.desc()).limit(20).all()

@app.post("/sessions", response_model=SessionResponse, status_code=201)
def create_session(payload: SessionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.project_id is not None and db.query(Project).filter(Project.id == payload.project_id, Project.user_id == current_user.id).first() is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    if payload.dataset_id is not None:
        dataset = db.query(Dataset).filter(Dataset.id == payload.dataset_id, Dataset.user_id == current_user.id).first()
        if dataset is None:
            raise HTTPException(status_code=404, detail="Dataset not found.")
        if payload.project_id is not None and dataset.project_id != payload.project_id:
            raise HTTPException(status_code=422, detail="Dataset does not belong to the selected project.")
    session = AnalysisSession(user_id=current_user.id, project_id=payload.project_id, dataset_id=payload.dataset_id, signal=payload.signal, points=payload.points, current_value=payload.current_value,
        prediction=payload.prediction, trend=payload.trend, behavior=payload.behavior,
        anomalies=payload.anomalies, signals_json=json.dumps(payload.signals), dataset_text=payload.dataset_text)
    db.add(session); db.commit(); db.refresh(session)
    return session

@app.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id, AnalysisSession.user_id == current_user.id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return session

@app.delete("/sessions", status_code=204)
def clear_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    db.query(AnalysisSession).filter(AnalysisSession.user_id == current_user.id).delete()
    db.commit()

@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, object]:
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
        data = np.genfromtxt(StringIO(text), delimiter=",", names=True, dtype=None, encoding="utf-8")
        names = data.dtype.names or ()
        numeric_column = next((name for name in names[1:] if np.issubdtype(np.asarray(data[name]).dtype, np.number)), None)
        if numeric_column is None: raise ValueError("No numeric signal column found.")
        values = np.asarray(data[numeric_column], dtype=float)
        if len(values) < 8: raise ValueError("At least 8 observations are required.")
        candidates = [lag for lag in [1, 3, 5] if len(values) > lag + 2]
        if not candidates: raise ValueError("Not enough observations for model selection.")
        results = []
        for lags in candidates:
            X = np.array([values[i-lags:i] for i in range(lags, len(values))]); y = values[lags:]
            split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
            model = LinearRegression().fit(X[:split], y[:split]); predictions = model.predict(X[split:]); naive = X[split:, -1]
            model_mae = mean_absolute_error(y[split:], predictions); naive_mae = mean_absolute_error(y[split:], naive)
            if model_mae <= naive_mae: results.append((model_mae, float(np.sqrt(mean_squared_error(y[split:], predictions))), "linear-regression-lag", lags))
            else: results.append((naive_mae, float(np.sqrt(mean_squared_error(y[split:], naive))), "persistence-baseline", lags))
        mae, rmse, selected_model, selected_lags = min(results, key=lambda item: (item[0], item[1]))
        X = np.array([values[i-selected_lags:i] for i in range(selected_lags, len(values))]); y = values[selected_lags:]
        split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
        next_prediction = float(LinearRegression().fit(X[:split], y[:split]).predict(values[-selected_lags:].reshape(1, -1))[0]) if selected_model == "linear-regression-lag" else float(values[-1])
        return {"signal": numeric_column, "current": float(values[-1]), "next_prediction": next_prediction, "mae": float(mae), "rmse": float(rmse), "train_samples": int(split), "test_samples": int(len(y) - split), "model": selected_model, "lags": int(selected_lags)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
