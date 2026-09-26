"""Evaluate the AI 4D temporal model on a held-out time-series segment."""
from __future__ import annotations
import argparse
from pathlib import Path
from train import load_signal, train

def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the AI 4D temporal model.")
    parser.add_argument("--data", default="data/sample_timeseries.csv")
    parser.add_argument("--column", default="signal_a")
    parser.add_argument("--lags", type=int, default=3)
    args = parser.parse_args()
    metrics = train(load_signal(Path(args.data), args.column), args.lags)
    print("AI 4D — evaluation")
    print(f"MAE={metrics['mae']:.4f}")
    print(f"RMSE={metrics['rmse']:.4f}")

if __name__ == "__main__":
    main()
