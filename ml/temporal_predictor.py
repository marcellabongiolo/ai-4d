"""AI 4D — lightweight temporal prediction prototype.

This module demonstrates a deterministic baseline for evolving signals.
It is intentionally dependency-free so the experiment can run anywhere.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Sequence


@dataclass
class Prediction:
    next_value: float
    trend: str
    confidence: float


def predict_next(values: Sequence[float], window: int = 4) -> Prediction:
    """Estimate the next point from recent deltas.

    This is a baseline, not a trained ML model. It provides a clean
    foundation for replacing the estimator with a learned temporal model.
    """
    if len(values) < 2:
        raise ValueError("At least two observations are required.")
    recent = list(values[-max(2, window):])
    deltas = [b - a for a, b in zip(recent, recent[1:])]
    avg_delta = sum(deltas) / len(deltas)
    next_value = recent[-1] + avg_delta

    if avg_delta > 1e-9:
        trend = "rising"
    elif avg_delta < -1e-9:
        trend = "falling"
    else:
        trend = "stable"

    volatility = sum(abs(d - avg_delta) for d in deltas) / len(deltas)
    confidence = max(0.0, min(1.0, 1.0 - volatility / (abs(recent[-1]) + 1.0)))

    return Prediction(next_value, trend, confidence)


if __name__ == "__main__":
    observations = [10.0, 11.2, 12.1, 13.5, 14.0]
    result = predict_next(observations)
    print(f"next_value={result.next_value:.2f}")
    print(f"trend={result.trend}")
    print(f"confidence={result.confidence:.2f}")
