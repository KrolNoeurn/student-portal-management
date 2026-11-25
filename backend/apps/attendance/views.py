from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.attendance.serializers import (
    AttendanceRecordSerializer,
    AttendanceSessionSerializer,
    BulkAttendanceSubmitSerializer,
    CorrectAttendanceSerializer,
)
from apps.attendance.services import (
    build_attendance_csv,
    compute_attendance_summary,
    correct_attendance_record,
    submit_bulk_attendance,
)
from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions
from apps.students.views import _is_student_only_user
from apps.teachers.views import _is_instructor_only_user


def _filter_records_qs(request, qs):
    class_section = request.query_params.get("class_section")
    subject = request.query_params.get("subject")
    student = request.query_params.get("student")
    academic_year = request.query_params.get("academic_year")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    month = request.query_params.get("month")  # YYYY-MM

    if class_section:
        qs = qs.filter(session__class_section_id=class_section)
    if subject:
        qs = qs.filter(session__subject_id=subject)
    if student:
        qs = qs.filter(student_id=student)
    if academic_year:
        qs = qs.filter(session__academic_year_id=academic_year)
    if date_from:
        qs = qs.filter(session__session_date__gte=date_from)
    if date_to:
        qs = qs.filter(session__session_date__lte=date_to)
    if month and len(month) == 7 and "-" in month:
        y, m = month.split("-")
        if y.isdigit() and m.isdigit():
            qs = qs.filter(session__session_date__year=int(y), session__session_date__month=int(m))
    return qs


class AttendanceSessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceSessionSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["academic_year", "class_section", "subject", "session_date", "status"]

    def get_queryset(self):
        qs = (
            AttendanceSession.objects.select_related(
                "academic_year", "class_section", "subject", "teacher"
            )
            .annotate(
                total_count=Count("records", distinct=True),
                present_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.PRESENT)
                ),
                absent_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.ABSENT)
                ),
                late_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.LATE)
                ),
                excused_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.EXCUSED)
                ),
                permission_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.PERMISSION)
                ),
            )
            .order_by("-session_date", "-session_slot", "-id")
        )
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(session_date__gte=date_from)
        if date_to:
            qs = qs.filter(session_date__lte=date_to)

        user = self.request.user
        if _is_instructor_only_user(user):
            return qs.filter(
                class_section__teaching_assignments__teacher__user=user
            ).distinct()
        if _is_student_only_user(user):
            return qs.filter(records__student__user=user).distinct()
        return qs


class AttendanceRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["session", "student", "status"]

    def get_queryset(self):
        qs = (
            AttendanceRecord.objects.select_related(
                "session", "session__class_section", "session__subject", "student"
            )
            .prefetch_related("corrections__corrected_by")
            .order_by("-session__session_date", "student__student_code")
        )
        qs = _filter_records_qs(self.request, qs)
        user = self.request.user
        if _is_student_only_user(user):
            return qs.filter(student__user=user)
        if _is_instructor_only_user(user):
            return qs.filter(
                session__class_section__teaching_assignments__teacher__user=user
            ).distinct()
        return qs

    @action(detail=True, methods=["post"], url_path="correct")
    def correct(self, request, pk=None):
        if not (
            request.user.has_perm("attendance.correct_attendance")
            or request.user.has_perm("attendance.change_attendancerecord")
        ):
            raise PermissionDenied("You do not have permission to correct attendance records.")
        record = self.get_object()
        serializer = CorrectAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = correct_attendance_record(
            record=record,
            new_status=serializer.validated_data["status"],
            reason=serializer.validated_data["reason"],
            remarks=serializer.validated_data.get("remarks"),
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(updated).data)


class BulkAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (
            request.user.has_perm("attendance.take_attendance")
            or request.user.has_perm("attendance.add_attendancesession")
        ):
            raise PermissionDenied("You do not have permission to take attendance.")
        serializer = BulkAttendanceSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = submit_bulk_attendance(
            **serializer.validated_data,
            user=request.user,
            request=request,
        )
        # Re-fetch annotated session for immediate stats display
        annotated = (
            AttendanceSession.objects.select_related(
                "academic_year", "class_section", "subject", "teacher"
            )
            .annotate(
                total_count=Count("records", distinct=True),
                present_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.PRESENT)
                ),
                absent_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.ABSENT)
                ),
                late_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.LATE)
                ),
                excused_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.EXCUSED)
                ),
                permission_count=Count(
                    "records", filter=Q(records__status=AttendanceRecord.StatusChoices.PERMISSION)
                ),
            )
            .get(pk=session.pk)
        )
        return Response(AttendanceSessionSerializer(annotated).data, status=status.HTTP_201_CREATED)


class AttendanceSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (
            request.user.has_perm("attendance.view_attendancerecord")
            or request.user.has_perm("attendance.view_attendancesession")
        ):
            raise PermissionDenied()

        qs = AttendanceRecord.objects.all()
        qs = _filter_records_qs(request, qs)
        if _is_student_only_user(request.user):
            qs = qs.filter(student__user=request.user)
        elif _is_instructor_only_user(request.user):
            qs = qs.filter(
                session__class_section__teaching_assignments__teacher__user=request.user
            ).distinct()

        warnings_only = request.query_params.get("warnings_only") == "true"
        return Response(compute_attendance_summary(qs, warnings_only=warnings_only))


class AttendanceExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.has_perm("attendance.export_attendance"):
            raise PermissionDenied("You do not have permission to export attendance reports.")

        qs = _filter_records_qs(
            request,
            AttendanceRecord.objects.select_related(
                "session", "session__class_section", "session__subject", "student"
            ),
        ).order_by("-session__session_date", "student__student_code")
        if _is_instructor_only_user(request.user):
            qs = qs.filter(
                session__class_section__teaching_assignments__teacher__user=request.user
            ).distinct()
        csv_data = build_attendance_csv(qs)
        response = HttpResponse(csv_data, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="attendance_report.csv"'
        record_audit_log(
            action="export",
            module="attendance",
            actor=request.user,
            metadata={"count": qs.count()},
            request=request,
        )
        return response
