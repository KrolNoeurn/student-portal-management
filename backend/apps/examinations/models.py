from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.academics.models import AcademicYear, Semester
from apps.classes.models import ClassSection
from apps.core.models import BlameableModel, TimeStampedModel
from apps.enrollments.models import Enrollment
from apps.students.models import Student
from apps.subjects.models import Subject


class AssessmentType(TimeStampedModel):
    class StatusChoices(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    code = models.CharField(max_length=30, unique=True)
    name_en = models.CharField(max_length=100)
    name_km = models.CharField(max_length=100, blank=True)
    default_weight_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("20.00")
    )
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.ACTIVE
    )

    class Meta:
        db_table = "examinations_assessment_type"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name_en}"


class GradingScale(TimeStampedModel):
    letter_grade = models.CharField(max_length=10, unique=True)
    min_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    max_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    grade_point = models.DecimalField(max_digits=3, decimal_places=2)
    is_passing = models.BooleanField(default=True)
    description = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "examinations_grading_scale"
        ordering = ["-min_percentage"]

    def __str__(self):
        return f"{self.letter_grade} ({self.min_percentage}-{self.max_percentage}% = {self.grade_point})"


class Assessment(TimeStampedModel, BlameableModel):
    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="assessments",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assessments",
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="assessments",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="assessments",
    )
    assessment_type = models.ForeignKey(
        AssessmentType,
        on_delete=models.PROTECT,
        related_name="assessments",
    )
    title = models.CharField(max_length=150)
    max_score = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("100.00"))
    weight_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("20.00"))
    assessment_date = models.DateField(null=True, blank=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        db_table = "examinations_assessment"
        ordering = ["-assessment_date", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(max_score__gt=Decimal("0")),
                name="assessment_max_score_positive",
            ),
            models.CheckConstraint(
                condition=Q(weight_percent__gte=Decimal("0")) & Q(weight_percent__lte=Decimal("100")),
                name="assessment_weight_valid_range",
            ),
        ]

    def __str__(self):
        return f"{self.class_section.code} · {self.subject.code} — {self.title}"


class StudentScore(TimeStampedModel):
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.PROTECT,
        related_name="scores",
    )
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.PROTECT,
        related_name="assessment_scores",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="assessment_scores",
    )
    score = models.DecimalField(max_digits=6, decimal_places=2)
    remarks = models.CharField(max_length=255, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_scores",
    )

    class Meta:
        db_table = "examinations_student_score"
        ordering = ["student__student_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["assessment", "enrollment"],
                name="unique_score_per_assessment_enrollment",
            ),
            models.CheckConstraint(
                condition=Q(score__gte=Decimal("0")),
                name="student_score_non_negative",
            ),
        ]

    def __str__(self):
        return f"{self.student.student_code}: {self.score}/{self.assessment.max_score}"


class SubjectGrade(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        DRAFT = "draft", "Draft"
        VERIFIED = "verified", "Verified"
        PUBLISHED = "published", "Published"

    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.PROTECT,
        related_name="subject_grades",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="subject_grades",
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="subject_grades",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="subject_grades",
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="subject_grades",
    )
    total_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    letter_grade = models.CharField(max_length=10)
    grade_point = models.DecimalField(max_digits=3, decimal_places=2)
    credits_attempted = models.DecimalField(max_digits=4, decimal_places=1)
    credits_earned = models.DecimalField(max_digits=4, decimal_places=1)
    is_passing = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.DRAFT,
        db_index=True,
    )

    class Meta:
        db_table = "examinations_subject_grade"
        ordering = ["-enrollment__academic_year__start_date", "subject__code"]
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "subject", "class_section"],
                name="unique_subject_grade_per_enrollment_class",
            ),
        ]
        permissions = [
            ("publish_grades", "Can publish verified student grades"),
            ("override_grade", "Can override calculated grades"),
        ]

    def __str__(self):
        return f"{self.student.student_code} · {self.subject.code}: {self.letter_grade} ({self.total_percentage}%)"
