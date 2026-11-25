from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, Semester
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions

User = get_user_model()


class AcademicsAPITests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.admin = User.objects.create_user(
            username="acad_admin",
            email="acad_admin@university.edu",
            password=self.password,
        )
        self.admin.groups.add(Group.objects.get(name="Academic Administrator"))

        self.student = User.objects.create_user(
            username="student_view",
            email="student_view@university.edu",
            password=self.password,
        )
        self.student.groups.add(Group.objects.get(name="Student"))

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_single_current_academic_year_and_date_validation(self):
        self._auth("acad_admin")

        # Invalid date range rejected
        bad_resp = self.client.post(
            reverse("academic-year-list"),
            {
                "name": "2025-2026",
                "start_date": "2026-09-01",
                "end_date": "2025-07-01",
                "status": "planned",
            },
            format="json",
        )
        self.assertEqual(bad_resp.status_code, status.HTTP_400_BAD_REQUEST)

        y1 = self.client.post(
            reverse("academic-year-list"),
            {
                "name": "2025-2026",
                "start_date": "2025-10-01",
                "end_date": "2026-08-31",
                "status": "active",
                "is_current": True,
            },
            format="json",
        )
        self.assertEqual(y1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(y1.data["is_current"])

        y2 = self.client.post(
            reverse("academic-year-list"),
            {
                "name": "2026-2027",
                "start_date": "2026-10-01",
                "end_date": "2027-08-31",
                "status": "planned",
                "is_current": False,
            },
            format="json",
        )
        self.assertEqual(y2.status_code, status.HTTP_201_CREATED)

        # Switch current year via set-current action
        switch = self.client.post(reverse("academic-year-set-current", args=[y2.data["id"]]))
        self.assertEqual(switch.status_code, status.HTTP_200_OK)
        self.assertFalse(AcademicYear.objects.get(pk=y1.data["id"]).is_current)
        self.assertTrue(AcademicYear.objects.get(pk=y2.data["id"]).is_current)

    def test_semester_must_fall_within_academic_year_bounds(self):
        self._auth("acad_admin")
        year = AcademicYear.objects.create(
            name="2026-2027",
            start_date=date(2026, 10, 1),
            end_date=date(2027, 8, 31),
            status="active",
            is_current=True,
        )

        # Outside bounds -> 400
        bad = self.client.post(
            reverse("semester-list"),
            {
                "academic_year": year.id,
                "name": "Semester 1",
                "code": "S1",
                "sequence_number": 1,
                "start_date": "2026-09-01",
                "end_date": "2027-02-28",
            },
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        # Inside bounds -> 201
        ok = self.client.post(
            reverse("semester-list"),
            {
                "academic_year": year.id,
                "name": "Semester 1",
                "code": "S1",
                "sequence_number": 1,
                "start_date": "2026-10-01",
                "end_date": "2027-02-28",
                "is_current": True,
            },
            format="json",
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Semester.objects.filter(is_current=True).count(), 1)

    def test_protected_delete_degree_with_major_and_student_readonly(self):
        self._auth("acad_admin")
        degree = Degree.objects.get(code="BACH")
        major_resp = self.client.post(
            reverse("major-list"),
            {
                "degree": degree.id,
                "code": "CS",
                "name_en": "Computer Science",
                "name_km": "វិទ្យាសាស្ត្រកុំព្យូទ័រ",
            },
            format="json",
        )
        self.assertEqual(major_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Major.objects.filter(degree=degree, code="CS").exists())

        # Deleting a Degree referenced by a Major must return 400 (ProtectedError handled)
        del_degree = self.client.delete(reverse("degree-detail", args=[degree.id]))
        self.assertEqual(del_degree.status_code, status.HTTP_400_BAD_REQUEST)

        # Student can view degrees & majors but cannot create or edit
        self._auth("student_view")
        self.assertEqual(self.client.get(reverse("degree-list")).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse("major-list")).status_code, status.HTTP_200_OK)
        blocked = self.client.post(
            reverse("degree-list"),
            {"code": "PHD", "name_en": "Doctorate", "level": "doctorate", "duration_years": 3},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
