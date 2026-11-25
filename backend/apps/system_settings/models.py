from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class SystemSetting(TimeStampedModel):
    """Key-value institution & portal configuration avoiding hardcoded values."""

    class CategoryChoices(models.TextChoices):
        INSTITUTION = "institution", "Institution"
        ACADEMIC = "academic", "Academic"
        STUDENT_ID = "student_id", "Student ID"
        APPEARANCE = "appearance", "Appearance"
        ATTENDANCE = "attendance", "Attendance"
        UPLOAD = "upload", "Upload"
        BACKUP = "backup", "Backup"

    key = models.CharField(max_length=100, unique=True, db_index=True)
    category = models.CharField(
        max_length=30,
        choices=CategoryChoices.choices,
        default=CategoryChoices.INSTITUTION,
        db_index=True,
    )
    value = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(
        default=False,
        help_text="If True, safe to expose on the public frontend bootstrap endpoint.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_system_settings",
    )

    class Meta:
        db_table = "system_settings_setting"
        ordering = ["category", "key"]
        permissions = [
            ("manage_system_settings", "Can manage system settings"),
        ]

    def __str__(self):
        return f"{self.category}.{self.key}"


class BackupRecord(TimeStampedModel):
    """Tracks manual and scheduled database backups."""

    class BackupTypeChoices(models.TextChoices):
        MANUAL = "manual", "Manual"
        SCHEDULED = "scheduled", "Scheduled"

    class StatusChoices(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size_bytes = models.BigIntegerField(default=0)
    sha256_checksum = models.CharField(max_length=64, blank=True)
    backup_type = models.CharField(
        max_length=20,
        choices=BackupTypeChoices.choices,
        default=BackupTypeChoices.MANUAL,
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
        db_index=True,
    )
    error_message = models.TextField(blank=True)
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_backups",
    )

    class Meta:
        db_table = "system_settings_backup_record"
        ordering = ["-created_at"]
        permissions = [
            ("manage_backups", "Can create and manage database backups"),
        ]

    def __str__(self):
        return f"{self.filename} ({self.status})"
