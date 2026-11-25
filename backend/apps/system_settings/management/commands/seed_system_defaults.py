from django.core.management.base import BaseCommand

from apps.system_settings.services import seed_default_settings


class Command(BaseCommand):
    help = "Seeds default system settings idempotently."

    def handle(self, *args, **options):
        created = seed_default_settings()
        self.stdout.write(
            self.style.SUCCESS(f"System settings ready ({created} new defaults created).")
        )
