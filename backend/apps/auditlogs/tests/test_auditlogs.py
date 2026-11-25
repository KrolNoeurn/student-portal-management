from django.test import TestCase

from apps.auditlogs.models import AuditLog
from apps.auditlogs.services import record_audit_log


class AuditLogTests(TestCase):
    def test_record_audit_log_redacts_sensitive_fields(self):
        entry = record_audit_log(
            action="update",
            module="accounts",
            object_type="User",
            object_id="1",
            object_repr="admin",
            metadata={
                "username": "admin",
                "password": "super-secret-password",
                "nested": {"token": "abc123", "role": "Super Administrator"},
            },
        )
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(entry.metadata["password"], "[REDACTED]")
        self.assertEqual(entry.metadata["nested"]["token"], "[REDACTED]")
        self.assertEqual(entry.metadata["nested"]["role"], "Super Administrator")
