# Production Deployment Guide — SAMS

> **Stack:** Django 5.2 + DRF (Gunicorn) · React 19 + Vite SPA (Nginx) · SQLite (WAL) or PostgreSQL 16+  
> **Settings Module:** `DJANGO_ENV=prod` (`config.settings.prod`)

---

## 1. Production Architecture

```text
Browser (HTTPS :443)
   │
   ▼
Nginx (TLS Termination, Gzip/Brotli, Security Headers)
   ├── /                 ──► Built React SPA (/srv/sams/frontend/dist)
   ├── /static/          ──► Django collectstatic (/srv/sams/backend/staticfiles)
   ├── /api/ & /admin/   ──► Gunicorn Unix Socket (/run/sams/gunicorn.sock)
   └── /media/           ──► Internal / Authenticated FileResponse via Django
```

- **Important:** Do **not** expose `/media/` directly without access control in production for sensitive student documents; documents are served via `GET /api/v1/student-documents/{id}/download/` using Django permission checks.

---

## 2. Server Prerequisites

- Linux server (Ubuntu 22.04 / 24.04 LTS or Debian 12)
- Python **3.11+** (or matching your verified runtime) with `venv`
- Node.js **20+ LTS** (build host or CI runner)
- Nginx + Certbot (Let's Encrypt TLS)
- Dedicated non-root service user: `sams`

```bash
sudo useradd --system --create-home --shell /bin/bash sams
sudo mkdir -p /srv/sams /run/sams /var/log/sams /var/backups/sams
sudo chown -R sams:www-data /srv/sams /run/sams /var/log/sams /var/backups/sams
```

---

## 3. Environment Configuration (`backend/.env`)

Copy `backend/.env.example` to `/srv/sams/backend/.env` with `chmod 600` owned by `sams`:

```dotenv
DJANGO_ENV=prod
DJANGO_SECRET_KEY=<generate-64-char-random-secret>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=portal.university.edu,api.university.edu

# Option A: SQLite (Default, WAL Mode)
SQLITE_DB_PATH=/srv/sams/data/db.sqlite3

# Option B: PostgreSQL (Uncomment to switch engines automatically in prod.py)
# POSTGRES_DB=sams_prod
# POSTGRES_USER=sams_app
# POSTGRES_PASSWORD=<strong-password>
# POSTGRES_HOST=127.0.0.1
# POSTGRES_PORT=5432

# Security & Origins
CORS_ALLOWED_ORIGINS=https://portal.university.edu
CSRF_TRUSTED_ORIGINS=https://portal.university.edu
DJANGO_SECURE_SSL_REDIRECT=True

# Localization, Uploads & Backups
TIME_ZONE=Asia/Phnom_Penh
MAX_UPLOAD_SIZE_MB=5
BACKUP_DIR=/var/backups/sams
```

Generate a cryptographically secure secret key:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(64))'
```

---

## 4. Backend Build & Initialization

```bash
cd /srv/sams/backend
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt gunicorn

# Load environment variables, run migrations, seed idempotent defaults, collect static
set -a; source .env; set +a
.venv/bin/python manage.py check --deploy
.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py seed_system_defaults
.venv/bin/python manage.py seed_academic_defaults
.venv/bin/python manage.py seed_examination_defaults
.venv/bin/python manage.py seed_roles_permissions
.venv/bin/python manage.py collectstatic --noinput
.venv/bin/python manage.py createsuperuser
```

---

## 5. Frontend Production Build

```bash
cd /srv/sams/frontend
cp .env.example .env.production
# Ensure VITE_API_BASE_URL=/api/v1 (same-origin behind Nginx)
npm ci
npm run build
# Output: /srv/sams/frontend/dist/ (code-split route & vendor chunks)
```

---

## 6. Gunicorn systemd Service (`/etc/systemd/system/sams-gunicorn.service`)

> **SQLite Concurrency Note:** If deploying on SQLite, keep `--workers 2` to `--workers 3` (with WAL mode + 20s timeout already enabled in `apps.core.signals`). When scaling beyond 3–4 concurrent write workers, migrate to PostgreSQL using `docs/postgresql-migration.md`.

```ini
[Unit]
Description=SAMS Django REST API (Gunicorn)
After=network.target

[Service]
User=sams
Group=www-data
WorkingDirectory=/srv/sams/backend
EnvironmentFile=/srv/sams/backend/.env
RuntimeDirectory=sams
ExecStart=/srv/sams/backend/.venv/bin/gunicorn config.wsgi:application \
    --bind unix:/run/sams/gunicorn.sock \
    --workers 3 \
    --timeout 60 \
    --access-logfile /var/log/sams/gunicorn-access.log \
    --error-logfile /var/log/sams/gunicorn-error.log
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sams-gunicorn
sudo systemctl status sams-gunicorn
```

---

## 7. Nginx Reverse Proxy (`/etc/nginx/sites-available/sams`)

```nginx
server {
    listen 80;
    server_name portal.university.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.university.edu;

    ssl_certificate     /etc/letsencrypt/live/portal.university.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.university.edu/privkey.pem;

    client_max_body_size 10M;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "same-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Django Static Assets
    location /static/ {
        alias /srv/sams/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Django REST API & Admin
    location ~ ^/(api|admin)/ {
        proxy_pass http://unix:/run/sams/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React Built SPA (History API Fallback)
    location / {
        root /srv/sams/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site and verify:

```bash
sudo ln -s /etc/nginx/sites-available/sams /etc/nginx/sites-enabled/sams
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Pre-Launch Security Checklist

- [ ] `DJANGO_ENV=prod` and `DJANGO_DEBUG=False` verified
- [ ] Unique 64+ character `DJANGO_SECRET_KEY` set in `.env` (`chmod 600`)
- [ ] `manage.py check --deploy` passes with zero errors
- [ ] HTTPS active with valid TLS certificate (`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`)
- [ ] `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` restricted to exact production domain(s)
- [ ] OpenAPI schema (`/api/schema/`, `/api/docs/`) requires authentication (`DEBUG=False`)
- [ ] Login rate limiting (`10/minute` per IP) active via DRF `ScopedRateThrottle`
- [ ] Automated daily database backups scheduled and off-site copy configured (see `docs/backup-and-restore.md`)
- [ ] Health endpoint responding `200 OK`: `curl -fsS https://portal.university.edu/api/v1/health/`
