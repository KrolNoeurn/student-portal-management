from datetime import time

from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from apps.auditlogs.services import record_audit_log
from apps.classes.models import Classroom, ClassSubject
from apps.teachers.models import ClassSchedule, Teacher, TeachingAssignment


def generate_teacher_code() -> str:
    seq = Teacher.all_objects.count() + 1
    while True:
        candidate = f"TCH-{seq:04d}"
        if not Teacher.all_objects.filter(teacher_code=candidate).exists():
            return candidate
        seq += 1


@transaction.atomic
def create_teaching_assignment(*, validated_data: dict, user=None, request=None) -> TeachingAssignment:
    class_section = validated_data["class_section"]
    semester = validated_data.get("semester") or class_section.semester
    if semester is not None and semester.academic_year_id != class_section.academic_year_id:
        raise ValidationError(
            {
                "semester": [
                    f"Semester '{semester.name}' does not belong to class academic year "
                    f"'{class_section.academic_year.name}'."
                ]
            }
        )

    actor = user if getattr(user, "is_authenticated", False) else None
    assignment = TeachingAssignment.objects.create(
        teacher=validated_data["teacher"],
        academic_year=class_section.academic_year,
        semester=semester,
        class_section=class_section,
        subject=validated_data["subject"],
        role=validated_data.get("role", TeachingAssignment.RoleChoices.PRIMARY),
        status=validated_data.get("status", TeachingAssignment.StatusChoices.ACTIVE),
        created_by=actor,
        updated_by=actor,
    )

    # Ensure the subject is also linked to the class section's subject list
    if semester is not None:
        ClassSubject.objects.get_or_create(
            class_section=class_section,
            subject=assignment.subject,
            semester=semester,
        )
    else:
        if not ClassSubject.objects.filter(
            class_section=class_section, subject=assignment.subject, semester__isnull=True
        ).exists():
            ClassSubject.objects.create(
                class_section=class_section,
                subject=assignment.subject,
                semester=None,
            )

    record_audit_log(
        action="assign_teacher",
        module="teachers",
        actor=user,
        obj=assignment,
        metadata={
            "teacher_code": assignment.teacher.teacher_code,
            "class_code": class_section.code,
            "subject_code": assignment.subject.code,
        },
        request=request,
    )
    return assignment


def detect_schedule_conflicts(
    *,
    teaching_assignment: TeachingAssignment,
    classroom: Classroom,
    day_of_week: int,
    start_time: time,
    end_time: time,
    exclude_schedule_id: int | None = None,
) -> list[dict]:
    """
    Detect overlapping time slots across:
      1. Teacher schedule conflict
      2. Classroom conflict
      3. Class section schedule conflict
    Two slots [s1, e1) and [s2, e2) overlap iff s1 < e2 and e1 > s2.
    """
    if end_time <= start_time:
        raise ValidationError({"end_time": ["End time must be later than start time."]})

    qs = (
        ClassSchedule.objects.select_related("teacher", "classroom", "class_section", "subject")
        .filter(
            is_active=True,
            academic_year=teaching_assignment.academic_year,
            day_of_week=day_of_week,
            start_time__lt=end_time,
            end_time__gt=start_time,
        )
    )

    if teaching_assignment.semester_id is not None:
        qs = qs.filter(
            Q(semester_id=teaching_assignment.semester_id) | Q(semester__isnull=True)
        )

    if exclude_schedule_id:
        qs = qs.exclude(pk=exclude_schedule_id)

    conflicts: list[dict] = []

    for existing in qs:
        slot_desc = f"{existing.start_time:%H:%M}-{existing.end_time:%H:%M}"
        if existing.teacher_id == teaching_assignment.teacher_id:
            conflicts.append(
                {
                    "type": "teacher",
                    "schedule_id": existing.id,
                    "message": (
                        f"Teacher conflict: {existing.teacher.full_name_en} is already teaching "
                        f"{existing.class_section.code} ({existing.subject.code}) at {slot_desc}."
                    ),
                }
            )
        if existing.classroom_id == classroom.id:
            conflicts.append(
                {
                    "type": "classroom",
                    "schedule_id": existing.id,
                    "message": (
                        f"Classroom conflict: Room {existing.classroom.code} is already occupied by "
                        f"{existing.class_section.code} ({existing.subject.code}) at {slot_desc}."
                    ),
                }
            )
        if existing.class_section_id == teaching_assignment.class_section_id:
            conflicts.append(
                {
                    "type": "class_section",
                    "schedule_id": existing.id,
                    "message": (
                        f"Class schedule conflict: {existing.class_section.code} already has "
                        f"{existing.subject.code} scheduled at {slot_desc}."
                    ),
                }
            )

    return conflicts


@transaction.atomic
def save_class_schedule(
    *,
    validated_data: dict,
    instance: ClassSchedule | None = None,
    user=None,
    request=None,
) -> ClassSchedule:
    assignment: TeachingAssignment = validated_data.get(
        "teaching_assignment", getattr(instance, "teaching_assignment", None)
    )
    classroom: Classroom = validated_data.get("classroom", getattr(instance, "classroom", None))
    day_of_week: int = validated_data.get("day_of_week", getattr(instance, "day_of_week", None))
    start_time: time = validated_data.get("start_time", getattr(instance, "start_time", None))
    end_time: time = validated_data.get("end_time", getattr(instance, "end_time", None))
    is_active: bool = validated_data.get("is_active", getattr(instance, "is_active", True))

    if is_active:
        conflicts = detect_schedule_conflicts(
            teaching_assignment=assignment,
            classroom=classroom,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            exclude_schedule_id=instance.pk if instance else None,
        )
        if conflicts:
            raise ValidationError(
                {
                    "conflicts": [c["message"] for c in conflicts],
                }
            )

    actor = user if getattr(user, "is_authenticated", False) else None
    fields = {
        "teaching_assignment": assignment,
        "academic_year": assignment.academic_year,
        "semester": assignment.semester,
        "class_section": assignment.class_section,
        "teacher": assignment.teacher,
        "subject": assignment.subject,
        "classroom": classroom,
        "day_of_week": day_of_week,
        "start_time": start_time,
        "end_time": end_time,
        "is_active": is_active,
        "notes": validated_data.get("notes", getattr(instance, "notes", "")),
        "updated_by": actor,
    }

    if instance is None:
        schedule = ClassSchedule.objects.create(**fields, created_by=actor)
        action_name = "create_schedule"
    else:
        for k, v in fields.items():
            setattr(instance, k, v)
        instance.save()
        schedule = instance
        action_name = "update_schedule"

    record_audit_log(
        action=action_name,
        module="teachers",
        actor=user,
        obj=schedule,
        metadata={
            "class_code": schedule.class_section.code,
            "teacher_code": schedule.teacher.teacher_code,
            "classroom_code": schedule.classroom.code,
            "day_of_week": schedule.day_of_week,
            "time": f"{schedule.start_time:%H:%M}-{schedule.end_time:%H:%M}",
        },
        request=request,
    )
    return schedule
