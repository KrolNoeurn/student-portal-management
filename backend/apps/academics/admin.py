from django.contrib import admin

from apps.academics.models import AcademicYear, Degree, Major, Semester, YearLevel


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "status", "is_current")
    list_filter = ("status", "is_current")


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("academic_year", "code", "name", "start_date", "end_date", "is_current", "status")
    list_filter = ("academic_year", "status", "is_current")


@admin.register(Degree)
class DegreeAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_km", "level", "duration_years", "status")
    list_filter = ("level", "status")


@admin.register(Major)
class MajorAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_km", "degree", "status")
    list_filter = ("degree", "status")


@admin.register(YearLevel)
class YearLevelAdmin(admin.ModelAdmin):
    list_display = ("order_index", "code", "name_en", "name_km", "status")
    list_filter = ("status",)
