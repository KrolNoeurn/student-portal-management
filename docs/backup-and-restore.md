# Backup & Restore Runbook — SAMS

> **Applies to:** SQLite (WAL mode) online backups via `sqlite3.Connection.backup()` & PostgreSQL `pg_dump`  
> **Never** copy a live SQLite `.sqlite3` file directly with `cp` or `rsync` while Gunicorn is running — doing so risks mid-transaction corruption if WAL frames are uncommitted.

---

## 1. How SAMS Online SQLite Backups Work

The built-in backup service (`apps.system_settings.services.create_safe_sqlite_backup`) uses Python's `sqlite3.Connection.backup()` API:

1. Opens a live read-consistent connection to the active SQLite database (safe under WAL mode without stopping traffic).
2. Streams consistent database pages to `<BACKUP_DIR>/sams_backup_<YYYYMMDD_HHMMSS>.sqlite3`.
3. Computes a **SHA-256 checksum** and records file size, checksum, status, and actor in the `BackupRecord` table.
4. Logs an audited `"backup"` event in `AuditLog`.

---

## 2. Triggering Backups

### A. Via Admin UI or REST API
- **UI:** Navigate to **System Settings → Database Backups** and click **Create Safe SQLite Backup** (requires `system_settings.manage_backups`).
- **API:** `POST /api/v1/backups/create-backup/`

### B. Via Management Command (Manual or Scheduled)
```bash
cd /srv/sams/backend
set -a; source .env; set +a

# Manual CLI snapshot
.venv/bin/python manage.py backup_database

# Scheduled snapshot (tagged backup_type='scheduled')
.venv/bin/python manage.py backup_database --scheduled
```

---

## 3. Automated Daily Schedule (systemd Timer — Recommended)

### `/etc/systemd/system/sams-backup.service`
```ini
[Unit]
Description=SAMS Safe Online SQLite Backup

[Service]
Type=oneshot
User=sams
Group=www-data
WorkingDirectory=/srv/sams/backend
EnvironmentFile=/srv/sams/backend/.env
ExecStart=/srv/sams/backend/.venv/bin/python manage.py backup_database --scheduled
```

### `/etc/systemd/system/sams-backup.timer`
```ini
[Unit]
Description=Run SAMS Database Backup Daily at 02:00 Asia/Phnom_Penh

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sams-backup.timer
sudo systemctl list-timers sams-backup.timer
```

### Retention & Off-Site Sync
Prune local backups older than `backup.retention_days` (default: 30 days) after syncing encrypted snapshots off-site (e.g., S3 / GCS / secondary NAS):

```bash
find /var/backups/sams -name 'sams_backup_*.sqlite3' -mtime +30 -delete
```

---

## 4. Backup Integrity Verification Drill

Run periodically (and always before a restore):

```bash
BACKUP_FILE="/var/backups/sams/sams_backup_YYYYMMDD_HHMMSS.sqlite3"

# 1. Verify SHA-256 matches BackupRecord
sha256sum "$BACKUP_FILE"

# 2. Verify SQLite internal integrity & foreign keys
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check; PRAGMA foreign_key_check;"
# Expected output: ok
```

---

## 5. Step-by-Step Point-in-Time Restore Procedure (SQLite)

> **Warning:** Always take a safety copy of the current database files before replacing them.

```bash
BACKUP_FILE="/var/backups/sams/sams_backup_YYYYMMDD_HHMMSS.sqlite3"
DB_PATH="/srv/sams/data/db.sqlite3"

# 1. Verify backup integrity BEFORE stopping production
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;"

# 2. Stop API traffic cleanly so no open SQLite writers remain
sudo systemctl stop sams-gunicorn

# 3. Preserve current database + WAL/SHM files for rollback
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mv "$DB_PATH" "${DB_PATH}.pre_restore_${TIMESTAMP}"
rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"

# 4. Restore snapshot and ensure correct ownership/permissions
cp "$BACKUP_FILE" "$DB_PATH"
chown sams:www-data "$DB_PATH"
chmod 660 "$DB_PATH"

# 5. Run Django check & smoke-verify schema/counts
cd /srv/sams/backend
set -a; source .env; set +a
.venv/bin/python manage.py check

# 6. Restart Gunicorn and verify health endpoint
sudo systemctl start sams-gunicorn
curl -fsS https://portal.university.edu/api/v1/health/
```

---

## 6. PostgreSQL Backup & Restore (After Migrating to PostgreSQL)

Once running on PostgreSQL (`POSTGRES_DB` set in `.env`), use `pg_dump` in custom compressed format:

```bash
# Backup
pg_dump -Fc -U sams_app -h 127.0.0.1 sams_prod > "/var/backups/sams/sams_pg_$(date +%Y%m%d_%H%M%S).dump"

# Restore into a fresh target database
pg_restore --clean --if-exists --no-owner -U sams_app -h 127.0.0.1 -d sams_prod /var/backups/sams/sams_pg_YYYYMMDD_HHMMSS.dump
```
