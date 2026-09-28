# AI 4D Inference API

Experimental FastAPI service for temporal prediction, persistence, and authentication.

## Run locally

    pip install -r requirements.txt
    uvicorn api.main:app --reload

Health check: `GET /health`.
Interactive docs: `/docs`.

## Authentication

- `POST /auth/register` creates a user with a unique email and returns a signed access token.
- `POST /auth/login` verifies credentials and returns a signed access token.
- Passwords are stored as hashes, never as plaintext.
- Set `AI4D_SECRET_KEY` to a strong secret in deployment. The development fallback in `api/auth.py` must not be used for production.

Authentication is currently a foundation: session endpoints are not yet user-scoped. The next backend step is to associate analyses with authenticated users and require Bearer tokens for private session history.

This is an experimental portfolio API. The sample dataset is small and synthetic, so results should not be treated as production forecasts.
