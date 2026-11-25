from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.system_settings.services import get_public_bootstrap_config


class PublicBootstrapSettingsView(APIView):
    """Returns safe public portal metadata and UI defaults for app initialization."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(get_public_bootstrap_config())
