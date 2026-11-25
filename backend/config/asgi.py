import os
from pathlib import Path

from django.core.asgi import get_asgi_application
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
env = os.environ.get("DJANGO_ENV", "prod").lower()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", f"config.settings.{env}")

application = get_asgi_application()
