from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.filters import UserFilter
from apps.accounts.permissions import CanViewPermissions
from apps.accounts.serializers import (
    AdminResetPasswordSerializer,
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LoginSerializer,
    PermissionSerializer,
    RoleSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserPreferencesSerializer,
)
from apps.accounts.services import (
    PROTECTED_ROLES,
    get_user_effective_permissions,
    revoke_all_user_tokens,
)
from apps.auditlogs.services import record_audit_log
from apps.core.permissions import StrictDjangoModelPermissions

User = get_user_model()

REFRESH_COOKIE_NAME = "sams_refresh_token"
INTERNAL_EXCLUDED_APPS = {"sessions", "contenttypes", "admin", "token_blacklist"}


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path="/api/v1/auth/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/api/v1/auth/",
        samesite="Lax",
    )


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        refresh = RefreshToken.for_user(user)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        record_audit_log(
            action="login",
            module="accounts",
            actor=user,
            obj=user,
            request=request,
        )

        response = Response(
            {
                "access": str(refresh.access_token),
                "user": CurrentUserSerializer(user).data,
                "permissions": get_user_effective_permissions(user),
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(refresh))
        return response


class TokenRefreshCookieView(APIView):
    """Rotates refresh token read from HttpOnly cookie (or optional body fallback)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if not raw_refresh:
            return Response(
                {
                    "error": {
                        "code": "refresh_token_missing",
                        "message": "Refresh token not provided.",
                        "details": {},
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_refresh = RefreshToken(raw_refresh)
            user_id = old_refresh.get("user_id")
            user = User.objects.filter(pk=user_id, is_active=True).first()
            if user is None:
                raise TokenError("User no longer active.")

            old_refresh.blacklist()
            new_refresh = RefreshToken.for_user(user)
        except TokenError:
            response = Response(
                {
                    "error": {
                        "code": "token_not_valid",
                        "message": "Refresh token is invalid or expired.",
                        "details": {},
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(response)
            return response

        response = Response({"access": str(new_refresh.access_token)}, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, str(new_refresh))
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
            except TokenError:
                pass

        if getattr(request.user, "is_authenticated", False):
            record_audit_log(
                action="logout",
                module="accounts",
                actor=request.user,
                obj=request.user,
                request=request,
            )

        response = Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.prefetch_related("groups").get(pk=request.user.pk)
        return Response(CurrentUserSerializer(user).data)


class CurrentUserPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        serializer = UserPreferencesSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        user = User.objects.prefetch_related("groups").get(pk=request.user.pk)
        return Response(CurrentUserSerializer(user).data)


class CurrentUserPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = list(request.user.groups.values("id", "name"))
        return Response(
            {
                "is_superuser": request.user.is_superuser,
                "roles": roles,
                "permissions": get_user_effective_permissions(request.user),
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])

        revoke_all_user_tokens(user)
        new_refresh = RefreshToken.for_user(user)

        record_audit_log(
            action="password_change",
            module="accounts",
            actor=user,
            obj=user,
            request=request,
        )

        response = Response(
            {
                "detail": "Password changed successfully.",
                "access": str(new_refresh.access_token),
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(new_refresh))
        return response


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.prefetch_related("groups").order_by("username")
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    filterset_class = UserFilter
    search_fields = ["username", "email", "first_name", "last_name", "full_name_km", "phone"]
    ordering_fields = ["username", "email", "date_joined", "last_login", "is_active"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserListSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        record_audit_log(
            action="create",
            module="accounts",
            actor=self.request.user,
            obj=user,
            metadata={"username": user.username, "roles": list(user.groups.values_list("name", flat=True))},
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.pk == self.request.user.pk and serializer.validated_data.get("is_active") is False:
            raise ValidationError({"is_active": ["You cannot deactivate your own account."]})

        user = serializer.save()
        if not user.is_active:
            revoke_all_user_tokens(user)

        record_audit_log(
            action="update",
            module="accounts",
            actor=self.request.user,
            obj=user,
            metadata={
                "is_active": user.is_active,
                "roles": list(user.groups.values_list("name", flat=True)),
            },
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            raise ValidationError({"detail": "You cannot deactivate your own account."})
        if instance.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            raise ValidationError({"detail": "Cannot deactivate the last active superuser."})

        # Safe non-destructive deactivation preserving audit log references
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        revoke_all_user_tokens(instance)

        record_audit_log(
            action="deactivate",
            module="accounts",
            actor=request.user,
            obj=instance,
            request=request,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        if not request.user.has_perm("accounts.change_user"):
            return Response(status=status.HTTP_403_FORBIDDEN)

        target = self.get_object()
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target.set_password(serializer.validated_data["new_password"])
        target.must_change_password = serializer.validated_data["must_change_password"]
        target.save(update_fields=["password", "must_change_password"])
        revoke_all_user_tokens(target)

        record_audit_log(
            action="admin_password_reset",
            module="accounts",
            actor=request.user,
            obj=target,
            metadata={"must_change_password": target.must_change_password},
            request=request,
        )
        return Response({"detail": "Password has been reset."})


class RoleViewSet(viewsets.ModelViewSet):
    queryset = (
        Group.objects.prefetch_related("permissions__content_type")
        .annotate(
            annotated_permission_count=Count("permissions", distinct=True),
            annotated_user_count=Count("user", distinct=True),
        )
        .order_by("name")
    )
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, StrictDjangoModelPermissions]
    search_fields = ["name"]
    ordering_fields = ["name", "id"]

    def perform_create(self, serializer):
        role = serializer.save()
        record_audit_log(
            action="create",
            module="roles",
            actor=self.request.user,
            obj=role,
            metadata={"permission_count": role.permissions.count()},
            request=self.request,
        )

    def perform_update(self, serializer):
        role = serializer.save()
        record_audit_log(
            action="permission_change",
            module="roles",
            actor=self.request.user,
            obj=role,
            metadata={"permission_count": role.permissions.count()},
            request=self.request,
        )

    def perform_destroy(self, instance):
        if instance.name in PROTECTED_ROLES:
            raise ValidationError({"detail": f"The '{instance.name}' role cannot be deleted."})
        if instance.user_set.exists():
            raise ValidationError(
                {"detail": "Cannot delete a role that is currently assigned to users."}
            )
        role_id = str(instance.pk)
        role_name = instance.name
        instance.delete()
        record_audit_log(
            action="delete",
            module="roles",
            actor=self.request.user,
            object_type="Group",
            object_id=role_id,
            object_repr=role_name,
            request=self.request,
        )


class PermissionListView(generics.ListAPIView):
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, CanViewPermissions]
    pagination_class = None

    def get_queryset(self):
        qs = Permission.objects.select_related("content_type").order_by(
            "content_type__app_label", "content_type__model", "codename"
        )
        include_internal = self.request.query_params.get("include_internal") == "true"
        if not include_internal:
            qs = qs.exclude(content_type__app_label__in=INTERNAL_EXCLUDED_APPS)
        app_label = self.request.query_params.get("app_label")
        if app_label:
            qs = qs.filter(content_type__app_label=app_label)
        return qs
