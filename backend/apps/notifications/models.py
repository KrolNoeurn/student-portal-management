from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    class CategoryChoices(models.TextChoices):
        INFO = "info", "Information"
        ATTENDANCE_WARNING = "attendance_warning", "Attendance Warning"
        ENROLLMENT = "enrollment", "Enrollment"
        GRADE = "grade", "Grades"
        SCHEDULE = "schedule", "Schedule"
        SYSTEM = "system", "System"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    category = models.CharField(
        max_length=30,
        choices=CategoryChoices.choices,
        default=CategoryChoices.INFO,
        db_index=True,
    )
    title_en = models.CharField(max_length=200)
    title_km = models.CharField(max_length=200, blank=True)
    message_en = models.TextField(blank=True)
    message_km = models.TextField(blank=True)
    link_url = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications_notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"To {self.recipient_id}: {self.title_en}"
