"""
Активный код сброса пароля.
"""
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    email = Column(String, primary_key=True, index=True)
    code_hash = Column(String, nullable=False)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
