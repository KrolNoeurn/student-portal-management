from django.db import transaction
from django.db.models import Count, ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel
from apps.academics.serializers import (
    AcademicYearSerializer,
    DegreeSerializer,
    MajorSerializer,
    SemesterSerializer,
    YearLevelSerializer,
)
from apps.academics.services import set_current_academic_year, set_current_semester
from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions


class ProtectedDestroyMixin:
    """Converts database ProtectedError into a clean 400 validation error."""

    audit_module = "academics"

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        obj_id = str(instance.pk)
        obj_type = instance.__class__.__name__
        obj_repr = str(instance)
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {
                    "detail": (
                        f"Cannot delete {obj_type} '{obj_repr}' because it is referenced by "
                        "existing academic records. Mark it as inactive or archived instead."
                    )
                }
            )
        record_audit_log(
            action="delete",
            module=self.audit_module,
            actor=request.user,
            object_type=obj_type,
            object_id=obj_id,
            object_repr=obj_repr,
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcademicYearViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = AcademicYear.objects.annotate(
        annotated_semester_count=Count("semesters", distinct=True)
    ).order_by("-start_date", "-name")
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["status", "is_current"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "start_date", "end_date", "status"]

    @transaction.atomic
    def perform_create(self, serializer):
        wants_current = serializer.validated_data.get("is_current", False)
        if wants_current:
            AcademicYear.objects.filter(is_current=True).update(is_current=False)
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        wants_current = serializer.validated_data.get("is_current", False)
        if wants_current:
            AcademicYear.objects.filter(is_current=True).exclude(pk=serializer.instance.pk).update(
                is_current=False
            )
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    @action(detail=True, methods=["post"], url_path="set-current")
    def set_current(self, request, pk=None):
        if not request.user.has_perm("academics.change_academicyear"):
            return Response(status=status.HTTP_403_FORBIDDEN)
        year = set_current_academic_year(self.get_object(), user=request.user)
        record_audit_log(
            action="set_current",
            module="academics",
            actor=request.user,
            obj=year,
            request=request,
        )
        return Response(self.get_serializer(year).data)


class SemesterViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = Semester.objects.select_related("academic_year").order_by(
        "-academic_year__start_date", "sequence_number"
    )
    serializer_class = SemesterSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["academic_year", "status", "is_current"]
    search_fields = ["name", "code", "academic_year__name"]
    ordering_fields = ["sequence_number", "start_date", "end_date"]

    @transaction.atomic
    def perform_create(self, serializer):
        wants_current = serializer.validated_data.get("is_current", False)
        if wants_current:
            Semester.objects.filter(is_current=True).update(is_current=False)
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        wants_current = serializer.validated_data.get("is_current", False)
        if wants_current:
            Semester.objects.filter(is_current=True).exclude(pk=serializer.instance.pk).update(
                is_current=False
            )
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    @action(detail=True, methods=["post"], url_path="set-current")
    def set_current(self, request, pk=None):
        if not request.user.has_perm("academics.change_semester"):
            return Response(status=status.HTTP_403_FORBIDDEN)
        semester = set_current_semester(self.get_object(), user=request.user)
        record_audit_log(
            action="set_current",
            module="academics",
            actor=request.user,
            obj=semester,
            request=request,
        )
        return Response(self.get_serializer(semester).data)


class DegreeViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = Degree.objects.annotate(
        annotated_major_count=Count("majors", distinct=True)
    ).order_by("duration_years", "name_en")
    serializer_class = DegreeSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["level", "status"]
    search_fields = ["code", "name_en", "name_km"]
    ordering_fields = ["code", "name_en", "duration_years"]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )


class MajorViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = Major.objects.select_related("degree").order_by("degree__name_en", "name_en")
    serializer_class = MajorSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["degree", "status"]
    search_fields = ["code", "name_en", "name_km", "degree__name_en"]
    ordering_fields = ["code", "name_en"]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )


class YearLevelViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    queryset = YearLevel.objects.order_by("order_index")
    serializer_class = YearLevelSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["status"]
    search_fields = ["code", "name_en", "name_km"]
    ordering_fields = ["order_index", "code"]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="academics",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )
