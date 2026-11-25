from django.db.models import Count
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.academics.views import ProtectedDestroyMixin
from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions
from apps.subjects.models import Curriculum, CurriculumSubject, Subject
from apps.subjects.serializers import (
    CurriculumSerializer,
    CurriculumSubjectSerializer,
    SubjectSerializer,
)


class SubjectViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    audit_module = "subjects"
    queryset = Subject.objects.order_by("code")
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["status"]
    search_fields = ["code", "name_en", "name_km"]
    ordering_fields = ["code", "name_en", "credits"]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="subjects",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="subjects",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )


class CurriculumViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    audit_module = "subjects"
    queryset = (
        Curriculum.objects.select_related("degree", "major", "effective_academic_year")
        .annotate(annotated_subject_count=Count("items", distinct=True))
        .order_by("-created_at")
    )
    serializer_class = CurriculumSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["degree", "major", "status", "effective_academic_year"]
    search_fields = ["version", "major__name_en", "major__code", "degree__name_en"]
    ordering_fields = ["version", "created_at", "status"]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        record_audit_log(
            action="create",
            module="subjects",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update",
            module="subjects",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )


class CurriculumSubjectViewSet(viewsets.ModelViewSet):
    queryset = CurriculumSubject.objects.select_related(
        "curriculum", "subject", "year_level", "prerequisite_subject"
    ).order_by("year_level__order_index", "semester_number", "subject__code")
    serializer_class = CurriculumSubjectSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["curriculum", "year_level", "semester_number", "is_required"]
    search_fields = ["subject__code", "subject__name_en", "subject__name_km"]

    def perform_create(self, serializer):
        instance = serializer.save()
        record_audit_log(
            action="create",
            module="subjects",
            actor=self.request.user,
            obj=instance,
            request=self.request,
        )

    def perform_destroy(self, instance):
        obj_id = str(instance.pk)
        obj_repr = str(instance)
        instance.delete()
        record_audit_log(
            action="delete",
            module="subjects",
            actor=self.request.user,
            object_type="CurriculumSubject",
            object_id=obj_id,
            object_repr=obj_repr,
            request=self.request,
        )
