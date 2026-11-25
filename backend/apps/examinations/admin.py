from django.contrib import admin

from apps.examinations.models import (
    Assessment,
    AssessmentType,
    GradingScale,
    StudentScore,
    SubjectGrade,
)

admin.site.register(AssessmentType)
admin.site.register(GradingScale)
admin.site.register(Assessment)
admin.site.register(StudentScore)
admin.site.register(SubjectGrade)
