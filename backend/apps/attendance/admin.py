from django.contrib import admin

from apps.attendance.models import (
    AttendanceCorrectionLog,
    AttendanceRecord,
    AttendanceSession,
)


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ("session_date", "session_slot", "class_section", "subject", "status")
    list_filter = ("academic_year", "status", "session_date")


admin.site.register(AttendanceRecord)
admin.site.register(AttendanceCorrectionLog)
