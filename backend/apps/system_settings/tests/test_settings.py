from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.system_settings.models import SystemSetting
from apps.system_settings.services import seed_default_settings


class SystemSettingsTests(APITestCase):
    def test_seed_default_settings_is_idempotent(self):
        first_created = seed_default_settings()
        second_created = seed_default_settings()
        self.assertGreater(first_created, 0)
        self.assertEqual(second_created, 0)
        self.assertTrue(SystemSetting.objects.filter(key="institution.name_en").exists())

    def test_public_bootstrap_endpoint_exposes_only_safe_defaults(self):
        seed_default_settings()
        response = self.client.get(reverse("system-bootstrap"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("institution", response.data)
        self.assertIn("appearance", response.data)
        self.assertEqual(response.data["institution"]["short_name"], "SAMS")
        self.assertNotIn("student_id.format", str(response.data))
