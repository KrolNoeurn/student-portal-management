from decimal import Decimal

from django.db import models
from django.db.models import Q

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.core.models import BlameableModel, TimeStampedModel


class Subject(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    code = models.CharField(max_length=30, unique=True, db_index=True)
    name_en = models.CharField(max_length=200)
    name_km = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    credits = models.DecimalField(max_digits=4, decimal_places=1, default=Decimal("3.0"))
    theory_hours = models.PositiveSmallIntegerField(default=30)
    practical_hours = models.PositiveSmallIntegerField(default=15)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "subjects_subject"
        ordering = ["code"]
        constraints = [
            models.CheckConstraint(
                condition=Q(credits__gte=Decimal("0.0")),
                name="subject_credits_non_negative",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name_en}"


class Curriculum(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    degree = models.ForeignKey(
        Degree,
        on_delete=models.PROTECT,
        related_name="curricula",
    )
    major = models.ForeignKey(
        Major,
        on_delete=models.PROTECT,
        related_name="curricula",
    )
    version = models.CharField(max_length=40)
    effective_academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="effective_curricula",
    )
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "subjects_curriculum"
        ordering = ["-created_at"]
        verbose_name_plural = "Curricula"
        constraints = [
            models.UniqueConstraint(
                fields=["degree", "major", "version"],
                name="unique_curriculum_degree_major_version",
            ),
        ]

    def __str__(self):
        return f"{self.degree.code} / {self.major.code} ({self.version})"


class CurriculumSubject(TimeStampedModel):
    curriculum = models.ForeignKey(
        Curriculum,
        on_delete=models.CASCADE,
        related_name="items",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="curriculum_items",
    )
    year_level = models.ForeignKey(
        YearLevel,
        on_delete=models.PROTECT,
        related_name="curriculum_items",
    )
    semester_number = models.PositiveSmallIntegerField(default=1)
    is_required = models.BooleanField(default=True)
    prerequisite_subject = models.ForeignKey(
        Subject,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dependent_curriculum_items",
    )

    class Meta:
        db_table = "subjects_curriculum_subject"
        ordering = ["year_level__order_index", "semester_number", "subject__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["curriculum", "subject", "year_level", "semester_number"],
                name="unique_subject_in_curriculum_term",
            ),
            models.CheckConstraint(
                condition=Q(semester_number__gte=1),
                name="curriculum_semester_positive",
            ),
        ]

    def __str__(self):
        return f"{self.curriculum} - Y{self.year_level.order_index}S{self.semester_number} - {self.subject.code}"
