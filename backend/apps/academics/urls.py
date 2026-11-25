from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.academics.views import (
    AcademicYearViewSet,
    DegreeViewSet,
    MajorViewSet,
    SemesterViewSet,
    YearLevelViewSet,
)

router = DefaultRouter()
router.register("academic-years", AcademicYearViewSet, basename="academic-year")
router.register("semesters", SemesterViewSet, basename="semester")
router.register("degrees", DegreeViewSet, basename="degree")
router.register("majors", MajorViewSet, basename="major")
router.register("year-levels", YearLevelViewSet, basename="year-level")

urlpatterns = [
    path("", include(router.urls)),
]
