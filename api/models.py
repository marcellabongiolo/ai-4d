"""Persistence models for AI 4D."""
from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from api.database import Base

class AnalysisSession(Base):
    __tablename__ = "analysis_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    signal: Mapped[str] = mapped_column(String(255), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False)
    prediction: Mapped[float] = mapped_column(Float, nullable=False)
    trend: Mapped[str] = mapped_column(String(50), nullable=False)
    behavior: Mapped[str] = mapped_column(String(50), nullable=False)
    anomalies: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    signals_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
