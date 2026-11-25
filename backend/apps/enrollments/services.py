from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel
from apps.auditlogs.services import record_audit_log
from apps.enrollments.models import Enrollment, EnrollmentHistory, EnrollmentSequence
from apps.students.models import Student


def _snapshot(enrollment: Enrollment) -> dict:
    return {
        "academic_year": enrollment.academic_year.name,
        "semester": enrollment.semester.code if enrollment.semester else None,
        "degree": enrollment.degree.code,
        "major": enrollment.major.code,
        "year_level": enrollment.year_level.code,
        "status": enrollment.status,
        "enrollment_type": enrollment.enrollment_type,
    }


def validate_enrollment_context(*, academic_year: AcademicYear, semester: Semester | None, degree: Degree, major: Major):
    if major.degree_id != degree.id:
        raise ValidationError(
            {"major": [f"Major '{major.name_en}' does not belong to degree '{degree.name_en}'."]}
        )
    if semester is not None and semester.academic_year_id != academic_year.id:
        raise ValidationError(
            {
                "semester": [
                    f"Semester '{semester.name}' does not belong to academic year '{academic_year.name}'."
                ]
            }
        )


@transaction.atomic
def generate_registration_number(academic_year: AcademicYear) -> str:
    year_tag = academic_year.start_date.year
    prefix_key = f"ENR-{year_tag}"
    seq_row, _ = EnrollmentSequence.objects.select_for_update().get_or_create(
        prefix_key=prefix_key,
        defaults={"last_sequence": 0},
    )
    while True:
        seq_row.last_sequence += 1
        candidate = f"ENR-{year_tag}-{seq_row.last_sequence:05d}"
        if not Enrollment.all_objects.filter(registration_number=candidate).exists():
            seq_row.save(update_fields=["last_sequence", "updated_at"])
            return candidate


@transaction.atomic
def create_enrollment(*, validated_data: dict, user=None, request=None) -> Enrollment:
    student: Student = validated_data["student"]
    academic_year: AcademicYear = validated_data["academic_year"]
    semester: Semester | None = validated_data.get("semester")
    degree: Degree = validated_data["degree"]
    major: Major = validated_data["major"]
    status_val: str = validated_data.get("status", Enrollment.StatusChoices.ACTIVE)

    validate_enrollment_context(
        academic_year=academic_year,
        semester=semester,
        degree=degree,
        major=major,
    )

    if status_val == Enrollment.StatusChoices.ACTIVE:
        if Enrollment.objects.filter(
            student=student, academic_year=academic_year, status=Enrollment.StatusChoices.ACTIVE
        ).exists():
            raise ValidationError(
                {
                    "student": [
                        f"Student '{student.student_code}' already has an active enrollment "
                        f"for academic year {academic_year.name}."
                    ]
                }
            )

    reg_no = validated_data.get("registration_number", "").strip()
    if not reg_no:
        validated_data["registration_number"] = generate_registration_number(academic_year)

    actor = user if getattr(user, "is_authenticated", False) else None
    enrollment = Enrollment.objects.create(
        **validated_data,
        created_by=actor,
        updated_by=actor,
    )

    # Activate applicant student upon active enrollment
    if student.status == Student.StatusChoices.APPLICANT and enrollment.status == Enrollment.StatusChoices.ACTIVE:
        student.status = Student.StatusChoices.ACTIVE
        student.save(update_fields=["status", "updated_at"])

    EnrollmentHistory.objects.create(
        enrollment=enrollment,
        event_type="created",
        previous_data={},
        new_data=_snapshot(enrollment),
        reason=enrollment.remarks or "Initial enrollment",
        actor=actor,
    )

    record_audit_log(
        action="enroll",
        module="enrollments",
        actor=user,
        obj=enrollment,
        metadata={
            "student_code": student.student_code,
            "academic_year": academic_year.name,
            "major": major.code,
            "year_level": enrollment.year_level.code,
        },
        request=request,
    )
    return enrollment


