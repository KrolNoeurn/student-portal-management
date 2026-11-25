from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Immutable append-only audit log for sensitive and academic operations."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=50, db_index=True)
    module = models.CharField(max_length=60, db_index=True)
    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=64, blank=True, db_index=True)
    object_repr = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "auditlogs_audit_log"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["module", "action", "created_at"]),
        ]
        permissions = [
            ("view_audit_logs", "Can view system audit logs"),
        ]

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.module}.{self.action} ({self.object_id})"
