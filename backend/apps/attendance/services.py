import csv
import io
from datetime import date

from django.db import transaction
from django.db.models import Count, Q
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.attendance.models import (
    AttendanceCorrectionLog,
    AttendanceRecord,
    AttendanceSession,
)
from apps.auditlogs.services import record_audit_log
from apps.classes.models import ClassMembership, ClassSection
from apps.subjects.models import Subject
from apps.system_settings.models import SystemSetting
from apps.teachers.models import Teacher, TeachingAssignment
from apps.teachers.views import _is_instructor_only_user


def get_attendance_warning_threshold() -> float:
    setting = SystemSetting.objects.filter(key="attendance.warning_threshold_percent").first()
    if setting and isinstance(setting.value, (int, float)):
        return float(setting.value)
    return 80.0


@transaction.atomic
def submit_bulk_attendance(
    *,
    class_section: ClassSection,
    subject: Subject,
    session_date: date,
    session_slot: int = 1,
    topic: str = "",
    records: list[dict],
    update_existing: bool = False,
    user=None,
    request=None,
) -> AttendanceSession:
    if not records:
        raise ValidationError({"records": ["At least one student attendance record is required."]})

    # Instructor-only users may only take attendance for classes/subjects they are assigned to teach
    if user and _is_instructor_only_user(user):
        assigned = TeachingAssignment.objects.filter(
            teacher__user=user,
            class_section=class_section,
            subject=subject,
            status=TeachingAssignment.StatusChoices.ACTIVE,
        ).exists()
        if not assigned:
            raise PermissionDenied(
                "You can only take attendance for classes and subjects assigned to you."
            )

    # Check duplicate student IDs in payload
    seen_students: set[int] = set()
    for item in records:
        sid = item["student"].id
        if sid in seen_students:
            raise ValidationError(
                {"records": [f"Duplicate attendance entry detected for student ID {sid}."]}
            )
        seen_students.add(sid)

    # Validate every student is actively assigned to this class section
    memberships = {
        m.student_id: m
        for m in ClassMembership.objects.select_related("student", "enrollment").filter(
            class_section=class_section,
            status=ClassMembership.StatusChoices.ACTIVE,
            student_id__in=seen_students,
        )
    }
    missing_ids = seen_students - set(memberships.keys())
    if missing_ids:
        raise ValidationError(
            {
                "records": [
                    f"Students {sorted(missing_ids)} are not actively assigned to class '{class_section.code}'."
                ]
            }
        )

    existing_session = AttendanceSession.objects.filter(
        class_section=class_section,
        subject=subject,
        session_date=session_date,
        session_slot=session_slot,
    ).first()

    if existing_session:
        if existing_session.status == AttendanceSession.StatusChoices.LOCKED:
            raise ValidationError({"session": ["This attendance session is locked and cannot be modified."]})
        if not update_existing:
            raise ValidationError(
                {
                    "session": [
                        f"Attendance session already exists for {class_section.code} ({subject.code}) "
                        f"on {session_date} (Slot {session_slot}). Enable edit mode to update it."
                    ]
                }
            )
        session = existing_session
        session.topic = topic or session.topic
        session.updated_by = user if getattr(user, "is_authenticated", False) else None
        session.save(update_fields=["topic", "updated_by", "updated_at"])
    else:
        teacher_obj = None
        if user and getattr(user, "is_authenticated", False):
            teacher_obj = Teacher.objects.filter(user=user).first()
        if teacher_obj is None:
            ta = TeachingAssignment.objects.filter(
                class_section=class_section,
                subject=subject,
                status=TeachingAssignment.StatusChoices.ACTIVE,
            ).select_related("teacher").first()
            teacher_obj = ta.teacher if ta else None

        actor = user if getattr(user, "is_authenticated", False) else None
        session = AttendanceSession.objects.create(
            academic_year=class_section.academic_year,
            class_section=class_section,
            subject=subject,
            teacher=teacher_obj,
            session_date=session_date,
            session_slot=session_slot,
            topic=topic,
            status=AttendanceSession.StatusChoices.SUBMITTED,
            taken_by=actor,
            created_by=actor,
            updated_by=actor,
        )

    actor = user if getattr(user, "is_authenticated", False) else None
    existing_records = {
        r.student_id: r for r in AttendanceRecord.objects.filter(session=session)
    }

    for item in records:
        student = item["student"]
        new_status = item["status"]
        remarks = item.get("remarks", "")
        membership = memberships[student.id]

        if student.id in existing_records:
            rec = existing_records[student.id]
            prev_status = rec.status
            if prev_status != new_status or rec.remarks != remarks:
                rec.status = new_status
                rec.remarks = remarks
                rec.marked_by = actor
                rec.save(update_fields=["status", "remarks", "marked_by", "marked_at", "updated_at"])
                if prev_status != new_status:
                    AttendanceCorrectionLog.objects.create(
                        attendance_record=rec,
                        previous_status=prev_status,
                        new_status=new_status,
                        reason=f"Bulk session update: {remarks or 'Updated during session edit'}",
                        corrected_by=actor,
                    )
        else:
            AttendanceRecord.objects.create(
                session=session,
                student=student,
                enrollment=membership.enrollment,
                status=new_status,
                remarks=remarks,
                marked_by=actor,
            )

    record_audit_log(
        action="bulk_attendance",
        module="attendance",
        actor=user,
        obj=session,
        metadata={
            "class_code": class_section.code,
            "subject_code": subject.code,
            "session_date": session_date.isoformat(),
            "record_count": len(records),
            "update_existing": update_existing,
        },
        request=request,
    )
    return session


