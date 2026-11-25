---
name: student-portal-development
description: Development standards, architecture, database design, API structure, UI/UX, security, and workflow for a Django React Student Portal and Academic Management System.
---

# Student Portal Development Skill

## 1. Project Overview

Build a professional Student Portal and Academic Management System (SAMS) for a higher education institution.

The system must support academic administration, student registration, enrollment, class management, attendance, teaching management, examinations, reports, and student services.

The application must be modular, maintainable, secure, responsive, scalable, and user-friendly.

## 2. Technology Stack

### Backend
- Python
- Django
- Django REST Framework
- Django ORM
- SQLite
- Django Authentication System
- Django Groups
- Django Permissions
- REST API
- Token-based or JWT authentication where appropriate

### Frontend
- React
- Vite
- JavaScript or TypeScript (prefer TypeScript for new modules)
- Vuexy React template as the primary UI foundation
- React Router
- Axios
- TanStack Query
- React Hook Form
- Yup or Zod
- ApexCharts or Recharts

### Database
- SQLite as the development and initial deployment database
- Use Django ORM and migrations
- Do not directly manipulate database schema outside Django migrations
- Keep database architecture migration-ready for PostgreSQL

## 3. Architecture

Separate the project into two applications:

- backend: Django REST API
- frontend: React SPA

Responsibilities must be clearly separated.

Backend:
- Business logic
- Data validation
- Authentication
- Authorization
- Database management
- API endpoints
- Reporting
- Audit logging

Frontend:
- User interface
- Routing
- Layouts
- Forms
- Tables
- Filters
- Dashboards
- API communication
- Translation
- UI state

Do not put business logic in React.

Never duplicate business rules between frontend and backend. The backend must be the source of truth.

## 4. Backend Development Rules

Use Django modular applications.

Suggested modules:

- accounts
- students
- academics
- enrollment
- classes
- subjects
- teachers
- attendance
- assessments
- examinations
- reports
- notifications
- settings
- auditlogs

Use Django REST Framework for API development.

Use:
- Models
- Serializers
- Views or ViewSets
- Routers
- Permissions
- Filters
- Pagination
- Services where business logic becomes complex

Avoid oversized models, views, serializers, and single-file applications.

Each module must have clear responsibilities.

## 5. Authentication and Authorization

Use Django's existing User model and authentication framework.

Do not create a separate user authentication system without a compelling reason.

Use:
- Django User
- Django Groups
- Django Permissions
- Custom permissions when required

Groups represent roles.

Examples:
- Super Administrator
- Administrator
- Academic Officer
- Registrar
- Student Affairs Officer
- Attendance Officer
- Instructor
- Department Head
- Student

Permissions must be assigned to Groups.

Do not hardcode role-based permissions throughout React.

The backend must enforce permissions for every protected API endpoint.

The frontend must dynamically show or hide menus, buttons, actions, and pages according to the current user's permissions.

Frontend permission checks improve UX but must never replace backend authorization.

Implement:
- Login
- Logout
- Current-user endpoint
- Current-user permissions endpoint
- Password change
- Session/token expiration handling
- Protected routes
- Access-denied page
- Unauthorized API handling

## 6. Academic Data Architecture

Implement the following core academic entities:

- AcademicYear
- Degree
- Major
- YearLevel
- Semester
- Subject
- Curriculum
- ClassSection
- Student
- Enrollment
- ClassMembership
- Teacher
- TeachingAssignment
- Schedule

AcademicYear must support:
- Name
- Start date
- End date
- Status
- Current academic year configuration

Degree must support:
- Degree name
- Degree level
- Description
- Duration
- Status

Major must support:
- Major name
- Major code
- Degree
- Description
- Status

Student must be a permanent identity record.

Enrollment must store the student's academic registration for a particular academic year and program.

Do not duplicate the student profile when the student moves to another academic year.

Preserve historical enrollment data.

## 7. Student Management

Implement:

