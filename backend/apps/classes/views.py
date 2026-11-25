from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academics.views import ProtectedDestroyMixin
from apps.auditlogs.services import record_audit_log
from apps.classes.models import (
    ClassMembership,
    Classroom,
    ClassSection,
    ClassSubject,
    ClassTransferHistory,
)
from apps.classes.serializers import (
    AssignStudentSerializer,
    ClassMembershipSerializer,
    ClassroomSerializer,
    ClassSectionSerializer,
    ClassSubjectSerializer,
    ClassTransferHistorySerializer,
    TransferStudentSerializer,
)
from apps.classes.services import (
    _sync_class_capacity_status,
    assign_student_to_class,
    transfer_student_class,
    validate_class_context,
)
from apps.core.permissions import StrictDjangoModelPermissions
from apps.enrollments.models import Enrollment
from apps.enrollments.serializers import EnrollmentSerializer
from apps.students.views import _is_student_only_user
from apps.teachers.views import _is_instructor_only_user


class ClassroomViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    audit_module = "classes"
    queryset = Classroom.objects.order_by("code")
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["room_type", "status", "building"]
    search_fields = ["code", "name", "building"]
    ordering_fields = ["code", "name", "capacity"]

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create", module="classes", actor=self.request.user, obj=obj, request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update", module="classes", actor=self.request.user, obj=obj, request=self.request
        )


class ClassSectionViewSet(viewsets.ModelViewSet):
    serializer_class = ClassSectionSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = [
        "academic_year",
        "semester",
        "degree",
        "major",
        "year_level",
        "status",
        "default_classroom",
    ]
    search_fields = ["code", "name", "major__name_en", "major__code", "default_classroom__code"]
    ordering_fields = ["code", "name", "capacity", "created_at"]

    def get_queryset(self):
        qs = (
            ClassSection.objects.select_related(
                "academic_year",
                "semester",
                "degree",
                "major",
                "year_level",
                "default_classroom",
                "homeroom_advisor",
            )
            .annotate(
                annotated_active_students=Count(
                    "memberships",
                    filter=Q(memberships__status=ClassMembership.StatusChoices.ACTIVE),
                    distinct=True,
                ),
                annotated_subject_count=Count("class_subjects", distinct=True),
            )
            .order_by("-academic_year__start_date", "code")
        )
        if _is_student_only_user(self.request.user):
            return qs.filter(memberships__student__user=self.request.user).distinct()
        return qs

    def perform_create(self, serializer):
        validate_class_context(
            academic_year=serializer.validated_data["academic_year"],
            semester=serializer.validated_data.get("semester"),
            degree=serializer.validated_data["degree"],
            major=serializer.validated_data["major"],
        )
        obj = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create", module="classes", actor=self.request.user, obj=obj, request=self.request
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        validate_class_context(
            academic_year=serializer.validated_data.get("academic_year", instance.academic_year),
            semester=serializer.validated_data.get("semester", instance.semester),
            degree=serializer.validated_data.get("degree", instance.degree),
            major=serializer.validated_data.get("major", instance.major),
        )
        obj = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update", module="classes", actor=self.request.user, obj=obj, request=self.request
        )

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.status = ClassSection.StatusChoices.ARCHIVED
        obj.save(update_fields=["status", "updated_at"])
        obj.soft_delete(user=request.user)
        record_audit_log(
            action="archive", module="classes", actor=request.user, obj=obj, request=request
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="students")
    def students(self, request, pk=None):
        class_section = self.get_object()
        status_filter = request.query_params.get("status")
        qs = class_section.memberships.select_related("student", "enrollment").order_by(
            "student__student_code"
        )
        if _is_student_only_user(request.user):
            qs = qs.filter(student__user=request.user)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(ClassMembershipSerializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="eligible-enrollments")
    def eligible_enrollments(self, request, pk=None):
        if not (
            request.user.has_perm("classes.assign_class_student")
            or request.user.has_perm("classes.add_classmembership")
        ):
            raise PermissionDenied()
        class_section = self.get_object()
        assigned_ids = ClassMembership.objects.filter(
            status=ClassMembership.StatusChoices.ACTIVE
        ).values_list("enrollment_id", flat=True)
        qs = (
            Enrollment.objects.select_related(
                "student", "academic_year", "degree", "major", "year_level"
            )
            .prefetch_related("history__actor")
            .filter(
                academic_year=class_section.academic_year,
                degree=class_section.degree,
                major=class_section.major,
                year_level=class_section.year_level,
                status=Enrollment.StatusChoices.ACTIVE,
            )
            .exclude(id__in=assigned_ids)
            .order_by("student__student_code")[:100]
        )
        return Response(EnrollmentSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="assign-student")
    def assign_student(self, request, pk=None):
        if not (
            request.user.has_perm("classes.assign_class_student")
            or request.user.has_perm("classes.add_classmembership")
        ):
            raise PermissionDenied("You do not have permission to assign students to classes.")
        class_section = self.get_object()
        serializer = AssignStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = assign_student_to_class(
            class_section=class_section,
            enrollment=serializer.validated_data["enrollment"],
            assigned_date=serializer.validated_data.get("assigned_date"),
            user=request.user,
            request=request,
        )
        return Response(
            ClassMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="transfer-student")
    def transfer_student(self, request, pk=None):
        if not (
            request.user.has_perm("classes.transfer_class_student")
            or request.user.has_perm("classes.change_classmembership")
        ):
            raise PermissionDenied("You do not have permission to transfer students.")
        class_section = self.get_object()
        serializer = TransferStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = serializer.validated_data["membership"]
        if membership.class_section_id != class_section.id:
            raise ValidationError({"membership": ["Membership does not belong to this class."]})
        new_membership = transfer_student_class(
            membership=membership,
            target_class_section=serializer.validated_data["target_class_section"],
            reason=serializer.validated_data.get("reason", ""),
            transfer_date=serializer.validated_data.get("transfer_date"),
            user=request.user,
            request=request,
        )
        return Response(ClassMembershipSerializer(new_membership).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="transfers")
    def transfers(self, request, pk=None):
        class_section = self.get_object()
        qs = ClassTransferHistory.objects.select_related(
            "student", "from_class_section", "to_class_section", "transferred_by"
        ).filter(Q(from_class_section=class_section) | Q(to_class_section=class_section))
        if _is_student_only_user(request.user):
            qs = qs.filter(student__user=request.user)
        return Response(ClassTransferHistorySerializer(qs, many=True).data)


