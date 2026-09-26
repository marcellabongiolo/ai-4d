# Temporal Intelligence Prototype

This folder contains the first computational layer of AI 4D.

The current implementation is deliberately simple: it estimates the next value of a sequence from recent temporal deltas. The purpose is architectural — establish an interface that can later be replaced by a trained model.

## Run

```bash
python ml/temporal_predictor.py
```

## Evolution path

1. Baseline temporal estimator
2. Real time-series dataset
3. Feature engineering
4. Trained forecasting model
5. Evaluation metrics
6. API integration with the web interface
