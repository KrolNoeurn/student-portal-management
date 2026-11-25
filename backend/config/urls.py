from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.academics.urls")),
    path("api/v1/", include("apps.subjects.urls")),
    path("api/v1/", include("apps.students.urls")),
    path("api/v1/", include("apps.enrollments.urls")),
    path("api/v1/", include("apps.classes.urls")),
    path("api/v1/", include("apps.teachers.urls")),
    path("api/v1/", include("apps.system_settings.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
