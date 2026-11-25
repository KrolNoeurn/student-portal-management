from django.core.management.base import BaseCommand

from apps.academics.services import seed_academic_defaults


class Command(BaseCommand):
    help = "Idempotently seeds default Year Levels (Year 1-4) and Degrees (Higher Diploma, Bachelor's)."

    def handle(self, *args, **options):
        res = seed_academic_defaults()
        self.stdout.write(
            self.style.SUCCESS(
                f"Academic defaults ready ({res['created_year_levels']} year levels, "
                f"{res['created_degrees']} degrees created)."
            )
        )
