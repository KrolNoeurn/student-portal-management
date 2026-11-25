from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.services import seed_roles_and_permissions
from apps.auditlogs.models import AuditLog

User = get_user_model()


class AuthenticationTests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        self.password = "StrongPass#2026"
        self.user = User.objects.create_user(
            username="officer1",
            email="officer1@university.edu",
            password=self.password,
            first_name="Sokha",
            last_name="Chan",
        )

    def test_login_by_username_sets_cookie_and_returns_access_and_user(self):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertEqual(resp.data["user"]["username"], "officer1")
        self.assertIn("sams_refresh_token", resp.cookies)
        self.assertTrue(resp.cookies["sams_refresh_token"]["httponly"])
        self.assertTrue(AuditLog.objects.filter(action="login", module="accounts").exists())

    def test_login_by_email_succeeds(self):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1@university.edu", "password": self.password},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["user"]["username"], "officer1")

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_and_permissions_require_auth(self):
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.client.get(reverse("auth-me-permissions")).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        login_resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        access = login_resp.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        me_resp = self.client.get(reverse("auth-me"))
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(me_resp.data["email"], "officer1@university.edu")

        perm_resp = self.client.get(reverse("auth-me-permissions"))
        self.assertEqual(perm_resp.status_code, status.HTTP_200_OK)
        self.assertIn("permissions", perm_resp.data)

    def test_preferences_update(self):
        login_resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_resp.data['access']}")

        resp = self.client.patch(
            reverse("auth-me-preferences"),
            {
                "preferred_language": "km",
                "preferred_layout": "horizontal",
                "preferred_theme": "dark",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["preferred_language"], "km")
        self.assertEqual(resp.data["preferred_layout"], "horizontal")
        self.assertEqual(resp.data["preferred_theme"], "dark")

    def test_refresh_rotation_and_logout_blacklist(self):
        login_resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        first_cookie = login_resp.cookies["sams_refresh_token"].value

        refresh_resp = self.client.post(reverse("auth-token-refresh"))
        self.assertEqual(refresh_resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_resp.data)
        second_cookie = refresh_resp.cookies["sams_refresh_token"].value
        self.assertNotEqual(first_cookie, second_cookie)

        # Replaying old rotated refresh token must fail
        replay_resp = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": first_cookie},
            format="json",
        )
        # Clear client cookie first so body token is tested
        self.client.cookies.clear()
        replay_resp = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": first_cookie},
            format="json",
        )
        self.assertEqual(replay_resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Logout with valid second refresh token blacklists it
        self.client.cookies["sams_refresh_token"] = second_cookie
        logout_resp = self.client.post(reverse("auth-logout"))
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)

        self.client.cookies.clear()
        after_logout = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": second_cookie},
            format="json",
        )
        self.assertEqual(after_logout.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change_updates_credentials(self):
        login_resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_resp.data['access']}")

        new_password = "NewStrongPass#2027"
        resp = self.client.post(
            reverse("auth-password-change"),
            {
                "current_password": self.password,
                "new_password": new_password,
                "confirm_password": new_password,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Old password must no longer work
        self.client.credentials()
        old_login = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": self.password},
            format="json",
        )
        self.assertEqual(old_login.status_code, status.HTTP_400_BAD_REQUEST)

        # New password works
        new_login = self.client.post(
            reverse("auth-login"),
            {"username": "officer1", "password": new_password},
            format="json",
        )
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)
