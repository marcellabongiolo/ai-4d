# AI 4D Inference API

Experimental FastAPI service that exposes the trained temporal baseline through `POST /predict`.

## Run locally

    pip install -r requirements.txt
    uvicorn api.main:app --reload

Health check: `GET /health`.

The service accepts a CSV upload and returns the detected signal, current value, next prediction, MAE, RMSE, and train/test sample counts.

This is an experimental portfolio API. The sample dataset is small and synthetic, so results should not be treated as production forecasts.
