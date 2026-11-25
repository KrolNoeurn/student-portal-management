from django.core.management.base import BaseCommand

from apps.accounts.services import seed_roles_and_permissions


class Command(BaseCommand):
    help = "Idempotently seeds the 10 standard Django Groups (roles) and baseline permissions."

    def handle(self, *args, **options):
        result = seed_roles_and_permissions()
        self.stdout.write(
            self.style.SUCCESS(
                f"Roles & permissions ready ({result['created_roles']} new roles created; "
                f"{result['total_roles']} total standard roles)."
            )
        )
