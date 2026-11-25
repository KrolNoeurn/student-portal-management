from django.contrib import admin

from apps.subjects.models import Curriculum, CurriculumSubject, Subject


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name_en", "name_km", "credits", "theory_hours", "practical_hours", "status")
    list_filter = ("status",)
    search_fields = ("code", "name_en", "name_km")


@admin.register(Curriculum)
class CurriculumAdmin(admin.ModelAdmin):
    list_display = ("degree", "major", "version", "effective_academic_year", "status")
    list_filter = ("degree", "status")


@admin.register(CurriculumSubject)
class CurriculumSubjectAdmin(admin.ModelAdmin):
    list_display = ("curriculum", "year_level", "semester_number", "subject", "is_required")
    list_filter = ("year_level", "semester_number", "is_required")
