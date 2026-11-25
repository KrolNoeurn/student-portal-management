from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.subjects.views import (
    CurriculumSubjectViewSet,
    CurriculumViewSet,
    SubjectViewSet,
)

router = DefaultRouter()
router.register("subjects", SubjectViewSet, basename="subject")
router.register("curricula", CurriculumViewSet, basename="curriculum")
router.register("curriculum-subjects", CurriculumSubjectViewSet, basename="curriculum-subject")

urlpatterns = [
    path("", include(router.urls)),
]
