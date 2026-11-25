from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.system_settings.views import (
    BackupRecordViewSet,
    PublicBootstrapSettingsView,
    SystemSettingViewSet,
)

router = DefaultRouter()
router.register("settings", SystemSettingViewSet, basename="system-setting")
router.register("backups", BackupRecordViewSet, basename="backup-record")

urlpatterns = [
    path("system/bootstrap/", PublicBootstrapSettingsView.as_view(), name="system-bootstrap"),
    path("", include(router.urls)),
]
