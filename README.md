# Student Portal & Academic Management System (SAMS)

A modular, production-oriented **Student Portal & Academic Management System** for higher education institutions, built with **Django + Django REST Framework** (SQLite, PostgreSQL-ready) and **React + Vite + Bootstrap 5** styled after the **Vuexy** administration template.

## Architecture & Documentation

- [System Architecture](docs/architecture.md)
- [Database Design & ERD](docs/database-design.md)
- [Development Roadmap (Phases 0–12)](docs/development-roadmap.md)

## Project Structure

```text
student-portal/
├── backend/       # Django + DRF REST API (/api/v1/)
├── frontend/      # React + Vite + TypeScript + Bootstrap 5 (Vuexy-styled)
├── docs/          # Architecture, database design, roadmap, runbooks
└── .agent/        # Project development standards skill
```

## Quick Start (Development)

### 1. Backend (Django REST API)

```bash
cd backend
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_system_defaults
.venv/bin/python manage.py seed_roles_permissions
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py runserver 8000
```

- API Health Check: `http://127.0.0.1:8000/api/v1/health/`
- OpenAPI Docs (Swagger): `http://127.0.0.1:8000/api/docs/`
- Django Admin: `http://127.0.0.1:8000/admin/`

### 2. Frontend (React + Vite + Bootstrap Vuexy Style)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Frontend App: `http://localhost:5173`

## Features in Phase 1 (Foundation)

- Decoupled Django + DRF backend (`config/settings/{base,dev,test,prod}.py`) with SQLite WAL mode and PostgreSQL-ready ORM configuration
- Modular `apps.core`, `apps.accounts` (custom `AbstractUser` foundation), `apps.system_settings`, and `apps.auditlogs`
- Versioned `/api/v1/` API with standardized pagination, normalized error responses, OpenAPI schema, and live `/api/v1/health/` & `/api/v1/system/bootstrap/` endpoints
- React + Vite + TypeScript + Bootstrap 5 SPA styled after Vuexy:
  - **Vertical (collapsible sidebar)** and **Horizontal (top menu)** layout switcher
  - **Light & Dark** theme switcher
  - Centralized **English (`en`) & Khmer (`km`)** `i18next` localization with Khmer Unicode typography
  - Axios API client, TanStack Query, React Hook Form + Zod, and reusable Vuexy-styled UI primitives
