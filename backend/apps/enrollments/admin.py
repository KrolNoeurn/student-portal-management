from django.contrib import admin

from apps.enrollments.models import Enrollment, EnrollmentHistory


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = (
        "registration_number",
        "student",
        "academic_year",
        "degree",
        "major",
        "year_level",
        "enrollment_type",
        "status",
    )
    list_filter = ("academic_year", "degree", "major", "year_level", "status", "enrollment_type")
    search_fields = ("registration_number", "student__student_code", "student__full_name_en")


admin.site.register(EnrollmentHistory)
