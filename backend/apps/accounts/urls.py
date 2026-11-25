from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    ChangePasswordView,
    CurrentUserPermissionsView,
    CurrentUserPreferencesView,
    CurrentUserView,
    LoginView,
    LogoutView,
    PermissionListView,
    RoleViewSet,
    TokenRefreshCookieView,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/token/refresh/", TokenRefreshCookieView.as_view(), name="auth-token-refresh"),
    path("auth/me/", CurrentUserView.as_view(), name="auth-me"),
    path("auth/me/preferences/", CurrentUserPreferencesView.as_view(), name="auth-me-preferences"),
    path("auth/me/permissions/", CurrentUserPermissionsView.as_view(), name="auth-me-permissions"),
    path("auth/password/change/", ChangePasswordView.as_view(), name="auth-password-change"),
    path("permissions/", PermissionListView.as_view(), name="permission-list"),
    path("", include(router.urls)),
]
