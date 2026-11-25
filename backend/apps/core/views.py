from django.db import connection
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """Lightweight liveness & database connectivity endpoint."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = True
        db_vendor = connection.vendor
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
        except Exception:
            db_ok = False

        return Response(
            {
                "status": "ok" if db_ok else "degraded",
                "service": "student-portal-api",
                "api_version": "v1",
                "database": {
                    "connected": db_ok,
                    "vendor": db_vendor,
                },
                "timestamp": timezone.now().isoformat(),
            }
        )
