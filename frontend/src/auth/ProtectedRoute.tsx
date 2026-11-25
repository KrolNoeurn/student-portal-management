import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/AuthContext'

interface ProtectedRouteProps {
  permission?: string
  anyOf?: string[]
  children: ReactNode
}

export function ProtectedRoute({ permission, anyOf, children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, hasPermission, hasAnyPermission } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status" aria-label="Loading session" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/forbidden" replace />
  }

  if (anyOf && !hasAnyPermission(anyOf)) {
    return <Navigate to="/forbidden" replace />
  }

  return <>{children}</>
}
