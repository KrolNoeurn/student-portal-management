import csv
import io

from django.db.models import Count, Q

from apps.academics.models import AcademicYear, Degree, Major
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.attendance.services import compute_attendance_summary
from apps.auditlogs.models import AuditLog
from apps.classes.models import ClassMembership, ClassSection
from apps.enrollments.models import Enrollment
from apps.examinations.models import SubjectGrade
from apps.examinations.services import build_student_transcript
from apps.students.models import Student
from apps.students.views import _is_student_only_user
from apps.teachers.models import ClassSchedule, Teacher, TeachingAssignment
from apps.teachers.views import _is_instructor_only_user


def build_dashboard_payload(user) -> dict:
    """Return real-data dashboard metrics tailored to the authenticated user's role/permissions."""
    if _is_student_only_user(user):
        return _build_student_dashboard(user)
    if _is_instructor_only_user(user):
        return _build_instructor_dashboard(user)
    if user.is_superuser or user.has_perm("reports.view_admin_dashboard"):
        return _build_admin_dashboard()
    return _build_academic_dashboard()


def _attendance_overview_counts(records_qs) -> dict:
    agg = records_qs.aggregate(
        total=Count("id"),
        present=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.PRESENT)),
        late=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.LATE)),
        absent=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.ABSENT)),
        excused=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.EXCUSED)),
        permission=Count("id", filter=Q(status=AttendanceRecord.StatusChoices.PERMISSION)),
    )
    total = agg["total"] or 0
    attended = (agg["present"] or 0) + (agg["late"] or 0)
    agg["attendance_rate"] = round((attended / total) * 100.0, 1) if total > 0 else 0.0
    return agg


def _build_admin_dashboard() -> dict:
    enrollment_by_year = list(
        Enrollment.objects.values("academic_year__name")
        .annotate(count=Count("id"))
        .order_by("academic_year__name")
    )
    students_by_major = list(
        Enrollment.objects.filter(status=Enrollment.StatusChoices.ACTIVE)
        .values("major__code", "major__name_en")
        .annotate(count=Count("student_id", distinct=True))
        .order_by("-count")[:10]
    )
    students_by_degree = list(
        Enrollment.objects.filter(status=Enrollment.StatusChoices.ACTIVE)
        .values("degree__code", "degree__name_en")
        .annotate(count=Count("student_id", distinct=True))
        .order_by("-count")
    )
    students_by_status = list(
        Student.objects.values("status").annotate(count=Count("id")).order_by("-count")
    )
    recent_activities = [
        {
            "id": log.id,
            "module": log.module,
            "action": log.action,
            "object_repr": log.object_repr,
            "actor": (log.actor.get_full_name().strip() or log.actor.username) if log.actor else "System",
            "created_at": log.created_at.isoformat(),
        }
        for log in AuditLog.objects.select_related("actor")[:10]
    ]

    return {
        "dashboard_type": "admin",
        "kpis": {
            "total_students": Student.objects.count(),
            "active_students": Student.objects.filter(status=Student.StatusChoices.ACTIVE).count(),
            "total_academic_years": AcademicYear.objects.count(),
            "total_degrees": Degree.objects.count(),
            "total_majors": Major.objects.count(),
            "total_classes": ClassSection.objects.count(),
            "total_teachers": Teacher.objects.count(),
            "active_enrollments": Enrollment.objects.filter(
                status=Enrollment.StatusChoices.ACTIVE
            ).count(),
        },
        "attendance": _attendance_overview_counts(AttendanceRecord.objects.all()),
        "enrollment_by_year": [
            {"label": r["academic_year__name"], "count": r["count"]} for r in enrollment_by_year
        ],
        "students_by_major": [
            {"code": r["major__code"], "label": r["major__name_en"], "count": r["count"]}
            for r in students_by_major
        ],
        "students_by_degree": [
            {"code": r["degree__code"], "label": r["degree__name_en"], "count": r["count"]}
            for r in students_by_degree
        ],
        "students_by_status": students_by_status,
        "recent_activities": recent_activities,
    }


def _build_academic_dashboard() -> dict:
    base = _build_admin_dashboard()
    class_distribution = list(
        ClassSection.objects.annotate(
            active_students=Count(
                "memberships",
                filter=Q(memberships__status=ClassMembership.StatusChoices.ACTIVE),
                distinct=True,
            )
        )
        .values("id", "code", "name", "capacity", "active_students")
        .order_by("-active_students")[:10]
    )
    base["dashboard_type"] = "academic_officer"
    base["class_distribution"] = class_distribution
    base["recent_activities"] = []
    return base


