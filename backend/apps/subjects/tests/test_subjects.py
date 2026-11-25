from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.subjects.models import Curriculum, Subject

User = get_user_model()


class SubjectsAndCurriculumTests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.officer = User.objects.create_user(
            username="officer_subj",
            email="officer_subj@university.edu",
            password=self.password,
        )
        self.officer.groups.add(Group.objects.get(name="Academic Officer"))

        self.bach = Degree.objects.get(code="BACH")
        self.hd = Degree.objects.get(code="HD")
        self.major_cs = Major.objects.create(
            degree=self.bach, code="CS", name_en="Computer Science"
        )
        self.y1 = YearLevel.objects.get(code="Y1")

        resp = self.client.post(
            reverse("auth-login"),
            {"username": "officer_subj", "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_subject_and_curriculum_validation_rules(self):
        s1_resp = self.client.post(
            reverse("subject-list"),
            {
                "code": "cs101",
                "name_en": "Introduction to Programming",
                "name_km": "សេចក្តីផ្តើមអំពីការសរសេរកម្មវិធី",
                "credits": "3.0",
                "theory_hours": 30,
                "practical_hours": 30,
            },
            format="json",
        )
        self.assertEqual(s1_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(s1_resp.data["code"], "CS101")
        self.assertEqual(s1_resp.data["total_hours"], 60)

        # Mismatched degree & major in Curriculum must fail
        bad_curr = self.client.post(
            reverse("curriculum-list"),
            {
                "degree": self.hd.id,
                "major": self.major_cs.id,
                "version": "2026-v1",
            },
            format="json",
        )
        self.assertEqual(bad_curr.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid Curriculum
        curr_resp = self.client.post(
            reverse("curriculum-list"),
            {
                "degree": self.bach.id,
                "major": self.major_cs.id,
                "version": "2026-v1",
            },
            format="json",
        )
        self.assertEqual(curr_resp.status_code, status.HTTP_201_CREATED)
        curr_id = curr_resp.data["id"]

        # Self-prerequisite rejected
        self_prereq = self.client.post(
            reverse("curriculum-subject-list"),
            {
                "curriculum": curr_id,
                "subject": s1_resp.data["id"],
                "year_level": self.y1.id,
                "semester_number": 1,
                "prerequisite_subject": s1_resp.data["id"],
            },
            format="json",
        )
        self.assertEqual(self_prereq.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid curriculum subject item
        cs_resp = self.client.post(
            reverse("curriculum-subject-list"),
            {
                "curriculum": curr_id,
                "subject": s1_resp.data["id"],
                "year_level": self.y1.id,
                "semester_number": 1,
                "is_required": True,
            },
            format="json",
        )
        self.assertEqual(cs_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Curriculum.objects.get(pk=curr_id).items.count(), 1)
        self.assertTrue(Subject.objects.filter(code="CS101").exists())
