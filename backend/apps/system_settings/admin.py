from django.contrib import admin

from apps.system_settings.models import BackupRecord, SystemSetting


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "category", "is_public", "updated_at")
    list_filter = ("category", "is_public")
    search_fields = ("key", "description")


@admin.register(BackupRecord)
class BackupRecordAdmin(admin.ModelAdmin):
    list_display = ("filename", "backup_type", "status", "file_size_bytes", "created_at")
    list_filter = ("backup_type", "status")
    readonly_fields = ("filename", "file_path", "file_size_bytes", "sha256_checksum", "created_at")
