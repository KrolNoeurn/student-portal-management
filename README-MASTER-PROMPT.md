# Student Portal & Academic Management System — Project Initialization

## Role

Act as a Senior Software Architect, Django Backend Engineer, React Frontend Engineer, Database Architect, UI/UX Designer, and QA Engineer.

You are responsible for designing and developing a professional Student Portal and Academic Management System for a higher education institution.

The project must be production-oriented, modular, secure, maintainable, responsive, and extensible.

Use the project skill:

`.agent/skills/student-portal-development/SKILL.md`

Read and follow this skill before performing any implementation.

---

## 1. Project Objective

Build a complete Student Portal and Academic Management System that enables administrators, academic officers, instructors, and students to manage academic operations.

The system must manage:

- System users
- Roles and permissions
- Academic years
- Degrees
- Majors
- Year levels
- Semesters
- Subjects
- Curriculum
- Students
- Student registration
- Student enrollment
- Class sections
- Class assignments
- Teaching assignments
- Class schedules
- Attendance
- Examination
- Assessment
- Grades
- Reports
- Notifications
- System settings

The architecture must support future expansion to tuition management, scholarship management, online student services, student self-service, mobile applications, and additional academic modules.

---

## 2. Technology Stack

### Backend

- Python
- Django
- Django REST Framework
- Django ORM
- SQLite
- Django Authentication
- Django Groups
- Django Permissions

### Frontend

- React
- Vite
- Vuexy React Template
- React Router
- Axios
- TanStack Query
- React Hook Form
- Yup or Zod

### Additional

- Git
- REST API
- English and Khmer translation
- Responsive UI
- Light/Dark theme
- Horizontal/Vertical layout

Do not replace the requested technology stack without explaining the technical reason and obtaining approval for major changes.

---

## 3. Existing Template Integration

I will use an existing Vuexy React template.

Before generating frontend code:

1. Inspect the existing template directory.
2. Identify its version, structure, dependencies, layout system, theme system, authentication structure, reusable components, navigation, and existing pages.
3. Understand how Vuexy handles vertical and horizontal layouts.
4. Understand its routing and permission mechanisms.
5. Reuse the existing template infrastructure.
6. Do not rebuild Vuexy from scratch.
7. Do not unnecessarily replace existing dependencies.
8. Preserve the template's original design language.

If the Vuexy template files are not yet present, prepare the integration architecture and clearly identify what is waiting for the template.

The frontend must feel like a polished modern university administration system, not a basic CRUD application.

---

## 4. Authentication and Role Management

Use Django's existing authentication system.

Use Django Groups as roles.

Use Django Permissions as authorization rules.

Do not create a duplicate user-role-permission system without a strong technical justification.

Prepare roles such as:

- Super Administrator
- System Administrator
- Academic Administrator
- Registrar
- Academic Officer
- Department Head
- Instructor
- Attendance Officer
- Student Affairs
- Student

Permissions should be granular.

Examples:

- View students
- Create students
- Edit students
- Delete or archive students
- View enrollment
- Manage enrollment
- Manage academic years
- Manage degrees
- Manage majors
- Manage classes
- Manage subjects
- Take attendance
- Edit attendance
- View reports
- Export reports
- Manage users
- Manage permissions

The backend must validate permissions on every protected endpoint.

The frontend should display navigation and actions according to the authenticated user's permissions.

Implement:

- Login
- Logout
- Current user
- Current user permissions
- Protected routes
- Session/token handling
- Unauthorized page
- Forbidden page
- Password change

---

## 5. Academic Management

Develop a complete academic configuration module.

### Academic Year

Fields:

- Name
- Start date
- End date
- Status
- Is current
- Description

Only one academic year should be current at a time, unless the business rules explicitly allow otherwise.

### Degree

Support:

- Higher Diploma
- Bachelor's Degree
- Other configurable degrees

Fields:

- Degree name
- Degree code
- Degree level
- Duration
- Description
- Status

### Major

Fields:

- Major name
- Major code
- Degree
- Description
- Status

A major must be linked to an appropriate degree.

### Year Level

Examples:

- Year 1
- Year 2
- Year 3
- Year 4

Must be configurable.

### Semester

Must support semester configuration within academic years.

### Subject

Fields:

- Subject code
- Subject name
- Description
- Credits
- Theory hours
- Practical hours
- Status

### Curriculum

Configure subjects according to:

- Degree
- Major
- Year level
- Semester
- Academic curriculum version

---

## 6. Student Management

Create a student management module.

### Student Profile

Include:

- Student ID
- Full name in English
- Full name in Khmer
- Gender
- Date of birth
- Profile photo
- Phone
- Email
- Address
- Nationality
- Guardian information
- Emergency contact
- Previous education
- Documents
- Notes
- Student status

