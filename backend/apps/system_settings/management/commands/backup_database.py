from django.core.management.base import BaseCommand

from apps.system_settings.models import BackupRecord
from apps.system_settings.services import create_safe_sqlite_backup


class Command(BaseCommand):
    help = "Creates a transactionally safe SQLite online backup and logs a BackupRecord."

    def add_arguments(self, parser):
        parser.add_argument(
            "--scheduled",
            action="store_true",
            help="Mark backup type as scheduled (for cron/systemd usage).",
        )

    def handle(self, *args, **options):
        btype = (
            BackupRecord.BackupTypeChoices.SCHEDULED
            if options["scheduled"]
            else BackupRecord.BackupTypeChoices.MANUAL
        )
        record = create_safe_sqlite_backup(backup_type=btype)
        self.stdout.write(
            self.style.SUCCESS(
                f"Backup completed: {record.filename} ({record.file_size_bytes} bytes, sha256={record.sha256_checksum[:12]}...)"
            )
        )
