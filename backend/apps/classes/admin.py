from django.contrib import admin

from apps.classes.models import (
    ClassMembership,
    Classroom,
    ClassSection,
    ClassSubject,
    ClassTransferHistory,
)


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "building", "capacity", "room_type", "status")
    list_filter = ("room_type", "status")


@admin.register(ClassSection)
class ClassSectionAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "academic_year", "degree", "major", "year_level", "capacity", "status")
    list_filter = ("academic_year", "degree", "major", "year_level", "status")


admin.site.register(ClassSubject)
admin.site.register(ClassMembership)
admin.site.register(ClassTransferHistory)
