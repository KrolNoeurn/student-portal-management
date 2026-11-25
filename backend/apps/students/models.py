import uuid
from pathlib import Path

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import BlameableModel, SoftDeleteModel, TimeStampedModel
from apps.core.validators import (
    validate_document_extension,
    validate_file_size,
    validate_image_extension,
)


def student_photo_upload_path(instance, filename: str) -> str:
    ext = Path(filename).suffix.lower() or ".jpg"
    return f"students/{instance.public_id}/photo_{uuid.uuid4().hex[:10]}{ext}"


def student_document_upload_path(instance, filename: str) -> str:
    ext = Path(filename).suffix.lower() or ".bin"
    return f"students/{instance.student.public_id}/docs/{uuid.uuid4().hex}{ext}"


class StudentCodeSequence(models.Model):
    """Transactional sequence counter ensuring collision-free Student IDs."""

    prefix_key = models.CharField(max_length=50, unique=True)
    last_sequence = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students_code_sequence"

    def __str__(self):
        return f"{self.prefix_key}: {self.last_sequence}"


class Student(TimeStampedModel, SoftDeleteModel, BlameableModel):
    """Permanent institutional student identity (never duplicated across academic years)."""

    class GenderChoices(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    class StatusChoices(models.TextChoices):
        APPLICANT = "applicant", "Applicant"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        LEAVE = "leave", "On Leave"
        TRANSFERRED = "transferred", "Transferred"
        GRADUATED = "graduated", "Graduated"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class RegistrationStateChoices(models.TextChoices):
        DRAFT = "draft", "Draft"
        COMPLETED = "completed", "Completed"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_profile",
    )
    student_code = models.CharField(max_length=30, unique=True, db_index=True)
    full_name_en = models.CharField(max_length=200, db_index=True)
    full_name_km = models.CharField(max_length=200, blank=True, db_index=True)
    gender = models.CharField(max_length=15, choices=GenderChoices.choices)
    date_of_birth = models.DateField()
    nationality = models.CharField(max_length=80, default="Cambodian", blank=True)
    national_id_number = models.CharField(max_length=50, blank=True, db_index=True)
    profile_photo = models.ImageField(
        upload_to=student_photo_upload_path,
        null=True,
        blank=True,
        validators=[validate_file_size, validate_image_extension],
    )
    phone = models.CharField(max_length=30, blank=True, db_index=True)
    email = models.EmailField(blank=True, db_index=True)

    address_line = models.TextField(blank=True)
    commune = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default="Cambodia", blank=True)

    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_relationship = models.CharField(max_length=60, blank=True)
    emergency_contact_phone = models.CharField(max_length=30, blank=True)

    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    registration_state = models.CharField(
        max_length=15,
        choices=RegistrationStateChoices.choices,
        default=RegistrationStateChoices.COMPLETED,
        db_index=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "students_student"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["full_name_en", "date_of_birth"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["national_id_number"],
                condition=~Q(national_id_number=""),
                name="unique_non_empty_student_national_id",
            ),
        ]
        permissions = [
            ("archive_student", "Can archive student records"),
            ("export_student", "Can export student list"),
            ("print_student_profile", "Can print student profile"),
        ]

    def __str__(self):
        return f"{self.student_code} - {self.full_name_en}"


class StudentGuardian(TimeStampedModel):
    class RelationshipChoices(models.TextChoices):
        FATHER = "father", "Father"
        MOTHER = "mother", "Mother"
        GUARDIAN = "guardian", "Guardian"
        SIBLING = "sibling", "Sibling"
        OTHER = "other", "Other"

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="guardians",
    )
    full_name = models.CharField(max_length=150)
    relationship = models.CharField(
        max_length=30,
        choices=RelationshipChoices.choices,
        default=RelationshipChoices.GUARDIAN,
    )
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "students_guardian"
        ordering = ["-is_primary", "full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.relationship})"


class StudentEducationHistory(TimeStampedModel):
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="education_history",
    )
    institution_name = models.CharField(max_length=200)
    qualification = models.CharField(max_length=150)
    graduation_year = models.PositiveSmallIntegerField(null=True, blank=True)
    gpa_or_grade = models.CharField(max_length=40, blank=True)
    certificate_number = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "students_education_history"
        ordering = ["-graduation_year", "-created_at"]

    def __str__(self):
        return f"{self.institution_name} - {self.qualification}"


class StudentDocument(TimeStampedModel):
    class DocumentTypeChoices(models.TextChoices):
        NATIONAL_ID = "national_id", "National ID / Passport"
        BIRTH_CERTIFICATE = "birth_certificate", "Birth Certificate"
        HIGH_SCHOOL_DIPLOMA = "high_school_diploma", "High School Diploma"
        TRANSCRIPT = "transcript", "Academic Transcript"
        PHOTO = "photo", "ID Photo"
        OTHER = "other", "Other"

    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    document_type = models.CharField(
        max_length=30,
        choices=DocumentTypeChoices.choices,
        default=DocumentTypeChoices.OTHER,
    )
    title = models.CharField(max_length=200)
    file = models.FileField(
        upload_to=student_document_upload_path,
        validators=[validate_file_size, validate_document_extension],
    )
    file_size = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_student_documents",
    )

    class Meta:
        db_table = "students_document"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student.student_code} - {self.title}"


class StudentStatusHistory(models.Model):
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="status_history",
    )
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    effective_date = models.DateField()
    reason = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_status_changes",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "students_status_history"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student.student_code}: {self.previous_status} -> {self.new_status}"
