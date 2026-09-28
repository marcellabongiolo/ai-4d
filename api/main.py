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
        candidates = [1, 3, 5]
        candidates = [lag for lag in candidates if len(values) > lag + 2]
        if not candidates:
            raise ValueError("Not enough observations for model selection.")

        results = []
        for lags in candidates:
            X = np.array([values[i-lags:i] for i in range(lags, len(values))])
            y = values[lags:]
            split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
            model = LinearRegression().fit(X[:split], y[:split])
            test_predictions = model.predict(X[split:])
            naive_predictions = X[split:, -1]
            model_mae = mean_absolute_error(y[split:], test_predictions)
            naive_mae = mean_absolute_error(y[split:], naive_predictions)
            if model_mae <= naive_mae:
                results.append((model_mae, float(np.sqrt(mean_squared_error(y[split:], test_predictions))), "linear-regression-lag", lags))
            else:
                results.append((naive_mae, float(np.sqrt(mean_squared_error(y[split:], naive_predictions))), "persistence-baseline", lags))

        mae, rmse, selected_model, selected_lags = min(results, key=lambda item: (item[0], item[1]))
        X = np.array([values[i-selected_lags:i] for i in range(selected_lags, len(values))])
        y = values[selected_lags:]
        split = min(max(1, int(len(X) * 0.75)), len(X) - 1)
        if selected_model == "linear-regression-lag":
            model = LinearRegression().fit(X[:split], y[:split])
            next_prediction = float(model.predict(values[-selected_lags:].reshape(1, -1))[0])
        else:
            next_prediction = float(values[-1])
        return {
            "signal": numeric_column,
            "current": float(values[-1]),
            "next_prediction": next_prediction,
            "mae": float(mae),
            "rmse": float(rmse),
            "train_samples": int(split),
            "test_samples": int(len(y) - split),
            "model": selected_model,
            "lags": int(selected_lags),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
