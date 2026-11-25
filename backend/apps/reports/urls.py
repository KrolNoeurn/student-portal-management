from django.urls import path

from apps.reports.views import DashboardView, InstitutionalReportView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="api-dashboard"),
    path("reports/<str:report_type>/", InstitutionalReportView.as_view(), name="api-report"),
]
