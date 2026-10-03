"""Evaluate the AI 4D temporal model on a held-out time-series segment."""
from __future__ import annotations
import argparse
from pathlib import Path
from train import load_signal, make_windows
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
import numpy as np

def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the AI 4D temporal model.")
    parser.add_argument("--data", default="data/sample_timeseries.csv")
    parser.add_argument("--column", default="signal_a")
    parser.add_argument("--lags", type=int, default=3)
    args = parser.parse_args()
    values = load_signal(Path(args.data), args.column)
    X, y = make_windows(values, args.lags)
    # Rolling-origin evaluation: each fold only sees observations before its test point.
    folds = min(5, max(1, len(y) - 5))
    errors = []
    for end in range(max(args.lags + 2, len(y) - folds), len(y)):
        model = LinearRegression().fit(X[:end], y[:end])
        pred = float(model.predict(X[end:end + 1])[0])
        errors.append(y[end] - pred)
    mae = float(np.mean(np.abs(errors))) if errors else float("nan")
    rmse = float(np.sqrt(np.mean(np.square(errors)))) if errors else float("nan")
    print("AI 4D — rolling evaluation")
    print(f"Folds={len(errors)}")
    print(f"MAE={mae:.4f}")
    print(f"RMSE={rmse:.4f}")

if __name__ == "__main__":
    main()