def _build_instructor_dashboard(user) -> dict:
    assignments = TeachingAssignment.objects.select_related(
        "class_section", "subject", "academic_year"
    ).filter(teacher__user=user, status=TeachingAssignment.StatusChoices.ACTIVE)

    class_ids = list(assignments.values_list("class_section_id", flat=True).distinct())
    total_students = (
        ClassMembership.objects.filter(
            class_section_id__in=class_ids, status=ClassMembership.StatusChoices.ACTIVE
        )
        .values("student_id")
        .distinct()
        .count()
    )
    schedules = [
        {
            "id": s.id,
            "day_name": s.get_day_of_week_display(),
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
            "class_code": s.class_section.code,
            "subject_code": s.subject.code,
            "subject_name": s.subject.name_en,
            "classroom_code": s.classroom.code,
        }
        for s in ClassSchedule.objects.select_related(
            "class_section", "subject", "classroom"
        ).filter(teacher__user=user, is_active=True)[:12]
    ]

    return {
        "dashboard_type": "instructor",
        "kpis": {
            "assigned_classes": len(class_ids),
            "assigned_subjects": assignments.values("subject_id").distinct().count(),
            "total_students": total_students,
            "attendance_sessions_taken": AttendanceSession.objects.filter(
                class_section_id__in=class_ids
            ).count(),
        },
        "assigned_classes_list": [
            {
                "id": a.class_section_id,
                "class_code": a.class_section.code,
                "class_name": a.class_section.name,
                "subject_code": a.subject.code,
                "subject_name": a.subject.name_en,
                "academic_year": a.academic_year.name,
            }
            for a in assignments[:15]
        ],
        "schedules": schedules,
    }


def _build_student_dashboard(user) -> dict:
    student = Student.objects.filter(user=user).first()
    if not student:
        return {
            "dashboard_type": "student",
            "profile": None,
            "enrollment": None,
            "attendance": _attendance_overview_counts(AttendanceRecord.objects.none()),
            "transcript_summary": {"cumulative_gpa": "0.00", "credits_earned": "0.0", "subjects_count": 0},
        }

    active_enrollment = (
        Enrollment.objects.select_related("academic_year", "degree", "major", "year_level")
        .filter(student=student, status=Enrollment.StatusChoices.ACTIVE)
        .first()
    )
    active_membership = (
        ClassMembership.objects.select_related("class_section")
        .filter(student=student, status=ClassMembership.StatusChoices.ACTIVE)
        .first()
    )
    transcript = build_student_transcript(student, published_only=True)

    return {
        "dashboard_type": "student",
        "profile": {
            "id": student.id,
            "student_code": student.student_code,
            "full_name_en": student.full_name_en,
            "full_name_km": student.full_name_km,
            "status": student.status,
        },
        "enrollment": (
            {
                "registration_number": active_enrollment.registration_number,
                "academic_year": active_enrollment.academic_year.name,
                "degree": active_enrollment.degree.name_en,
                "major": active_enrollment.major.name_en,
                "year_level": active_enrollment.year_level.name_en,
                "class_code": active_membership.class_section.code if active_membership else "—",
            }
            if active_enrollment
            else None
        ),
        "attendance": _attendance_overview_counts(AttendanceRecord.objects.filter(student=student)),
        "transcript_summary": transcript["summary"],
    }