@transaction.atomic
def promote_or_reenroll_student(
    *,
    source_enrollment: Enrollment,
    target_academic_year: AcademicYear,
    target_year_level: YearLevel,
    target_semester: Semester | None = None,
    target_degree: Degree | None = None,
    target_major: Major | None = None,
    enrollment_type: str = Enrollment.EnrollmentTypeChoices.PROMOTION,
    enrollment_date: date | None = None,
    remarks: str = "",
    user=None,
    request=None,
) -> Enrollment:
    """
    Promotes or re-enrolls an existing student into a target academic year/level.
    Never creates a duplicate Student profile; links progression via `previous_enrollment`.
    """
    degree = target_degree or source_enrollment.degree
    major = target_major or source_enrollment.major
    validate_enrollment_context(
        academic_year=target_academic_year,
        semester=target_semester,
        degree=degree,
        major=major,
    )

    if source_enrollment.academic_year_id == target_academic_year.id:
        raise ValidationError(
            {
                "target_academic_year": [
                    "Target academic year must be different from the source enrollment's academic year."
                ]
            }
        )

    if Enrollment.objects.filter(
        student=source_enrollment.student,
        academic_year=target_academic_year,
        status=Enrollment.StatusChoices.ACTIVE,
    ).exists():
        raise ValidationError(
            {
                "target_academic_year": [
                    f"Student '{source_enrollment.student.student_code}' already has an active "
                    f"enrollment in {target_academic_year.name}."
                ]
            }
        )

    actor = user if getattr(user, "is_authenticated", False) else None
    prev_snapshot = _snapshot(source_enrollment)

    # Preserve historical record by transitioning source enrollment out of 'active'
    source_enrollment.status = (
        Enrollment.StatusChoices.PROMOTED
        if enrollment_type == Enrollment.EnrollmentTypeChoices.PROMOTION
        else Enrollment.StatusChoices.COMPLETED
    )
    source_enrollment.updated_by = actor
    source_enrollment.save(update_fields=["status", "updated_by", "updated_at"])

    EnrollmentHistory.objects.create(
        enrollment=source_enrollment,
        event_type="promoted" if enrollment_type == Enrollment.EnrollmentTypeChoices.PROMOTION else "re_enrolled",
        previous_data=prev_snapshot,
        new_data=_snapshot(source_enrollment),
        reason=remarks or f"Progressed to {target_academic_year.name} ({target_year_level.code})",
        actor=actor,
    )

    new_enrollment = Enrollment.objects.create(
        registration_number=generate_registration_number(target_academic_year),
        student=source_enrollment.student,
        academic_year=target_academic_year,
        semester=target_semester,
        degree=degree,
        major=major,
        year_level=target_year_level,
        enrollment_type=enrollment_type,
        enrollment_date=enrollment_date or timezone.localdate(),
        status=Enrollment.StatusChoices.ACTIVE,
        previous_enrollment=source_enrollment,
        remarks=remarks,
        created_by=actor,
        updated_by=actor,
    )

    EnrollmentHistory.objects.create(
        enrollment=new_enrollment,
        event_type="promoted" if enrollment_type == Enrollment.EnrollmentTypeChoices.PROMOTION else "re_enrolled",
        previous_data=prev_snapshot,
        new_data=_snapshot(new_enrollment),
        reason=remarks or f"Progressed from {source_enrollment.registration_number}",
        actor=actor,
    )

    record_audit_log(
        action="promote" if enrollment_type == Enrollment.EnrollmentTypeChoices.PROMOTION else "re_enroll",
        module="enrollments",
        actor=user,
        obj=new_enrollment,
        metadata={
            "student_code": source_enrollment.student.student_code,
            "from_enrollment": source_enrollment.registration_number,
            "to_academic_year": target_academic_year.name,
            "to_year_level": target_year_level.code,
        },
        request=request,
    )
    return new_enrollment


@transaction.atomic
def change_enrollment_program_or_transfer(
    *,
    enrollment: Enrollment,
    degree: Degree | None = None,
    major: Major | None = None,
    year_level: YearLevel | None = None,
    status_val: str | None = None,
    reason: str = "",
    user=None,
    request=None,
) -> Enrollment:
    prev_snapshot = _snapshot(enrollment)
    next_degree = degree or enrollment.degree
    next_major = major or enrollment.major
    next_year_level = year_level or enrollment.year_level

    validate_enrollment_context(
        academic_year=enrollment.academic_year,
        semester=enrollment.semester,
        degree=next_degree,
        major=next_major,
    )

    actor = user if getattr(user, "is_authenticated", False) else None
    enrollment.degree = next_degree
    enrollment.major = next_major
    enrollment.year_level = next_year_level
    if status_val:
        enrollment.status = status_val
    if degree or major:
        enrollment.enrollment_type = Enrollment.EnrollmentTypeChoices.PROGRAM_CHANGE
    enrollment.updated_by = actor
    enrollment.save()

    event_type = "transferred" if status_val == Enrollment.StatusChoices.TRANSFERRED else "program_changed"
    EnrollmentHistory.objects.create(
        enrollment=enrollment,
        event_type=event_type,
        previous_data=prev_snapshot,
        new_data=_snapshot(enrollment),
        reason=reason,
        actor=actor,
    )

    record_audit_log(
        action=event_type,
        module="enrollments",
        actor=user,
        obj=enrollment,
        metadata={"previous": prev_snapshot, "new": _snapshot(enrollment), "reason": reason},
        request=request,
    )
    return enrollment
