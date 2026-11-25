from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions
from apps.enrollments.models import Enrollment
from apps.enrollments.serializers import (
    ChangeProgramSerializer,
    EnrollmentSerializer,
    PromoteEnrollmentSerializer,
)
from apps.enrollments.services import (
    change_enrollment_program_or_transfer,
    create_enrollment,
    promote_or_reenroll_student,
    validate_enrollment_context,
)
from apps.students.views import _is_student_only_user


class EnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = EnrollmentSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = [
        "student",
        "academic_year",
        "semester",
        "degree",
        "major",
        "year_level",
        "status",
        "enrollment_type",
    ]
    search_fields = [
        "registration_number",
        "student__student_code",
        "student__full_name_en",
        "student__full_name_km",
    ]
    ordering_fields = ["enrollment_date", "registration_number", "created_at", "status"]

    def get_queryset(self):
        qs = (
            Enrollment.objects.select_related(
                "student",
                "academic_year",
                "semester",
                "degree",
                "major",
                "year_level",
                "previous_enrollment",
            )
            .prefetch_related("history__actor")
            .order_by("-academic_year__start_date", "-enrollment_date", "-id")
        )
        if _is_student_only_user(self.request.user):
            return qs.filter(student__user=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enrollment = create_enrollment(
            validated_data=dict(serializer.validated_data),
            user=request.user,
            request=request,
        )
        out = self.get_serializer(enrollment)
        return Response(out.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        instance = self.get_object()
        validate_enrollment_context(
            academic_year=serializer.validated_data.get("academic_year", instance.academic_year),
            semester=serializer.validated_data.get("semester", instance.semester),
            degree=serializer.validated_data.get("degree", instance.degree),
            major=serializer.validated_data.get("major", instance.major),
        )
        updated = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="enrollments",
            actor=self.request.user,
            obj=updated,
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        enrollment = self.get_object()
        enrollment.status = Enrollment.StatusChoices.CANCELLED
        enrollment.save(update_fields=["status", "updated_at"])
        enrollment.soft_delete(user=request.user)
        record_audit_log(
            action="archive",
            module="enrollments",
            actor=request.user,
            obj=enrollment,
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="promote")
    def promote(self, request, pk=None):
        if not (
            request.user.has_perm("enrollments.promote_enrollment")
            or request.user.has_perm("enrollments.add_enrollment")
        ):
            raise PermissionDenied("You do not have permission to promote or re-enroll students.")

        source = self.get_object()
        serializer = PromoteEnrollmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_enrollment = promote_or_reenroll_student(
            source_enrollment=source,
            target_academic_year=serializer.validated_data["target_academic_year"],
            target_year_level=serializer.validated_data["target_year_level"],
            target_semester=serializer.validated_data.get("target_semester"),
            target_degree=serializer.validated_data.get("target_degree"),
            target_major=serializer.validated_data.get("target_major"),
            enrollment_type=serializer.validated_data["enrollment_type"],
            enrollment_date=serializer.validated_data.get("enrollment_date"),
            remarks=serializer.validated_data.get("remarks", ""),
            user=request.user,
            request=request,
        )
        return Response(
            self.get_serializer(new_enrollment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="change-program")
    def change_program(self, request, pk=None):
        if not (
            request.user.has_perm("enrollments.transfer_enrollment")
            or request.user.has_perm("enrollments.change_enrollment")
        ):
            raise PermissionDenied("You do not have permission to change program or transfer enrollment.")

        enrollment = self.get_object()
        serializer = ChangeProgramSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = change_enrollment_program_or_transfer(
            enrollment=enrollment,
            degree=serializer.validated_data.get("degree"),
            major=serializer.validated_data.get("major"),
            year_level=serializer.validated_data.get("year_level"),
            status_val=serializer.validated_data.get("status"),
            reason=serializer.validated_data.get("reason", ""),
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(updated).data)
