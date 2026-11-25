from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.enrollments.views import EnrollmentViewSet

router = DefaultRouter()
router.register("enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = [
    path("", include(router.urls)),
]
