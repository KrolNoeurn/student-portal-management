# Student Portal & Academic Management System (SAMS)

A modular, production-oriented **Student Portal & Academic Management System** for higher education institutions, built with **Django + Django REST Framework** (SQLite, PostgreSQL-ready) and **React + Vite + TypeScript + Bootstrap 5** styled after the **Vuexy** administration template.

---

## Architecture & Documentation

- [System Architecture](docs/architecture.md)
- [Database Design & ERD](docs/database-design.md)
- [Development Roadmap (Phases 0–12)](docs/development-roadmap.md)

---

## Project Structure

```text
student-portal/
├── backend/       # Django + DRF REST API (/api/v1/)
├── frontend/      # React + Vite + TypeScript + Bootstrap 5 (Vuexy-styled)
├── docs/          # Architecture, database design, roadmap, runbooks
└── .agent/        # Project development standards skill
```

---

## Quick Start (Development)

### 1. Backend (Django REST API)

```bash
cd backend
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_system_defaults
.venv/bin/python manage.py seed_academic_defaults
.venv/bin/python manage.py seed_examination_defaults
.venv/bin/python manage.py seed_roles_permissions
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver 8000
```

- API Health Check: `http://127.0.0.1:8000/api/v1/health/`
- OpenAPI Docs (Swagger): `http://127.0.0.1:8000/api/docs/`
- Django Admin: `http://127.0.0.1:8000/admin/`

### 2. Frontend (React + Vite + Bootstrap 5 Vuexy Style)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Frontend App: `http://localhost:5173`

### 3. Running Automated Tests & Checks

```bash
# Backend tests (all apps)
DJANGO_ENV=test backend/.venv/bin/python backend/manage.py test apps --verbosity=2

# Frontend typecheck & production build
npm --prefix frontend run build
```

---

## Development Phases & Implementation Log

| Phase | Module | Status | Key Deliverables |
| :-: | :--- | :-: | :--- |
| **Phase 0** | Architecture & Database Design | Done | `docs/architecture.md`, `docs/database-design.md`, `docs/development-roadmap.md` |
| **Phase 1** | Foundation & Vuexy-Styled Bootstrap 5 Shell | Done | Django split settings, SQLite WAL, `apps.core`, `apps.system_settings`, `apps.auditlogs`, `/api/v1/health/`, `/api/v1/system/bootstrap/`, Vertical/Horizontal layouts, Light/Dark theme, EN/KM i18n, Axios + TanStack Query + RHF/Zod, reusable UI primitives |
| **Phase 2** | Authentication, Users, Roles & Permissions | Done | `apps.accounts` JWT login/logout/refresh cookie rotation + token blacklist, `/auth/me/`, `/auth/me/permissions/`, `/auth/password/change/`, Users & Django Group Roles CRUD, Permission Matrix UI, 10 seeded standard roles, permission-driven navigation & `<ProtectedRoute>` / `<PermissionGuard>` |
| **Phase 3** | Academic Configuration & Curriculum | Done | `apps.academics` (`AcademicYear`, `Semester`, `Degree`, `Major`, `YearLevel` with single `is_current` constraints, date-bound validation, `PROTECT` delete handling) & `apps.subjects` (`Subject`, `Curriculum`, `CurriculumSubject`), reusable `AcademicFilterBar`, tabbed Academics & Subjects/Curriculum UI |
| **Phase 4** | Student Management | Done | `apps.students` permanent `Student` identity, configurable transactional Student ID generator (`StudentCodeSequence`), duplicate identity detection, guardians, education history, secure document upload/download, 7-state `StudentStatusHistory`, UTF-8 CSV export, printable Student Detail page, object-level Student role scoping |
| **Phase 5** | Enrollment Management | Done | `apps.enrollments` (`Enrollment`, `EnrollmentSequence`, `EnrollmentHistory`), transactional registration # generator, single-active-per-year constraint, Promote/Re-Enroll progression chain (`previous_enrollment`), Major/Degree Change & Transfer workflows, Enrollments UI & live Student Detail Enrollments tab |
| **Phase 6** | Class Management | Done | `apps.classes` (`Classroom`, `ClassSection`, `ClassSubject`, `ClassMembership`, `ClassTransferHistory`), context-matched roster assignment, capacity enforcement & auto `open`/`full` sync, class transfer service, 7-tab Class Detail page (`Overview`, `Students`, `Subjects`, `Teachers`, `Schedule`, `Attendance`, `Reports`) |
| **Phase 7** | Teaching & Schedule Management | Done | `apps.teachers` (`Teacher`, `TeachingAssignment`, `ClassSchedule`), real-time conflict detection engine (Teacher, Classroom, and ClassSection overlap prevention), weekly timetable UI with live pre-save conflict alerts, live `Teachers` & `Schedule` tabs wired into Class Detail |
| **Phase 8** | Attendance Management | Done | `apps.attendance` (`AttendanceSession`, `AttendanceRecord`, `AttendanceCorrectionLog`), transactional bulk attendance marking with all 5 statuses, duplicate prevention, audited corrections, monthly attendance % & absence warnings, UTF-8 CSV/Excel export, cascading Attendance UI & live Class Detail `Attendance` tab |
| **Phase 9** | Examination & Assessment | Done | `apps.examinations` (`AssessmentType`, `GradingScale`, `Assessment`, `StudentScore`, `SubjectGrade`), seeded 4.00 grading scale & assessment types, transactional score grid, weighted grade & cumulative GPA calculation, permission-gated grade publication, printable academic transcript |
| **Phase 10** | Dashboards, Reports, Notifications & Settings | Done | `apps.reports` (4 role-scoped live dashboards + 8 filterable institutional reports with CSV/Excel export & print), `apps.notifications` (recipient-scoped live navbar notifications), `apps.system_settings` (`/settings/`, `/backups/`, `backup_database` CLI), `apps.auditlogs` (`/audit-logs/`), live Dashboard, Reports & 3-tab System Settings UI |
| **Phase 11** | Testing, Security & Performance Hardening | Done | Cross-role RBAC & IDOR audit/fixes (backups retrieve, class roster/membership scoping, instructor transcript/attendance export scoping, duplicate-check gating), DRF & login rate-limiting (`ScopedRateThrottle`), production security headers, OpenAPI auth gating, N+1 query optimization verified via `assertNumQueries`, React `lazy`/`Suspense` route code-splitting & Vite vendor chunking |
| **Phase 12** | Deployment, Backup & Migration Strategy | Planned | Production settings, safe SQLite online backup/restore runbook, PostgreSQL migration guide |

