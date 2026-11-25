from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.academics.views import ProtectedDestroyMixin
from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions
from apps.examinations.models import (
    Assessment,
    AssessmentType,
    GradingScale,
    SubjectGrade,
)
from apps.examinations.serializers import (
    AssessmentSerializer,
    AssessmentTypeSerializer,
    BulkScoreSubmitSerializer,
    CalculateGradesSerializer,
    GradingScaleSerializer,
    StudentScoreSerializer,
    SubjectGradeSerializer,
)
from apps.examinations.services import (
    _assert_instructor_scope,
    build_student_transcript,
    bulk_save_assessment_scores,
    calculate_class_subject_grades,
)
from apps.students.models import Student
from apps.students.views import _is_student_only_user
from apps.teachers.views import _is_instructor_only_user


class AssessmentTypeViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    audit_module = "examinations"
    queryset = AssessmentType.objects.order_by("code")
    serializer_class = AssessmentTypeSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["status"]


class GradingScaleViewSet(viewsets.ModelViewSet):
    queryset = GradingScale.objects.order_by("-min_percentage")
    serializer_class = GradingScaleSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]


class AssessmentViewSet(ProtectedDestroyMixin, viewsets.ModelViewSet):
    audit_module = "examinations"
    serializer_class = AssessmentSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["academic_year", "class_section", "subject", "assessment_type", "is_published"]
    search_fields = ["title", "class_section__code", "subject__code"]

    def get_queryset(self):
        qs = (
            Assessment.objects.select_related(
                "academic_year", "semester", "class_section", "subject", "assessment_type"
            )
            .annotate(annotated_scored_count=Count("scores", distinct=True))
            .order_by("-assessment_date", "-id")
        )
        user = self.request.user
        if _is_instructor_only_user(user):
            return qs.filter(class_section__teaching_assignments__teacher__user=user).distinct()
        if _is_student_only_user(user):
            return qs.filter(
                class_section__memberships__student__user=user, is_published=True
            ).distinct()
        return qs

    def perform_create(self, serializer):
        cls = serializer.validated_data["class_section"]
        subj = serializer.validated_data["subject"]
        _assert_instructor_scope(self.request.user, cls, subj)
        obj = serializer.save(
            academic_year=cls.academic_year,
            semester=serializer.validated_data.get("semester") or cls.semester,
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        record_audit_log(
            action="create_assessment",
            module="examinations",
            actor=self.request.user,
            obj=obj,
            request=self.request,
        )

    @action(detail=True, methods=["get"], url_path="scores")
    def scores(self, request, pk=None):
        assessment = self.get_object()
        qs = assessment.scores.select_related("student", "enrollment").order_by(
            "student__student_code"
        )
        if _is_student_only_user(request.user):
            qs = qs.filter(student__user=request.user)
        return Response(StudentScoreSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="bulk-scores")
    def bulk_scores(self, request, pk=None):
        if not (
            request.user.has_perm("examinations.add_studentscore")
            or request.user.has_perm("examinations.change_studentscore")
        ):
            raise PermissionDenied("You do not have permission to enter scores.")
        assessment = self.get_object()
        serializer = BulkScoreSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        saved = bulk_save_assessment_scores(
            assessment=assessment,
            entries=serializer.validated_data["scores"],
            user=request.user,
            request=request,
        )
        return Response(StudentScoreSerializer(saved, many=True).data, status=status.HTTP_200_OK)


class SubjectGradeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SubjectGradeSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_fields = ["class_section", "subject", "student", "enrollment", "status"]

    def get_queryset(self):
        qs = SubjectGrade.objects.select_related(
            "enrollment__academic_year", "student", "class_section", "subject"
        ).order_by("student__student_code", "subject__code")
        user = self.request.user
        if _is_student_only_user(user):
            return qs.filter(student__user=user, status=SubjectGrade.StatusChoices.PUBLISHED)
        if _is_instructor_only_user(user):
            return qs.filter(class_section__teaching_assignments__teacher__user=user).distinct()
        return qs

    @action(detail=False, methods=["post"], url_path="calculate")
    def calculate(self, request):
        if not (
            request.user.has_perm("examinations.add_subjectgrade")
            or request.user.has_perm("examinations.change_subjectgrade")
        ):
            raise PermissionDenied("You do not have permission to calculate grades.")
        serializer = CalculateGradesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        grades = calculate_class_subject_grades(
            class_section=serializer.validated_data["class_section"],
            subject=serializer.validated_data["subject"],
            publish=serializer.validated_data["publish"],
            user=request.user,
            request=request,
        )
        return Response(SubjectGradeSerializer(grades, many=True).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="transcript")
    def transcript(self, request):
        student_id = request.query_params.get("student")
        if _is_student_only_user(request.user):
            student = Student.objects.filter(user=request.user).first()
            if not student:
                raise ValidationError({"student": ["No student profile linked to your account."]})
            if student_id and str(student.id) != str(student_id):
                raise PermissionDenied("You can only view your own academic transcript.")
            return Response(build_student_transcript(student, published_only=True))

        if not student_id:
            raise ValidationError({"student": ["Query parameter 'student' is required."]})
        student = get_object_or_404(Student, pk=student_id)
        return Response(build_student_transcript(student, published_only=False))
