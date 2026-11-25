from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """Return a consistent error envelope across all API v1 endpoints."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    code = "api_error"
    message = "An error occurred while processing your request."
    details = {}

    if isinstance(exc, APIException):
        code = getattr(exc, "default_code", code)
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            code = "validation_error"
            message = "One or more fields failed validation."
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            code = "authentication_failed"
            message = "Authentication credentials were not provided or are invalid."
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            code = "permission_denied"
            message = "You do not have permission to perform this action."
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            code = "not_found"
            message = "The requested resource was not found."

    if isinstance(response.data, dict):
        if "detail" in response.data and len(response.data) == 1:
            message = str(response.data["detail"])
        else:
            details = response.data
    elif isinstance(response.data, list):
        details = {"non_field_errors": response.data}

    response.data = {
        "error": {
            "code": str(code),
            "message": message,
            "details": details,
        }
    }
    return response
