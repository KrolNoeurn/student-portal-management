from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.core.validators import validate_file_size, validate_image_extension


class User(AbstractUser):
    """
    Custom User inheriting Django's AbstractUser.
    Uses Django's native Group (roles) and Permission models without duplication.
    """

    class LanguageChoices(models.TextChoices):
        ENGLISH = "en", "English"
        KHMER = "km", "Khmer"

    class LayoutChoices(models.TextChoices):
        VERTICAL = "vertical", "Vertical"
        HORIZONTAL = "horizontal", "Horizontal"

    class ThemeChoices(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    email = models.EmailField("email address", unique=True)
    full_name_km = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    avatar = models.ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        validators=[validate_file_size, validate_image_extension],
    )
    preferred_language = models.CharField(
        max_length=5,
        choices=LanguageChoices.choices,
        default=LanguageChoices.ENGLISH,
    )
    preferred_layout = models.CharField(
        max_length=15,
        choices=LayoutChoices.choices,
        default=LayoutChoices.VERTICAL,
    )
    preferred_theme = models.CharField(
        max_length=10,
        choices=ThemeChoices.choices,
        default=ThemeChoices.LIGHT,
    )
    must_change_password = models.BooleanField(default=False)

    class Meta:
        db_table = "accounts_user"
        ordering = ["username"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.get_full_name() or self.username
