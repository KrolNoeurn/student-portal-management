from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "preferred_language",
        "preferred_layout",
    )
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Portal Profile & Preferences",
            {
                "fields": (
                    "full_name_km",
                    "phone",
                    "avatar",
                    "preferred_language",
                    "preferred_layout",
                    "preferred_theme",
                    "must_change_password",
                )
            },
        ),
    )
