from rest_framework import serializers

from apps.system_settings.models import SystemSetting


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
        read_only_fields = ["id", "updated_at"]
