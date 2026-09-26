"""AI 4D experimental inference API.

Receives a CSV time series and returns a trained temporal baseline prediction.
Run locally with: uvicorn api.main:app --reload
"""
from io import StringIO

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

app = FastAPI(title="AI 4D API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": "linear-regression-lag-baseline"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, object]:
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
        data = np.genfromtxt(StringIO(text), delimiter=",", names=True, dtype=None, encoding="utf-8")
        names = data.dtype.names or ()
        numeric_column = next(
            (name for name in names[1:] if np.issubdtype(np.asarray(data[name]).dtype, np.number)),
            None,
        )
        if numeric_column is None:
            raise ValueError("No numeric signal column found.")
        values = np.asarray(data[numeric_column], dtype=float)
        if len(values) < 8:
            raise ValueError("At least 8 observations are required.")
        lags = 3
        X = np.array([values[i-lags:i] for i in range(lags, len(values))])
        y = values[lags:]
        split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
        model = LinearRegression().fit(X[:split], y[:split])
        test_predictions = model.predict(X[split:])
        next_prediction = float(model.predict(values[-lags:].reshape(1, -1))[0])
        return {
            "signal": numeric_column,
            "current": float(values[-1]),
            "next_prediction": next_prediction,
            "mae": float(mean_absolute_error(y[split:], test_predictions)),
            "rmse": float(np.sqrt(mean_squared_error(y[split:], test_predictions))),
            "train_samples": int(split),
            "test_samples": int(len(y) - split),
            "model": "linear-regression-lag-baseline",
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