- Student registration
- Student profile
- Student code generation
- Profile photo
- Personal information
- Contact information
- Guardian information
- Address
- Education history
- Documents
- Enrollment history
- Student status

Student status must support:

- Applicant
- Active
- Suspended
- Leave
- Transferred
- Graduated
- Withdrawn

Use validation for unique student codes and required fields.

Student registration must support draft and completed registration when appropriate.

## 8. Academic Enrollment

Enrollment must support:

- Student
- Academic year
- Degree
- Major
- Year level
- Semester where applicable
- Enrollment date
- Enrollment status
- Registration number
- Academic history

Prevent duplicate active enrollment for the same student and academic year where the business rules prohibit it.

Allow administrators to manage enrollment history without deleting historical records.

Support student promotion and re-enrollment between academic years.

## 9. Class Management

Implement:

- Class/section creation
- Class code
- Class name
- Academic year
- Degree
- Major
- Year level
- Semester
- Capacity
- Classroom
- Assigned instructor
- Student assignment
- Class roster
- Class schedule
- Class transfer
- Class status

A class must be associated with an academic context.

Do not mix students from different academic years unless explicitly configured.

## 10. Subject and Curriculum Management

Implement:

- Subject code
- Subject name
- Description
- Credits
- Theory hours
- Practical hours
- Degree
- Major
- Year level
- Semester
- Curriculum
- Subject status

Support subject assignment to teaching classes.

## 11. Attendance Management

Attendance must support:

- Class attendance
- Subject attendance
- Attendance session
- Attendance date
- Instructor
- Student
- Present
- Absent
- Late
- Excused
- Permission

Implement:

- Attendance-taking interface
- Bulk attendance
- Individual attendance updates
- Attendance history
- Attendance correction
- Attendance reports
- Monthly statistics
- Attendance percentage
- Absence warning

Prevent duplicate attendance records for the same student in the same session.

Attendance records must be auditable.

## 12. Examination and Assessment

Design the system for future implementation of:

- Assessments
- Assignment
- Midterm
- Final exam
- Practical examination
- Score
- Grade
- Grade calculation
- GPA
- Transcript
- Academic progress

Keep examination modules independent but integrated with students, subjects, enrollment, classes, and academic years.

## 13. Frontend UI/UX Standards

Use the existing Vuexy React template as the primary UI framework.

Do not recreate the entire UI framework if the template already provides the components.

Maintain consistent design across all pages.

The application must support:

- Horizontal layout
- Vertical layout
- Responsive layout
- Desktop
- Tablet
- Mobile
- Light mode
- Dark mode
- Theme customization

UI elements:

- Sidebar
- Navbar
- Breadcrumbs
- Dashboard cards
- Tables
- Search
- Filters
- Pagination
- Dropdowns
- Modals
- Drawer
- Tabs
- Forms
- Toast notifications
- Loading states
- Empty states
- Error states

Create reusable components.

Do not duplicate page layouts.

## 14. Frontend Layouts

### Vertical Layout
- Sidebar navigation
- Top navbar
- Main content
- Footer
- Responsive sidebar collapse

### Horizontal Layout
- Horizontal menu/navbar
- Main content
- Responsive menu
- Dropdown navigation

Both layouts must use the same pages, API, permission system, and business logic.

Users must be able to switch layouts through system configuration.

## 15. Translation

Support at minimum:

- English
- Khmer

Use a centralized translation system.

Do not hardcode text directly into components.

All:
- Menus
- Labels
- Buttons
- Messages
- Validation errors
- Statuses
- Table headings

must support translation.

Ensure Khmer Unicode text renders correctly.

## 16. API Standards

Use versioned API endpoints.

Example:

/api/v1/auth/
/api/v1/users/
/api/v1/students/
/api/v1/academic-years/
/api/v1/degrees/
/api/v1/majors/
/api/v1/enrollments/
/api/v1/classes/
/api/v1/subjects/
/api/v1/attendance/
/api/v1/reports/

Follow REST principles.

