"""Authentication helpers for AI 4D."""
import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from api.database import get_db
from api.models import User

SECRET_KEY = os.getenv("AI4D_SECRET_KEY", "dev-only-change-this-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

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

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.", headers={"WWW-Authenticate": "Bearer"}) from exc
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.", headers={"WWW-Authenticate": "Bearer"})
    return user
