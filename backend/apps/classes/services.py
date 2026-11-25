from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.academics.models import AcademicYear, Degree, Major, Semester
from apps.auditlogs.services import record_audit_log
from apps.classes.models import ClassMembership, ClassSection, ClassTransferHistory
from apps.enrollments.models import Enrollment


def validate_class_context(
    *,
    academic_year: AcademicYear,
    semester: Semester | None,
    degree: Degree | None,
    major: Major | None,
    allow_mixed_degrees: bool = False,
):
    if not allow_mixed_degrees:
        if degree is None:
            raise ValidationError(
                {"degree": ["Degree is required unless mixed degrees are enabled."]}
            )
        if major is None:
            raise ValidationError(
                {"major": ["Major is required unless mixed degrees are enabled."]}
            )
    if major is not None and degree is not None and major.degree_id != degree.id:
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


def get_allowed_degree_ids(class_section: ClassSection) -> set[int]:
    """Return explicit allowed degree IDs for a mixed-degree class (empty set = all degrees)."""
    allowed_ids = set(class_section.allowed_degrees.values_list("id", flat=True))
    if class_section.degree_id:
        allowed_ids.add(class_section.degree_id)
    return allowed_ids


def _validate_enrollment_matches_class(enrollment: Enrollment, class_section: ClassSection):
    if enrollment.status != Enrollment.StatusChoices.ACTIVE:
        raise ValidationError(
            {"enrollment": ["Only students with an active enrollment can be assigned to a class."]}
        )
    mismatches = []
    if enrollment.academic_year_id != class_section.academic_year_id:
        mismatches.append("academic year")
    if enrollment.year_level_id != class_section.year_level_id:
        mismatches.append("year level")

    if class_section.allow_mixed_degrees:
        allowed_ids = get_allowed_degree_ids(class_section)
        if allowed_ids and enrollment.degree_id not in allowed_ids:
            mismatches.append("allowed degrees")
    else:
        if enrollment.degree_id != class_section.degree_id:
            mismatches.append("degree")
        if enrollment.major_id != class_section.major_id:
            mismatches.append("major")

    if mismatches:
        raise ValidationError(
            {
                "enrollment": [
                    f"Student enrollment does not match this class's {', '.join(mismatches)}."
                ]
            }
        )


def _sync_class_capacity_status(class_section: ClassSection):
    if class_section.status not in (
        ClassSection.StatusChoices.OPEN,
        ClassSection.StatusChoices.FULL,
    ):
        return
    active_count = ClassMembership.objects.filter(
        class_section=class_section, status=ClassMembership.StatusChoices.ACTIVE
    ).count()
    next_status = (
        ClassSection.StatusChoices.FULL
        if active_count >= class_section.capacity
        else ClassSection.StatusChoices.OPEN
    )
    if class_section.status != next_status:
        class_section.status = next_status
        class_section.save(update_fields=["status", "updated_at"])


@transaction.atomic
def assign_student_to_class(
    *,
    class_section: ClassSection,
    enrollment: Enrollment,
    assigned_date: date | None = None,
    user=None,
    request=None,
) -> ClassMembership:
    if class_section.status in (
        ClassSection.StatusChoices.COMPLETED,
        ClassSection.StatusChoices.ARCHIVED,
    ):
        raise ValidationError(
            {"class_section": ["Cannot assign students to a completed or archived class."]}
        )

    _validate_enrollment_matches_class(enrollment, class_section)

    existing = ClassMembership.objects.filter(
        enrollment=enrollment,
        status=ClassMembership.StatusChoices.ACTIVE,
    ).select_related("class_section").first()
    if existing:
        if existing.class_section_id == class_section.id:
            raise ValidationError(
                {"enrollment": ["This student is already actively assigned to this class."]}
            )
        raise ValidationError(
            {
                "enrollment": [
                    f"This student is already assigned to class '{existing.class_section.code}'. "
                    "Use Class Transfer instead."
                ]
            }
        )

    active_count = ClassMembership.objects.filter(
        class_section=class_section,
        status=ClassMembership.StatusChoices.ACTIVE,
    ).count()
    if active_count >= class_section.capacity:
        raise ValidationError(
            {
                "class_section": [
                    f"Class '{class_section.code}' has reached its maximum capacity ({class_section.capacity})."
                ]
            }
        )

    actor = user if getattr(user, "is_authenticated", False) else None
    membership = ClassMembership.objects.create(
        class_section=class_section,
        enrollment=enrollment,
        student=enrollment.student,
        assigned_date=assigned_date or timezone.localdate(),
        status=ClassMembership.StatusChoices.ACTIVE,
        created_by=actor,
        updated_by=actor,
    )

    _sync_class_capacity_status(class_section)

    record_audit_log(
        action="assign_student",
        module="classes",
        actor=user,
        obj=membership,
        metadata={
            "class_code": class_section.code,
            "student_code": enrollment.student.student_code,
        },
        request=request,
    )
    return membership


@transaction.atomic
def transfer_student_class(
    *,
    membership: ClassMembership,
    target_class_section: ClassSection,
    reason: str = "",
    transfer_date: date | None = None,
    user=None,
    request=None,
) -> ClassMembership:
    if membership.status != ClassMembership.StatusChoices.ACTIVE:
        raise ValidationError({"membership": ["Only active class memberships can be transferred."]})

    if membership.class_section_id == target_class_section.id:
        raise ValidationError(
            {"target_class_section": ["Target class must be different from the current class."]}
        )

    if target_class_section.status in (
        ClassSection.StatusChoices.COMPLETED,
        ClassSection.StatusChoices.ARCHIVED,
    ):
        raise ValidationError(
            {"target_class_section": ["Cannot transfer into a completed or archived class."]}
        )

    _validate_enrollment_matches_class(membership.enrollment, target_class_section)

    target_count = ClassMembership.objects.filter(
        class_section=target_class_section,
        status=ClassMembership.StatusChoices.ACTIVE,
    ).count()
    if target_count >= target_class_section.capacity:
        raise ValidationError(
            {
                "target_class_section": [
                    f"Target class '{target_class_section.code}' is already at full capacity "
                    f"({target_class_section.capacity})."
                ]
            }
        )

    t_date = transfer_date or timezone.localdate()
    actor = user if getattr(user, "is_authenticated", False) else None
    source_class = membership.class_section

    membership.status = ClassMembership.StatusChoices.TRANSFERRED
    membership.left_date = t_date
    membership.updated_by = actor
    membership.save(update_fields=["status", "left_date", "updated_by", "updated_at"])

    new_membership = ClassMembership.objects.create(
        class_section=target_class_section,
        enrollment=membership.enrollment,
        student=membership.student,
        assigned_date=t_date,
        status=ClassMembership.StatusChoices.ACTIVE,
        created_by=actor,
        updated_by=actor,
    )

    ClassTransferHistory.objects.create(
        student=membership.student,
        enrollment=membership.enrollment,
        from_class_section=source_class,
        to_class_section=target_class_section,
        transfer_date=t_date,
        reason=reason,
        transferred_by=actor,
    )

    _sync_class_capacity_status(source_class)
    _sync_class_capacity_status(target_class_section)

    record_audit_log(
        action="transfer_student",
        module="classes",
        actor=user,
        obj=new_membership,
        metadata={
            "student_code": membership.student.student_code,
            "from_class": source_class.code,
            "to_class": target_class_section.code,
            "reason": reason,
        },
        request=request,
    )
    return new_membership
