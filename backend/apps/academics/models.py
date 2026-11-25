from django.db import models
from django.db.models import F, Q

from apps.core.models import BlameableModel, TimeStampedModel


class AcademicYear(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=50, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PLANNED,
        db_index=True,
    )
    is_current = models.BooleanField(default=False, db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "academics_academic_year"
        ordering = ["-start_date", "-name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gt=F("start_date")),
                name="academic_year_end_after_start",
            ),
            models.UniqueConstraint(
                fields=["is_current"],
                condition=Q(is_current=True),
                name="unique_current_academic_year",
            ),
        ]

    def __str__(self):
        return self.name


class Semester(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="semesters",
    )
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20)
    sequence_number = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PLANNED,
        db_index=True,
    )

    class Meta:
        db_table = "academics_semester"
        ordering = ["-academic_year__start_date", "sequence_number"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gt=F("start_date")),
                name="semester_end_after_start",
            ),
            models.UniqueConstraint(
                fields=["academic_year", "code"],
                name="unique_semester_code_per_year",
            ),
            models.UniqueConstraint(
                fields=["academic_year", "sequence_number"],
                name="unique_semester_seq_per_year",
            ),
            models.UniqueConstraint(
                fields=["is_current"],
                condition=Q(is_current=True),
                name="unique_current_semester",
            ),
        ]

    def __str__(self):
        return f"{self.academic_year.name} - {self.name}"


class Degree(TimeStampedModel, BlameableModel):
    class LevelChoices(models.TextChoices):
        CERTIFICATE = "certificate", "Certificate"
        HIGHER_DIPLOMA = "higher_diploma", "Higher Diploma"
        ASSOCIATE = "associate", "Associate Degree"
        BACHELOR = "bachelor", "Bachelor's Degree"
        MASTER = "master", "Master's Degree"
        DOCTORATE = "doctorate", "Doctorate"
        OTHER = "other", "Other"

    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    code = models.CharField(max_length=20, unique=True)
    name_en = models.CharField(max_length=150, unique=True)
    name_km = models.CharField(max_length=150, blank=True)
    level = models.CharField(
        max_length=30,
        choices=LevelChoices.choices,
        default=LevelChoices.BACHELOR,
        db_index=True,
    )
    duration_years = models.PositiveSmallIntegerField(default=4)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "academics_degree"
        ordering = ["duration_years", "name_en"]
        constraints = [
            models.CheckConstraint(
                condition=Q(duration_years__gte=1),
                name="degree_duration_positive",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name_en}"


class Major(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    degree = models.ForeignKey(
        Degree,
        on_delete=models.PROTECT,
        related_name="majors",
    )
    code = models.CharField(max_length=20)
    name_en = models.CharField(max_length=150)
    name_km = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "academics_major"
        ordering = ["degree__name_en", "name_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["degree", "code"],
                name="unique_major_code_per_degree",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name_en} ({self.degree.code})"


class YearLevel(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    code = models.CharField(max_length=20, unique=True)
    name_en = models.CharField(max_length=50)
    name_km = models.CharField(max_length=50, blank=True)
    order_index = models.PositiveSmallIntegerField(unique=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )

    class Meta:
        db_table = "academics_year_level"
        ordering = ["order_index"]
        constraints = [
            models.CheckConstraint(
                condition=Q(order_index__gte=1),
                name="year_level_order_positive",
            ),
        ]

    def __str__(self):
        return self.name_en