class ClassSubjectViewSet(viewsets.ModelViewSet):
    queryset = ClassSubject.objects.select_related("class_section", "subject", "semester").order_by(
        "subject__code"
    )
    serializer_class = ClassSubjectSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["class_section", "subject", "semester", "status"]

    def perform_create(self, serializer):
        obj = serializer.save()
        record_audit_log(
            action="add_subject", module="classes", actor=self.request.user, obj=obj, request=self.request
        )

    def perform_destroy(self, instance):
        obj_id = str(instance.pk)
        obj_repr = str(instance)
        instance.delete()
        record_audit_log(
            action="remove_subject",
            module="classes",
            actor=self.request.user,
            object_type="ClassSubject",
            object_id=obj_id,
            object_repr=obj_repr,
            request=self.request,
        )


class ClassMembershipViewSet(viewsets.ModelViewSet):
    serializer_class = ClassMembershipSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["class_section", "enrollment", "student", "status"]

    def get_queryset(self):
        qs = ClassMembership.objects.select_related(
            "class_section", "enrollment", "student"
        ).order_by("student__student_code")
        user = self.request.user
        if _is_student_only_user(user):
            return qs.filter(student__user=user)
        if _is_instructor_only_user(user):
            return qs.filter(class_section__teaching_assignments__teacher__user=user).distinct()
        return qs

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        membership.status = ClassMembership.StatusChoices.DROPPED
        membership.left_date = timezone.localdate()
        membership.updated_by = request.user
        membership.save(update_fields=["status", "left_date", "updated_by", "updated_at"])
        _sync_class_capacity_status(membership.class_section)
        record_audit_log(
            action="drop_student",
            module="classes",
            actor=request.user,
            obj=membership,
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
