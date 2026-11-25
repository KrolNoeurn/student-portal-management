from rest_framework import serializers

from apps.system_settings.models import BackupRecord, SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = [
            "id",
            "key",
            "category",
            "value",
            "description",
            "is_public",
            "updated_at",
        ]
        read_only_fields = ["id", "key", "category", "is_public", "updated_at"]


class BackupRecordSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BackupRecord
        fields = [
            "id",
            "filename",
            "file_size_bytes",
            "sha256_checksum",
            "backup_type",
            "status",
            "error_message",
            "triggered_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_triggered_by_name(self, obj) -> str:
        if not obj.triggered_by:
            return "System"
        return obj.triggered_by.get_full_name().strip() or obj.triggered_by.username
