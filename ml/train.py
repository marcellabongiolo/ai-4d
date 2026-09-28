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
    candidates = sorted({1, 3, 5, lags})
    results = []
    for candidate_lags in candidates:
        if len(values) <= candidate_lags + 2:
            continue
        X, y = make_windows(values, candidate_lags)
        split = min(max(1, int(len(X) * (1 - test_ratio))), len(X) - 1)
        model = LinearRegression().fit(X[:split], y[:split])
        predictions = model.predict(X[split:])
        model_mae = mean_absolute_error(y[split:], predictions)
        naive_predictions = X[split:, -1]
        naive_mae = mean_absolute_error(y[split:], naive_predictions)
        if model_mae <= naive_mae:
            results.append((model_mae, float(np.sqrt(mean_squared_error(y[split:], predictions))), "linear-regression-lag", candidate_lags))
        else:
            results.append((naive_mae, float(np.sqrt(mean_squared_error(y[split:], naive_predictions))), "persistence-baseline", candidate_lags))
    if not results:
        raise ValueError("Not enough observations for model selection.")
    mae, rmse, model_name, selected_lags = min(results, key=lambda item: (item[0], item[1]))
    X, y = make_windows(values, selected_lags)
    split = min(max(1, int(len(X) * (1 - test_ratio))), len(X) - 1)
    if model_name == "linear-regression-lag":
        model = LinearRegression().fit(X[:split], y[:split])
        next_prediction = float(model.predict(values[-selected_lags:].reshape(1, -1))[0])
    else:
        next_prediction = float(values[-1])
    return {"mae": float(mae), "rmse": float(rmse), "train_samples": float(split), "test_samples": float(len(y) - split), "next_prediction": next_prediction, "model": model_name, "lags": float(selected_lags)}

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
