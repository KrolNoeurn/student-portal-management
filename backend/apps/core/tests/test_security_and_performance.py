from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.academics.models import AcademicYear, Degree, Major, YearLevel
from apps.academics.services import seed_academic_defaults
from apps.accounts.services import seed_roles_and_permissions
from apps.classes.models import ClassMembership, ClassSection
from apps.enrollments.models import Enrollment
from apps.students.models import Student, StudentGuardian
from apps.subjects.models import Subject
from apps.system_settings.models import BackupRecord
from apps.system_settings.services import seed_default_settings
from apps.teachers.models import Teacher, TeachingAssignment

User = get_user_model()


class SecurityRBACAndPerformanceTests(APITestCase):
    def setUp(self):
        seed_default_settings()
        seed_academic_defaults()
        seed_roles_and_permissions()

        self.admin = User.objects.create_superuser("secadmin", "secadmin@example.edu", "StrongPass!123")

        self.year = AcademicYear.objects.create(
            name="2026-2027",
            start_date=date(2026, 10, 1),
            end_date=date(2027, 8, 31),
            is_current=True,
        )
        self.degree = Degree.objects.get(code="BACH")
        self.major = Major.objects.create(
            degree=self.degree, code="CS-SEC", name_en="Computer Science", name_km="វិទ្យាសាស្ត្រកុំព្យូទ័រ"
        )
        self.y1 = YearLevel.objects.get(code="Y1")
        self.subject = Subject.objects.create(code="SEC101", name_en="Security Fundamentals", credits=3)

        self.class1 = ClassSection.objects.create(
            code="CS-SEC-A",
            name="CS Security A",
            academic_year=self.year,
            degree=self.degree,
            major=self.major,
            year_level=self.y1,
            capacity=30,
        )
        self.class2 = ClassSection.objects.create(
            code="CS-SEC-B",
            name="CS Security B",
            academic_year=self.year,
            degree=self.degree,
            major=self.major,
            year_level=self.y1,
            capacity=30,
        )

        # Student A in Class 1, Student B in Class 1 & Class 2
        self.student_a_user = self._make_user("student_a", "Student")
        self.student_b_user = self._make_user("student_b", "Student")
        self.student_a = Student.objects.create(
            user=self.student_a_user,
            student_code="STU-SEC-001",
            full_name_en="Alice Student",
            gender="female",
            date_of_birth=date(2005, 3, 10),
        )
        self.student_b = Student.objects.create(
            user=self.student_b_user,
            student_code="STU-SEC-002",
            full_name_en="Bob Student",
            gender="male",
            date_of_birth=date(2005, 5, 12),
        )
        self.enr_a = Enrollment.objects.create(
            registration_number="ENR-SEC-001",
            student=self.student_a,
            academic_year=self.year,
            degree=self.degree,
            major=self.major,
            year_level=self.y1,
            status="active",
        )
        self.enr_b = Enrollment.objects.create(
            registration_number="ENR-SEC-002",
            student=self.student_b,
            academic_year=self.year,
            degree=self.degree,
            major=self.major,
            year_level=self.y1,
            status="active",
        )
        ClassMembership.objects.create(
            class_section=self.class1, enrollment=self.enr_a, student=self.student_a, status="active"
        )
        ClassMembership.objects.create(
            class_section=self.class2, enrollment=self.enr_b, student=self.student_b, status="active"
        )

        # Instructor assigned ONLY to Class 1
        self.instructor_user = self._make_user("inst_sec", "Instructor")
        self.teacher = Teacher.objects.create(
            user=self.instructor_user,
            teacher_code="TCH-SEC-001",
            full_name_en="Prof. Chan",
        )
        TeachingAssignment.objects.create(
            teacher=self.teacher,
            academic_year=self.year,
            class_section=self.class1,
            subject=self.subject,
            status="active",
        )

        self.backup = BackupRecord.objects.create(
            filename="sams_test_backup.sqlite3",
            file_path="/tmp/sams_test_backup.sqlite3",
            file_size_bytes=1024,
            sha256_checksum="a" * 64,
            backup_type="manual",
            status="success",
            triggered_by=self.admin,
        )

    def _make_user(self, username: str, role_name: str):
        user = User.objects.create_user(username, f"{username}@example.edu", "StrongPass!123")
        user.groups.add(Group.objects.get(name=role_name))
        return user

    def test_unauthenticated_endpoints_require_auth(self):
        # Public endpoints remain accessible
        self.assertEqual(self.client.get("/api/v1/health/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/v1/system/bootstrap/").status_code, status.HTTP_200_OK)

        protected_urls = [
            "/api/v1/students/",
            "/api/v1/enrollments/",
            "/api/v1/classes/",
            "/api/v1/class-memberships/",
            "/api/v1/teachers/",
            "/api/v1/attendance/sessions/",
            "/api/v1/assessments/",
            "/api/v1/grades/",
            "/api/v1/dashboard/",
            "/api/v1/reports/students/",
            "/api/v1/notifications/",
            "/api/v1/settings/",
            "/api/v1/backups/",
            f"/api/v1/backups/{self.backup.id}/",
            "/api/v1/audit-logs/",
            "/api/v1/users/",
            "/api/v1/roles/",
            "/api/schema/",
        ]
        for url in protected_urls:
            resp = self.client.get(url)
            self.assertEqual(
                resp.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"Expected 401 for unauthenticated GET {url}, got {resp.status_code}",
            )

    def test_student_and_instructor_idor_boundaries(self):
        # Student A cannot inspect Student B or admin resources
        self.client.force_authenticate(self.student_a_user)

        self.assertEqual(
            self.client.get(f"/api/v1/students/{self.student_b.id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/students/check-duplicate/", {"full_name_en": "Bob Student"}
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        # Class roster action only returns Student A's own membership
        roster = self.client.get(f"/api/v1/classes/{self.class1.id}/students/")
        self.assertEqual(roster.status_code, status.HTTP_200_OK)
        self.assertEqual([m["student"] for m in roster.data], [self.student_a.id])

        # ClassMembershipViewSet scoped strictly to Student A
        memberships = self.client.get("/api/v1/class-memberships/")
        self.assertIn(memberships.status_code, (status.HTTP_200_OK, status.HTTP_403_FORBIDDEN))
        if memberships.status_code == status.HTTP_200_OK:
            self.assertTrue(all(m["student"] == self.student_a.id for m in memberships.data["results"]))

        # Student cannot retrieve individual backup record (closed IDOR)
        self.assertEqual(
            self.client.get(f"/api/v1/backups/{self.backup.id}/").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        # Student cannot view another student's transcript
        self.assertEqual(
            self.client.get(f"/api/v1/grades/transcript/?student={self.student_b.id}").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        # Instructor scoping: allowed for Student A (in Class 1), forbidden for Student B (Class 2)
        self.client.force_authenticate(self.instructor_user)
        self.assertEqual(
            self.client.get(f"/api/v1/grades/transcript/?student={self.student_a.id}").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/grades/transcript/?student={self.student_b.id}").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/backups/{self.backup.id}/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_cross_role_permission_matrix_boundaries(self):
        auditor = self._make_user("auditor_sec", "Read-Only Auditor")
        self.client.force_authenticate(auditor)
        self.assertEqual(self.client.get("/api/v1/students/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/v1/audit-logs/").status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.post(
                "/api/v1/students/",
                {"full_name_en": "Blocked Write", "gender": "male", "date_of_birth": "2004-01-01"},
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        admission = self._make_user("adm_sec", "Admission Officer")
        self.client.force_authenticate(admission)
        self.assertEqual(self.client.get("/api/v1/students/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/v1/settings/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/v1/backups/").status_code, status.HTTP_403_FORBIDDEN)

        attendance_officer = self._make_user("att_sec", "Attendance Officer")
        self.client.force_authenticate(attendance_officer)
        self.assertEqual(
            self.client.get("/api/v1/attendance/sessions/").status_code, status.HTTP_200_OK
        )
        self.assertEqual(self.client.get("/api/v1/users/").status_code, status.HTTP_403_FORBIDDEN)

    def test_student_list_query_count_is_bounded_without_n_plus_one(self):
        for i in range(15):
            st = Student.objects.create(
                student_code=f"STU-PERF-{i:03d}",
                full_name_en=f"Perf Student {i}",
                gender="male",
                date_of_birth=date(2004, 1, 1),
            )
            StudentGuardian.objects.create(
                student=st, full_name=f"Guardian {i}", relationship="guardian", phone="012000000"
            )

        self.client.force_authenticate(self.admin)
        # Expect only count + paginated student rows (zero guardian/doc/history N+1 queries)
        with self.assertNumQueries(2):
            resp = self.client.get("/api/v1/students/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 17)

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_AUTHENTICATION_CLASSES": [
                "rest_framework_simplejwt.authentication.JWTAuthentication",
            ],
            "DEFAULT_PERMISSION_CLASSES": [
                "rest_framework.permissions.IsAuthenticated",
            ],
            "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
            "DEFAULT_THROTTLE_CLASSES": [
                "rest_framework.throttling.ScopedRateThrottle",
            ],
            "DEFAULT_THROTTLE_RATES": {
                "login": "2/minute",
            },
        }
    )
    def test_login_endpoint_enforces_rate_limiting(self):
        cache.clear()
        payload = {"identifier": "secadmin", "password": "WrongPassword!"}
        r1 = self.client.post("/api/v1/auth/login/", payload)
        r2 = self.client.post("/api/v1/auth/login/", payload)
        r3 = self.client.post("/api/v1/auth/login/", payload)
        self.assertEqual(r1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r3.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        cache.clear()
