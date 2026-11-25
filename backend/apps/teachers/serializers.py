from rest_framework import serializers

from apps.classes.models import Classroom
from apps.teachers.models import ClassSchedule, Teacher, TeachingAssignment
from apps.teachers.services import generate_teacher_code


class TeacherSerializer(serializers.ModelSerializer):
    teacher_code = serializers.CharField(max_length=30, required=False, allow_blank=True)
    assignment_count = serializers.SerializerMethodField()

    class Meta:
        model = Teacher
        fields = [
            "id",
            "user",
            "teacher_code",
            "full_name_en",
            "full_name_km",
            "gender",
            "email",
            "phone",
            "specialization",
            "qualification",
            "employment_type",
            "status",
            "notes",
            "assignment_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "assignment_count", "created_at", "updated_at"]

    def get_assignment_count(self, obj) -> int:
        if hasattr(obj, "annotated_assignment_count"):
            return obj.annotated_assignment_count
        return obj.teaching_assignments.filter(status=TeachingAssignment.StatusChoices.ACTIVE).count()

    def validate_teacher_code(self, value):
        code = value.strip().upper()
        if code:
            qs = Teacher.all_objects.filter(teacher_code=code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("A teacher with this code already exists.")
        return code

    def create(self, validated_data):
        if not validated_data.get("teacher_code", "").strip():
            validated_data["teacher_code"] = generate_teacher_code()
        return super().create(validated_data)


class TeachingAssignmentSerializer(serializers.ModelSerializer):
    teacher_code = serializers.CharField(source="teacher.teacher_code", read_only=True)
    teacher_name_en = serializers.CharField(source="teacher.full_name_en", read_only=True)
    teacher_name_km = serializers.CharField(source="teacher.full_name_km", read_only=True)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True, default="")
    class_code = serializers.CharField(source="class_section.code", read_only=True)
    class_name = serializers.CharField(source="class_section.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    subject_name_km = serializers.CharField(source="subject.name_km", read_only=True)

    class Meta:
        model = TeachingAssignment
        fields = [
            "id",
            "teacher",
            "teacher_code",
            "teacher_name_en",
            "teacher_name_km",
            "academic_year",
            "academic_year_name",
            "semester",
            "semester_name",
            "class_section",
            "class_code",
            "class_name",
            "subject",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "role",
            "status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "academic_year",
            "teacher_code",
            "teacher_name_en",
            "teacher_name_km",
            "academic_year_name",
            "semester_name",
            "class_code",
            "class_name",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "created_at",
        ]


class ClassScheduleSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source="get_day_of_week_display", read_only=True)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True, default="")
    class_code = serializers.CharField(source="class_section.code", read_only=True)
    class_name = serializers.CharField(source="class_section.name", read_only=True)
    teacher_code = serializers.CharField(source="teacher.teacher_code", read_only=True)
    teacher_name_en = serializers.CharField(source="teacher.full_name_en", read_only=True)
    teacher_name_km = serializers.CharField(source="teacher.full_name_km", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    subject_name_km = serializers.CharField(source="subject.name_km", read_only=True)
    classroom_code = serializers.CharField(source="classroom.code", read_only=True)
    classroom_name = serializers.CharField(source="classroom.name", read_only=True)

    class Meta:
        model = ClassSchedule
        fields = [
            "id",
            "teaching_assignment",
            "academic_year",
            "academic_year_name",
            "semester",
            "semester_name",
            "class_section",
            "class_code",
            "class_name",
            "teacher",
            "teacher_code",
            "teacher_name_en",
            "teacher_name_km",
            "subject",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "classroom",
            "classroom_code",
            "classroom_name",
            "day_of_week",
            "day_name",
            "start_time",
            "end_time",
            "is_active",
            "notes",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "academic_year",
            "academic_year_name",
            "semester",
            "semester_name",
            "class_section",
            "class_code",
            "class_name",
            "teacher",
            "teacher_code",
            "teacher_name_en",
            "teacher_name_km",
            "subject",
            "subject_code",
            "subject_name_en",
            "subject_name_km",
            "classroom_code",
            "classroom_name",
            "day_name",
            "created_at",
        ]


class CheckConflictSerializer(serializers.Serializer):
    teaching_assignment = serializers.PrimaryKeyRelatedField(
        queryset=TeachingAssignment.objects.select_related(
            "teacher", "class_section", "subject", "academic_year", "semester"
        )
    )
    classroom = serializers.PrimaryKeyRelatedField(queryset=Classroom.objects.all())
    day_of_week = serializers.IntegerField(min_value=1, max_value=7)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    exclude_schedule_id = serializers.IntegerField(required=False, allow_null=True)
