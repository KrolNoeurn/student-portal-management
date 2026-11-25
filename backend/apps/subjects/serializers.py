from rest_framework import serializers

from apps.subjects.models import Curriculum, CurriculumSubject, Subject


class SubjectSerializer(serializers.ModelSerializer):
    total_hours = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = [
            "id",
            "code",
            "name_en",
            "name_km",
            "description",
            "credits",
            "theory_hours",
            "practical_hours",
            "total_hours",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total_hours", "created_at", "updated_at"]

    def get_total_hours(self, obj) -> int:
        return (obj.theory_hours or 0) + (obj.practical_hours or 0)

    def validate_code(self, value):
        return value.strip().upper()


class CurriculumSubjectSerializer(serializers.ModelSerializer):
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    subject_name_km = serializers.CharField(source="subject.name_km", read_only=True)
    subject_credits = serializers.DecimalField(
        source="subject.credits", max_digits=4, decimal_places=1, read_only=True
    )
    year_level_code = serializers.CharField(source="year_level.code", read_only=True)
    year_level_name_en = serializers.CharField(source="year_level.name_en", read_only=True)
    year_level_name_km = serializers.CharField(source="year_level.name_km", read_only=True)
    prerequisite_code = serializers.CharField(
        source="prerequisite_subject.code", read_only=True, default=""
    )

    class Meta:
        model = CurriculumSubject
        fields = [
            "id",
            "curriculum",
            "subject",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "subject_credits",
            "year_level",
            "year_level_code",
            "year_level_name_en",
            "year_level_name_km",
            "semester_number",
            "is_required",
            "prerequisite_subject",
            "prerequisite_code",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "subject_credits",
            "year_level_code",
            "year_level_name_en",
            "year_level_name_km",
            "prerequisite_code",
            "created_at",
        ]

    def validate(self, attrs):
        subject = attrs.get("subject", getattr(self.instance, "subject", None))
        prereq = attrs.get(
            "prerequisite_subject", getattr(self.instance, "prerequisite_subject", None)
        )
        if subject and prereq and subject.pk == prereq.pk:
            raise serializers.ValidationError(
                {"prerequisite_subject": ["A subject cannot be a prerequisite of itself."]}
            )
        return attrs


class CurriculumSerializer(serializers.ModelSerializer):
    degree_code = serializers.CharField(source="degree.code", read_only=True)
    degree_name_en = serializers.CharField(source="degree.name_en", read_only=True)
    degree_name_km = serializers.CharField(source="degree.name_km", read_only=True)
    major_code = serializers.CharField(source="major.code", read_only=True)
    major_name_en = serializers.CharField(source="major.name_en", read_only=True)
    major_name_km = serializers.CharField(source="major.name_km", read_only=True)
    effective_academic_year_name = serializers.CharField(
        source="effective_academic_year.name", read_only=True, default=""
    )
    subject_count = serializers.SerializerMethodField()

    class Meta:
        model = Curriculum
        fields = [
            "id",
            "degree",
            "degree_code",
            "degree_name_en",
            "degree_name_km",
            "major",
            "major_code",
            "major_name_en",
            "major_name_km",
            "version",
            "effective_academic_year",
            "effective_academic_year_name",
            "description",
            "status",
            "subject_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "degree_code",
            "degree_name_en",
            "degree_name_km",
            "major_code",
            "major_name_en",
            "major_name_km",
            "effective_academic_year_name",
            "subject_count",
            "created_at",
            "updated_at",
        ]

    def get_subject_count(self, obj) -> int:
        return getattr(obj, "annotated_subject_count", obj.items.count())

    def validate(self, attrs):
        degree = attrs.get("degree", getattr(self.instance, "degree", None))
        major = attrs.get("major", getattr(self.instance, "major", None))
        if degree and major and major.degree_id != degree.id:
            raise serializers.ValidationError(
                {"major": [f"Major '{major.name_en}' does not belong to degree '{degree.name_en}'."]}
            )
        return attrs
