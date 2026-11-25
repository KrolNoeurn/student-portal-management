from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.attendance.models import AttendanceCorrectionLog, AttendanceRecord
from apps.classes.models import ClassMembership, ClassSection
from apps.enrollments.models import Enrollment
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.system_settings.services import seed_default_settings
from apps.teachers.models import Teacher, TeachingAssignment

User = get_user_model()


class AttendanceAPITests(APITestCase):
    def setUp(self):
        seed_default_settings()
        seed_roles_and_permissions()
        seed_academic_defaults()
        self.password = "StrongPass#2026"

        self.att_officer = User.objects.create_user(
            username="att_officer", email="att_officer@university.edu", password=self.password
        )
        self.att_officer.groups.add(Group.objects.get(name="Attendance Officer"))

        self.inst_user = User.objects.create_user(
            username="inst_att", email="inst_att@university.edu", password=self.password
        )
        self.inst_user.groups.add(Group.objects.get(name="Instructor"))

        self.student_user = User.objects.create_user(
            username="stu_att", email="stu_att@university.edu", password=self.password
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
        self.y1 = YearLevel.objects.get(code="Y1")

        self.cls = ClassSection.objects.create(
            code="CS-Y1-A", name="CS A", academic_year=self.year, degree=self.bach, major=self.cs, year_level=self.y1
        )
        self.subj = Subject.objects.create(code="CS101", name_en="Programming")
        self.other_subj = Subject.objects.create(code="CS102", name_en="Networks")

        self.teacher = Teacher.objects.create(
            user=self.inst_user, teacher_code="TCH-0100", full_name_en="Inst Att"
        )
        TeachingAssignment.objects.create(
            teacher=self.teacher,
            academic_year=self.year,
            class_section=self.cls,
            subject=self.subj,
        )

        self.s1 = Student.objects.create(
            user=self.student_user,
            student_code="STU-2026-0010",
            full_name_en="Student One",
            gender="male",
            date_of_birth=date(2005, 1, 1),
        )
        self.s2 = Student.objects.create(
            student_code="STU-2026-0011",
            full_name_en="Student Two",
            gender="female",
            date_of_birth=date(2005, 2, 2),
        )
        e1 = Enrollment.objects.create(
            registration_number="ENR-2026-10001",
            student=self.s1,
            academic_year=self.year,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )
        e2 = Enrollment.objects.create(
            registration_number="ENR-2026-10002",
            student=self.s2,
            academic_year=self.year,
            degree=self.bach,
            major=self.cs,
            year_level=self.y1,
            enrollment_date=date(2026, 10, 1),
        )
        ClassMembership.objects.create(
            class_section=self.cls, enrollment=e1, student=self.s1, assigned_date=date(2026, 10, 2)
        )
        ClassMembership.objects.create(
            class_section=self.cls, enrollment=e2, student=self.s2, assigned_date=date(2026, 10, 2)
        )

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_bulk_attendance_duplicate_prevention_correction_warnings_and_scoping(self):
        # Instructor cannot mark attendance for unassigned subject
        self._auth("inst_att")
        blocked_inst = self.client.post(
            reverse("attendance-bulk-mark"),
            {
                "class_section": self.cls.id,
                "subject": self.other_subj.id,
                "session_date": "2026-10-15",
                "records": [{"student": self.s1.id, "status": "present"}],
            },
            format="json",
        )
        self.assertEqual(blocked_inst.status_code, status.HTTP_403_FORBIDDEN)

        # Instructor marks valid assigned class + subject
        ok_bulk = self.client.post(
            reverse("attendance-bulk-mark"),
            {
                "class_section": self.cls.id,
                "subject": self.subj.id,
                "session_date": "2026-10-15",
                "session_slot": 1,
                "topic": "Variables & Loops",
                "records": [
                    {"student": self.s1.id, "status": "present"},
                    {"student": self.s2.id, "status": "absent", "remarks": "Unexcused"},
                ],
            },
            format="json",
        )
        self.assertEqual(ok_bulk.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ok_bulk.data["present_count"], 1)
        self.assertEqual(ok_bulk.data["absent_count"], 1)

        # Duplicate session rejected unless update_existing=True
        dup_sess = self.client.post(
            reverse("attendance-bulk-mark"),
            {
                "class_section": self.cls.id,
                "subject": self.subj.id,
                "session_date": "2026-10-15",
                "session_slot": 1,
                "records": [{"student": self.s1.id, "status": "present"}],
            },
            format="json",
        )
        self.assertEqual(dup_sess.status_code, status.HTTP_400_BAD_REQUEST)

        # Attendance Officer checks warnings -> s2 has 0% (<80%) warning
        self._auth("att_officer")
        summary = self.client.get(
            reverse("attendance-summary"), {"class_section": self.cls.id, "warnings_only": "true"}
        )
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["warning_count"], 1)
        self.assertEqual(summary.data["results"][0]["student_id"], self.s2.id)

        # Attendance Officer corrects s2 record with reason -> logs AttendanceCorrectionLog
        rec_s2 = AttendanceRecord.objects.get(student=self.s2)
        corr = self.client.post(
            reverse("attendance-record-correct", args=[rec_s2.id]),
            {"status": "permission", "reason": "Submitted doctor note"},
            format="json",
        )
        self.assertEqual(corr.status_code, status.HTTP_200_OK)
        self.assertEqual(corr.data["status"], "permission")
        self.assertEqual(AttendanceCorrectionLog.objects.filter(attendance_record=rec_s2).count(), 1)

        # Export CSV succeeds for Attendance Officer
        exp = self.client.get(reverse("attendance-export"), {"class_section": self.cls.id})
        self.assertEqual(exp.status_code, status.HTTP_200_OK)
        self.assertIn("STU-2026-0010", exp.content.decode("utf-8-sig"))

        # Student sees ONLY own attendance records and cannot export or bulk mark
        self._auth("stu_att")
        stu_recs = self.client.get(reverse("attendance-record-list"))
        self.assertEqual(stu_recs.status_code, status.HTTP_200_OK)
        self.assertEqual(stu_recs.data["count"], 1)
        self.assertEqual(stu_recs.data["results"][0]["student"], self.s1.id)
        self.assertEqual(
            self.client.get(reverse("attendance-export")).status_code, status.HTTP_403_FORBIDDEN
        )
