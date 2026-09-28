"""AI 4D experimental inference, persistence, and authentication API."""
import json
from io import StringIO
import numpy as np
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sqlalchemy.orm import Session
from api.auth import create_access_token, hash_password, verify_password
from api.database import Base, engine, get_db
from api.models import AnalysisSession, User
from api.schemas import LoginRequest, RegisterRequest, SessionCreate, SessionResponse, TokenResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI 4D API", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

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
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user_id": user.id}

@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user_id": user.id}

@app.get("/sessions", response_model=list[SessionResponse])
def list_sessions(db: Session = Depends(get_db)):
    return db.query(AnalysisSession).order_by(AnalysisSession.created_at.desc()).limit(20).all()

@app.post("/sessions", response_model=SessionResponse, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_db)):
    session = AnalysisSession(signal=payload.signal, points=payload.points, current_value=payload.current_value,
        prediction=payload.prediction, trend=payload.trend, behavior=payload.behavior,
        anomalies=payload.anomalies, signals_json=json.dumps(payload.signals))
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@app.delete("/sessions", status_code=204)
def clear_sessions(db: Session = Depends(get_db)) -> None:
    db.query(AnalysisSession).delete()
    db.commit()

@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, object]:
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
        data = np.genfromtxt(StringIO(text), delimiter=",", names=True, dtype=None, encoding="utf-8")
        names = data.dtype.names or ()
        numeric_column = next((name for name in names[1:] if np.issubdtype(np.asarray(data[name]).dtype, np.number)), None)
        if numeric_column is None:
            raise ValueError("No numeric signal column found.")
        values = np.asarray(data[numeric_column], dtype=float)
        if len(values) < 8:
            raise ValueError("At least 8 observations are required.")
        candidates = [lag for lag in [1, 3, 5] if len(values) > lag + 2]
        if not candidates:
            raise ValueError("Not enough observations for model selection.")
        results = []
        for lags in candidates:
            X = np.array([values[i-lags:i] for i in range(lags, len(values))])
            y = values[lags:]
            split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
            model = LinearRegression().fit(X[:split], y[:split])
            predictions = model.predict(X[split:])
            naive = X[split:, -1]
            model_mae = mean_absolute_error(y[split:], predictions)
            naive_mae = mean_absolute_error(y[split:], naive)
            if model_mae <= naive_mae:
                results.append((model_mae, float(np.sqrt(mean_squared_error(y[split:], predictions))), "linear-regression-lag", lags))
            else:
                results.append((naive_mae, float(np.sqrt(mean_squared_error(y[split:], naive))), "persistence-baseline", lags))
        mae, rmse, selected_model, selected_lags = min(results, key=lambda item: (item[0], item[1]))
        X = np.array([values[i-selected_lags:i] for i in range(selected_lags, len(values))])
        y = values[selected_lags:]
        split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
        if selected_model == "linear-regression-lag":
            model = LinearRegression().fit(X[:split], y[:split])
            next_prediction = float(model.predict(values[-selected_lags:].reshape(1, -1))[0])
        else:
            next_prediction = float(values[-1])
        return {"signal": numeric_column, "current": float(values[-1]), "next_prediction": next_prediction,
                "mae": float(mae), "rmse": float(rmse), "train_samples": int(split),
                "test_samples": int(len(y) - split), "model": selected_model, "lags": int(selected_lags)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
