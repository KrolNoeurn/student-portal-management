from django.http import FileResponse, HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions
from apps.students.filters import StudentFilter
from apps.students.models import (
    Student,
    StudentDocument,
    StudentEducationHistory,
    StudentGuardian,
)
from apps.students.serializers import (
    ChangeStudentStatusSerializer,
    DuplicateCheckSerializer,
    StudentDetailSerializer,
    StudentDocumentSerializer,
    StudentEducationHistorySerializer,
    StudentGuardianSerializer,
    StudentListSerializer,
)
from apps.students.services import (
    build_students_csv,
    change_student_status,
    find_potential_duplicates,
)
from apps.system_settings.services import get_public_bootstrap_config


def _is_student_only_user(user) -> bool:
    """True when user belongs exclusively to the Student role (not staff/superuser)."""
    if user.is_superuser:
        return False
    group_names = set(user.groups.values_list("name", flat=True))
    return group_names == {"Student"}


class StudentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_class = StudentFilter
    search_fields = [
        "student_code",
        "full_name_en",
        "full_name_km",
        "phone",
        "email",
        "national_id_number",
    ]
    ordering_fields = ["student_code", "full_name_en", "created_at", "status", "date_of_birth"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        include_archived = self.request.query_params.get("include_archived") == "true"
        base_qs = Student.all_objects if include_archived and user.has_perm("students.archive_student") else Student.objects
        qs = base_qs.prefetch_related(
            "guardians", "education_history", "documents", "status_history"
        )
        if _is_student_only_user(user):
            return qs.filter(user=user)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return StudentListSerializer
        return StudentDetailSerializer

    def perform_create(self, serializer):
        student = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="students",
            actor=self.request.user,
            obj=student,
            metadata={"student_code": student.student_code, "status": student.status},
            request=self.request,
        )

    def perform_update(self, serializer):
        student = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="students",
            actor=self.request.user,
            obj=student,
            metadata={"student_code": student.student_code, "status": student.status},
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        if not (
            request.user.has_perm("students.archive_student")
            or request.user.has_perm("students.delete_student")
        ):
            raise PermissionDenied("You do not have permission to archive students.")
        student = self.get_object()
        student.soft_delete(user=request.user)
        record_audit_log(
            action="archive",
            module="students",
            actor=request.user,
            obj=student,
            metadata={"student_code": student.student_code},
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="check-duplicate")
    def check_duplicate(self, request):
        if not request.user.has_perm("students.view_student"):
            raise PermissionDenied()
        serializer = DuplicateCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        matches = find_potential_duplicates(**serializer.validated_data)
        return Response(
            {
                "has_duplicates": matches.exists(),
                "matches": StudentListSerializer(matches, many=True).data,
            }
        )

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        if not request.user.has_perm("students.change_student"):
            raise PermissionDenied()
        student = self.get_object()
        serializer = ChangeStudentStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = change_student_status(
            student=student,
            new_status=serializer.validated_data["status"],
            reason=serializer.validated_data.get("reason", ""),
            effective_date=serializer.validated_data.get("effective_date"),
            user=request.user,
            request=request,
        )
        return Response(StudentDetailSerializer(updated, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="upload-photo", parser_classes=[MultiPartParser, FormParser])
    def upload_photo(self, request, pk=None):
        if not request.user.has_perm("students.change_student"):
            raise PermissionDenied()
        student = self.get_object()
        photo = request.FILES.get("profile_photo")
        if not photo:
            raise ValidationError({"profile_photo": ["Please select an image file to upload."]})
        student.profile_photo = photo
        student.updated_by = request.user
        student.full_clean()
        student.save(update_fields=["profile_photo", "updated_by", "updated_at"])
        record_audit_log(
            action="upload_photo",
            module="students",
            actor=request.user,
            obj=student,
            request=request,
        )
        return Response(StudentDetailSerializer(student, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="print-data")
    def print_data(self, request, pk=None):
        if not (
            request.user.has_perm("students.print_student_profile")
            or request.user.has_perm("students.view_student")
        ):
            raise PermissionDenied()
        student = self.get_object()
        return Response(
            {
                "institution": get_public_bootstrap_config()["institution"],
                "student": StudentDetailSerializer(student, context={"request": request}).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        if not request.user.has_perm("students.export_student"):
            raise PermissionDenied("You do not have permission to export student records.")
        qs = self.filter_queryset(self.get_queryset())
        csv_content = build_students_csv(qs)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="students_export.csv"'
        record_audit_log(
            action="export",
            module="students",
            actor=request.user,
            metadata={"count": qs.count()},
            request=request,
        )
        return response


class StudentGuardianViewSet(viewsets.ModelViewSet):
    queryset = StudentGuardian.objects.select_related("student").all()
    serializer_class = StudentGuardianSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["student"]

    def get_queryset(self):
        qs = super().get_queryset()
        if _is_student_only_user(self.request.user):
            return qs.filter(student__user=self.request.user)
        return qs


class StudentEducationHistoryViewSet(viewsets.ModelViewSet):
    queryset = StudentEducationHistory.objects.select_related("student").all()
    serializer_class = StudentEducationHistorySerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["student"]

    def get_queryset(self):
        qs = super().get_queryset()
        if _is_student_only_user(self.request.user):
            return qs.filter(student__user=self.request.user)
        return qs


class StudentDocumentViewSet(viewsets.ModelViewSet):
    queryset = StudentDocument.objects.select_related("student", "uploaded_by").all()
    serializer_class = StudentDocumentSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["student", "document_type"]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        if _is_student_only_user(self.request.user):
            return qs.filter(student__user=self.request.user)
        return qs

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get("file")
        file_size = uploaded_file.size if uploaded_file else 0
        mime_type = getattr(uploaded_file, "content_type", "") if uploaded_file else ""
        doc = serializer.save(
            uploaded_by=self.request.user,
            file_size=file_size,
            mime_type=mime_type[:100],
        )
        record_audit_log(
            action="upload_document",
            module="students",
            actor=self.request.user,
            obj=doc,
            metadata={"student_id": doc.student_id, "document_type": doc.document_type},
            request=self.request,
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        doc = self.get_object()
        if not doc.file:
            raise ValidationError({"detail": "File not found."})
        return FileResponse(doc.file.open("rb"), as_attachment=True, filename=doc.title)
