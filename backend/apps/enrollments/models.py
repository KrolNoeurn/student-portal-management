from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel
from apps.core.models import BlameableModel, SoftDeleteModel, TimeStampedModel
from apps.students.models import Student


class EnrollmentSequence(models.Model):
    """Transactional sequence counter for enrollment registration numbers."""

    prefix_key = models.CharField(max_length=50, unique=True)
    last_sequence = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enrollments_sequence"

    def __str__(self):
        return f"{self.prefix_key}: {self.last_sequence}"


class Enrollment(TimeStampedModel, SoftDeleteModel, BlameableModel):
    """
    Temporal academic registration linking a permanent Student to an AcademicYear,
    Degree, Major, and YearLevel without ever duplicating the Student profile.
    """

    class EnrollmentTypeChoices(models.TextChoices):
        NEW = "new", "New Enrollment"
        RE_ENROLLMENT = "re_enrollment", "Re-Enrollment"
        PROMOTION = "promotion", "Promotion"
        TRANSFER_IN = "transfer_in", "Transfer In"
        PROGRAM_CHANGE = "program_change", "Program Change"

    class StatusChoices(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        PROMOTED = "promoted", "Promoted"
        TRANSFERRED = "transferred", "Transferred"
        SUSPENDED = "suspended", "Suspended"
        WITHDRAWN = "withdrawn", "Withdrawn"
        CANCELLED = "cancelled", "Cancelled"

    registration_number = models.CharField(max_length=40, unique=True, db_index=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="enrollments",
    )
    degree = models.ForeignKey(
        Degree,
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    major = models.ForeignKey(
        Major,
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    year_level = models.ForeignKey(
        YearLevel,
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    enrollment_type = models.CharField(
        max_length=20,
        choices=EnrollmentTypeChoices.choices,
        default=EnrollmentTypeChoices.NEW,
        db_index=True,
    )
    enrollment_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    previous_enrollment = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="next_enrollments",
    )
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = "enrollments_enrollment"
        ordering = ["-academic_year__start_date", "-enrollment_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "academic_year"],
                condition=Q(status="active", is_deleted=False),
                name="unique_active_enrollment_per_student_year",
            ),
        ]
        permissions = [
            ("promote_enrollment", "Can promote or re-enroll students"),
            ("transfer_enrollment", "Can change program or transfer enrollment"),
        ]

    def __str__(self):
        return f"{self.registration_number} ({self.student.student_code} · {self.academic_year.name})"


class EnrollmentHistory(models.Model):
    """Immutable audit trail of enrollment lifecycle transitions."""

    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.PROTECT,
        related_name="history",
    )
    event_type = models.CharField(max_length=30, db_index=True)
    previous_data = models.JSONField(default=dict, blank=True)
    new_data = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrollment_history_events",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "enrollments_history"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.enrollment.registration_number} - {self.event_type}"
