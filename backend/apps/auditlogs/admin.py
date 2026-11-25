from django.contrib import admin

from apps.auditlogs.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "module", "action", "object_type", "object_id")
    list_filter = ("module", "action")
    search_fields = ("object_repr", "object_id", "actor__username")
    readonly_fields = (
        "actor",
        "action",
        "module",
        "object_type",
        "object_id",
        "object_repr",
        "metadata",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
