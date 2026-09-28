# AI 4D Inference API

Experimental FastAPI service for temporal prediction, persistence, authentication, private analysis history, and projects.

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

## Projects

Projects create a private workspace boundary for a user's analyses.

- `GET /projects` lists the authenticated user's projects.
- `POST /projects` creates a project.
- `DELETE /projects/{project_id}` deletes an owned project and unlinks its analyses without deleting those analyses.
- `POST /sessions` accepts an optional `project_id`.
- `GET /sessions?project_id=<id>` filters the authenticated user's history by project.

A project ID belonging to another user cannot be attached to a session.

## Private analysis history

The `/sessions` endpoints require a Bearer token. Each analysis is stored with its `user_id`, and users can only list or delete their own analyses.

The browser can keep a small local history for offline use. When an API is configured and the user is authenticated, the frontend can synchronize the latest analysis with the selected project.

## Database migrations

The current SQLite schema is suitable for development. Because the project model adds a `projects` table and a `project_id` column to `analysis_sessions`, production deployments need a migration strategy such as Alembic before upgrading an existing database. `Base.metadata.create_all()` does not modify existing tables.

## ML notes

The prediction endpoint compares a small linear-regression lag model with a persistence baseline. The sample dataset is small and synthetic, so results should not be treated as production forecasts.

This is an experimental portfolio API, not a production service yet.
