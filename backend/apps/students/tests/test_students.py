import tempfile
from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.services import seed_roles_and_permissions
from apps.auditlogs.models import AuditLog
from apps.students.models import Student, StudentStatusHistory
from apps.system_settings.services import seed_default_settings

User = get_user_model()


class StudentsAPITests(APITestCase):
    def setUp(self):
        seed_default_settings()
        seed_roles_and_permissions()
        self.password = "StrongPass#2026"

        self.registrar = User.objects.create_user(
            username="registrar_stu",
            email="registrar_stu@university.edu",
            password=self.password,
        )
        self.registrar.groups.add(Group.objects.get(name="Registrar"))

        self.student_user = User.objects.create_user(
            username="student_self",
            email="student_self@university.edu",
            password=self.password,
        )
        self.student_user.groups.add(Group.objects.get(name="Student"))

    def _auth(self, username: str):
        resp = self.client.post(
            reverse("auth-login"),
            {"username": username, "password": self.password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    def test_auto_student_id_generation_and_duplicate_detection(self):
        self._auth("registrar_stu")

        r1 = self.client.post(
            reverse("student-list"),
            {
                "full_name_en": "Sokha Chan",
                "full_name_km": "ចាន់ សុខា",
                "gender": "female",
                "date_of_birth": "2005-05-15",
                "national_id_number": "NID-990011",
                "phone": "012345678",
                "email": "sokha@student.edu",
                "status": "active",
                "registration_state": "completed",
            },
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r1.data["student_code"].startswith("STU-"))
        self.assertEqual(StudentStatusHistory.objects.filter(student_id=r1.data["id"]).count(), 1)

        # Duplicate check endpoint flags matching name + DOB
        dup = self.client.post(
            reverse("student-check-duplicate"),
            {"full_name_en": "Sokha Chan", "date_of_birth": "2005-05-15"},
            format="json",
        )
        self.assertEqual(dup.status_code, status.HTTP_200_OK)
        self.assertTrue(dup.data["has_duplicates"])

        # Duplicate national ID rejected
        r_dup_nid = self.client.post(
            reverse("student-list"),
            {
                "full_name_en": "Other Name",
                "gender": "male",
                "date_of_birth": "2004-02-01",
                "national_id_number": "NID-990011",
            },
            format="json",
        )
        self.assertEqual(r_dup_nid.status_code, status.HTTP_400_BAD_REQUEST)

        # Sequential second student ID
        r2 = self.client.post(
            reverse("student-list"),
            {
                "full_name_en": "Dara Kim",
                "gender": "male",
                "date_of_birth": "2004-08-20",
                "status": "applicant",
                "registration_state": "draft",
            },
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(r1.data["student_code"], r2.data["student_code"])

    def test_status_change_soft_delete_and_csv_export(self):
        self._auth("registrar_stu")
        student = Student.objects.create(
            student_code="STU-2026-0100",
            full_name_en="Vanna Meas",
            full_name_km="មាស វណ្ណា",
            gender="female",
            date_of_birth=date(2005, 1, 10),
            status="active",
        )

        # Status change
        st_resp = self.client.post(
            reverse("student-change-status", args=[student.id]),
            {"status": "leave", "reason": "Medical leave for one semester"},
            format="json",
        )
        self.assertEqual(st_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(st_resp.data["status"], "leave")
        self.assertTrue(
            StudentStatusHistory.objects.filter(
                student=student, previous_status="active", new_status="leave"
            ).exists()
        )
        self.assertTrue(AuditLog.objects.filter(module="students", action="status_change").exists())

        # CSV export
        csv_resp = self.client.get(reverse("student-export"))
        self.assertEqual(csv_resp.status_code, status.HTTP_200_OK)
        self.assertIn("STU-2026-0100", csv_resp.content.decode("utf-8-sig"))

        # Soft delete preserves DB record
        del_resp = self.client.delete(reverse("student-detail", args=[student.id]))
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Student.objects.filter(pk=student.id).exists())
        self.assertTrue(Student.all_objects.filter(pk=student.id, is_deleted=True).exists())

    def test_student_role_scoped_only_to_own_profile_and_cannot_export(self):
        own_student = Student.objects.create(
            user=self.student_user,
            student_code="STU-2026-0201",
            full_name_en="Own Student",
            gender="male",
            date_of_birth=date(2005, 3, 12),
        )
        other_student = Student.objects.create(
            student_code="STU-2026-0202",
            full_name_en="Other Student",
            gender="female",
            date_of_birth=date(2005, 4, 18),
        )

        self._auth("student_self")
        list_resp = self.client.get(reverse("student-list"))
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(list_resp.data["count"], 1)
        self.assertEqual(list_resp.data["results"][0]["id"], own_student.id)

        # Cannot access another student's profile
        other_resp = self.client.get(reverse("student-detail", args=[other_student.id]))
        self.assertEqual(other_resp.status_code, status.HTTP_404_NOT_FOUND)

        # Cannot export
        export_resp = self.client.get(reverse("student-export"))
        self.assertEqual(export_resp.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_document_upload_and_download(self):
        self._auth("registrar_stu")
        student = Student.objects.create(
            student_code="STU-2026-0301",
            full_name_en="Doc Student",
            gender="male",
            date_of_birth=date(2004, 6, 1),
        )
        pdf_file = SimpleUploadedFile(
            "diploma.pdf", b"%PDF-1.4 test document bytes", content_type="application/pdf"
        )
        upload = self.client.post(
            reverse("student-document-list"),
            {
                "student": student.id,
                "document_type": "high_school_diploma",
                "title": "High School Diploma",
                "file": pdf_file,
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
        doc_id = upload.data["id"]

        dl = self.client.get(reverse("student-document-download", args=[doc_id]))
        self.assertEqual(dl.status_code, status.HTTP_200_OK)
