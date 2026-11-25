from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.classes.models import ClassMembership, Classroom, ClassSection, ClassTransferHistory
from apps.enrollments.models import Enrollment
from apps.students.models import Student

User = get_user_model()


class ClassesAPITests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.officer = User.objects.create_user(
            username="officer_cls",
            email="officer_cls@university.edu",
            password=self.password,
        )
        self.officer.groups.add(Group.objects.get(name="Academic Officer"))

        self.student_user = User.objects.create_user(
            username="student_cls",
            email="student_cls@university.edu",
            password=self.password,
        )
        self.student_user.groups.add(Group.objects.get(name="Student"))

        self.year = AcademicYear.objects.create(
            name="2026-2027",
            start_date=date(2026, 10, 1),
            end_date=date(2027, 8, 31),
            status="active",
            is_current=True,
        )
        self.bach = Degree.objects.get(code="BACH")
        self.cs = Major.objects.create(degree=self.bach, code="CS", name_en="Computer Science")
        self.it = Major.objects.create(degree=self.bach, code="IT", name_en="Information Tech")
        self.y1 = YearLevel.objects.get(code="Y1")
        self.y2 = YearLevel.objects.get(code="Y2")

        self.room = Classroom.objects.create(code="B1-101", name="Lab 101", capacity=30)
        self.s1 = Student.objects.create(
            user=self.student_user,
            student_code="STU-2026-0001",
            full_name_en="Alice Sok",
            gender="female",
            date_of_birth=date(2005, 1, 1),
        )
        self.s2 = Student.objects.create(
            student_code="STU-2026-0002",
            full_name_en="Bob Dara",
            gender="male",
            date_of_birth=date(2005, 2, 2),
        )
        self.enr_cs_y1_1 = Enrollment.objects.create(
            registration_number="ENR-2026-00001",
            student=self.s1,
            academic_year=self.year,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )
        self.enr_cs_y1_2 = Enrollment.objects.create(
            registration_number="ENR-2026-00002",
            student=self.s2,
            academic_year=self.year,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )
        self.s_mismatch = Student.objects.create(
            student_code="STU-2026-0003",
            full_name_en="Carol IT",
            gender="female",
            date_of_birth=date(2004, 3, 3),
        )
        self.enr_it_y2 = Enrollment.objects.create(
            registration_number="ENR-2026-00003",
            student=self.s_mismatch,
            academic_year=self.year,
            degree=self.bach,
            major=self.it,
            year_level=self.y2,
            enrollment_date=date(2026, 10, 1),
        )

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_assign_context_validation_capacity_and_transfer(self):
        self._auth("officer_cls")

        cls_a = self.client.post(
            reverse("class-section-list"),
            {
                "code": "CS-Y1-A",
                "name": "CS Year 1 Section A",
                "academic_year": self.year.id,
                "degree": self.bach.id,
                "major": self.cs.id,
                "year_level": self.y1.id,
                "default_classroom": self.room.id,
                "capacity": 1,
            },
            format="json",
        )
        self.assertEqual(cls_a.status_code, status.HTTP_201_CREATED)
        cls_a_id = cls_a.data["id"]

        cls_b = self.client.post(
            reverse("class-section-list"),
            {
                "code": "CS-Y1-B",
                "name": "CS Year 1 Section B",
                "academic_year": self.year.id,
                "degree": self.bach.id,
                "major": self.cs.id,
                "year_level": self.y1.id,
                "capacity": 2,
            },
            format="json",
        )
        self.assertEqual(cls_b.status_code, status.HTTP_201_CREATED)
        cls_b_id = cls_b.data["id"]

        # Context mismatch rejected
        bad_assign = self.client.post(
            reverse("class-section-assign-student", args=[cls_a_id]),
            {"enrollment": self.enr_it_y2.id},
            format="json",
        )
        self.assertEqual(bad_assign.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid assignment fills capacity=1 -> status becomes 'full'
        ok_assign = self.client.post(
            reverse("class-section-assign-student", args=[cls_a_id]),
            {"enrollment": self.enr_cs_y1_1.id},
            format="json",
        )
        self.assertEqual(ok_assign.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ClassSection.objects.get(pk=cls_a_id).status, "full")

        # Over-capacity rejected
        over_cap = self.client.post(
            reverse("class-section-assign-student", args=[cls_a_id]),
            {"enrollment": self.enr_cs_y1_2.id},
            format="json",
        )
        self.assertEqual(over_cap.status_code, status.HTTP_400_BAD_REQUEST)

        # Transfer student from A to B reopens A and logs ClassTransferHistory
        transfer = self.client.post(
            reverse("class-section-transfer-student", args=[cls_a_id]),
            {
                "membership": ok_assign.data["id"],
                "target_class_section": cls_b_id,
                "reason": "Section balancing",
            },
            format="json",
        )
        self.assertEqual(transfer.status_code, status.HTTP_200_OK)
        self.assertEqual(ClassSection.objects.get(pk=cls_a_id).status, "open")
        self.assertEqual(ClassMembership.objects.get(pk=ok_assign.data["id"]).status, "transferred")
        self.assertEqual(ClassTransferHistory.objects.count(), 1)

        # Student role only sees their own assigned classes and cannot assign
        self._auth("student_cls")
        my_classes = self.client.get(reverse("class-section-list"))
        self.assertEqual(my_classes.status_code, status.HTTP_200_OK)
        self.assertEqual(my_classes.data["count"], 2)  # historical A + active B

        blocked = self.client.post(
            reverse("class-section-assign-student", args=[cls_b_id]),
            {"enrollment": self.enr_cs_y1_2.id},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    def test_mixed_degree_class_section_allows_multiple_degrees(self):
        self._auth("officer_cls")
        hd = Degree.objects.get(code="HD")
        cs_hd = Major.objects.create(degree=hd, code="CS-HD", name_en="Computer Science (HD)")
        s_hd = Student.objects.create(
            student_code="STU-2026-0099",
            full_name_en="Dara Diploma",
            gender="male",
            date_of_birth=date(2005, 6, 1),
        )
        enr_hd_y1 = Enrollment.objects.create(
            registration_number="ENR-2026-00099",
            student=s_hd,
            academic_year=self.year,
            degree=hd,
            major=cs_hd,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )

        # Create mixed-degree class allowing both BACH and HD (no single degree/major required)
        mixed_cls = self.client.post(
            reverse("class-section-list"),
            {
                "code": "MIX-Y1-A",
                "name": "Mixed Degree Year 1 Section A",
                "academic_year": self.year.id,
                "allow_mixed_degrees": True,
                "allowed_degrees": [self.bach.id, hd.id],
                "year_level": self.y1.id,
                "capacity": 30,
            },
            format="json",
        )
        self.assertEqual(mixed_cls.status_code, status.HTTP_201_CREATED)
        mixed_id = mixed_cls.data["id"]
        self.assertTrue(mixed_cls.data["allow_mixed_degrees"])
        self.assertEqual(set(mixed_cls.data["allowed_degrees"]), {self.bach.id, hd.id})

        # Eligible enrollments include BOTH Bachelor's and Higher Diploma Y1 students
        eligible = self.client.get(reverse("class-section-eligible-enrollments", args=[mixed_id]))
        self.assertEqual(eligible.status_code, status.HTTP_200_OK)
        eligible_ids = {item["id"] for item in eligible.data}
        self.assertIn(self.enr_cs_y1_1.id, eligible_ids)
        self.assertIn(enr_hd_y1.id, eligible_ids)
        self.assertNotIn(self.enr_it_y2.id, eligible_ids)  # Y2 still excluded

        # Assign Bachelor's student and Higher Diploma student into the same class
        r1 = self.client.post(
            reverse("class-section-assign-student", args=[mixed_id]),
            {"enrollment": self.enr_cs_y1_1.id},
            format="json",
        )
        r2 = self.client.post(
            reverse("class-section-assign-student", args=[mixed_id]),
            {"enrollment": enr_hd_y1.id},
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r1.data["degree_code"], "BACH")
        self.assertEqual(r2.data["degree_code"], "HD")

        # Year-level mismatch (Y2) is still rejected even in mixed-degree class
        r_y2 = self.client.post(
            reverse("class-section-assign-student", args=[mixed_id]),
            {"enrollment": self.enr_it_y2.id},
            format="json",
        )
        self.assertEqual(r_y2.status_code, status.HTTP_400_BAD_REQUEST)

        # Restricting allowed_degrees to BACH only blocks transferring HD student into another class
        bach_only_mixed = self.client.post(
            reverse("class-section-list"),
            {
                "code": "MIX-Y1-BACH",
                "name": "BACH Only Mixed",
                "academic_year": self.year.id,
                "allow_mixed_degrees": True,
                "allowed_degrees": [self.bach.id],
                "year_level": self.y1.id,
                "capacity": 30,
            },
            format="json",
        )
        self.assertEqual(bach_only_mixed.status_code, status.HTTP_201_CREATED)
        bad_transfer = self.client.post(
            reverse("class-section-transfer-student", args=[mixed_id]),
            {"membership": r2.data["id"], "target_class_section": bach_only_mixed.data["id"]},
            format="json",
        )
        self.assertEqual(bad_transfer.status_code, status.HTTP_400_BAD_REQUEST)
