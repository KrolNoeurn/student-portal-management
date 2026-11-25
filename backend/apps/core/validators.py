from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}


def validate_file_size(file_obj, max_mb=None):
    limit_mb = max_mb or getattr(settings, "MAX_UPLOAD_SIZE_MB", 5)
    max_bytes = limit_mb * 1024 * 1024
    if file_obj.size > max_bytes:
        raise ValidationError(f"File size must not exceed {limit_mb} MB.")


def validate_image_extension(file_obj):
    ext = Path(file_obj.name).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f"Unsupported image format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}."
        )


def validate_document_extension(file_obj):
    ext = Path(file_obj.name).suffix.lower()
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValidationError(
            f"Unsupported document format '{ext}'. Allowed: {', '.join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))}."
        )
