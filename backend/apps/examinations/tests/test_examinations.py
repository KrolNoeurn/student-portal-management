from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.classes.models import ClassMembership, ClassSection
from apps.enrollments.models import Enrollment
from apps.examinations.models import AssessmentType
from apps.examinations.services import seed_examination_defaults
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.teachers.models import Teacher, TeachingAssignment

User = get_user_model()


class ExaminationsAndGPATests(APITestCase):
    def setUp(self):
        seed_roles_and_permissions()
        seed_academic_defaults()
        seed_examination_defaults()
        self.password = "StrongPass#2026"

        self.admin = User.objects.create_user(
            username="acad_exam", email="acad_exam@university.edu", password=self.password
        )
        self.admin.groups.add(Group.objects.get(name="Academic Administrator"))

        self.inst = User.objects.create_user(
            username="inst_exam", email="inst_exam@university.edu", password=self.password
        )
        self.inst.groups.add(Group.objects.get(name="Instructor"))

        self.stu_user = User.objects.create_user(
            username="stu_exam", email="stu_exam@university.edu", password=self.password
        )
        self.stu_user.groups.add(Group.objects.get(name="Student"))

        self.year = AcademicYear.objects.create(
            name="2026-2027", start_date=date(2026, 10, 1), end_date=date(2027, 8, 31), is_current=True
        )
        self.bach = Degree.objects.get(code="BACH")
        self.cs = Major.objects.create(degree=self.bach, code="CS", name_en="Computer Science")
        self.y1 = YearLevel.objects.get(code="Y1")
        self.cls = ClassSection.objects.create(
            code="CS-E1", name="CS Exam 1", academic_year=self.year, degree=self.bach, major=self.cs, year_level=self.y1
        )
        self.subj = Subject.objects.create(code="CS101", name_en="Algorithms", credits=Decimal("3.0"))

        self.teacher = Teacher.objects.create(
            user=self.inst, teacher_code="TCH-0500", full_name_en="Dr. Exam"
        )
        TeachingAssignment.objects.create(
            teacher=self.teacher, academic_year=self.year, class_section=self.cls, subject=self.subj
        )

        self.s1 = Student.objects.create(
            user=self.stu_user,
            student_code="STU-2026-0501",
            full_name_en="High Scorer",
            gender="female",
            date_of_birth=date(2005, 1, 1),
        )
        self.e1 = Enrollment.objects.create(
            registration_number="ENR-2026-50001",
            student=self.s1,
            academic_year=self.year,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )
        ClassMembership.objects.create(
            class_section=self.cls, enrollment=self.e1, student=self.s1, assigned_date=date(2026, 10, 2)
        )

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_assessment_scores_weighted_grade_publish_and_student_transcript(self):
        self._auth("inst_exam")
        midterm_type = AssessmentType.objects.get(code="MIDTERM")
        final_type = AssessmentType.objects.get(code="FINAL")

        a1 = self.client.post(
            reverse("assessment-list"),
            {
                "class_section": self.cls.id,
                "subject": self.subj.id,
                "assessment_type": midterm_type.id,
                "title": "Midterm Exam",
                "max_score": "100.00",
                "weight_percent": "40.00",
            },
            format="json",
        )
        self.assertEqual(a1.status_code, status.HTTP_201_CREATED)

        a2 = self.client.post(
            reverse("assessment-list"),
            {
                "class_section": self.cls.id,
                "subject": self.subj.id,
                "assessment_type": final_type.id,
                "title": "Final Exam",
                "max_score": "100.00",
                "weight_percent": "60.00",
            },
            format="json",
        )
        self.assertEqual(a2.status_code, status.HTTP_201_CREATED)

        # Out-of-bounds score > max_score rejected
        bad_score = self.client.post(
            reverse("assessment-bulk-scores", args=[a1.data["id"]]),
            {"scores": [{"enrollment": self.e1.id, "score": "120.00"}]},
            format="json",
        )
        self.assertEqual(bad_score.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid scores: 80 * 40% + 90 * 60% = 32 + 54 = 86.00% -> A (4.00)
        self.assertEqual(
            self.client.post(
                reverse("assessment-bulk-scores", args=[a1.data["id"]]),
                {"scores": [{"enrollment": self.e1.id, "score": "80.00"}]},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.post(
                reverse("assessment-bulk-scores", args=[a2.data["id"]]),
                {"scores": [{"enrollment": self.e1.id, "score": "90.00"}]},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )

        # Instructor cannot publish directly -> 403
        blocked_pub = self.client.post(
            reverse("subject-grade-calculate"),
            {"class_section": self.cls.id, "subject": self.subj.id, "publish": True},
            format="json",
        )
        self.assertEqual(blocked_pub.status_code, status.HTTP_403_FORBIDDEN)

        # Instructor calculates draft grades -> 200 (draft)
        draft_calc = self.client.post(
            reverse("subject-grade-calculate"),
            {"class_section": self.cls.id, "subject": self.subj.id, "publish": False},
            format="json",
        )
        self.assertEqual(draft_calc.status_code, status.HTTP_200_OK)
        self.assertEqual(draft_calc.data[0]["total_percentage"], "86.00")
        self.assertEqual(draft_calc.data[0]["letter_grade"], "A")
        self.assertEqual(draft_calc.data[0]["status"], "draft")

        # Student sees 0 grades before publication
        self._auth("stu_exam")
        pre_tr = self.client.get(reverse("subject-grade-transcript"))
        self.assertEqual(pre_tr.status_code, status.HTTP_200_OK)
        self.assertEqual(pre_tr.data["summary"]["subjects_count"], 0)

        # Academic Administrator publishes grades
        self._auth("acad_exam")
        pub_calc = self.client.post(
            reverse("subject-grade-calculate"),
            {"class_section": self.cls.id, "subject": self.subj.id, "publish": True},
            format="json",
        )
        self.assertEqual(pub_calc.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_calc.data[0]["status"], "published")

        # Student now sees published transcript with GPA 4.00
        self._auth("stu_exam")
        post_tr = self.client.get(reverse("subject-grade-transcript"))
        self.assertEqual(post_tr.status_code, status.HTTP_200_OK)
        self.assertEqual(post_tr.data["summary"]["cumulative_gpa"], "4.00")
        self.assertEqual(post_tr.data["summary"]["credits_earned"], "3.0")
