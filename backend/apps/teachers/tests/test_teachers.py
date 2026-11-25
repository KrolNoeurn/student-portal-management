from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.classes.models import Classroom, ClassSection
from apps.subjects.models import Subject
from apps.teachers.models import Teacher

User = get_user_model()


class TeachersAndScheduleConflictTests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.officer = User.objects.create_user(
            username="officer_tch",
            email="officer_tch@university.edu",
            password=self.password,
        )
        self.officer.groups.add(Group.objects.get(name="Academic Officer"))

        self.inst_user = User.objects.create_user(
            username="inst_tch",
            email="inst_tch@university.edu",
            password=self.password,
        )
        self.inst_user.groups.add(Group.objects.get(name="Instructor"))

        self.year = AcademicYear.objects.create(
            name="2026-2027",
            start_date=date(2026, 10, 1),
            end_date=date(2027, 8, 31),
            status="active",
            is_current=True,
        )
        self.bach = Degree.objects.get(code="BACH")
        self.cs = Major.objects.create(degree=self.bach, code="CS", name_en="Computer Science")
        self.y1 = YearLevel.objects.get(code="Y1")

        self.room1 = Classroom.objects.create(code="R101", name="Room 101", capacity=40)
        self.room2 = Classroom.objects.create(code="R102", name="Room 102", capacity=40)

        self.cls_a = ClassSection.objects.create(
            code="CS-A", name="CS A", academic_year=self.year, degree=self.bach, major=self.cs, year_level=self.y1
        )
        self.cls_b = ClassSection.objects.create(
            code="CS-B", name="CS B", academic_year=self.year, degree=self.bach, major=self.cs, year_level=self.y1
        )
        self.subj1 = Subject.objects.create(code="CS101", name_en="Programming I")
        self.subj2 = Subject.objects.create(code="CS102", name_en="Database Systems")

        self.t1 = Teacher.objects.create(
            user=self.inst_user, teacher_code="TCH-0001", full_name_en="Dr. Dara Sok"
        )
        self.t2 = Teacher.objects.create(teacher_code="TCH-0002", full_name_en="Prof. Sophea Ly")

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_teacher_classroom_and_class_schedule_conflict_detection(self):
        self._auth("officer_tch")

        # Create 3 teaching assignments:
        # a1: t1 teaches CS-A (CS101)
        # a2: t1 teaches CS-B (CS101)  -> same teacher
        # a3: t2 teaches CS-A (CS102)  -> same class
        # a4: t2 teaches CS-B (CS102)  -> different teacher & class (tests classroom conflict)
        a1 = self.client.post(
            reverse("teaching-assignment-list"),
            {"teacher": self.t1.id, "class_section": self.cls_a.id, "subject": self.subj1.id},
            format="json",
        ).data["id"]
        a2 = self.client.post(
            reverse("teaching-assignment-list"),
            {"teacher": self.t1.id, "class_section": self.cls_b.id, "subject": self.subj1.id},
            format="json",
        ).data["id"]
        a3 = self.client.post(
            reverse("teaching-assignment-list"),
            {"teacher": self.t2.id, "class_section": self.cls_a.id, "subject": self.subj2.id},
            format="json",
        ).data["id"]
        a4 = self.client.post(
            reverse("teaching-assignment-list"),
            {"teacher": self.t2.id, "class_section": self.cls_b.id, "subject": self.subj2.id},
            format="json",
        ).data["id"]

        # Schedule a1 on Monday 08:00-10:00 in R101 -> OK
        s1 = self.client.post(
            reverse("class-schedule-list"),
            {
                "teaching_assignment": a1,
                "classroom": self.room1.id,
                "day_of_week": 1,
                "start_time": "08:00:00",
                "end_time": "10:00:00",
            },
            format="json",
        )
        self.assertEqual(s1.status_code, status.HTTP_201_CREATED)

        # 1. Teacher conflict: t1 in CS-B R102 at 09:00-11:00 -> 400
        chk_t = self.client.post(
            reverse("class-schedule-check-conflicts"),
            {
                "teaching_assignment": a2,
                "classroom": self.room2.id,
                "day_of_week": 1,
                "start_time": "09:00:00",
                "end_time": "11:00:00",
            },
            format="json",
        )
        self.assertTrue(chk_t.data["has_conflicts"])
        self.assertEqual(chk_t.data["conflicts"][0]["type"], "teacher")

        bad_t = self.client.post(
            reverse("class-schedule-list"),
            {
                "teaching_assignment": a2,
                "classroom": self.room2.id,
                "day_of_week": 1,
                "start_time": "09:00:00",
                "end_time": "11:00:00",
            },
            format="json",
        )
        self.assertEqual(bad_t.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Class conflict: t2 teaching CS-A in R102 at 08:30-09:30 -> 400
        bad_c = self.client.post(
            reverse("class-schedule-list"),
            {
                "teaching_assignment": a3,
                "classroom": self.room2.id,
                "day_of_week": 1,
                "start_time": "08:30:00",
                "end_time": "09:30:00",
            },
            format="json",
        )
        self.assertEqual(bad_c.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Classroom conflict: t2 teaching CS-B in R101 at 08:00-10:00 -> 400
        bad_r = self.client.post(
            reverse("class-schedule-list"),
            {
                "teaching_assignment": a4,
                "classroom": self.room1.id,
                "day_of_week": 1,
                "start_time": "08:00:00",
                "end_time": "10:00:00",
            },
            format="json",
        )
        self.assertEqual(bad_r.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Back-to-back non-overlapping slot 10:00-12:00 in same room & same teacher -> 201 OK
        ok_next = self.client.post(
            reverse("class-schedule-list"),
            {
                "teaching_assignment": a2,
                "classroom": self.room1.id,
                "day_of_week": 1,
                "start_time": "10:00:00",
                "end_time": "12:00:00",
            },
            format="json",
        )
        self.assertEqual(ok_next.status_code, status.HTTP_201_CREATED)

        # 5. Instructor role sees only own assignments & cannot create assignments
        self._auth("inst_tch")
        my_assigns = self.client.get(reverse("teaching-assignment-list"))
        self.assertEqual(my_assigns.status_code, status.HTTP_200_OK)
        self.assertEqual(my_assigns.data["count"], 2)  # a1 & a2 belong to t1

        blocked = self.client.post(
            reverse("teaching-assignment-list"),
            {"teacher": self.t2.id, "class_section": self.cls_b.id, "subject": self.subj1.id},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
