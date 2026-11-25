from django.contrib import admin

from apps.students.models import (
    Student,
    StudentDocument,
    StudentEducationHistory,
    StudentGuardian,
    StudentStatusHistory,
)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("student_code", "full_name_en", "full_name_km", "gender", "status", "registration_state", "is_deleted")
    list_filter = ("status", "gender", "registration_state", "is_deleted")
    search_fields = ("student_code", "full_name_en", "full_name_km", "email", "phone")


admin.site.register(StudentGuardian)
admin.site.register(StudentEducationHistory)
admin.site.register(StudentDocument)
admin.site.register(StudentStatusHistory)
