from django.core.management.base import BaseCommand

from apps.examinations.services import seed_examination_defaults


class Command(BaseCommand):
    help = "Idempotently seeds standard Assessment Types and 4.00 Grading Scale."

    def handle(self, *args, **options):
        res = seed_examination_defaults()
        self.stdout.write(
            self.style.SUCCESS(
                f"Examination defaults ready ({res['created_types']} assessment types, "
                f"{res['created_scales']} grading bands created)."
            )
        )
