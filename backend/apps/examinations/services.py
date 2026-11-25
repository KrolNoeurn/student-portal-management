from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.auditlogs.services import record_audit_log
from apps.classes.models import ClassMembership, ClassSection
from apps.examinations.models import (
    Assessment,
    AssessmentType,
    GradingScale,
    StudentScore,
    SubjectGrade,
)
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.teachers.models import TeachingAssignment
from apps.teachers.views import _is_instructor_only_user

DEFAULT_ASSESSMENT_TYPES = [
    {"code": "ASSIGN", "name_en": "Assignment", "name_km": "កិច្ចការផ្ទះ", "default_weight_percent": Decimal("15.00")},
    {"code": "QUIZ", "name_en": "Quiz", "name_km": "តេស្តខ្លី", "default_weight_percent": Decimal("10.00")},
    {"code": "MIDTERM", "name_en": "Midterm Exam", "name_km": "ប្រឡងពាក់កណ្តាលឆមាស", "default_weight_percent": Decimal("25.00")},
    {"code": "PRACTICAL", "name_en": "Practical Exam", "name_km": "ប្រឡងអនុវត្ត", "default_weight_percent": Decimal("15.00")},
    {"code": "FINAL", "name_en": "Final Exam", "name_km": "ប្រឡងបញ្ចប់ឆមាស", "default_weight_percent": Decimal("35.00")},
]

DEFAULT_GRADING_SCALES = [
    {"letter_grade": "A", "min_percentage": Decimal("85.00"), "max_percentage": Decimal("100.00"), "grade_point": Decimal("4.00"), "is_passing": True, "description": "Excellent"},
    {"letter_grade": "B+", "min_percentage": Decimal("80.00"), "max_percentage": Decimal("84.99"), "grade_point": Decimal("3.50"), "is_passing": True, "description": "Very Good"},
    {"letter_grade": "B", "min_percentage": Decimal("70.00"), "max_percentage": Decimal("79.99"), "grade_point": Decimal("3.00"), "is_passing": True, "description": "Good"},
    {"letter_grade": "C+", "min_percentage": Decimal("65.00"), "max_percentage": Decimal("69.99"), "grade_point": Decimal("2.50"), "is_passing": True, "description": "Fairly Good"},
    {"letter_grade": "C", "min_percentage": Decimal("50.00"), "max_percentage": Decimal("64.99"), "grade_point": Decimal("2.00"), "is_passing": True, "description": "Fair"},
    {"letter_grade": "D", "min_percentage": Decimal("45.00"), "max_percentage": Decimal("49.99"), "grade_point": Decimal("1.50"), "is_passing": True, "description": "Poor"},
    {"letter_grade": "F", "min_percentage": Decimal("0.00"), "max_percentage": Decimal("44.99"), "grade_point": Decimal("0.00"), "is_passing": False, "description": "Fail"},
]


@transaction.atomic
def seed_examination_defaults() -> dict[str, int]:
    created_types = 0
    created_scales = 0
    for item in DEFAULT_ASSESSMENT_TYPES:
        _, created = AssessmentType.objects.get_or_create(code=item["code"], defaults=item)
        if created:
            created_types += 1
    for item in DEFAULT_GRADING_SCALES:
        _, created = GradingScale.objects.get_or_create(
            letter_grade=item["letter_grade"], defaults=item
        )
        if created:
            created_scales += 1
    return {"created_types": created_types, "created_scales": created_scales}


def resolve_grade_band(percentage: Decimal) -> tuple[str, Decimal, bool]:
    scales = list(GradingScale.objects.order_by("-min_percentage"))
    for band in scales:
        if percentage >= band.min_percentage:
            return band.letter_grade, band.grade_point, band.is_passing
    return "F", Decimal("0.00"), False


def _assert_instructor_scope(user, class_section: ClassSection, subject: Subject):
    if user and _is_instructor_only_user(user):
        assigned = TeachingAssignment.objects.filter(
            teacher__user=user,
            class_section=class_section,
            subject=subject,
            status=TeachingAssignment.StatusChoices.ACTIVE,
        ).exists()
        if not assigned:
            raise PermissionDenied(
                "Instructors can only manage assessments and scores for assigned classes and subjects."
            )


@transaction.atomic
def bulk_save_assessment_scores(
    *,
    assessment: Assessment,
    entries: list[dict],
    user=None,
    request=None,
) -> list[StudentScore]:
    _assert_instructor_scope(user, assessment.class_section, assessment.subject)

    memberships = {
        m.enrollment_id: m
        for m in ClassMembership.objects.select_related("student", "enrollment").filter(
            class_section=assessment.class_section,
            status__in=[
                ClassMembership.StatusChoices.ACTIVE,
                ClassMembership.StatusChoices.COMPLETED,
            ],
        )
    }

    actor = user if getattr(user, "is_authenticated", False) else None
    saved: list[StudentScore] = []

    for entry in entries:
        enrollment_id = entry["enrollment"].id
        score_val: Decimal = entry["score"]
        remarks = entry.get("remarks", "")

        if enrollment_id not in memberships:
            raise ValidationError(
                {
                    "scores": [
                        f"Enrollment ID {enrollment_id} is not on the roster of class '{assessment.class_section.code}'."
                    ]
                }
            )
        if score_val < Decimal("0") or score_val > assessment.max_score:
            raise ValidationError(
                {
                    "scores": [
                        f"Score {score_val} must be between 0 and {assessment.max_score}."
                    ]
                }
            )

        membership = memberships[enrollment_id]
        obj, _ = StudentScore.objects.update_or_create(
            assessment=assessment,
            enrollment=membership.enrollment,
            defaults={
                "student": membership.student,
                "score": score_val,
                "remarks": remarks,
                "graded_by": actor,
            },
        )
        saved.append(obj)

    record_audit_log(
        action="bulk_scores",
        module="examinations",
        actor=user,
        obj=assessment,
        metadata={"score_count": len(saved), "class_code": assessment.class_section.code},
        request=request,
    )
    return saved


