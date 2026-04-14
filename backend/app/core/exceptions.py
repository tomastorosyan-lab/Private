"""
Кастомные исключения для приложения
"""
from fastapi import HTTPException, status


class DISException(HTTPException):
    """Базовое исключение приложения"""
    pass


class NotFoundException(HTTPException):
    """Ресурс не найден"""
    def __init__(self, detail: str = "Ресурс не найден"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class UnauthorizedException(HTTPException):
    """Не авторизован"""
    def __init__(self, detail: str = "Требуется авторизация"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )


class ForbiddenException(HTTPException):
    """Доступ запрещен"""
    def __init__(self, detail: str = "Доступ запрещен"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ValidationException(HTTPException):
    """Ошибка валидации"""
    def __init__(self, detail: str = "Ошибка валидации данных"):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class BusinessLogicException(HTTPException):
    """Ошибка бизнес-логики"""
    def __init__(self, detail: str = "Ошибка бизнес-логики"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)





