from django.utils import timezone
from rest_framework import serializers

from apps.students.models import (
    Student,
    StudentDocument,
    StudentEducationHistory,
    StudentGuardian,
    StudentStatusHistory,
)
from apps.students.services import generate_student_code


class StudentGuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentGuardian
        fields = [
            "id",
            "student",
            "full_name",
            "relationship",
            "phone",
            "email",
            "occupation",
            "address",
            "is_primary",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StudentEducationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentEducationHistory
        fields = [
            "id",
            "student",
            "institution_name",
            "qualification",
            "graduation_year",
            "gpa_or_grade",
            "certificate_number",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StudentDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentDocument
        fields = [
            "id",
            "student",
            "document_type",
            "title",
            "file",
            "file_size",
            "mime_type",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "file_size", "mime_type", "uploaded_by", "uploaded_by_name", "created_at"]

    def get_uploaded_by_name(self, obj) -> str:
        if not obj.uploaded_by:
            return ""
        return obj.uploaded_by.get_full_name().strip() or obj.uploaded_by.username


class StudentStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentStatusHistory
        fields = [
            "id",
            "previous_status",
            "new_status",
            "effective_date",
            "reason",
            "changed_by_name",
            "created_at",
        ]

    def get_changed_by_name(self, obj) -> str:
        if not obj.changed_by:
            return ""
        return obj.changed_by.get_full_name().strip() or obj.changed_by.username


class StudentListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            "id",
            "public_id",
            "student_code",
            "full_name_en",
            "full_name_km",
            "gender",
            "date_of_birth",
            "nationality",
            "phone",
            "email",
            "province",
            "profile_photo",
            "status",
            "registration_state",
            "created_at",
        ]


class StudentDetailSerializer(serializers.ModelSerializer):
    student_code = serializers.CharField(max_length=30, required=False, allow_blank=True)
    guardians = StudentGuardianSerializer(many=True, read_only=True)
    education_history = StudentEducationHistorySerializer(many=True, read_only=True)
    documents = StudentDocumentSerializer(many=True, read_only=True)
    status_history = StudentStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "public_id",
            "user",
            "student_code",
            "full_name_en",
            "full_name_km",
            "gender",
            "date_of_birth",
            "nationality",
            "national_id_number",
            "profile_photo",
            "phone",
            "email",
            "address_line",
            "commune",
            "district",
            "province",
            "country",
            "emergency_contact_name",
            "emergency_contact_relationship",
            "emergency_contact_phone",
            "status",
            "registration_state",
            "notes",
            "guardians",
            "education_history",
            "documents",
            "status_history",
            "is_deleted",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "guardians",
            "education_history",
            "documents",
            "status_history",
            "is_deleted",
            "created_at",
            "updated_at",
        ]

    def validate_student_code(self, value):
        code = value.strip().upper()
        if code:
            qs = Student.all_objects.filter(student_code=code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A student with this Student ID already exists.")
        return code

    def validate_national_id_number(self, value):
        nid = value.strip()
        if nid:
            qs = Student.all_objects.filter(national_id_number__iexact=nid)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A student with this National ID / Passport number already exists."
                )
        return nid

    def create(self, validated_data):
        code = validated_data.get("student_code", "").strip()
        if not code:
            validated_data["student_code"] = generate_student_code()
        student = super().create(validated_data)
        StudentStatusHistory.objects.create(
            student=student,
            previous_status="",
            new_status=student.status,
            effective_date=timezone.localdate(),
            reason="Initial student registration",
            changed_by=student.created_by,
        )
        return student


class ChangeStudentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Student.StatusChoices.choices)
    effective_date = serializers.DateField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class DuplicateCheckSerializer(serializers.Serializer):
    full_name_en = serializers.CharField(required=False, allow_blank=True, default="")
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    national_id_number = serializers.CharField(required=False, allow_blank=True, default="")
    exclude_id = serializers.IntegerField(required=False, allow_null=True)
