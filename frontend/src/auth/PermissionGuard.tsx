import type { ReactNode } from 'react'

import { useAuth } from '@/auth/AuthContext'

interface PermissionGuardProps {
  permission?: string
  anyOf?: string[]
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({
  permission,
  anyOf,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission } = useAuth()

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>
  }

  if (anyOf && !hasAnyPermission(anyOf)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
