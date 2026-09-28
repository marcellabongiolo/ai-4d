"""API schemas for persisted analysis sessions."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

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
