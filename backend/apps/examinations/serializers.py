from rest_framework import serializers

from apps.classes.models import ClassSection
from apps.enrollments.models import Enrollment
from apps.examinations.models import (
    Assessment,
    AssessmentType,
    GradingScale,
    StudentScore,
    SubjectGrade,
)
from apps.subjects.models import Subject


class AssessmentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentType
        fields = ["id", "code", "name_en", "name_km", "default_weight_percent", "status"]

    def validate_code(self, value):
        return value.strip().upper()


class GradingScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GradingScale
        fields = [
            "id",
            "letter_grade",
            "min_percentage",
            "max_percentage",
            "grade_point",
            "is_passing",
            "description",
        ]


class AssessmentSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    class_code = serializers.CharField(source="class_section.code", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    assessment_type_code = serializers.CharField(source="assessment_type.code", read_only=True)
    assessment_type_name = serializers.CharField(source="assessment_type.name_en", read_only=True)
    scored_count = serializers.SerializerMethodField()

    class Meta:
        model = Assessment
        fields = [
            "id",
            "academic_year",
            "academic_year_name",
            "semester",
            "class_section",
            "class_code",
            "subject",
            "subject_code",
            "subject_name_en",
            "assessment_type",
            "assessment_type_code",
            "assessment_type_name",
            "title",
            "max_score",
            "weight_percent",
            "assessment_date",
            "is_published",
            "scored_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "academic_year",
            "academic_year_name",
            "class_code",
            "subject_code",
            "subject_name_en",
            "assessment_type_code",
            "assessment_type_name",
            "scored_count",
            "created_at",
        ]

    def get_scored_count(self, obj) -> int:
        if hasattr(obj, "annotated_scored_count"):
            return obj.annotated_scored_count
        return obj.scores.count()


class StudentScoreSerializer(serializers.ModelSerializer):
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_name_en = serializers.CharField(source="student.full_name_en", read_only=True)
    student_name_km = serializers.CharField(source="student.full_name_km", read_only=True)

    class Meta:
        model = StudentScore
        fields = [
            "id",
            "assessment",
            "enrollment",
            "student",
            "student_code",
            "student_name_en",
            "student_name_km",
            "score",
            "remarks",
            "updated_at",
        ]


class BulkScoreEntrySerializer(serializers.Serializer):
    enrollment = serializers.PrimaryKeyRelatedField(queryset=Enrollment.objects.all())
    score = serializers.DecimalField(max_digits=6, decimal_places=2)
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class BulkScoreSubmitSerializer(serializers.Serializer):
    scores = BulkScoreEntrySerializer(many=True)


class SubjectGradeSerializer(serializers.ModelSerializer):
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_name_en = serializers.CharField(source="student.full_name_en", read_only=True)
    student_name_km = serializers.CharField(source="student.full_name_km", read_only=True)
    class_code = serializers.CharField(source="class_section.code", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)

    class Meta:
        model = SubjectGrade
        fields = [
            "id",
            "enrollment",
            "student",
            "student_code",
            "student_name_en",
            "student_name_km",
            "class_section",
            "class_code",
            "subject",
            "subject_code",
            "subject_name_en",
            "total_percentage",
            "letter_grade",
            "grade_point",
            "credits_attempted",
            "credits_earned",
            "is_passing",
            "status",
            "updated_at",
        ]


class CalculateGradesSerializer(serializers.Serializer):
    class_section = serializers.PrimaryKeyRelatedField(queryset=ClassSection.objects.all())
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    publish = serializers.BooleanField(default=False)