Support:

- Student registration
- Profile editing
- Student search
- Student detail page
- Student profile history
- Document management
- Student list
- Advanced filters
- Export
- Print student profile

Create a configurable student ID generation mechanism.

Avoid duplicate student identities.

Student statuses:

- Applicant
- Active
- Suspended
- Leave
- Transferred
- Graduated
- Withdrawn

---

## 7. Enrollment Management

Enrollment must be separate from the Student Profile.

Each enrollment must be associated with:

- Student
- Academic year
- Degree
- Major
- Year level
- Semester where applicable
- Enrollment date
- Registration number
- Enrollment status

Support:

- New enrollment
- Re-enrollment
- Student promotion
- Major change
- Degree change
- Academic year progression
- Student transfer
- Enrollment history

Do not create duplicate student profiles when students progress to another academic year.

Preserve historical records.

---

## 8. Class Management

Implement:

- Class creation
- Class code
- Class name
- Academic year
- Degree
- Major
- Year level
- Semester
- Capacity
- Classroom
- Instructor
- Subjects
- Class schedule
- Student roster
- Class assignment
- Class transfer
- Class status

Create a class detail page with tabs:

- Overview
- Students
- Subjects
- Teachers
- Schedule
- Attendance
- Reports

Allow authorized users to assign enrolled students to a class.

Validate that the student's enrollment matches the class academic context.

---

## 9. Attendance Management

Create a professional attendance module.

Attendance workflow:

1. Select academic year.
2. Select degree.
3. Select major.
4. Select class.
5. Select subject.
6. Select date.
7. Load enrolled students.
8. Mark attendance.
9. Save attendance.
10. Review attendance statistics.

Statuses:

- Present
- Absent
- Late
- Excused
- Permission

Features:

- Bulk attendance
- Individual status changes
- Attendance session
- Attendance history
- Edit attendance
- Attendance correction
- Attendance report
- Monthly summary
- Attendance percentage
- Student attendance warning
- Filter by date and class
- Export to Excel
- Print

Prevent duplicate attendance records.

Use transactions where appropriate.

---

## 10. Teaching Management

Implement:

- Teacher profiles
- Teaching assignments
- Subject assignments
- Class assignments
- Semester assignments
- Teaching schedules
- Classroom
- Day
- Start time
- End time

Support conflict detection:

- Teacher schedule conflict
- Classroom conflict
- Class schedule conflict

---

## 11. Dashboard

Build dynamic dashboards using real API data.

### Administrator Dashboard

Display:

- Total students
- Active students
- Total academic years
- Total degrees
- Total majors
- Total classes
- Student enrollment statistics
- Attendance statistics
- Charts
- Recent activities

### Academic Officer Dashboard

Display:

- Student enrollment
- Students by academic year
- Students by major
- Students by degree
- Class distribution
- Registration statistics

### Instructor Dashboard

Display:

- Assigned classes
- Assigned subjects
- Students
- Attendance management
- Class schedule

### Student Dashboard

Display:

- Profile
- Student ID
- Academic year
- Degree
- Major
- Class
- Enrollment
- Subjects
- Attendance
- Academic progress

Dashboards must respect permissions.

---

## 12. Frontend Design

Use Vuexy React as the foundation.

Implement:

### Layouts

- Vertical Layout
- Horizontal Layout

### Features

- Responsive sidebar
- Navbar
- Breadcrumbs
- User dropdown
- Notifications
- Search
- Dashboard cards
- Data tables
- Forms
- Modal dialogs
- Drawer
- Tabs
- Filters
- Pagination
- Toast messages
- Loading skeletons
- Empty states
- Error handling

The user should be able to switch between horizontal and vertical layouts.

Maintain consistent colors, spacing, typography, component behavior, and design patterns.

Do not make every page look different.

Use reusable UI components.

---

## 13. Languages

Support:

- English
- Khmer

Implement a centralized i18n system.

Every page must support both languages.

Do not hardcode labels and messages.

Ensure Khmer fonts render correctly.

Allow users to switch language without losing their current page or form state where practical.

---

## 14. API Architecture

Use:

`/api/v1/`

Create modular APIs.

Examples:

- `/api/v1/auth/`
- `/api/v1/users/`
- `/api/v1/academic-years/`
- `/api/v1/degrees/`
- `/api/v1/majors/`
- `/api/v1/subjects/`
- `/api/v1/students/`
- `/api/v1/enrollments/`
- `/api/v1/classes/`
- `/api/v1/teachers/`
- `/api/v1/teaching-assignments/`
- `/api/v1/attendance/`
- `/api/v1/reports/`

Implement:

