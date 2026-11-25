import hashlib
import sqlite3
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from apps.system_settings.models import BackupRecord, SystemSetting

DEFAULT_SETTINGS = [
    {
        "key": "institution.name_en",
        "category": SystemSetting.CategoryChoices.INSTITUTION,
        "value": "University Student Portal",
        "description": "Institution display name in English",
        "is_public": True,
    },
    {
        "key": "institution.name_km",
        "category": SystemSetting.CategoryChoices.INSTITUTION,
        "value": "ប្រព័ន្ធគ្រប់គ្រងនិស្សិត និងការសិក្សា",
        "description": "Institution display name in Khmer",
        "is_public": True,
    },
    {
        "key": "institution.short_name",
        "category": SystemSetting.CategoryChoices.INSTITUTION,
        "value": "SAMS",
        "description": "Short acronym shown in sidebar header",
        "is_public": True,
    },
    {
        "key": "appearance.default_language",
        "category": SystemSetting.CategoryChoices.APPEARANCE,
        "value": "en",
        "description": "Default UI language (en or km)",
        "is_public": True,
    },
    {
        "key": "appearance.default_layout",
        "category": SystemSetting.CategoryChoices.APPEARANCE,
        "value": "vertical",
        "description": "Default navigation layout (vertical or horizontal)",
        "is_public": True,
    },
    {
        "key": "appearance.default_theme",
        "category": SystemSetting.CategoryChoices.APPEARANCE,
        "value": "light",
        "description": "Default color theme (light or dark)",
        "is_public": True,
    },
    {
        "key": "appearance.page_size",
        "category": SystemSetting.CategoryChoices.APPEARANCE,
        "value": 20,
        "description": "Default data table page size",
        "is_public": True,
    },
    {
        "key": "student_id.format",
        "category": SystemSetting.CategoryChoices.STUDENT_ID,
        "value": "STU-{YEAR}-{SEQ:04d}",
        "description": "Configurable student code format template",
        "is_public": False,
    },
    {
        "key": "attendance.warning_threshold_percent",
        "category": SystemSetting.CategoryChoices.ATTENDANCE,
        "value": 80,
        "description": "Minimum attendance percentage before triggering a warning",
        "is_public": False,
    },
    {
        "key": "upload.max_size_mb",
        "category": SystemSetting.CategoryChoices.UPLOAD,
        "value": 5,
        "description": "Maximum allowed upload file size in megabytes",
        "is_public": False,
    },
    {
        "key": "backup.retention_days",
        "category": SystemSetting.CategoryChoices.BACKUP,
        "value": 30,
        "description": "Number of days to retain automated database backups",
        "is_public": False,
    },
]


def seed_default_settings():
    created_count = 0
    for item in DEFAULT_SETTINGS:
        _, created = SystemSetting.objects.get_or_create(
            key=item["key"],
            defaults={
                "category": item["category"],
                "value": item["value"],
                "description": item["description"],
                "is_public": item["is_public"],
            },
        )
        if created:
            created_count += 1
    return created_count


def get_public_bootstrap_config():
    """Return safe public system defaults for initial frontend bootstrap."""
    rows = SystemSetting.objects.filter(is_public=True).values("key", "value")
    mapping = {row["key"]: row["value"] for row in rows}
    return {
        "institution": {
            "name_en": mapping.get("institution.name_en", "University Student Portal"),
            "name_km": mapping.get("institution.name_km", "ប្រព័ន្ធគ្រប់គ្រងនិស្សិត និងការសិក្សា"),
            "short_name": mapping.get("institution.short_name", "SAMS"),
        },
        "appearance": {
            "default_language": mapping.get("appearance.default_language", "en"),
            "default_layout": mapping.get("appearance.default_layout", "vertical"),
            "default_theme": mapping.get("appearance.default_theme", "light"),
            "page_size": mapping.get("appearance.page_size", 20),
        },
    }


def create_safe_sqlite_backup(user=None, backup_type=BackupRecord.BackupTypeChoices.MANUAL):
    """
    Create a transactionally consistent SQLite backup using sqlite3.Connection.backup().
    Never performs raw file copy while transactions may be active.
    """
    db_config = settings.DATABASES["default"]
    if "sqlite3" not in db_config["ENGINE"]:
        raise RuntimeError("SQLite online backup service is only for SQLite databases.")

    source_path = Path(db_config["NAME"])
    if str(source_path) == ":memory:" or not source_path.exists():
        raise RuntimeError("Cannot back up an in-memory or missing SQLite database.")

    backup_dir = Path(settings.BACKUP_DIR)
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    filename = f"sams_backup_{timestamp}.sqlite3"
    dest_path = backup_dir / filename

    record = BackupRecord.objects.create(
        filename=filename,
        file_path=str(dest_path),
        backup_type=backup_type,
        status=BackupRecord.StatusChoices.PENDING,
        triggered_by=user,
    )

    try:
        with sqlite3.connect(str(source_path)) as src_conn, sqlite3.connect(str(dest_path)) as dst_conn:
            src_conn.backup(dst_conn)

        sha256 = hashlib.sha256()
        with dest_path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)

        record.file_size_bytes = dest_path.stat().st_size
        record.sha256_checksum = sha256.hexdigest()
        record.status = BackupRecord.StatusChoices.COMPLETED
        record.save(update_fields=["file_size_bytes", "sha256_checksum", "status", "updated_at"])
        return record
    except Exception as exc:
        record.status = BackupRecord.StatusChoices.FAILED
        record.error_message = str(exc)
        record.save(update_fields=["status", "error_message", "updated_at"])
        raise
