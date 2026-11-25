from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

User = get_user_model()

# Baseline role definitions matching docs/architecture.md
DEFAULT_ROLES = [
    "Super Administrator",
    "System Administrator",
    "Academic Administrator",
    "Registrar",
    "Academic Officer",
    "Department Head",
    "Instructor",
    "Attendance Officer",
    "Student Affairs",
    "Student",
]

ACADEMICS_VIEW_PERMS = [
    "academics.view_academicyear",
    "academics.view_semester",
    "academics.view_degree",
    "academics.view_major",
    "academics.view_yearlevel",
    "subjects.view_subject",
    "subjects.view_curriculum",
    "subjects.view_curriculumsubject",
]

ACADEMICS_MANAGE_PERMS = [
    *ACADEMICS_VIEW_PERMS,
    "academics.add_academicyear",
    "academics.change_academicyear",
    "academics.delete_academicyear",
    "academics.add_semester",
    "academics.change_semester",
    "academics.delete_semester",
    "academics.add_degree",
    "academics.change_degree",
    "academics.delete_degree",
    "academics.add_major",
    "academics.change_major",
    "academics.delete_major",
    "academics.add_yearlevel",
    "academics.change_yearlevel",
    "academics.delete_yearlevel",
    "subjects.add_subject",
    "subjects.change_subject",
    "subjects.delete_subject",
    "subjects.add_curriculum",
    "subjects.change_curriculum",
    "subjects.delete_curriculum",
    "subjects.add_curriculumsubject",
    "subjects.change_curriculumsubject",
    "subjects.delete_curriculumsubject",
]

STUDENTS_VIEW_PERMS = [
    "students.view_student",
    "students.view_studentguardian",
    "students.view_studenteducationhistory",
    "students.view_studentdocument",
]

STUDENTS_MANAGE_PERMS = [
    *STUDENTS_VIEW_PERMS,
    "students.add_student",
    "students.change_student",
    "students.delete_student",
    "students.archive_student",
    "students.export_student",
    "students.print_student_profile",
    "students.add_studentguardian",
    "students.change_studentguardian",
    "students.delete_studentguardian",
    "students.add_studenteducationhistory",
    "students.change_studenteducationhistory",
    "students.delete_studenteducationhistory",
    "students.add_studentdocument",
    "students.change_studentdocument",
    "students.delete_studentdocument",
]

# Permissions assigned per role from apps currently installed;
# future phases extend this mapping cleanly and re-run seed_roles_permissions.
ROLE_PERMISSION_MAP: dict[str, list[str] | str] = {
    "Super Administrator": "__all__",
    "System Administrator": [
        "accounts.view_user",
        "accounts.add_user",
        "accounts.change_user",
        "accounts.delete_user",
        "auth.view_group",
        "auth.add_group",
        "auth.change_group",
        "auth.delete_group",
        "auth.view_permission",
        "system_settings.view_systemsetting",
        "system_settings.change_systemsetting",
        "system_settings.manage_system_settings",
        "system_settings.view_backuprecord",
        "system_settings.manage_backups",
        "auditlogs.view_auditlog",
        "auditlogs.view_audit_logs",
        *ACADEMICS_VIEW_PERMS,
        *STUDENTS_VIEW_PERMS,
    ],
    "Academic Administrator": [
        "accounts.view_user",
        "auth.view_group",
        "system_settings.view_systemsetting",
        *ACADEMICS_MANAGE_PERMS,
        *STUDENTS_MANAGE_PERMS,
    ],
    "Registrar": [
        "accounts.view_user",
        *ACADEMICS_VIEW_PERMS,
        *STUDENTS_MANAGE_PERMS,
    ],
    "Academic Officer": [
        *ACADEMICS_VIEW_PERMS,
        "academics.add_semester",
        "academics.change_semester",
        "subjects.add_subject",
        "subjects.change_subject",
        "subjects.add_curriculum",
        "subjects.change_curriculum",
        "subjects.add_curriculumsubject",
        "subjects.change_curriculumsubject",
        "subjects.delete_curriculumsubject",
        *STUDENTS_VIEW_PERMS,
        "students.add_student",
        "students.change_student",
        "students.print_student_profile",
    ],
    "Department Head": [
        *ACADEMICS_VIEW_PERMS,
        "subjects.add_curriculumsubject",
        "subjects.change_curriculumsubject",
        "subjects.delete_curriculumsubject",
        *STUDENTS_VIEW_PERMS,
    ],
    "Instructor": [*ACADEMICS_VIEW_PERMS, *STUDENTS_VIEW_PERMS],
    "Attendance Officer": [*ACADEMICS_VIEW_PERMS, *STUDENTS_VIEW_PERMS],
    "Student Affairs": [
        *ACADEMICS_VIEW_PERMS,
        *STUDENTS_VIEW_PERMS,
        "students.change_student",
        "students.add_studentdocument",
        "students.delete_studentdocument",
        "students.print_student_profile",
    ],
    "Student": [*ACADEMICS_VIEW_PERMS, *STUDENTS_VIEW_PERMS, "students.print_student_profile"],
}

PROTECTED_ROLES = {"Super Administrator"}


def get_user_effective_permissions(user) -> list[str]:
    """Return sorted Django permission strings (`app_label.codename`) for a user."""
    if not user or not user.is_authenticated:
        return []
    if user.is_superuser:
        perms = Permission.objects.select_related("content_type").values_list(
            "content_type__app_label", "codename"
        )
        return sorted({f"{app}.{code}" for app, code in perms})
    return sorted(user.get_all_permissions())


def revoke_all_user_tokens(user) -> int:
    """Blacklist all outstanding SimpleJWT refresh tokens for the given user."""
    tokens = OutstandingToken.objects.filter(user=user)
    count = 0
    for token in tokens:
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            count += 1
    return count


@transaction.atomic
def seed_roles_and_permissions() -> dict[str, int]:
    """Idempotently create the 10 standard Django Groups and sync baseline permissions."""
    created_roles = 0
    all_perms = list(Permission.objects.select_related("content_type").all())
    perm_lookup = {
        f"{perm.content_type.app_label}.{perm.codename}": perm for perm in all_perms
    }

    for role_name in DEFAULT_ROLES:
        group, created = Group.objects.get_or_create(name=role_name)
        if created:
            created_roles += 1

        spec = ROLE_PERMISSION_MAP.get(role_name, [])
        if spec == "__all__":
            group.permissions.set(all_perms)
        elif spec:
            matched = [perm_lookup[code] for code in spec if code in perm_lookup]
            if matched:
                group.permissions.add(*matched)

    return {"created_roles": created_roles, "total_roles": len(DEFAULT_ROLES)}