Use:
- Appropriate HTTP methods
- Consistent response structures
- Pagination
- Filtering
- Searching
- Sorting
- Validation
- Meaningful status codes

Do not expose sensitive information.

## 17. Data Integrity

Use:

- Foreign keys
- Unique constraints
- Check constraints when appropriate
- Transactions for multi-step operations
- Validation
- Soft deletion where historical data must be retained
- Audit logging for important operations

Do not permanently delete academic records when the records are needed for historical reporting.

## 18. Dashboard

Build dashboards based on user permissions.

Administrator dashboard:
- Total students
- Active students
- Academic years
- Degrees
- Majors
- Classes
- Attendance summary
- Enrollment trends

Academic Officer dashboard:
- Enrollment statistics
- Student registration
- Class distribution
- Academic year statistics

Instructor dashboard:
- Assigned classes
- Assigned subjects
- Attendance
- Student lists

Student dashboard:
- Profile
- Enrollment
- Class
- Subjects
- Attendance summary
- Academic information

## 19. Reporting

Provide:

- Search
- Filters
- Export
- Print
- Excel
- CSV
- PDF

Reports must be filterable by:

- Academic year
- Degree
- Major
- Year level
- Class
- Student
- Subject
- Date range

## 20. Security

Follow Django security best practices.

Implement:
- Server-side permission enforcement
- Input validation
- Authentication protection
- CSRF protection where applicable
- Safe file upload validation
- Environment-based configuration
- Secure secrets handling
- Audit logs
- Protection against unauthorized data access

Do not commit secrets to Git.

Do not expose Django DEBUG mode in production.

## 21. Development Workflow

Do not generate the entire application in one uncontrolled operation.

Follow this workflow:

Phase 1: Project analysis and architecture

Phase 2: Project setup

Phase 3: Authentication and permission system

Phase 4: Academic configuration

Phase 5: Student management

Phase 6: Enrollment management

Phase 7: Class management

Phase 8: Subject and teaching management

Phase 9: Attendance management

Phase 10: Examination and assessment

Phase 11: Reports and dashboards

Phase 12: Testing and security review

Phase 13: Deployment documentation

Before implementing each phase:

1. Review the existing project.
2. Identify dependencies.
3. Explain the implementation plan.
4. Define models and relationships.
5. Define API endpoints.
6. Define frontend pages and components.
7. Implement the module.
8. Run tests.
9. Fix errors.
10. Update documentation.

Do not unnecessarily rewrite existing working code.

## 22. Testing

Write tests for:

- Models
- Serializers
- API endpoints
- Authentication
- Permissions
- Enrollment validation
- Student registration
- Class assignments
- Attendance
- Reports

Test permission boundaries.

Verify that users cannot access data outside their authorized scope.

## 23. Code Quality

Follow these standards:

- Reusable components
- Clear naming
- Modular architecture
- DRY principles
- Maintainable code
- Separation of concerns
- No unnecessary complexity
- No fake implementations
- No placeholder APIs presented as completed functionality
- No hardcoded sample data in production logic
- No giant components
- No duplicated business logic

## 24. AI Development Behavior

Act as a senior software architect, Django developer, React developer, database designer, QA engineer, and UI/UX engineer.

Before making significant architectural changes:

- Analyze the current project
- Explain the problem
- Propose a solution
- Identify potential side effects
- Preserve existing working functionality

Do not blindly agree with architecture decisions if they create security, scalability, or maintainability problems.

If a requirement is unclear, make a reasonable assumption and document it.

Prioritize working, tested, integrated functionality over generating large amounts of incomplete code.

## 25. Completion Criteria

A module is complete only when:

- Database models are implemented
- Migrations are created
- API endpoints work
- Permissions are implemented
- Frontend pages are connected to real APIs
- Forms validate
- Loading states work
- Error states work
- Data can be created, read, updated, and managed
- Tests pass
- Documentation is updated

Never report a module as complete if it only contains a UI mockup or hardcoded data and display checklist. 

