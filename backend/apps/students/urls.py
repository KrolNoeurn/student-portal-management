from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.students.views import (
    StudentDocumentViewSet,
    StudentEducationHistoryViewSet,
    StudentGuardianViewSet,
    StudentViewSet,
)

router = DefaultRouter()
router.register("students", StudentViewSet, basename="student")
router.register("student-guardians", StudentGuardianViewSet, basename="student-guardian")
router.register("student-education", StudentEducationHistoryViewSet, basename="student-education")
router.register("student-documents", StudentDocumentViewSet, basename="student-document")

urlpatterns = [
    path("", include(router.urls)),
]
