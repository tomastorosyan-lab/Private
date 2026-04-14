"""
Сервис для работы с поставщиками
"""
from sqlalchemy.orm import Session
from typing import List
from app.models.user import User, UserType


class DistributorService:
    def __init__(self, db: Session):
        self.db = db
    
    async def get_distributors(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Получение списка поставщиков (пользователей типа supplier)"""
        return self.db.query(User).filter(
            User.user_type == UserType.SUPPLIER,
            User.is_active == True
        ).offset(skip).limit(limit).all()
    
    async def get_distributor_by_id(self, distributor_id: int) -> User:
        """Получение поставщика по ID"""
        return self.db.query(User).filter(
            User.id == distributor_id,
            User.user_type == UserType.SUPPLIER
        ).first()

