# SQLite to PostgreSQL Migration Guide — SAMS

SAMS is engineered from Phase 1 to run on **SQLite (WAL mode)** for single-server deployments and transition cleanly to **PostgreSQL 16+** without code or model rewrites:

- All models use standard Django ORM field types, `BigAutoField`, `DecimalField`, `JSONField`, and partial `UniqueConstraint` / `CheckConstraint` expressions supported natively by both SQLite and PostgreSQL.
- `config/settings/prod.py` automatically switches `DATABASES["default"]` to `django.db.backends.postgresql` whenever `POSTGRES_DB` is configured in the environment.

---

## 1. Prerequisites

1. Provision PostgreSQL 15/16+ and create the target database and role:

```sql
CREATE USER sams_app WITH PASSWORD '<strong-password>';
CREATE DATABASE sams_prod OWNER sams_app ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;
GRANT ALL PRIVILEGES ON DATABASE sams_prod TO sams_app;
```

2. Install the PostgreSQL Python adapter inside `backend/.venv`:

```bash
cd /srv/sams/backend
.venv/bin/pip install "psycopg[binary]>=3.2,<4.0"
```

---

## 2. Maintenance Window & Final SQLite Snapshot

1. Stop Gunicorn (freeze writes):
   ```bash
   sudo systemctl stop sams-gunicorn
   ```
2. Create a verified final SQLite backup:
   ```bash
   cd /srv/sams/backend
   set -a; source .env; set +a
   .venv/bin/python manage.py backup_database
   ```
3. Record baseline row counts from SQLite for post-migration verification:
   ```bash
   .venv/bin/python manage.py shell -c "
   from django.apps import apps
   for m in apps.get_models():
       if m._meta.managed:
           print(f'{m._meta.label}: {m.objects.count()}')
   " > /tmp/sqlite_counts.txt
   ```

---

## 3. Export Data from SQLite (Natural Keys)

Export all application data while excluding auto-populated framework tables (`contenttypes`, `auth.permission`, `sessions`, `admin.logentry`):

```bash
.venv/bin/python manage.py dumpdata \
  --natural-foreign \
  --natural-primary \
  --exclude contenttypes \
  --exclude auth.permission \
  --exclude sessions \
  --exclude admin.logentry \
  --indent 2 \
  -o /tmp/sams_data_export.json
```

---

## 4. Switch Environment to PostgreSQL & Apply Migrations

Add PostgreSQL variables to `/srv/sams/backend/.env`:

```dotenv
DJANGO_ENV=prod
POSTGRES_DB=sams_prod
POSTGRES_USER=sams_app
POSTGRES_PASSWORD=<strong-password>
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

Apply all Django migrations onto the fresh PostgreSQL database:

```bash
set -a; source .env; set +a
.venv/bin/python manage.py migrate --noinput
```

---

## 5. Import Data & Reset PostgreSQL Sequences

```bash
# Load exported JSON fixture
.venv/bin/python manage.py loaddata /tmp/sams_data_export.json

# Reset PostgreSQL primary-key sequences for all local apps
.venv/bin/python manage.py sqlsequencereset \
  accounts academics subjects students enrollments classes teachers \
  attendance examinations notifications reports system_settings auditlogs \
  | psql -U sams_app -h 127.0.0.1 -d sams_prod
```

---

## 6. Post-Migration Verification

1. Compare table row counts against `/tmp/sqlite_counts.txt`:

```bash
.venv/bin/python manage.py shell -c "
from django.apps import apps
for m in apps.get_models():
    if m._meta.managed:
        print(f'{m._meta.label}: {m.objects.count()}')
" > /tmp/postgres_counts.txt

diff -u /tmp/sqlite_counts.txt /tmp/postgres_counts.txt
```

2. Verify system health and restart Gunicorn:

```bash
.venv/bin/python manage.py check --deploy
sudo systemctl start sams-gunicorn
curl -fsS https://portal.university.edu/api/v1/health/
```

3. Smoke-test login, Student ID auto-generation (`StudentCodeSequence`), Enrollment creation, Attendance marking, Reports export, and Audit Logs.
4. Remove temporary dump files containing sensitive data:

```bash
shred -u /tmp/sams_data_export.json /tmp/sqlite_counts.txt /tmp/postgres_counts.txt
```

---

## 7. Rollback Plan

If any post-migration check fails:
1. Stop Gunicorn (`sudo systemctl stop sams-gunicorn`).
2. Comment out `POSTGRES_*` variables in `backend/.env` so `prod.py` falls back to the untouched SQLite database file.
3. Restart Gunicorn (`sudo systemctl start sams-gunicorn`) and verify `/api/v1/health/`.
