from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.teachers.views import (
    ClassScheduleViewSet,
    TeacherViewSet,
    TeachingAssignmentViewSet,
)

router = DefaultRouter()
router.register("teachers", TeacherViewSet, basename="teacher")
router.register("teaching-assignments", TeachingAssignmentViewSet, basename="teaching-assignment")
router.register("schedules", ClassScheduleViewSet, basename="class-schedule")

urlpatterns = [
    path("", include(router.urls)),
]
