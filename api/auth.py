"""Authentication foundation for AI 4D.

This module provides password hashing and signed access tokens.
It is a foundation only; production deployment should add HTTPS,
rate limiting, email verification, refresh-token rotation, and secrets
managed by the hosting provider.
"""
import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("AI4D_SECRET_KEY", "dev-only-change-this-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid access token") from exc
