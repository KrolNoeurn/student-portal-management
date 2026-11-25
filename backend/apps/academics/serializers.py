from rest_framework import serializers

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel


class AcademicYearSerializer(serializers.ModelSerializer):
    semester_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicYear
        fields = [
            "id",
            "name",
            "start_date",
            "end_date",
            "status",
            "is_current",
            "description",
            "semester_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "semester_count", "created_at", "updated_at"]

    def get_semester_count(self, obj) -> int:
        return getattr(obj, "annotated_semester_count", obj.semesters.count())

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_date": ["End date must be later than start date."]}
            )
        return attrs


class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)

    class Meta:
        model = Semester
        fields = [
            "id",
            "academic_year",
            "academic_year_name",
            "name",
            "code",
            "sequence_number",
            "start_date",
            "end_date",
            "is_current",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "academic_year_name", "created_at", "updated_at"]

    def validate(self, attrs):
        year = attrs.get("academic_year", getattr(self.instance, "academic_year", None))
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_date": ["End date must be later than start date."]}
            )
        if year and start and end:
            if start < year.start_date or end > year.end_date:
                raise serializers.ValidationError(
                    {
                        "start_date": [
                            f"Semester dates must fall within academic year {year.name} "
                            f"({year.start_date} to {year.end_date})."
                        ]
                    }
                )
        return attrs


class DegreeSerializer(serializers.ModelSerializer):
    major_count = serializers.SerializerMethodField()

    class Meta:
        model = Degree
        fields = [
            "id",
            "code",
            "name_en",
            "name_km",
            "level",
            "duration_years",
            "description",
            "status",
            "major_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "major_count", "created_at", "updated_at"]

    def get_major_count(self, obj) -> int:
        return getattr(obj, "annotated_major_count", obj.majors.count())

    def validate_code(self, value):
        return value.strip().upper()


class MajorSerializer(serializers.ModelSerializer):
    degree_name_en = serializers.CharField(source="degree.name_en", read_only=True)
    degree_name_km = serializers.CharField(source="degree.name_km", read_only=True)
    degree_code = serializers.CharField(source="degree.code", read_only=True)

    class Meta:
        model = Major
        fields = [
            "id",
            "degree",
            "degree_code",
            "degree_name_en",
            "degree_name_km",
            "code",
            "name_en",
            "name_km",
            "description",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "degree_code",
            "degree_name_en",
            "degree_name_km",
            "created_at",
            "updated_at",
        ]

    def validate_code(self, value):
        return value.strip().upper()


class YearLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = YearLevel
        fields = [
            "id",
            "code",
            "name_en",
            "name_km",
            "order_index",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        return value.strip().upper()
