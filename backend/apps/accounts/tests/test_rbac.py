from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.services import DEFAULT_ROLES, seed_roles_and_permissions
from apps.auditlogs.models import AuditLog

User = get_user_model()


class RBACPermissionTests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        self.password = "StrongPass#2026"

        self.sys_admin = User.objects.create_user(
            username="sysadmin",
            email="sysadmin@university.edu",
            password=self.password,
        )
        self.sys_admin.groups.add(Group.objects.get(name="System Administrator"))

        self.readonly_user = User.objects.create_user(
            username="registrar1",
            email="registrar1@university.edu",
            password=self.password,
        )
        self.readonly_user.groups.add(Group.objects.get(name="Registrar"))

        self.student_user = User.objects.create_user(
            username="student1",
            email="student1@university.edu",
            password=self.password,
        )
        self.student_user.groups.add(Group.objects.get(name="Student"))

    def _authenticate(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_seed_creates_all_standard_roles(self):
        existing = set(Group.objects.values_list("name", flat=True))
        for role in DEFAULT_ROLES:
            self.assertIn(role, existing)

    def test_student_cannot_access_users_roles_or_permissions(self):
        self._authenticate("student1")
        self.assertEqual(self.client.get(reverse("user-list")).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(reverse("role-list")).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.get(reverse("permission-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_registrar_can_view_users_but_cannot_create_or_delete(self):
        self._authenticate("registrar1")
        list_resp = self.client.get(reverse("user-list"))
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)

        create_resp = self.client.post(
            reverse("user-list"),
            {
                "username": "blocked_user",
                "email": "blocked@university.edu",
                "password": "StrongPass#2026",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_403_FORBIDDEN)

        del_resp = self.client.delete(reverse("user-detail", args=[self.student_user.pk]))
        self.assertEqual(del_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_admin_full_user_and_role_lifecycle(self):
        self._authenticate("sysadmin")

        # Create user with role
        instructor_group = Group.objects.get(name="Instructor")
        create_resp = self.client.post(
            reverse("user-list"),
            {
                "username": "inst1",
                "email": "inst1@university.edu",
                "password": "StrongPass#2026",
                "first_name": "Dara",
                "last_name": "Sok",
                "full_name_km": "សុខ តារា",
                "role_ids": [instructor_group.id],
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        created_id = create_resp.data["id"]
        self.assertEqual(create_resp.data["roles"][0]["name"], "Instructor")

        # Cannot deactivate self
        self_del = self.client.delete(reverse("user-detail", args=[self.sys_admin.pk]))
        self.assertEqual(self_del.status_code, status.HTTP_400_BAD_REQUEST)

        # Deactivate created user (non-destructive)
        del_resp = self.client.delete(reverse("user-detail", args=[created_id]))
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.get(pk=created_id).is_active)

        # Create custom role with permissions
        view_user_perm = Permission.objects.get(
            content_type__app_label="accounts", codename="view_user"
        )
        role_resp = self.client.post(
            reverse("role-list"),
            {"name": "Custom Auditor", "permission_ids": [view_user_perm.id]},
            format="json",
        )
        self.assertEqual(role_resp.status_code, status.HTTP_201_CREATED)
        custom_role_id = role_resp.data["id"]

        # Protected Super Administrator role cannot be deleted
        super_group = Group.objects.get(name="Super Administrator")
        del_super = self.client.delete(reverse("role-detail", args=[super_group.id]))
        self.assertEqual(del_super.status_code, status.HTTP_400_BAD_REQUEST)

        # Unassigned custom role can be deleted
        del_custom = self.client.delete(reverse("role-detail", args=[custom_role_id]))
        self.assertEqual(del_custom.status_code, status.HTTP_204_NO_CONTENT)

        # Verify audit logs captured operations
        self.assertTrue(AuditLog.objects.filter(module="accounts", action="create").exists())
        self.assertTrue(AuditLog.objects.filter(module="roles", action="create").exists())
