from django.conf import settings
from django.db import models
from django.db.models import F, Q

from apps.academics.models import AcademicYear, Semester
from apps.classes.models import Classroom, ClassSection
from apps.core.models import BlameableModel, SoftDeleteModel, TimeStampedModel
from apps.subjects.models import Subject


class Teacher(TimeStampedModel, SoftDeleteModel, BlameableModel):
    class GenderChoices(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    class EmploymentTypeChoices(models.TextChoices):
        FULL_TIME = "full_time", "Full-Time"
        PART_TIME = "part_time", "Part-Time"
        VISITING = "visiting", "Visiting Lecturer"

    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On Leave"
        INACTIVE = "inactive", "Inactive"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teacher_profile",
    )
    teacher_code = models.CharField(max_length=30, unique=True, db_index=True)
    full_name_en = models.CharField(max_length=200, db_index=True)
    full_name_km = models.CharField(max_length=200, blank=True, db_index=True)
    gender = models.CharField(
        max_length=15, choices=GenderChoices.choices, default=GenderChoices.MALE
    )
    email = models.EmailField(blank=True, db_index=True)
    phone = models.CharField(max_length=30, blank=True)
    specialization = models.CharField(max_length=150, blank=True)
    qualification = models.CharField(max_length=150, blank=True)
    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentTypeChoices.choices,
        default=EmploymentTypeChoices.FULL_TIME,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "teachers_teacher"
        ordering = ["teacher_code"]

    def __str__(self):
        return f"{self.teacher_code} - {self.full_name_en}"


class TeachingAssignment(TimeStampedModel, BlameableModel):
    class RoleChoices(models.TextChoices):
        PRIMARY = "primary", "Primary Instructor"
        ASSISTANT = "assistant", "Teaching Assistant"

    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.PROTECT,
        related_name="teaching_assignments",
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="teaching_assignments",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="teaching_assignments",
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="teaching_assignments",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="teaching_assignments",
    )
    role = models.CharField(
        max_length=20, choices=RoleChoices.choices, default=RoleChoices.PRIMARY
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "teachers_teaching_assignment"
        ordering = ["-academic_year__start_date", "class_section__code", "subject__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["teacher", "class_section", "subject"],
                condition=Q(status="active", semester__isnull=True),
                name="unique_active_teaching_no_semester",
            ),
            models.UniqueConstraint(
                fields=["teacher", "class_section", "subject", "semester"],
                condition=Q(status="active", semester__isnull=False),
                name="unique_active_teaching_with_semester",
            ),
        ]

    def __str__(self):
        return f"{self.teacher.teacher_code} -> {self.class_section.code} ({self.subject.code})"


class ClassSchedule(TimeStampedModel, BlameableModel):
    class DayOfWeekChoices(models.IntegerChoices):
        MONDAY = 1, "Monday"
        TUESDAY = 2, "Tuesday"
        WEDNESDAY = 3, "Wednesday"
        THURSDAY = 4, "Thursday"
        FRIDAY = 5, "Friday"
        SATURDAY = 6, "Saturday"
        SUNDAY = 7, "Sunday"

    teaching_assignment = models.ForeignKey(
        TeachingAssignment,
        on_delete=models.PROTECT,
        related_name="schedules",
    )
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="schedules",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="schedules",
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="schedules",
    )
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.PROTECT,
        related_name="schedules",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="schedules",
    )
    classroom = models.ForeignKey(
        Classroom,
        on_delete=models.PROTECT,
        related_name="schedules",
    )
    day_of_week = models.PositiveSmallIntegerField(
        choices=DayOfWeekChoices.choices,
        db_index=True,
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "teachers_class_schedule"
        ordering = ["day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["academic_year", "day_of_week", "teacher"]),
            models.Index(fields=["academic_year", "day_of_week", "classroom"]),
            models.Index(fields=["academic_year", "day_of_week", "class_section"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_time__gt=F("start_time")),
                name="schedule_end_after_start",
            ),
            models.CheckConstraint(
                condition=Q(day_of_week__gte=1) & Q(day_of_week__lte=7),
                name="schedule_valid_day_of_week",
            ),
        ]

    def __str__(self):
        return (
            f"{self.get_day_of_week_display()} {self.start_time:%H:%M}-{self.end_time:%H:%M} "
            f"{self.class_section.code} ({self.subject.code})"
        )
