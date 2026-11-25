from rest_framework.permissions import BasePermission


class CanViewPermissions(BasePermission):
    """Allows viewing Django permissions for users who can view/manage roles or permissions."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return (
            user.is_superuser
            or user.has_perm("auth.view_permission")
            or user.has_perm("auth.view_group")
            or user.has_perm("auth.change_group")
        )
