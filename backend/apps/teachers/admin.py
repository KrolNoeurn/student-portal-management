from django.contrib import admin

from apps.teachers.models import ClassSchedule, Teacher, TeachingAssignment


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ("teacher_code", "full_name_en", "specialization", "employment_type", "status")
    list_filter = ("employment_type", "status")


@admin.register(TeachingAssignment)
class TeachingAssignmentAdmin(admin.ModelAdmin):
    list_display = ("teacher", "class_section", "subject", "academic_year", "role", "status")
    list_filter = ("academic_year", "status", "role")


@admin.register(ClassSchedule)
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ("day_of_week", "start_time", "end_time", "class_section", "subject", "teacher", "classroom")
    list_filter = ("academic_year", "day_of_week", "is_active")
