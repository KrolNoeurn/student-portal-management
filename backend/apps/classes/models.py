from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel
from apps.core.models import BlameableModel, SoftDeleteModel, TimeStampedModel
from apps.enrollments.models import Enrollment
from apps.students.models import Student
from apps.subjects.models import Subject


class Classroom(TimeStampedModel, BlameableModel):
    class RoomTypeChoices(models.TextChoices):
        LECTURE = "lecture", "Lecture Hall"
        LAB = "lab", "Computer / Science Lab"
        SEMINAR = "seminar", "Seminar Room"
        AUDITORIUM = "auditorium", "Auditorium"

    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        MAINTENANCE = "maintenance", "Maintenance"
        INACTIVE = "inactive", "Inactive"

    code = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    building = models.CharField(max_length=100, blank=True)
    floor = models.CharField(max_length=30, blank=True)
    capacity = models.PositiveSmallIntegerField(default=40)
    room_type = models.CharField(
        max_length=20,
        choices=RoomTypeChoices.choices,
        default=RoomTypeChoices.LECTURE,
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "classes_classroom"
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(condition=Q(capacity__gte=1), name="classroom_capacity_positive"),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"


class ClassSection(TimeStampedModel, SoftDeleteModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        OPEN = "open", "Open"
        FULL = "full", "Full"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        ARCHIVED = "archived", "Archived"

    code = models.CharField(max_length=30, db_index=True)
    name = models.CharField(max_length=120)
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="class_sections",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="class_sections",
    )
    degree = models.ForeignKey(
        Degree,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="class_sections",
    )
    major = models.ForeignKey(
        Major,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="class_sections",
    )
    allow_mixed_degrees = models.BooleanField(default=False, db_index=True)
    allowed_degrees = models.ManyToManyField(
        Degree,
        blank=True,
        related_name="mixed_class_sections",
    )
    year_level = models.ForeignKey(
        YearLevel,
        on_delete=models.PROTECT,
        related_name="class_sections",
    )
    default_classroom = models.ForeignKey(
        Classroom,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_sections",
    )
    homeroom_advisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="advised_classes",
    )
    capacity = models.PositiveSmallIntegerField(default=40)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.OPEN,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "classes_section"
        ordering = ["-academic_year__start_date", "code"]
        constraints = [
            models.CheckConstraint(
                condition=Q(capacity__gte=1),
                name="class_section_capacity_positive",
            ),
            models.UniqueConstraint(
                fields=["academic_year", "code"],
                condition=Q(is_deleted=False),
                name="unique_active_class_code_per_year",
            ),
        ]
        permissions = [
            ("assign_class_student", "Can assign enrolled students to a class"),
            ("transfer_class_student", "Can transfer students between classes"),
        ]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.academic_year.name})"


class ClassSubject(TimeStampedModel):
    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.CASCADE,
        related_name="class_subjects",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="class_offerings",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="class_subjects",
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
    )

    class Meta:
        db_table = "classes_subject"
        ordering = ["subject__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["class_section", "subject"],
                condition=Q(semester__isnull=True),
                name="unique_class_subject_no_semester",
            ),
            models.UniqueConstraint(
                fields=["class_section", "subject", "semester"],
                condition=Q(semester__isnull=False),
                name="unique_class_subject_per_semester",
            ),
        ]

    def __str__(self):
        return f"{self.class_section.code} - {self.subject.code}"


class ClassMembership(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        TRANSFERRED = "transferred", "Transferred"
        COMPLETED = "completed", "Completed"
        DROPPED = "dropped", "Dropped"

    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.PROTECT,
        related_name="class_memberships",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="class_memberships",
    )
    assigned_date = models.DateField()
    left_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "classes_membership"
        ordering = ["student__student_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["class_section", "enrollment"],
                condition=Q(status="active"),
                name="unique_active_membership_per_class_enrollment",
            ),
        ]

    def __str__(self):
        return f"{self.class_section.code}: {self.student.student_code} ({self.status})"


class ClassTransferHistory(models.Model):
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="class_transfers",
    )
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.PROTECT,
        related_name="class_transfers",
    )
    from_class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="transfers_out",
    )
    to_class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="transfers_in",
    )
    transfer_date = models.DateField()
    reason = models.TextField(blank=True)
    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="executed_class_transfers",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "classes_transfer_history"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.student.student_code}: {self.from_class_section.code} -> "
            f"{self.to_class_section.code}"
        )
