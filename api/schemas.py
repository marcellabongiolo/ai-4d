"""API schemas for persisted analysis sessions, projects, and authentication."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class ProjectResponse(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime

class SessionCreate(BaseModel):
    project_id: int | None = Field(default=None, ge=1)
    signal: str = Field(min_length=1, max_length=255)
    points: int = Field(ge=1)
    current_value: float
    prediction: float
    trend: str = Field(min_length=1, max_length=50)
    behavior: str = Field(min_length=1, max_length=50)
    anomalies: int = Field(ge=0)
    signals: list[str] = Field(default_factory=list)
    dataset_text: str = Field(default="", max_length=2_000_000)

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


class DatasetCreate(BaseModel):
    project_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=2_000_000)
    signal_count: int = Field(ge=1)
    point_count: int = Field(ge=1)

class DatasetResponse(DatasetCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
