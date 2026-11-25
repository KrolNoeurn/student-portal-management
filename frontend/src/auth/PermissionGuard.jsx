import { useAuth } from '@/auth/AuthContext';
export function PermissionGuard({ permission, anyOf, fallback = null, children, }) {
    const { hasPermission, hasAnyPermission } = useAuth();
    if (permission && !hasPermission(permission)) {
        return <>{fallback}</>;
    }
    if (anyOf && !hasAnyPermission(anyOf)) {
        return <>{fallback}</>;
    }
    return <>{children}</>;
}
