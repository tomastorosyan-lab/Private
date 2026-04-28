"""
Утилиты для загрузки файлов
"""
import os
import uuid
from io import BytesIO
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from PIL import Image, ImageOps
from app.core.config import settings


def get_upload_dir() -> Path:
    """Получить путь к директории для загрузки файлов"""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def validate_image_file(file: UploadFile) -> None:
    """Валидация загружаемого изображения"""
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый тип файла. Разрешенные типы: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
        )


def _flatten_transparency(img: Image.Image) -> Image.Image:
    """RGBA/LA/P → RGB с белым фоном (удобно для витрины)."""
    if img.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        alpha = img.split()[-1]
        bg.paste(img.convert("RGB"), mask=alpha)
        return bg
    if img.mode == "P" and "transparency" in img.info:
        img = img.convert("RGBA")
        return _flatten_transparency(img)
    if img.mode != "RGB":
        return img.convert("RGB")
    return img


def _pillow_supports_webp() -> bool:
    exts = Image.registered_extensions()
    return any(fmt.upper() == "WEBP" for fmt in exts.values())


def _encode_image_under_limit(img: Image.Image, *, prefer_webp: bool) -> tuple[bytes, str]:
    """
    Сохраняет пропорции, кодирует WebP (или JPEG как запасной вариант), ≤ IMAGE_OUTPUT_MAX_BYTES.
    Возвращает (байты, расширение файла с точкой).
    """
    max_bytes = max(1024, int(settings.IMAGE_OUTPUT_MAX_BYTES))
    max_side = max(256, int(settings.IMAGE_OUTPUT_MAX_SIDE))
    use_webp = prefer_webp and _pillow_supports_webp()

    img = _flatten_transparency(img)
    working = img.copy()

    def try_save(thumb: Image.Image, fmt: str, **save_kw) -> bytes | None:
        buf = BytesIO()
        try:
            thumb.save(buf, format=fmt, **save_kw)
        except OSError:
            return None
        data = buf.getvalue()
        if len(data) <= max_bytes:
            return data
        return None

    side = max_side
    while side >= 256:
        thumb = working.copy()
        thumb.thumbnail((side, side), Image.Resampling.LANCZOS)
        if use_webp:
            for quality in range(88, 34, -4):
                data = try_save(
                    thumb,
                    "WEBP",
                    quality=quality,
                    method=6,
                    optimize=True,
                )
                if data is not None:
                    return data, ".webp"
        for quality in range(88, 34, -4):
            data = try_save(thumb, "JPEG", quality=quality, optimize=True, progressive=True)
            if data is not None:
                return data, ".jpg"
        side = int(side * 0.82)

    thumb = working.copy()
    thumb.thumbnail((400, 400), Image.Resampling.LANCZOS)
    if use_webp:
        data = try_save(thumb, "WEBP", quality=30, method=6, optimize=True)
        if data is not None:
            return data, ".webp"
    data = try_save(thumb, "JPEG", quality=30, optimize=True, progressive=True)
    if data is not None:
        return data, ".jpg"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Не удалось сжать изображение до допустимого размера. Попробуйте другое изображение.",
    )


async def save_uploaded_file(file: UploadFile, user_id: int) -> str:
    """
    Сохранить загруженный файл и вернуть URL.

    Любое допустимое изображение приводится к WebP, размер файла не превышает IMAGE_OUTPUT_MAX_BYTES.
    """
    validate_image_file(file)

    contents = await file.read()
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимальный размер: {settings.MAX_UPLOAD_SIZE / 1024 / 1024:.0f}MB",
        )

    try:
        img = Image.open(BytesIO(contents))
        if getattr(img, "n_frames", 1) > 1:
            img.seek(0)
        img = ImageOps.exif_transpose(img)
        processed, ext = _encode_image_under_limit(img, prefer_webp=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось обработать изображение",
        ) from exc

    if len(processed) > settings.IMAGE_OUTPUT_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Изображение после обработки превышает допустимый размер",
        )

    filename = f"{user_id}_{uuid.uuid4().hex}{ext}"

    upload_dir = get_upload_dir()
    user_dir = upload_dir / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    file_path = user_dir / filename
    with open(file_path, "wb") as f:
        f.write(processed)

    return f"/uploads/{user_id}/{filename}"


def delete_file(file_url: str) -> None:
    """Удалить файл по URL"""
    if not file_url or not file_url.startswith("/uploads/"):
        return

    file_path = Path(settings.UPLOAD_DIR) / file_url.replace("/uploads/", "")
    if file_path.exists():
        file_path.unlink()
        user_dir = file_path.parent
        if user_dir.exists() and not any(user_dir.iterdir()):
            user_dir.rmdir()