---

### Phase Details

#### Phase 1 — Foundation
- Decoupled `backend/` (Django 5.2 + DRF) and `frontend/` (React 19 + Vite + TypeScript + Bootstrap 5).
- Shared backend infrastructure: `TimeStampedModel`, `SoftDeleteModel`, `BlameableModel`, `StandardPageNumberPagination`, normalized API error envelope, `StrictDjangoModelPermissions`, safe `sqlite3.Connection.backup()`, and redacted `AuditLog`.
- Vuexy-styled Bootstrap 5 UI with Vertical collapsible sidebar, Horizontal top menu, Light/Dark theme switcher, and full English/Khmer (`Kantumruy Pro`) localization.

#### Phase 2 — Authentication, Users, Roles & Permissions
- Native Django `User(AbstractUser)`, `Group` (roles), and `Permission` (granular authorization) with `seed_roles_permissions` seeding all 10 standard roles.
- Short-lived Bearer access tokens + rotating `HttpOnly` refresh cookies + token blacklisting on logout and password change, with Axios single-flight `401` refresh queue.
- Full Users, Roles, and Grouped Permission Matrix management UI plus Login and Change Password pages.

#### Phase 3 — Academic Configuration & Curriculum
- Complete `apps.academics` APIs (`/api/v1/academic-years/`, `/semesters/`, `/degrees/`, `/majors/`, `/year-levels/`) with atomic `set-current` actions, single-current partial unique constraints, semester date-range enforcement, and `seed_academic_defaults` (Year 1–4, Higher Diploma, Bachelor's Degree).
- Complete `apps.subjects` APIs (`/api/v1/subjects/`, `/curricula/`, `/curriculum-subjects/`) enforcing degree–major alignment and non-circular prerequisites.
- Tabbed Academics Configuration UI, Subjects & Curriculum Builder UI, and reusable cascading `AcademicFilterBar`.

#### Phase 4 — Student Management
- Permanent `Student` identity model separated from enrollments, supporting all 7 statuses (`applicant`, `active`, `suspended`, `leave`, `transferred`, `graduated`, `withdrawn`) and `draft`/`completed` registration states.
- Configurable Student ID generator driven by `SystemSetting` (`student_id.format`) with transactional `StudentCodeSequence`, duplicate identity checking, non-destructive soft-delete archiving, safe multipart photo/document uploads with permission-checked downloads, and UTF-8-BOM CSV export.
- Student Directory with search/filters/export and a 5-tab Printable Student Detail page (`Overview`, `Guardians`, `Education History`, `Documents`, `Status History`).

#### Phase 5 — Enrollment Management
- Separate `Enrollment` model linked to permanent `Student` profiles with `AcademicYear`, optional `Semester`, `Degree`, `Major`, and `YearLevel`, enforcing one active enrollment per student per academic year and preserving historical records via `previous_enrollment` chains and immutable `EnrollmentHistory`.
- Transactional workflows for New Enrollment, Re-Enrollment, Promotion to the next academic year/year level (zero duplicate `Student` profiles), Major/Degree Change, and Student Transfer.
- Filterable Enrollments UI with Promote/Re-Enroll, Program Change/Transfer, and History modals, plus a live Enrollments tab integrated directly into the Student Detail page.

#### Phase 6 — Class Management
- `apps.classes` managing `Classroom`, `ClassSection`, `ClassSubject`, `ClassMembership`, and `ClassTransferHistory`.
- Transactional student assignment validates active enrollment matches class context (`AcademicYear`, `Degree`, `Major`, `YearLevel`), enforces capacity limits with automatic `open`/`full` status transitions, and supports audited class transfers preserving historical memberships.
- Classes & Classrooms UI plus a full 7-tab Class Detail page (`Overview`, `Students`, `Subjects`, `Teachers`, `Schedule`, `Attendance`, `Reports`) with printable roster support.

#### Phase 7 — Teaching & Schedule Management
- `apps.teachers` managing `Teacher` profiles (auto-code `TCH-XXXX`), `TeachingAssignment` (auto-linking subjects to `ClassSubject`), and `ClassSchedule`.
- Full conflict detection engine (`detect_schedule_conflicts` + `POST /api/v1/schedules/check-conflicts/`) preventing overlapping schedules for the same **Teacher**, **Classroom**, or **ClassSection**, while permitting back-to-back slots.
- 3-tab Teachers, Assignments & Weekly Timetable UI with live conflict alerts, plus live `Teachers` and `Schedule` tabs integrated into Class Detail.

#### Phase 8 — Attendance Management
- `apps.attendance` (`AttendanceSession`, `AttendanceRecord`, `AttendanceCorrectionLog`) supporting all 5 statuses (`Present`, `Absent`, `Late`, `Excused`, `Permission`) with database-enforced duplicate session/record prevention.
- Transactional bulk attendance service (`POST /api/v1/attendance/bulk-mark/`), mandatory-reason corrections, monthly attendance percentage & configurable absence warning threshold (`SystemSetting`), Instructor teaching-assignment authorization, Student self-scoping, and UTF-8 CSV/Excel export.
- 3-tab Attendance UI (`Take Attendance` cascading workflow, `Attendance History & Corrections`, `Monthly Summary & Warnings`) plus live `Attendance` tab wired into Class Detail.

#### Phase 9 — Examination & Assessment
- `apps.examinations` (`AssessmentType`, `GradingScale`, `Assessment`, `StudentScore`, `SubjectGrade`) with `seed_examination_defaults` (5 assessment types and 4.00 A–F grading scale).
- Bulk score entry with `0..max_score` validation, weighted percentage & GPA calculation (`POST /api/v1/grades/calculate/`), permission-gated grade publication (`examinations.publish_grades`), and student-scoped printable transcripts (`GET /api/v1/grades/transcript/`).
- 4-tab Examinations UI (`Assessments & Scores` grid, `Grades & Publication`, `Transcript & GPA`, and `Grading Scale & Types`).

#### Phase 10 — Dashboards, Reports, Notifications, System Settings & Audit Logs
- `apps.reports` serving real-data, role-scoped dashboards (`GET /api/v1/dashboard/` for Admin, Academic Officer, Instructor, and Student personas) and 8 filterable institutional reports (`GET /api/v1/reports/<report_type>/` with `?export=csv` UTF-8-BOM CSV/Excel download and print support).
- `apps.notifications` providing strictly recipient-scoped bilingual notifications (`GET /api/v1/notifications/`, `unread-count/`, `mark-read/`, `mark-all-read/`) wired directly into the live navbar notification bell.
- `apps.system_settings` & `apps.auditlogs` operational endpoints (`/api/v1/settings/`, `/api/v1/backups/`, `/api/v1/backups/create-backup/`, `/api/v1/audit-logs/`) plus `python manage.py backup_database` CLI for safe online SQLite snapshots with SHA-256 verification.
- Real-data `DashboardPage` (replacing the Phase 1 placeholder on `/`), filterable `ReportsPage`, and 3-tab `SettingsPage` (`System Configuration`, `Database Backups`, `Audit Logs`) with full EN/KM localization.

#### Phase 11 — Testing, Security & Performance Hardening
- **RBAC & IDOR Hardening:** Closed object-level access gaps across `BackupRecordViewSet.retrieve`, `ClassSectionViewSet.students`/`transfers`, `ClassMembershipViewSet`, `StudentViewSet.check_duplicate`, `SubjectGradeViewSet.transcript` (Instructor assigned-class verification), and `AttendanceExportView`; gated OpenAPI `/api/schema/`, `/api/docs/`, and `/api/redoc/` behind `IsAuthenticated` when `DEBUG=False`.
- **Rate Limiting & Security Headers:** Enabled DRF `AnonRateThrottle`, `UserRateThrottle`, and `ScopedRateThrottle` (`login: 10/minute`) on `/auth/login/` and `/auth/token/refresh/`, plus `SECURE_REFERRER_POLICY`, `HttpOnly` CSRF/session cookies, `SECURE_SSL_REDIRECT`, and `SECURE_PROXY_SSL_HEADER` in `prod.py`.
- **Backend & Frontend Performance:** Eliminated unnecessary detail prefetches on `StudentViewSet` list (verified bounded 2-query execution via `assertNumQueries`) and added `history__actor` prefetch on eligible enrollments; converted all React route pages to `React.lazy` + `Suspense` with Vite `manualChunks` vendor splitting (eliminating the >500 kB bundle warning).
- **Automated Verification:** Added `apps/core/tests/test_security_and_performance.py` covering unauthenticated endpoint enforcement, Student/Instructor IDOR boundaries, multi-role permission matrices, bounded SQL query counts, and login throttling.
