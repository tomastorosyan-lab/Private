"""
Утилиты для загрузки файлов
"""
import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings


def get_upload_dir() -> Path:
    """Получить путь к директории для загрузки файлов"""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def validate_image_file(file: UploadFile) -> None:
    """Валидация загружаемого изображения"""
    # Проверка типа файла
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый тип файла. Разрешенные типы: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
        )
    
    # Проверка размера файла (нужно прочитать файл)
    # Это будет сделано в endpoint, т.к. нужно прочитать содержимое


async def save_uploaded_file(file: UploadFile, user_id: int) -> str:
    """
    Сохранить загруженный файл и вернуть URL
    
    Args:
        file: Загруженный файл
        user_id: ID пользователя (для организации файлов)
    
    Returns:
        URL файла относительно корня приложения
    """
    # Валидация
    validate_image_file(file)
    
    # Читаем содержимое файла для проверки размера
    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимальный размер: {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )
    
    # Определяем расширение файла
    file_extension = Path(file.filename).suffix if file.filename else ".jpg"
    if not file_extension:
        # Определяем по content_type
        content_type_to_ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
        }
        file_extension = content_type_to_ext.get(file.content_type, ".jpg")
    
    # Генерируем уникальное имя файла
    filename = f"{user_id}_{uuid.uuid4().hex}{file_extension}"
    
    # Создаем директорию для пользователя
    upload_dir = get_upload_dir()
    user_dir = upload_dir / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Сохраняем файл
    file_path = user_dir / filename
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Возвращаем относительный URL
    return f"/uploads/{user_id}/{filename}"


def delete_file(file_url: str) -> None:
    """Удалить файл по URL"""
    if not file_url or not file_url.startswith("/uploads/"):
        return
    
    file_path = Path(settings.UPLOAD_DIR) / file_url.replace("/uploads/", "")
    if file_path.exists():
        file_path.unlink()
        # Удаляем пустую директорию пользователя, если она пуста
        user_dir = file_path.parent
        if user_dir.exists() and not any(user_dir.iterdir()):
            user_dir.rmdir()





