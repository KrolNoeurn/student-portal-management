from rest_framework import serializers

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel
from apps.enrollments.models import Enrollment, EnrollmentHistory


class EnrollmentHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = EnrollmentHistory
        fields = [
            "id",
            "event_type",
            "previous_data",
            "new_data",
            "reason",
            "actor_name",
            "created_at",
        ]

    def get_actor_name(self, obj) -> str:
        if not obj.actor:
            return ""
        return obj.actor.get_full_name().strip() or obj.actor.username


class EnrollmentSerializer(serializers.ModelSerializer):
    registration_number = serializers.CharField(max_length=40, required=False, allow_blank=True)
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_name_en = serializers.CharField(source="student.full_name_en", read_only=True)
    student_name_km = serializers.CharField(source="student.full_name_km", read_only=True)
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
    previous_registration_number = serializers.CharField(
        source="previous_enrollment.registration_number", read_only=True, default=""
    )
    history = EnrollmentHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "registration_number",
            "student",
            "student_code",
            "student_name_en",
            "student_name_km",
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
            "enrollment_type",
            "enrollment_date",
            "status",
            "previous_enrollment",
            "previous_registration_number",
            "remarks",
            "history",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "student_code",
            "student_name_en",
            "student_name_km",
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
            "previous_registration_number",
            "history",
            "created_at",
            "updated_at",
        ]


class PromoteEnrollmentSerializer(serializers.Serializer):
    target_academic_year = serializers.PrimaryKeyRelatedField(queryset=AcademicYear.objects.all())
    target_year_level = serializers.PrimaryKeyRelatedField(queryset=YearLevel.objects.all())
    target_semester = serializers.PrimaryKeyRelatedField(
        queryset=Semester.objects.all(), required=False, allow_null=True
    )
    target_degree = serializers.PrimaryKeyRelatedField(
        queryset=Degree.objects.all(), required=False, allow_null=True
    )
    target_major = serializers.PrimaryKeyRelatedField(
        queryset=Major.objects.all(), required=False, allow_null=True
    )
    enrollment_type = serializers.ChoiceField(
        choices=[
            Enrollment.EnrollmentTypeChoices.PROMOTION,
            Enrollment.EnrollmentTypeChoices.RE_ENROLLMENT,
        ],
        default=Enrollment.EnrollmentTypeChoices.PROMOTION,
    )
    enrollment_date = serializers.DateField(required=False)
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class ChangeProgramSerializer(serializers.Serializer):
    degree = serializers.PrimaryKeyRelatedField(
        queryset=Degree.objects.all(), required=False, allow_null=True
    )
    major = serializers.PrimaryKeyRelatedField(
        queryset=Major.objects.all(), required=False, allow_null=True
    )
    year_level = serializers.PrimaryKeyRelatedField(
        queryset=YearLevel.objects.all(), required=False, allow_null=True
    )
    status = serializers.ChoiceField(
        choices=Enrollment.StatusChoices.choices, required=False, allow_null=True
    )
    reason = serializers.CharField(required=False, allow_blank=True, default="")
