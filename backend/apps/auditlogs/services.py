from apps.auditlogs.models import AuditLog

SENSITIVE_KEYS = {
    "password",
    "new_password",
    "old_password",
    "token",
    "access",
    "refresh",
    "secret",
    "secret_key",
    "authorization",
}


def sanitize_metadata(payload):
    """Recursively redact sensitive fields before persisting audit metadata."""
    if isinstance(payload, dict):
        sanitized = {}
        for key, value in payload.items():
            if str(key).lower() in SENSITIVE_KEYS:
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = sanitize_metadata(value)
        return sanitized
    if isinstance(payload, list):
        return [sanitize_metadata(item) for item in payload]
    return payload


def record_audit_log(
    *,
    action: str,
    module: str,
    actor=None,
    obj=None,
    object_type: str = "",
    object_id: str = "",
    object_repr: str = "",
    metadata: dict | None = None,
    request=None,
):
    ip_address = None
    user_agent = ""
    if request is not None:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        ip_address = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
        user_agent = str(request.META.get("HTTP_USER_AGENT", ""))[:300]

    if obj is not None:
        object_type = object_type or obj.__class__.__name__
        object_id = object_id or str(getattr(obj, "pk", ""))
        object_repr = object_repr or str(obj)[:255]

    return AuditLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        module=module,
        object_type=object_type,
        object_id=object_id,
        object_repr=object_repr,
        metadata=sanitize_metadata(metadata or {}),
        ip_address=ip_address,
        user_agent=user_agent,
    )
