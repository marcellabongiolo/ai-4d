"""Train a small, reproducible forecasting baseline for AI 4D."""
from __future__ import annotations
import argparse
from pathlib import Path
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

def load_signal(path: Path, column: str = "signal_a") -> np.ndarray:
    data = np.genfromtxt(path, delimiter=",", names=True, dtype=None, encoding="utf-8")
    if column not in data.dtype.names:
        raise ValueError(f"Column {column!r} was not found.")
    values = np.asarray(data[column], dtype=float)
    if len(values) < 8:
        raise ValueError("At least 8 observations are required.")
    return values

def make_windows(values: np.ndarray, lags: int) -> tuple[np.ndarray, np.ndarray]:
    if len(values) <= lags:
        raise ValueError("Not enough observations for the selected lag window.")
    X = np.array([values[i - lags:i] for i in range(lags, len(values))])
    return X, values[lags:]

def train(values: np.ndarray, lags: int = 3, test_ratio: float = 0.25) -> dict[str, float]:
    X, y = make_windows(values, lags)
    split = min(max(1, int(len(X) * (1 - test_ratio))), len(X) - 1)
    model = LinearRegression().fit(X[:split], y[:split])
    predictions = model.predict(X[split:])

    # Compare against a persistence baseline: predict the next value as the last observed value.
    naive_predictions = X[split:, -1]
    model_mae = mean_absolute_error(y[split:], predictions)
    naive_mae = mean_absolute_error(y[split:], naive_predictions)
    use_model = model_mae <= naive_mae
    selected_predictions = predictions if use_model else naive_predictions
    mae = mean_absolute_error(y[split:], selected_predictions)
    rmse = float(np.sqrt(mean_squared_error(y[split:], selected_predictions)))
    next_prediction = float(model.predict(values[-lags:].reshape(1, -1))[0]) if use_model else float(values[-1])
    return {"mae": float(mae), "rmse": rmse, "train_samples": float(split), "test_samples": float(len(y) - split), "next_prediction": next_prediction, "model": "linear-regression-lag" if use_model else "persistence-baseline"}

def main() -> None:
    parser = argparse.ArgumentParser(description="Train the AI 4D temporal baseline.")
    parser.add_argument("--data", default="data/sample_timeseries.csv")
    parser.add_argument("--column", default="signal_a")
    parser.add_argument("--lags", type=int, default=3)
    args = parser.parse_args()
    metrics = train(load_signal(Path(args.data), args.column), args.lags)
    print("AI 4D — trained temporal baseline")
    print(f"MAE: {metrics['mae']:.4f}")
    print(f"RMSE: {metrics['rmse']:.4f}")
    print(f"Train samples: {int(metrics['train_samples'])}")
    print(f"Test samples: {int(metrics['test_samples'])}")
    print(f"Next prediction: {metrics['next_prediction']:.4f}")
    print(f"Selected model: {metrics['model']}")

if __name__ == "__main__":
    main()