def generate_report_rows(report_type: str, params) -> tuple[list[str], list[dict]]:
    """Build filterable tabular data for all institutional report types."""
    year = params.get("academic_year")
    degree = params.get("degree")
    major = params.get("major")
    year_level = params.get("year_level")
    class_section = params.get("class_section")
    month = params.get("month")

    if report_type == "students":
        qs = Student.objects.all()
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        cols = ["student_code", "full_name_en", "full_name_km", "gender", "phone", "email", "status"]
        rows = list(qs.values(*cols)[:500])
        return cols, rows

    if report_type == "enrollments-by-year":
        qs = Enrollment.objects.all()
        if year:
            qs = qs.filter(academic_year_id=year)
        if degree:
            qs = qs.filter(degree_id=degree)
        if major:
            qs = qs.filter(major_id=major)
        if year_level:
            qs = qs.filter(year_level_id=year_level)
        agg = (
            qs.values("academic_year__name", "degree__code", "major__name_en", "year_level__code")
            .annotate(total_enrollments=Count("id"), active_enrollments=Count("id", filter=Q(status="active")))
            .order_by("academic_year__name", "degree__code", "major__name_en")
        )
        cols = ["academic_year", "degree", "major", "year_level", "total_enrollments", "active_enrollments"]
        rows = [
            {
                "academic_year": r["academic_year__name"],
                "degree": r["degree__code"],
                "major": r["major__name_en"],
                "year_level": r["year_level__code"],
                "total_enrollments": r["total_enrollments"],
                "active_enrollments": r["active_enrollments"],
            }
            for r in agg
        ]
        return cols, rows

    if report_type == "students-by-degree":
        qs = Enrollment.objects.all()
        if year:
            qs = qs.filter(academic_year_id=year)
        agg = (
            qs.values("degree__code", "degree__name_en")
            .annotate(student_count=Count("student_id", distinct=True))
            .order_by("-student_count")
        )
        cols = ["degree_code", "degree_name", "student_count"]
        rows = [
            {
                "degree_code": r["degree__code"],
                "degree_name": r["degree__name_en"],
                "student_count": r["student_count"],
            }
            for r in agg
        ]
        return cols, rows

    if report_type == "students-by-major":
        qs = Enrollment.objects.all()
        if year:
            qs = qs.filter(academic_year_id=year)
        if degree:
            qs = qs.filter(degree_id=degree)
        agg = (
            qs.values("degree__code", "major__code", "major__name_en")
            .annotate(student_count=Count("student_id", distinct=True))
            .order_by("-student_count")
        )
        cols = ["degree_code", "major_code", "major_name", "student_count"]
        rows = [
            {
                "degree_code": r["degree__code"],
                "major_code": r["major__code"],
                "major_name": r["major__name_en"],
                "student_count": r["student_count"],
            }
            for r in agg
        ]
        return cols, rows

    if report_type == "students-by-class":
        qs = ClassSection.objects.select_related("academic_year", "major", "year_level")
        if year:
            qs = qs.filter(academic_year_id=year)
        if degree:
            qs = qs.filter(degree_id=degree)
        if major:
            qs = qs.filter(major_id=major)
        if year_level:
            qs = qs.filter(year_level_id=year_level)
        qs = qs.annotate(
            active_students=Count(
                "memberships",
                filter=Q(memberships__status=ClassMembership.StatusChoices.ACTIVE),
                distinct=True,
            )
        )
        cols = ["class_code", "class_name", "academic_year", "major", "year_level", "active_students", "capacity"]
        rows = [
            {
                "class_code": c.code,
                "class_name": c.name,
                "academic_year": c.academic_year.name,
                "major": c.major.name_en,
                "year_level": c.year_level.code,
                "active_students": c.active_students,
                "capacity": c.capacity,
            }
            for c in qs
        ]
        return cols, rows

    if report_type == "students-by-status":
        agg = Student.objects.values("status").annotate(student_count=Count("id")).order_by("-student_count")
        cols = ["status", "student_count"]
        return cols, list(agg)

    if report_type == "attendance-monthly":
        qs = AttendanceRecord.objects.all()
        if year:
            qs = qs.filter(session__academic_year_id=year)
        if class_section:
            qs = qs.filter(session__class_section_id=class_section)
        if month and len(month) == 7 and "-" in month:
            y, m = month.split("-")
            if y.isdigit() and m.isdigit():
                qs = qs.filter(session__session_date__year=int(y), session__session_date__month=int(m))
        summary = compute_attendance_summary(qs)
        cols = [
            "student_code",
            "student_name_en",
            "total_sessions",
            "present",
            "late",
            "absent",
            "excused",
            "permission",
            "attendance_rate",
        ]
        rows = [{c: r[c] for c in cols} for r in summary["results"]]
        return cols, rows

    if report_type == "academic-progress":
        qs = SubjectGrade.objects.select_related("student", "class_section", "subject", "enrollment__academic_year")
        if year:
            qs = qs.filter(enrollment__academic_year_id=year)
        if class_section:
            qs = qs.filter(class_section_id=class_section)
        cols = [
            "student_code",
            "student_name",
            "class_code",
            "subject_code",
            "total_percentage",
            "letter_grade",
            "grade_point",
            "status",
        ]
        rows = [
            {
                "student_code": g.student.student_code,
                "student_name": g.student.full_name_en,
                "class_code": g.class_section.code,
                "subject_code": g.subject.code,
                "total_percentage": str(g.total_percentage),
                "letter_grade": g.letter_grade,
                "grade_point": str(g.grade_point),
                "status": g.status,
            }
            for g in qs[:500]
        ]
        return cols, rows

    raise ValueError(f"Unsupported report type '{report_type}'.")


def rows_to_csv(columns: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.DictWriter(buf, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buf.getvalue()
