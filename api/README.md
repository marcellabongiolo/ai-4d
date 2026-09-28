# AI 4D Inference API

Experimental FastAPI service for temporal prediction, persistence, authentication, and private analysis history.

## Run locally

    pip install -r requirements.txt
    uvicorn api.main:app --reload

Health check: `GET /health`.
Interactive docs: `/docs`.

## Authentication

- `POST /auth/register` creates a user and returns a signed Bearer token.
- `POST /auth/login` verifies credentials and returns a signed Bearer token.
- Passwords are stored as hashes.
- Set `AI4D_SECRET_KEY` to a strong deployment secret.

## Private analysis history

The `/sessions` endpoints now require a Bearer token. Each analysis is stored with its `user_id`, and users can only list or delete their own analyses.

The current SQLite schema is suitable for development. A production migration strategy should be added before changing deployed databases.

This is an experimental portfolio API. The sample dataset is small and synthetic, so results should not be treated as production forecasts.
