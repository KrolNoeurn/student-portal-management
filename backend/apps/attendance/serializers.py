from rest_framework import serializers

from apps.attendance.models import (
    AttendanceCorrectionLog,
    AttendanceRecord,
    AttendanceSession,
)
from apps.classes.models import ClassSection
from apps.students.models import Student
from apps.subjects.models import Subject


class AttendanceCorrectionLogSerializer(serializers.ModelSerializer):
    corrected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceCorrectionLog
        fields = [
            "id",
            "previous_status",
            "new_status",
            "reason",
            "corrected_by_name",
            "corrected_at",
        ]

    def get_corrected_by_name(self, obj) -> str:
        if not obj.corrected_by:
            return ""
        return obj.corrected_by.get_full_name().strip() or obj.corrected_by.username


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_code = serializers.CharField(source="student.student_code", read_only=True)
    student_name_en = serializers.CharField(source="student.full_name_en", read_only=True)
    student_name_km = serializers.CharField(source="student.full_name_km", read_only=True)
    session_date = serializers.DateField(source="session.session_date", read_only=True)
    class_code = serializers.CharField(source="session.class_section.code", read_only=True)
    subject_code = serializers.CharField(source="session.subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="session.subject.name_en", read_only=True)
    corrections = AttendanceCorrectionLogSerializer(many=True, read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "session",
            "session_date",
            "class_code",
            "subject_code",
            "subject_name_en",
            "student",
            "student_code",
            "student_name_en",
            "student_name_km",
            "enrollment",
            "status",
            "remarks",
            "marked_at",
            "corrections",
        ]
        read_only_fields = [
            "id",
            "session_date",
            "class_code",
            "subject_code",
            "subject_name_en",
            "student_code",
            "student_name_en",
            "student_name_km",
            "marked_at",
            "corrections",
        ]


class AttendanceSessionSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    class_code = serializers.CharField(source="class_section.code", read_only=True)
    class_name = serializers.CharField(source="class_section.name", read_only=True)
    subject_code = serializers.CharField(source="subject.code", read_only=True)
    subject_name_en = serializers.CharField(source="subject.name_en", read_only=True)
    teacher_name_en = serializers.CharField(
        source="teacher.full_name_en", read_only=True, default=""
    )
    total_count = serializers.IntegerField(read_only=True, default=0)
    present_count = serializers.IntegerField(read_only=True, default=0)
    absent_count = serializers.IntegerField(read_only=True, default=0)
    late_count = serializers.IntegerField(read_only=True, default=0)
    excused_count = serializers.IntegerField(read_only=True, default=0)
    permission_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "academic_year",
            "academic_year_name",
            "class_section",
            "class_code",
            "class_name",
            "subject",
            "subject_code",
            "subject_name_en",
            "teacher",
            "teacher_name_en",
            "session_date",
            "session_slot",
            "topic",
            "status",
            "total_count",
            "present_count",
            "absent_count",
            "late_count",
            "excused_count",
            "permission_count",
            "created_at",
        ]


class BulkRecordInputSerializer(serializers.Serializer):
    student = serializers.PrimaryKeyRelatedField(queryset=Student.objects.all())
    status = serializers.ChoiceField(choices=AttendanceRecord.StatusChoices.choices)
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class BulkAttendanceSubmitSerializer(serializers.Serializer):
    class_section = serializers.PrimaryKeyRelatedField(queryset=ClassSection.objects.all())
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.objects.all())
    session_date = serializers.DateField()
    session_slot = serializers.IntegerField(min_value=1, max_value=10, default=1)
    topic = serializers.CharField(required=False, allow_blank=True, default="")
    update_existing = serializers.BooleanField(default=False)
    records = BulkRecordInputSerializer(many=True)


class CorrectAttendanceSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=AttendanceRecord.StatusChoices.choices)
    reason = serializers.CharField(required=True, min_length=3)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)
