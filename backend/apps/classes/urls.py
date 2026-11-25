from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.classes.views import (
    ClassMembershipViewSet,
    ClassroomViewSet,
    ClassSectionViewSet,
    ClassSubjectViewSet,
)

router = DefaultRouter()
router.register("classrooms", ClassroomViewSet, basename="classroom")
router.register("classes", ClassSectionViewSet, basename="class-section")
router.register("class-subjects", ClassSubjectViewSet, basename="class-subject")
router.register("class-memberships", ClassMembershipViewSet, basename="class-membership")

urlpatterns = [
    path("", include(router.urls)),
]
