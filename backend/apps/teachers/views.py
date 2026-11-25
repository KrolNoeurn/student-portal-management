from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions
from apps.students.views import _is_student_only_user
from apps.teachers.models import ClassSchedule, Teacher, TeachingAssignment
from apps.teachers.serializers import (
    CheckConflictSerializer,
    ClassScheduleSerializer,
    TeacherSerializer,
    TeachingAssignmentSerializer,
)
from apps.teachers.services import (
    create_teaching_assignment,
    detect_schedule_conflicts,
    save_class_schedule,
)


def _is_instructor_only_user(user) -> bool:
    if user.is_superuser:
        return False
    group_names = set(user.groups.values_list("name", flat=True))
    return group_names == {"Instructor"}


class TeacherViewSet(viewsets.ModelViewSet):
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["status", "employment_type", "gender"]
    search_fields = ["teacher_code", "full_name_en", "full_name_km", "email", "phone", "specialization"]
    ordering_fields = ["teacher_code", "full_name_en", "created_at"]

    def get_queryset(self):
        qs = Teacher.objects.annotate(
            annotated_assignment_count=Count(
                "teaching_assignments",
                filter=Q(teaching_assignments__status=TeachingAssignment.StatusChoices.ACTIVE),
                distinct=True,
            )
        ).order_by("teacher_code")
        if _is_instructor_only_user(self.request.user):
            return qs.filter(user=self.request.user)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create", module="teachers", actor=self.request.user, obj=obj, request=self.request
        )

    def perform_update(self, serializer):
        obj = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update", module="teachers", actor=self.request.user, obj=obj, request=self.request
        )

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.status = Teacher.StatusChoices.INACTIVE
        obj.save(update_fields=["status", "updated_at"])
        obj.soft_delete(user=request.user)
        record_audit_log(
            action="archive", module="teachers", actor=request.user, obj=obj, request=request
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeachingAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = TeachingAssignmentSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["teacher", "class_section", "subject", "semester", "academic_year", "status", "role"]
    search_fields = ["teacher__full_name_en", "teacher__teacher_code", "class_section__code", "subject__code"]

    def get_queryset(self):
        qs = TeachingAssignment.objects.select_related(
            "teacher", "academic_year", "semester", "class_section", "subject"
        ).order_by("-academic_year__start_date", "class_section__code", "subject__code")
        user = self.request.user
        if _is_instructor_only_user(user):
            return qs.filter(teacher__user=user)
        if _is_student_only_user(user):
            return qs.filter(class_section__memberships__student__user=user).distinct()
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = create_teaching_assignment(
            validated_data=dict(serializer.validated_data),
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(assignment).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        obj_id = str(instance.pk)
        obj_repr = str(instance)
        instance.status = TeachingAssignment.StatusChoices.CANCELLED
        instance.save(update_fields=["status", "updated_at"])
        record_audit_log(
            action="cancel_assignment",
            module="teachers",
            actor=self.request.user,
            object_type="TeachingAssignment",
            object_id=obj_id,
            object_repr=obj_repr,
            request=self.request,
        )


class ClassScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ClassScheduleSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = [
        "academic_year",
        "semester",
        "class_section",
        "teacher",
        "subject",
        "classroom",
        "day_of_week",
        "is_active",
    ]
    ordering_fields = ["day_of_week", "start_time"]

    def get_queryset(self):
        qs = ClassSchedule.objects.select_related(
            "teaching_assignment",
            "academic_year",
            "semester",
            "class_section",
            "teacher",
            "subject",
            "classroom",
        ).order_by("day_of_week", "start_time")
        user = self.request.user
        if _is_instructor_only_user(user):
            return qs.filter(teacher__user=user)
        if _is_student_only_user(user):
            return qs.filter(class_section__memberships__student__user=user).distinct()
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule = save_class_schedule(
            validated_data=dict(serializer.validated_data),
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(schedule).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        schedule = save_class_schedule(
            validated_data=dict(serializer.validated_data),
            instance=instance,
            user=request.user,
            request=request,
        )
        return Response(self.get_serializer(schedule).data)

    def perform_destroy(self, instance):
        obj_id = str(instance.pk)
        obj_repr = str(instance)
        instance.delete()
        record_audit_log(
            action="delete_schedule",
            module="teachers",
            actor=self.request.user,
            object_type="ClassSchedule",
            object_id=obj_id,
            object_repr=obj_repr,
            request=self.request,
        )

    @action(detail=False, methods=["post"], url_path="check-conflicts")
    def check_conflicts(self, request):
        serializer = CheckConflictSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conflicts = detect_schedule_conflicts(**serializer.validated_data)
        return Response(
            {
                "has_conflicts": len(conflicts) > 0,
                "conflicts": conflicts,
            }
        )