@transaction.atomic
def correct_attendance_record(
    *,
    record: AttendanceRecord,
    new_status: str,
    reason: str,
    remarks: str | None = None,
    user=None,
    request=None,
) -> AttendanceRecord:
    if record.session.status == AttendanceSession.StatusChoices.LOCKED:
        raise ValidationError({"session": ["Cannot modify records in a locked attendance session."]})
    if not reason or not reason.strip():
        raise ValidationError({"reason": ["A correction reason is required."]})

    prev_status = record.status
    actor = user if getattr(user, "is_authenticated", False) else None
    record.status = new_status
    if remarks is not None:
        record.remarks = remarks
    record.marked_by = actor
    record.save(update_fields=["status", "remarks", "marked_by", "marked_at", "updated_at"])

    AttendanceCorrectionLog.objects.create(
        attendance_record=record,
        previous_status=prev_status,
        new_status=new_status,
        reason=reason.strip(),
        corrected_by=actor,
    )

    record_audit_log(
        action="correct_attendance",
        module="attendance",
        actor=user,
        obj=record,
        metadata={
            "student_code": record.student.student_code,
            "previous_status": prev_status,
            "new_status": new_status,
            "reason": reason.strip(),
        },
        request=request,
    )
    return record


def compute_attendance_summary(records_qs, *, warnings_only: bool = False) -> dict:
    threshold = get_attendance_warning_threshold()
    rows = (
        records_qs.values(
            "student_id",
            "student__student_code",
            "student__full_name_en",
            "student__full_name_km",
        )
        .annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.PRESENT)),
            late=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.LATE)),
            absent=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.ABSENT)),
            excused=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.EXCUSED)),
            permission=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.PERMISSION)),
        )
        .order_by("student__student_code")
    )

    results = []
    for row in rows:
        total = row["total"] or 0
        attended = (row["present"] or 0) + (row["late"] or 0)
        rate = round((attended / total) * 100.0, 1) if total > 0 else 100.0
        is_warning = total > 0 and rate < threshold
        if warnings_only and not is_warning:
            continue
        results.append(
            {
                "student_id": row["student_id"],
                "student_code": row["student__student_code"],
                "student_name_en": row["student__full_name_en"],
                "student_name_km": row["student__full_name_km"],
                "total_sessions": total,
                "present": row["present"],
                "late": row["late"],
                "absent": row["absent"],
                "excused": row["excused"],
                "permission": row["permission"],
                "attendance_rate": rate,
                "is_warning": is_warning,
            }
        )

    return {
        "warning_threshold_percent": threshold,
        "student_count": len(results),
        "warning_count": sum(1 for r in results if r["is_warning"]),
        "results": results,
    }


def build_attendance_csv(records_qs) -> str:
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Date",
            "Slot",
            "Class Code",
            "Subject Code",
            "Subject Name",
            "Student ID",
            "Student Name (EN)",
            "Student Name (KM)",
            "Status",
            "Remarks",
        ]
    )
    for rec in records_qs.select_related("session__class_section", "session__subject", "student").iterator(
        chunk_size=500
    ):
        writer.writerow(
            [
                rec.session.session_date.isoformat(),
                rec.session.session_slot,
                rec.session.class_section.code,
                rec.session.subject.code,
                rec.session.subject.name_en,
                rec.student.student_code,
                rec.student.full_name_en,
                rec.student.full_name_km,
                rec.status,
                rec.remarks,
            ]
        )
    return buffer.getvalue()
