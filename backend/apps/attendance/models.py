from django.conf import settings
from django.db import models

from apps.academics.models import AcademicYear
from apps.classes.models import ClassSection
from apps.core.models import BlameableModel, TimeStampedModel
from apps.enrollments.models import Enrollment
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.teachers.models import ClassSchedule, Teacher


class AttendanceSession(TimeStampedModel, BlameableModel):
    class StatusChoices(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        LOCKED = "locked", "Locked"

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.PROTECT,
        related_name="attendance_sessions",
    )
    class_section = models.ForeignKey(
        ClassSection,
        on_delete=models.PROTECT,
        related_name="attendance_sessions",
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.PROTECT,
        related_name="attendance_sessions",
    )
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions",
    )
    schedule = models.ForeignKey(
        ClassSchedule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions",
    )
    session_date = models.DateField(db_index=True)
    session_slot = models.PositiveSmallIntegerField(default=1)
    topic = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.SUBMITTED,
        db_index=True,
    )
    taken_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="taken_attendance_sessions",
    )

    class Meta:
        db_table = "attendance_session"
        ordering = ["-session_date", "-session_slot", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["class_section", "subject", "session_date", "session_slot"],
                name="unique_attendance_session_per_slot",
            ),
        ]
        permissions = [
            ("take_attendance", "Can take or submit bulk attendance"),
            ("correct_attendance", "Can correct submitted attendance records"),
            ("export_attendance", "Can export attendance reports"),
        ]

    def __str__(self):
        return f"{self.class_section.code} · {self.subject.code} ({self.session_date} #{self.session_slot})"


class AttendanceRecord(TimeStampedModel):
    class StatusChoices(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LATE = "late", "Late"
        EXCUSED = "excused", "Excused"
        PERMISSION = "permission", "Permission"

    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.PROTECT,
        related_name="records",
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.PROTECT,
        related_name="attendance_records",
    )
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.PROTECT,
        related_name="attendance_records",
    )
    status = models.CharField(
        max_length=15,
        choices=StatusChoices.choices,
        default=StatusChoices.PRESENT,
        db_index=True,
    )
    remarks = models.CharField(max_length=255, blank=True)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_attendance_records",
    )
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "attendance_record"
        ordering = ["student__student_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "student"],
                name="unique_attendance_record_per_session_student",
            ),
        ]

    def __str__(self):
        return f"{self.student.student_code}: {self.status} ({self.session.session_date})"


class AttendanceCorrectionLog(models.Model):
    attendance_record = models.ForeignKey(
        AttendanceRecord,
        on_delete=models.PROTECT,
        related_name="corrections",
    )
    previous_status = models.CharField(max_length=15)
    new_status = models.CharField(max_length=15)
    reason = models.TextField()
    corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_corrections",
    )
    corrected_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "attendance_correction_log"
        ordering = ["-corrected_at"]

    def __str__(self):
        return f"{self.attendance_record.student.student_code}: {self.previous_status} -> {self.new_status}"
