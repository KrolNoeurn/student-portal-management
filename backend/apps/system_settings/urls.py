from django.urls import path

from apps.system_settings.views import PublicBootstrapSettingsView

urlpatterns = [
    path("system/bootstrap/", PublicBootstrapSettingsView.as_view(), name="system-bootstrap"),
]
