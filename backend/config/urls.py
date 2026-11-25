from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated

_docs_permission = [AllowAny] if settings.DEBUG else [IsAuthenticated]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(permission_classes=_docs_permission), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema", permission_classes=_docs_permission),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema", permission_classes=_docs_permission),
        name="redoc",
    ),
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.academics.urls")),
    path("api/v1/", include("apps.subjects.urls")),
    path("api/v1/", include("apps.students.urls")),
    path("api/v1/", include("apps.enrollments.urls")),
    path("api/v1/", include("apps.classes.urls")),
    path("api/v1/", include("apps.teachers.urls")),
    path("api/v1/", include("apps.attendance.urls")),
    path("api/v1/", include("apps.examinations.urls")),
    path("api/v1/", include("apps.reports.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.system_settings.urls")),
    path("api/v1/", include("apps.auditlogs.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
