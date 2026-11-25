from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.auditlogs.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "action",
            "module",
            "object_type",
            "object_id",
            "object_repr",
            "metadata",
            "ip_address",
            "created_at",
        ]

    def get_actor_name(self, obj) -> str:
        if not obj.actor:
            return "System"
        return obj.actor.get_full_name().strip() or obj.actor.username


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor").order_by("-created_at")
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["module", "action", "actor"]
    search_fields = ["object_repr", "object_id", "module", "action", "actor__username"]

    def list(self, request, *args, **kwargs):
        if not (
            request.user.is_superuser
            or request.user.has_perm("auditlogs.view_audit_logs")
            or request.user.has_perm("auditlogs.view_auditlog")
        ):
            raise PermissionDenied("You do not have permission to view audit logs.")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        if not (
            request.user.is_superuser
            or request.user.has_perm("auditlogs.view_audit_logs")
            or request.user.has_perm("auditlogs.view_auditlog")
        ):
            raise PermissionDenied("You do not have permission to view audit logs.")
        return super().retrieve(request, *args, **kwargs)
