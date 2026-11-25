from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.examinations.views import (
    AssessmentTypeViewSet,
    AssessmentViewSet,
    GradingScaleViewSet,
    SubjectGradeViewSet,
)

router = DefaultRouter()
router.register("assessment-types", AssessmentTypeViewSet, basename="assessment-type")
router.register("grading-scales", GradingScaleViewSet, basename="grading-scale")
router.register("assessments", AssessmentViewSet, basename="assessment")
router.register("grades", SubjectGradeViewSet, basename="subject-grade")

urlpatterns = [
    path("", include(router.urls)),
]
