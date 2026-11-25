from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.enrollments.models import Enrollment, EnrollmentHistory
from apps.students.models import Student

User = get_user_model()


class EnrollmentsAPITests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.registrar = User.objects.create_user(
            username="registrar_enr",
            email="registrar_enr@university.edu",
            password=self.password,
        )
        self.registrar.groups.add(Group.objects.get(name="Registrar"))

        self.student_user = User.objects.create_user(
            username="student_enr",
            email="student_enr@university.edu",
            password=self.password,
        )
        self.student_user.groups.add(Group.objects.get(name="Student"))

        self.y2025 = AcademicYear.objects.create(
            name="2025-2026",
            start_date=date(2025, 10, 1),
            end_date=date(2026, 8, 31),
            status="active",
            is_current=True,
        )
        self.y2026 = AcademicYear.objects.create(
            name="2026-2027",
            start_date=date(2026, 10, 1),
            end_date=date(2027, 8, 31),
            status="planned",
        )
        self.bach = Degree.objects.get(code="BACH")
        self.hd = Degree.objects.get(code="HD")
        self.cs = Major.objects.create(degree=self.bach, code="CS", name_en="Computer Science")
        self.it = Major.objects.create(degree=self.bach, code="IT", name_en="Information Technology")
        self.y1 = YearLevel.objects.get(code="Y1")
        self.y2 = YearLevel.objects.get(code="Y2")

        self.student = Student.objects.create(
            user=self.student_user,
            student_code="STU-2025-0001",
            full_name_en="Sophea Ly",
            gender="female",
            date_of_birth=date(2005, 5, 10),
            status="applicant",
        )

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_enrollment_duplicate_prevention_promotion_and_program_change(self):
        self._auth("registrar_enr")

        # Mismatched degree/major rejected
        bad = self.client.post(
            reverse("enrollment-list"),
            {
                "student": self.student.id,
                "academic_year": self.y2025.id,
                "degree": self.hd.id,
                "major": self.cs.id,
                "year_level": self.y1.id,
                "enrollment_date": "2025-10-05",
            },
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid initial enrollment activates applicant student
        e1 = self.client.post(
            reverse("enrollment-list"),
            {
                "student": self.student.id,
                "academic_year": self.y2025.id,
                "degree": self.bach.id,
                "major": self.cs.id,
                "year_level": self.y1.id,
                "enrollment_date": "2025-10-05",
            },
            format="json",
        )
        self.assertEqual(e1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(e1.data["registration_number"].startswith("ENR-2025-"))
        self.student.refresh_from_db()
        self.assertEqual(self.student.status, "active")

        # Duplicate active enrollment for same student & academic year blocked
        dup = self.client.post(
            reverse("enrollment-list"),
            {
                "student": self.student.id,
                "academic_year": self.y2025.id,
                "degree": self.bach.id,
                "major": self.cs.id,
                "year_level": self.y1.id,
                "enrollment_date": "2025-10-10",
            },
            format="json",
        )
        self.assertEqual(dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Promote student to Year 2 in 2026-2027 without duplicating Student profile
        promo = self.client.post(
            reverse("enrollment-promote", args=[e1.data["id"]]),
            {
                "target_academic_year": self.y2026.id,
                "target_year_level": self.y2.id,
                "enrollment_type": "promotion",
                "remarks": "Passed all Year 1 courses",
            },
            format="json",
        )
        self.assertEqual(promo.status_code, status.HTTP_201_CREATED)
        self.assertEqual(promo.data["previous_enrollment"], e1.data["id"])
        self.assertEqual(Student.objects.count(), 1)
        self.assertEqual(Enrollment.objects.count(), 2)
        self.assertEqual(Enrollment.objects.get(pk=e1.data["id"]).status, "promoted")

        # Major change on active Year 2 enrollment logs history
        chg = self.client.post(
            reverse("enrollment-change-program", args=[promo.data["id"]]),
            {"major": self.it.id, "reason": "Student approved for IT major switch"},
            format="json",
        )
        self.assertEqual(chg.status_code, status.HTTP_200_OK)
        self.assertEqual(chg.data["major"], self.it.id)
        self.assertTrue(
            EnrollmentHistory.objects.filter(
                enrollment_id=promo.data["id"], event_type="program_changed"
            ).exists()
        )

    def test_student_role_scoped_to_own_enrollments_and_readonly(self):
        Enrollment.objects.create(
            registration_number="ENR-2025-90001",
            student=self.student,
            academic_year=self.y2025,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2025, 10, 5),
        )
        other_student = Student.objects.create(
            student_code="STU-2025-0002",
            full_name_en="Other Person",
            gender="male",
            date_of_birth=date(2004, 1, 1),
        )
        Enrollment.objects.create(
            registration_number="ENR-2025-90002",
            student=other_student,
            academic_year=self.y2025,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2025, 10, 5),
        )

        self._auth("student_enr")
        res = self.client.get(reverse("enrollment-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 1)

        blocked = self.client.post(
            reverse("enrollment-list"),
            {
                "student": self.student.id,
                "academic_year": self.y2026.id,
                "degree": self.bach.id,
                "major": self.cs.id,
                "year_level": self.y2.id,
                "enrollment_date": "2026-10-01",
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
