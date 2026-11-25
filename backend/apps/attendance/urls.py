from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.attendance.views import (
    AttendanceExportView,
    AttendanceRecordViewSet,
    AttendanceSessionViewSet,
    AttendanceSummaryView,
    BulkAttendanceView,
)

router = DefaultRouter()
router.register("attendance/sessions", AttendanceSessionViewSet, basename="attendance-session")
router.register("attendance/records", AttendanceRecordViewSet, basename="attendance-record")

urlpatterns = [
    path("attendance/bulk-mark/", BulkAttendanceView.as_view(), name="attendance-bulk-mark"),
    path("attendance/summary/", AttendanceSummaryView.as_view(), name="attendance-summary"),
    path("attendance/export/", AttendanceExportView.as_view(), name="attendance-export"),
    path("", include(router.urls)),
]