@transaction.atomic
def calculate_class_subject_grades(
    *,
    class_section: ClassSection,
    subject: Subject,
    publish: bool = False,
    user=None,
    request=None,
) -> list[SubjectGrade]:
    _assert_instructor_scope(user, class_section, subject)
    if publish and user and not (user.is_superuser or user.has_perm("examinations.publish_grades")):
        raise PermissionDenied("You do not have permission to publish student grades.")

    assessments = list(
        Assessment.objects.filter(class_section=class_section, subject=subject).order_by("id")
    )
    if not assessments:
        raise ValidationError(
            {"assessments": ["No assessments have been configured for this class and subject."]}
        )

    total_weight = sum((a.weight_percent for a in assessments), Decimal("0.00"))
    if total_weight <= Decimal("0.00"):
        raise ValidationError({"assessments": ["Total assessment weight must be greater than 0."]})

    memberships = list(
        ClassMembership.objects.select_related("student", "enrollment").filter(
            class_section=class_section,
            status__in=[
                ClassMembership.StatusChoices.ACTIVE,
                ClassMembership.StatusChoices.COMPLETED,
            ],
        )
    )

    scores_map: dict[tuple[int, int], Decimal] = {}
    for sc in StudentScore.objects.filter(assessment__in=assessments):
        scores_map[(sc.enrollment_id, sc.assessment_id)] = sc.score

    actor = user if getattr(user, "is_authenticated", False) else None
    target_status = (
        SubjectGrade.StatusChoices.PUBLISHED if publish else SubjectGrade.StatusChoices.DRAFT
    )
    credits = subject.credits
    grades: list[SubjectGrade] = []

    for m in memberships:
        weighted_sum = Decimal("0.00")
        for a in assessments:
            raw = scores_map.get((m.enrollment_id, a.id), Decimal("0.00"))
            weighted_sum += (raw / a.max_score) * a.weight_percent

        # Normalize to 100 scale if weights do not yet total 100
        pct = ((weighted_sum / total_weight) * Decimal("100.00")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        letter, gp, passing = resolve_grade_band(pct)

        grade_obj, _ = SubjectGrade.objects.update_or_create(
            enrollment=m.enrollment,
            subject=subject,
            class_section=class_section,
            defaults={
                "student": m.student,
                "semester": class_section.semester,
                "total_percentage": pct,
                "letter_grade": letter,
                "grade_point": gp,
                "credits_attempted": credits,
                "credits_earned": credits if passing else Decimal("0.0"),
                "is_passing": passing,
                "status": target_status,
                "updated_by": actor,
            },
        )
        grades.append(grade_obj)

    if publish:
        Assessment.objects.filter(id__in=[a.id for a in assessments]).update(is_published=True)

    record_audit_log(
        action="publish_grades" if publish else "calculate_grades",
        module="examinations",
        actor=user,
        obj=class_section,
        metadata={
            "class_code": class_section.code,
            "subject_code": subject.code,
            "graded_students": len(grades),
            "published": publish,
        },
        request=request,
    )
    return grades


def build_student_transcript(student: Student, *, published_only: bool = False) -> dict:
    qs = SubjectGrade.objects.select_related(
        "enrollment__academic_year",
        "enrollment__degree",
        "enrollment__major",
        "enrollment__year_level",
        "subject",
        "class_section",
    ).filter(student=student)
    if published_only:
        qs = qs.filter(status=SubjectGrade.StatusChoices.PUBLISHED)

    total_credits_attempted = Decimal("0.0")
    total_credits_earned = Decimal("0.0")
    total_quality_points = Decimal("0.00")

    items = []
    for g in qs:
        total_credits_attempted += g.credits_attempted
        total_credits_earned += g.credits_earned
        total_quality_points += g.grade_point * g.credits_attempted
        items.append(
            {
                "id": g.id,
                "academic_year": g.enrollment.academic_year.name,
                "major_code": g.enrollment.major.code,
                "year_level": g.enrollment.year_level.code,
                "class_code": g.class_section.code,
                "subject_code": g.subject.code,
                "subject_name_en": g.subject.name_en,
                "subject_name_km": g.subject.name_km,
                "credits_attempted": str(g.credits_attempted),
                "credits_earned": str(g.credits_earned),
                "total_percentage": str(g.total_percentage),
                "letter_grade": g.letter_grade,
                "grade_point": str(g.grade_point),
                "is_passing": g.is_passing,
                "status": g.status,
            }
        )

    cumulative_gpa = (
        (total_quality_points / total_credits_attempted).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if total_credits_attempted > 0
        else Decimal("0.00")
    )

    return {
        "student": {
            "id": student.id,
            "student_code": student.student_code,
            "full_name_en": student.full_name_en,
            "full_name_km": student.full_name_km,
            "status": student.status,
        },
        "summary": {
            "cumulative_gpa": str(cumulative_gpa),
            "credits_attempted": str(total_credits_attempted),
            "credits_earned": str(total_credits_earned),
            "subjects_count": len(items),
        },
        "grades": items,
    }
