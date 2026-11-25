from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RoleSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ["id", "name"]


class PermissionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    code = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "name", "codename", "app_label", "model", "code"]

    def get_code(self, obj) -> str:
        return f"{obj.content_type.app_label}.{obj.codename}"


class RoleSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions",
        queryset=Permission.objects.select_related("content_type").all(),
        many=True,
        required=False,
    )
    permissions = PermissionSerializer(many=True, read_only=True)
    permission_count = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "permission_ids",
            "permissions",
            "permission_count",
            "user_count",
        ]

    def get_permission_count(self, obj) -> int:
        return getattr(obj, "annotated_permission_count", obj.permissions.count())

    def get_user_count(self, obj) -> int:
        return getattr(obj, "annotated_user_count", obj.user_set.count())


class CurrentUserSerializer(serializers.ModelSerializer):
    roles = RoleSummarySerializer(source="groups", many=True, read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "full_name_km",
            "phone",
            "avatar",
            "is_active",
            "is_superuser",
            "must_change_password",
            "preferred_language",
            "preferred_layout",
            "preferred_theme",
            "roles",
            "last_login",
            "date_joined",
        ]
        read_only_fields = fields

    def get_full_name(self, obj) -> str:
        return obj.get_full_name().strip() or obj.username


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "full_name_km",
            "phone",
            "preferred_language",
            "preferred_layout",
            "preferred_theme",
        ]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True, trim_whitespace=True)
    password = serializers.CharField(required=True, write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        identifier = attrs.get("username", "").strip()
        password = attrs.get("password", "")

        # Allow login by username or email address
        username = identifier
        if "@" in identifier:
            matched = User.objects.filter(email__iexact=identifier).first()
            if matched:
                username = matched.username

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=password,
        )
        if user is None:
            # Distinguish inactive account safely without leaking invalid password details
            existing = User.objects.filter(username=username).first()
            if existing and not existing.is_active and existing.check_password(password):
                raise serializers.ValidationError(
                    {"detail": "This account is deactivated. Please contact an administrator."}
                )
            raise serializers.ValidationError({"detail": "Invalid username or password."})

        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "This account is deactivated. Please contact an administrator."}
            )

        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": ["New password and confirmation do not match."]}
            )
        validate_password(attrs["new_password"], user=self.context["request"].user)
        return attrs


class UserListSerializer(serializers.ModelSerializer):
    roles = RoleSummarySerializer(source="groups", many=True, read_only=True)
    role_ids = serializers.PrimaryKeyRelatedField(
        source="groups",
        queryset=Group.objects.all(),
        many=True,
        required=False,
    )
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "full_name_km",
            "phone",
            "is_active",
            "is_superuser",
            "must_change_password",
            "preferred_language",
            "preferred_layout",
            "preferred_theme",
            "roles",
            "role_ids",
            "last_login",
            "date_joined",
        ]
        read_only_fields = ["id", "is_superuser", "last_login", "date_joined"]

    def get_full_name(self, obj) -> str:
        return obj.get_full_name().strip() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    role_ids = serializers.PrimaryKeyRelatedField(
        source="groups",
        queryset=Group.objects.all(),
        many=True,
        required=False,
    )
    roles = RoleSummarySerializer(source="groups", many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "full_name_km",
            "phone",
            "is_active",
            "must_change_password",
            "role_ids",
            "roles",
        ]
        read_only_fields = ["id", "roles"]

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        groups = validated_data.pop("groups", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if groups:
            user.groups.set(groups)
        return user


class AdminResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    must_change_password = serializers.BooleanField(default=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value
