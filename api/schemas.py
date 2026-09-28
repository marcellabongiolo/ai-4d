"""API schemas for persisted analysis sessions and authentication."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class SessionCreate(BaseModel):
    signal: str = Field(min_length=1, max_length=255)
    points: int = Field(ge=1)
    current_value: float
    prediction: float
    trend: str = Field(min_length=1, max_length=50)
    behavior: str = Field(min_length=1, max_length=50)
    anomalies: int = Field(ge=0)
    signals: list[str] = Field(default_factory=list)

class SessionResponse(SessionCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
