from rest_framework import serializers

from apps.classes.models import (
    ClassMembership,
    Classroom,
    ClassSection,
    ClassSubject,
    ClassTransferHistory,
)
from apps.enrollments.models import Enrollment


class ClassroomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = [
            "id",
            "code",
            "name",
            "building",
            "floor",
            "capacity",
            "room_type",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        return value.strip().upper()


class ClassSectionSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True, default="")
    degree_code = serializers.CharField(source="degree.code", read_only=True)
    degree_name_en = serializers.CharField(source="degree.name_en", read_only=True)
    degree_name_km = serializers.CharField(source="degree.name_km", read_only=True)
    major_code = serializers.CharField(source="major.code", read_only=True)
    major_name_en = serializers.CharField(source="major.name_en", read_only=True)
    major_name_km = serializers.CharField(source="major.name_km", read_only=True)
    year_level_code = serializers.CharField(source="year_level.code", read_only=True)
    year_level_name_en = serializers.CharField(source="year_level.name_en", read_only=True)
    year_level_name_km = serializers.CharField(source="year_level.name_km", read_only=True)
    classroom_code = serializers.CharField(
        source="default_classroom.code", read_only=True, default=""
    )
    classroom_name = serializers.CharField(
        source="default_classroom.name", read_only=True, default=""
    )
    advisor_name = serializers.SerializerMethodField()
    active_student_count = serializers.SerializerMethodField()
    subject_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassSection
        fields = [
            "id",
            "code",
            "name",
            "academic_year",
            "academic_year_name",
            "semester",
            "semester_name",
            "degree",
            "degree_code",
            "degree_name_en",
            "degree_name_km",
            "major",
            "major_code",
            "major_name_en",
            "major_name_km",
            "year_level",
            "year_level_code",
            "year_level_name_en",
            "year_level_name_km",
            "default_classroom",
            "classroom_code",
            "classroom_name",
            "homeroom_advisor",
            "advisor_name",
            "capacity",
            "active_student_count",
            "subject_count",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "academic_year_name",
            "semester_name",
            "degree_code",
            "degree_name_en",
            "degree_name_km",
            "major_code",
            "major_name_en",
            "major_name_km",
            "year_level_code",
            "year_level_name_en",
            "year_level_name_km",
            "classroom_code",
            "classroom_name",
            "advisor_name",
            "active_student_count",
            "subject_count",
            "created_at",
            "updated_at",
        ]

    def get_advisor_name(self, obj) -> str:
        if not obj.homeroom_advisor:
            return ""
        return obj.homeroom_advisor.get_full_name().strip() or obj.homeroom_advisor.username

    def get_active_student_count(self, obj) -> int:
        if hasattr(obj, "annotated_active_students"):
            return obj.annotated_active_students
        return obj.memberships.filter(status=ClassMembership.StatusChoices.ACTIVE).count()

    def get_subject_count(self, obj) -> int:
        if hasattr(obj, "annotated_subject_count"):
            return obj.annotated_subject_count
        return obj.class_subjects.count()

    def validate_code(self, value):
        return value.strip().upper()


class ClassSubjectSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    subject_name_km = serializers.CharField(source="subject.name_km", read_only=True)
    subject_credits = serializers.DecimalField(
        source="subject.credits", max_digits=4, decimal_places=1, read_only=True
    )
    semester_name = serializers.CharField(source="semester.name", read_only=True, default="")

    class Meta:
        model = ClassSubject
        fields = [
            "id",
            "class_section",
            "subject",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "subject_credits",
            "semester",
            "semester_name",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "subject_credits",
            "semester_name",
            "created_at",
        ]


class ClassMembershipSerializer(serializers.ModelSerializer):
    class_code = serializers.CharField(source="class_section.code", read_only=True)
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_name_en = serializers.CharField(source="student.full_name_en", read_only=True)
    student_name_km = serializers.CharField(source="student.full_name_km", read_only=True)
    student_gender = serializers.CharField(source="student.gender", read_only=True)
    student_phone = serializers.CharField(source="student.phone", read_only=True)
    registration_number = serializers.CharField(
        source="enrollment.registration_number", read_only=True
    )

    class Meta:
        model = ClassMembership
        fields = [
            "id",
            "class_section",
            "class_code",
            "enrollment",
            "registration_number",
            "student",
            "student_code",
            "student_name_en",
            "student_name_km",
            "student_gender",
            "student_phone",
            "assigned_date",
            "left_date",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "class_code",
            "registration_number",
            "student",
            "student_code",
            "student_name_en",
            "student_name_km",
            "student_gender",
            "student_phone",
            "created_at",
        ]


class ClassTransferHistorySerializer(serializers.ModelSerializer):
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_name_en = serializers.CharField(source="student.full_name_en", read_only=True)
    from_class_code = serializers.CharField(source="from_class_section.code", read_only=True)
    to_class_code = serializers.CharField(source="to_class_section.code", read_only=True)
    transferred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ClassTransferHistory
        fields = [
            "id",
            "student",
            "student_code",
            "student_name_en",
            "from_class_section",
            "from_class_code",
            "to_class_section",
            "to_class_code",
            "transfer_date",
            "reason",
            "transferred_by_name",
            "created_at",
        ]

    def get_transferred_by_name(self, obj) -> str:
        if not obj.transferred_by:
            return ""
        return obj.transferred_by.get_full_name().strip() or obj.transferred_by.username


class AssignStudentSerializer(serializers.Serializer):
    enrollment = serializers.PrimaryKeyRelatedField(queryset=Enrollment.objects.select_related("student"))
    assigned_date = serializers.DateField(required=False)


class TransferStudentSerializer(serializers.Serializer):
    membership = serializers.PrimaryKeyRelatedField(
        queryset=ClassMembership.objects.select_related("class_section", "enrollment", "student")
    )
    target_class_section = serializers.PrimaryKeyRelatedField(queryset=ClassSection.objects.all())
    transfer_date = serializers.DateField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True, default="")
