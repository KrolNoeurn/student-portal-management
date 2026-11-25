from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification
from apps.students.models import Student
from apps.system_settings.models import SystemSetting
from apps.system_settings.services import seed_default_settings

User = get_user_model()


class DashboardsReportsNotificationsSettingsTests(APITestCase):
    def setUp(self):
        seed_default_settings()
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.sys_admin = User.objects.create_user(
            username="sys_ops", email="sys_ops@university.edu", password=self.password
        )
        self.sys_admin.groups.add(Group.objects.get(name="System Administrator"))

        self.stu_user = User.objects.create_user(
            username="stu_ops", email="stu_ops@university.edu", password=self.password
        )
        self.stu_user.groups.add(Group.objects.get(name="Student"))

        self.year = AcademicYear.objects.create(
            name="2026-2027", start_date=date(2026, 10, 1), end_date=date(2027, 8, 31), is_current=True
        )
        self.bach = Degree.objects.get(code="BACH")
        self.cs = Major.objects.create(degree=self.bach, code="CS", name_en="Computer Science")
        self.y1 = YearLevel.objects.get(code="Y1")

        self.student = Student.objects.create(
            user=self.stu_user,
            student_code="STU-2026-0901",
            full_name_en="Dash Student",
            gender="female",
            date_of_birth=date(2005, 5, 5),
        )
        Enrollment.objects.create(
            registration_number="ENR-2026-90001",
            student=self.student,
            academic_year=self.year,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_admin_and_student_dashboards_reports_settings_and_audit(self):
        self._auth("sys_ops")

        dash = self.client.get(reverse("api-dashboard"))
        self.assertEqual(dash.status_code, status.HTTP_200_OK)
        self.assertEqual(dash.data["dashboard_type"], "admin")
        self.assertEqual(dash.data["kpis"]["total_students"], 1)

        # Report JSON & CSV export
        rep_json = self.client.get(reverse("api-report", args=["students-by-major"]))
        self.assertEqual(rep_json.status_code, status.HTTP_200_OK)
        self.assertEqual(rep_json.data["count"], 1)

        rep_csv = self.client.get(
            reverse("api-report", args=["students-by-major"]), {"export": "csv"}
        )
        self.assertEqual(rep_csv.status_code, status.HTTP_200_OK)
        self.assertIn("Computer Science", rep_csv.content.decode("utf-8-sig"))

        # System Setting update & Audit Log view
        setting = SystemSetting.objects.get(key="attendance.warning_threshold_percent")
        upd = self.client.patch(
            reverse("system-setting-detail", args=[setting.id]),
            {"value": 75},
            format="json",
        )
        self.assertEqual(upd.status_code, status.HTTP_200_OK)
        self.assertEqual(upd.data["value"], 75)

        logs = self.client.get(reverse("audit-log-list"))
        self.assertEqual(logs.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(logs.data["count"], 1)

        # Student dashboard & blocked from admin reports/settings/audit
        self._auth("stu_ops")
        stu_dash = self.client.get(reverse("api-dashboard"))
        self.assertEqual(stu_dash.status_code, status.HTTP_200_OK)
        self.assertEqual(stu_dash.data["dashboard_type"], "student")
        self.assertEqual(stu_dash.data["profile"]["student_code"], "STU-2026-0901")

        self.assertEqual(
            self.client.get(reverse("api-report", args=["students"])).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(reverse("system-setting-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(reverse("audit-log-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_notifications_strictly_scoped_per_recipient(self):
        n_admin = Notification.objects.create(
            recipient=self.sys_admin, title_en="Admin Notice", message_en="Backup finished"
        )
        n_stu = Notification.objects.create(
            recipient=self.stu_user, title_en="Grade Published", message_en="Your grades are live"
        )

        self._auth("stu_ops")
        res = self.client.get(reverse("notification-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 1)
        self.assertEqual(res.data["results"][0]["id"], n_stu.id)

        # Cannot access or mark admin's notification read
        self.assertEqual(
            self.client.post(reverse("notification-mark-read", args=[n_admin.id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        # Mark own notification read
        mark = self.client.post(reverse("notification-mark-read", args=[n_stu.id]))
        self.assertEqual(mark.status_code, status.HTTP_200_OK)
        self.assertTrue(mark.data["is_read"])
