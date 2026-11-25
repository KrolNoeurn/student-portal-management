from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auditlogs.services import record_audit_log
from apps.system_settings.models import BackupRecord, SystemSetting
from apps.system_settings.serializers import BackupRecordSerializer, SystemSettingSerializer
from apps.system_settings.services import (
    create_safe_sqlite_backup,
    get_public_bootstrap_config,
)


class PublicBootstrapSettingsView(APIView):
    """Returns safe public portal metadata and UI defaults for app initialization."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(get_public_bootstrap_config())


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.order_by("category", "key")
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "put", "head", "options"]
    filterset_fields = ["category", "is_public"]

    def _check_perm(self, request):
        if not (
            request.user.is_superuser
            or request.user.has_perm("system_settings.manage_system_settings")
            or (request.method in ("GET", "HEAD", "OPTIONS") and request.user.has_perm("system_settings.view_systemsetting"))
        ):
            raise PermissionDenied("You do not have permission to manage system settings.")

    def list(self, request, *args, **kwargs):
        self._check_perm(request)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._check_perm(request)
        return super().retrieve(request, *args, **kwargs)

    def perform_update(self, serializer):
        self._check_perm(self.request)
        obj = serializer.save(updated_by=self.request.user)
        record_audit_log(
            action="update_setting",
            module="system_settings",
            actor=self.request.user,
            obj=obj,
            metadata={"key": obj.key, "value": obj.value},
            request=self.request,
        )


class BackupRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BackupRecord.objects.select_related("triggered_by").order_by("-created_at")
    serializer_class = BackupRecordSerializer
    permission_classes = [IsAuthenticated]

    def _check_perm(self, request):
        if not (request.user.is_superuser or request.user.has_perm("system_settings.manage_backups")):
            raise PermissionDenied("You do not have permission to manage database backups.")

    def list(self, request, *args, **kwargs):
        self._check_perm(request)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._check_perm(request)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="create-backup")
    def create_backup(self, request):
        self._check_perm(request)
        try:
            record = create_safe_sqlite_backup(user=request.user)
        except RuntimeError as exc:
            return Response(
                {"error": {"code": "backup_unavailable", "message": str(exc), "details": {}}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record_audit_log(
            action="backup",
            module="system_settings",
            actor=request.user,
            obj=record,
            metadata={"filename": record.filename, "size": record.file_size_bytes},
            request=request,
        )
        return Response(BackupRecordSerializer(record).data, status=status.HTTP_201_CREATED)
