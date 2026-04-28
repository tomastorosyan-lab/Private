"""
Журнал запросов email-кодов при регистрации.
"""
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class EmailVerificationEvent(Base):
    __tablename__ = "email_verification_events"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    requested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
