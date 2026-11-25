from django.db import transaction

from apps.academics.models import AcademicYear, Degree, Semester, YearLevel


@transaction.atomic
def set_current_academic_year(year: AcademicYear, user=None) -> AcademicYear:
    """Atomically switch the single active current AcademicYear."""
    AcademicYear.objects.filter(is_current=True).exclude(pk=year.pk).update(is_current=False)
    year.is_current = True
    if year.status == AcademicYear.StatusChoices.PLANNED:
        year.status = AcademicYear.StatusChoices.ACTIVE
    if user and getattr(user, "is_authenticated", False):
        year.updated_by = user
    year.save(update_fields=["is_current", "status", "updated_by", "updated_at"])
    return year


@transaction.atomic
def set_current_semester(semester: Semester, user=None) -> Semester:
    """Atomically switch the single active current Semester."""
    Semester.objects.filter(is_current=True).exclude(pk=semester.pk).update(is_current=False)
    semester.is_current = True
    if semester.status == Semester.StatusChoices.PLANNED:
        semester.status = Semester.StatusChoices.ACTIVE
    if user and getattr(user, "is_authenticated", False):
        semester.updated_by = user
    semester.save(update_fields=["is_current", "status", "updated_by", "updated_at"])
    return semester


DEFAULT_YEAR_LEVELS = [
    {"code": "Y1", "name_en": "Year 1", "name_km": "ឆ្នាំទី ១", "order_index": 1},
    {"code": "Y2", "name_en": "Year 2", "name_km": "ឆ្នាំទី ២", "order_index": 2},
    {"code": "Y3", "name_en": "Year 3", "name_km": "ឆ្នាំទី ៣", "order_index": 3},
    {"code": "Y4", "name_en": "Year 4", "name_km": "ឆ្នាំទី ៤", "order_index": 4},
]

DEFAULT_DEGREES = [
    {
        "code": "HD",
        "name_en": "Higher Diploma",
        "name_km": "បរិញ្ញាបត្ររង",
        "level": Degree.LevelChoices.HIGHER_DIPLOMA,
        "duration_years": 2,
        "description": "Two-year higher diploma program.",
    },
    {
        "code": "BACH",
        "name_en": "Bachelor's Degree",
        "name_km": "បរិញ្ញាបត្រ",
        "level": Degree.LevelChoices.BACHELOR,
        "duration_years": 4,
        "description": "Four-year undergraduate bachelor's degree program.",
    },
]


@transaction.atomic
def seed_academic_defaults() -> dict[str, int]:
    created_years = 0
    created_degrees = 0

    for item in DEFAULT_YEAR_LEVELS:
        _, created = YearLevel.objects.get_or_create(code=item["code"], defaults=item)
        if created:
            created_years += 1

    for item in DEFAULT_DEGREES:
        _, created = Degree.objects.get_or_create(code=item["code"], defaults=item)
        if created:
            created_degrees += 1

    return {"created_year_levels": created_years, "created_degrees": created_degrees}