- Search
- Filters
- Pagination
- Sorting
- Validation
- Permission checks
- Consistent error handling

Do not expose unnecessary internal database fields.

---

## 15. Database Design

Use SQLite initially.

Use Django ORM.

Create well-designed relationships and constraints.

Separate:

- Student
- Enrollment
- Class
- Class Membership
- Subject
- Teaching Assignment
- Attendance Session
- Attendance Record

Maintain historical academic information.

Avoid destructive operations on historical records.

Design the schema to be compatible with PostgreSQL migration in the future.

---

## 16. Reports

Develop reports for:

- Student list
- Student profile
- Student enrollment
- Enrollment by academic year
- Students by degree
- Students by major
- Students by year level
- Students by class
- Student attendance
- Class attendance
- Monthly attendance
- Student status
- Academic progress

Reports must support filtering, export, and printing.

---

## 17. System Settings

Create system configuration for:

- Institution information
- Institution logo
- Student ID format
- Academic year settings
- Default language
- Default layout
- Theme
- Pagination
- Attendance settings
- Upload configuration
- Backup configuration

Avoid hardcoding institution-specific values.

---

## 18. Audit Logging

Log important actions:

- Student creation
- Student profile update
- Enrollment
- Student transfer
- Class assignment
- Attendance modification
- User creation
- Permission changes
- Academic configuration changes

Logs should contain:

- User
- Action
- Module
- Record reference
- Timestamp
- Relevant metadata

Do not expose sensitive information in logs.

---

## 19. Backup

Prepare database backup functionality.

Requirements:

- Manual backup
- Configurable scheduled backup
- Backup location configuration
- Backup history
- Restore documentation
- Safe backup handling

SQLite backups must use a safe method that avoids copying an inconsistent database while transactions are active.

---

## 20. Development Phases

Do not implement all modules at once.

### Phase 1 — Foundation

- Inspect project
- Create architecture
- Backend setup
- Frontend setup
- Vuexy integration
- SQLite
- Git
- Environment configuration

### Phase 2 — Authentication and Permissions

- Login
- Logout
- User management
- Groups
- Permissions
- Protected routes
- API authorization

### Phase 3 — Academic Configuration

- Academic year
- Degree
- Major
- Year level
- Semester
- Subject
- Curriculum

### Phase 4 — Student Management

- Student profile
- Registration
- Student ID
- Documents
- Student status

### Phase 5 — Enrollment

- Academic enrollment
- Re-enrollment
- Promotion
- Enrollment history

### Phase 6 — Class Management

- Class
- Class roster
- Class membership
- Student assignment
- Class transfer

### Phase 7 — Teaching Management

- Teachers
- Teaching assignments
- Subject assignment
- Schedules
- Conflict validation

### Phase 8 — Attendance

- Attendance session
- Bulk attendance
- Attendance records
- Attendance reports

### Phase 9 — Examination

- Assessments
- Exams
- Scores
- Grades

### Phase 10 — Reporting

- Dashboard
- Reports
- Export
- Print

### Phase 11 — Testing and Hardening

- Unit tests
- Integration tests
- Permission tests
- Security review
- Performance review
- Data validation review

### Phase 12 — Deployment

- Production settings
- Deployment documentation
- Backup
- Restore
- Database migration strategy

---

## 21. Development Rules

Before implementing a module:

1. Review the existing code.
2. Read the project skill.
3. Identify dependencies.
4. Define database models.
5. Define relationships.
6. Define business rules.
7. Define API endpoints.
8. Define permissions.
9. Define frontend pages.
10. Implement the backend.
11. Implement the frontend.
12. Connect the frontend to the real API.
13. Test the module.
14. Fix errors.
15. Update documentation.

Do not generate hundreds of files before validating the architecture.

Do not implement fake functionality.

Do not use hardcoded dashboard numbers after APIs are available.

Do not ignore permission enforcement.

Do not unnecessarily rewrite working code.

Do not move to the next phase while critical errors remain in the current phase.

---

## 22. Initial Task

For your first task, do not begin generating the entire system.

Instead:

1. Read the project skill.
2. Inspect the current workspace.
3. Identify whether Vuexy React template files are present.
4. Inspect existing backend and frontend files.
5. Propose the project architecture.
6. Propose the Django app structure.
7. Propose the React folder structure.
8. Design the core database ERD.
9. Define the authentication and permission architecture.
10. Define the development roadmap.
11. Identify technical risks and assumptions.
12. Create a `docs/architecture.md` document.
13. Create a `docs/database-design.md` document.
14. Create a `docs/development-roadmap.md` document.

Wait for architecture review before implementing Phase 1.

The project must prioritize correctness, maintainability, security, integration, and real functionality over code generation speed.
