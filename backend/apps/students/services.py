import csv
import io
from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.auditlogs.services import record_audit_log
from apps.students.models import Student, StudentCodeSequence, StudentStatusHistory
from apps.system_settings.models import SystemSetting

DEFAULT_STUDENT_ID_FORMAT = "STU-{YEAR}-{SEQ:04d}"


def get_student_id_format() -> str:
    setting = SystemSetting.objects.filter(key="student_id.format").first()
    if setting and isinstance(setting.value, str) and "{SEQ" in setting.value:
        return setting.value
    return DEFAULT_STUDENT_ID_FORMAT


@transaction.atomic
def generate_student_code(year: int | None = None) -> str:
    """
    Generate a unique Student ID using the configurable `student_id.format` template
    and a transactional `StudentCodeSequence` counter.
    """
    target_year = year or timezone.localdate().year
    template = get_student_id_format()
    prefix_key = f"{template}:{target_year}"

    seq_row, _ = StudentCodeSequence.objects.select_for_update().get_or_create(
        prefix_key=prefix_key,
        defaults={"last_sequence": 0},
    )

    while True:
        seq_row.last_sequence += 1
        try:
            candidate = template.format(YEAR=target_year, SEQ=seq_row.last_sequence)
        except Exception:
            candidate = DEFAULT_STUDENT_ID_FORMAT.format(
                YEAR=target_year, SEQ=seq_row.last_sequence
            )
        if not Student.all_objects.filter(student_code=candidate).exists():
            seq_row.save(update_fields=["last_sequence", "updated_at"])
            return candidate


def find_potential_duplicates(
    *,
    full_name_en: str = "",
    date_of_birth: date | None = None,
    national_id_number: str = "",
    exclude_id: int | None = None,
):
    """Return existing students matching identity attributes to warn against duplicates."""
    query = Q()
    if national_id_number and national_id_number.strip():
        query |= Q(national_id_number__iexact=national_id_number.strip())
    if full_name_en and full_name_en.strip() and date_of_birth:
        query |= Q(full_name_en__iexact=full_name_en.strip(), date_of_birth=date_of_birth)

    if not query:
        return Student.objects.none()

    qs = Student.objects.filter(query)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs[:10]


@transaction.atomic
def change_student_status(
    *,
    student: Student,
    new_status: str,
    reason: str = "",
    effective_date: date | None = None,
    user=None,
    request=None,
) -> Student:
    previous = student.status
    eff_date = effective_date or timezone.localdate()

    student.status = new_status
    if user and getattr(user, "is_authenticated", False):
        student.updated_by = user
    student.save(update_fields=["status", "updated_by", "updated_at"])

    StudentStatusHistory.objects.create(
        student=student,
        previous_status=previous,
        new_status=new_status,
        effective_date=eff_date,
        reason=reason,
        changed_by=user if getattr(user, "is_authenticated", False) else None,
    )

    record_audit_log(
        action="status_change",
        module="students",
        actor=user,
        obj=student,
        metadata={
            "previous_status": previous,
            "new_status": new_status,
            "effective_date": eff_date.isoformat(),
            "reason": reason,
        },
        request=request,
    )
    return student


def build_students_csv(queryset) -> str:
    """Serialize filtered students to UTF-8 CSV (BOM prefixed for Khmer Excel compatibility)."""
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Student ID",
            "Full Name (EN)",
            "Full Name (KM)",
            "Gender",
            "Date of Birth",
            "Nationality",
            "National ID",
            "Phone",
            "Email",
            "Province",
            "Status",
            "Registration State",
        ]
    )
    for st in queryset.prefetch_related(None).iterator(chunk_size=500):
        writer.writerow(
            [
                st.student_code,
                st.full_name_en,
                st.full_name_km,
                st.gender,
                st.date_of_birth.isoformat() if st.date_of_birth else "",
                st.nationality,
                st.national_id_number,
                st.phone,
                st.email,
                st.province,
                st.status,
                st.registration_state,
            ]
        )
    return buffer.getvalue()
