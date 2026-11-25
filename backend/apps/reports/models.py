from django.db import models


class ReportPermissionAnchor(models.Model):
    """Unmanaged model anchoring custom dashboard & reporting permissions in Django auth."""

    class Meta:
        managed = False
        default_permissions = ()
        permissions = [
            ("view_admin_dashboard", "Can view administrator dashboard"),
            ("view_academic_dashboard", "Can view academic officer dashboard"),
            ("view_instructor_dashboard", "Can view instructor dashboard"),
            ("view_student_dashboard", "Can view student dashboard"),
            ("export_reports", "Can view and export institutional reports"),
        ]
