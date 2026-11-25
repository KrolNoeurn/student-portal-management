import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import type { AuthUser } from '@/auth/authApi'
import { useAuth } from '@/auth/AuthContext'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import { ResetPasswordModal } from '@/features/users/ResetPasswordModal'
import { RoleFormModal } from '@/features/users/RoleFormModal'
import { UserFormModal } from '@/features/users/UserFormModal'
import {
  deactivateUser,
  deleteRole,
  fetchPermissions,
  fetchRoles,
  fetchUsers,
  updateUser,
  type RoleDetail,
} from '@/features/users/usersApi'

export function UsersRolesPage() {
  const { t } = useTranslation()
  const { user: currentUser, hasPermission } = useAuth()
  const { showToast } = useToast()
  const qc = useQueryClient()

  const canViewUsers = hasPermission('accounts.view_user')
  const canViewRoles = hasPermission('auth.view_group')

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>(
    canViewUsers ? 'users' : 'roles'
  )

  // Users filters & modals
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null)

  // Roles modals
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null)

  const usersQuery = useQuery({
    queryKey: ['users', { page, search, statusFilter, roleFilter }],
    queryFn: () =>
      fetchUsers({
        page,
        search,
        is_active: statusFilter,
        role: roleFilter,
      }),
    enabled: canViewUsers,
  })

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => fetchRoles(),
    enabled: canViewRoles || hasPermission('accounts.add_user') || hasPermission('accounts.change_user'),
  })

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: fetchPermissions,
    enabled: canViewRoles,
  })

  const rolesList = rolesQuery.data?.results || []

  const handleToggleUserActive = async (target: AuthUser) => {
    try {
      if (target.is_active) {
        await deactivateUser(target.id)
        showToast(t('users.userDeactivated'), 'warning')
      } else {
        await updateUser(target.id, { is_active: true })
        showToast(t('users.userActivated'), 'success')
      }
      qc.invalidateQueries({ queryKey: ['users'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    }
  }

  const handleDeleteRole = async (role: RoleDetail) => {
    try {
      await deleteRole(role.id)
      showToast(t('roles.roleDeleted'), 'success')
      qc.invalidateQueries({ queryKey: ['roles'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    }
  }

  const userColumns: TableColumn<AuthUser>[] = [
    {
      key: 'user',
      header: t('users.colUser'),
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.full_name}</div>
          <div className="small text-body-secondary">
            @{row.username} · {row.email}
          </div>
          {row.full_name_km && (
            <div className="small text-body-secondary">{row.full_name_km}</div>
          )}
        </div>
      ),
    },
    {
      key: 'roles',
      header: t('users.colRoles'),
      render: (row) => (
        <div className="d-flex flex-wrap gap-1">
          {row.is_superuser && <StatusBadge label="Superuser" tone="danger" />}
          {row.roles.map((r) => (
            <StatusBadge key={r.id} label={r.name} tone="primary" />
          ))}
          {!row.is_superuser && row.roles.length === 0 && (
            <span className="text-body-secondary small">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge
          label={row.is_active ? t('common.active') : t('users.inactive')}
          tone={row.is_active ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="accounts.change_user">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              title={t('users.editUser')}
              onClick={() => {
                setEditingUser(row)
                setUserModalOpen(true)
              }}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              title={t('users.resetPassword')}
              onClick={() => setResetTarget(row)}
            >
              <KeyRound size={15} />
            </button>
          </PermissionGuard>

          <PermissionGuard permission="accounts.delete_user">
            {row.id !== currentUser?.id && (
              <button
                type="button"
                className={`btn btn-icon btn-sm ${
                  row.is_active ? 'btn-label-secondary' : 'btn-label-primary'
                }`}
                title={row.is_active ? t('users.deactivate') : t('users.activate')}
                onClick={() => handleToggleUserActive(row)}
              >
                {row.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
              </button>
            )}
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const roleColumns: TableColumn<RoleDetail>[] = [
    {
      key: 'name',
      header: t('roles.roleName'),
      render: (row) => <span className="fw-semibold">{row.name}</span>,
    },
    {
      key: 'users',
      header: t('roles.colUsers'),
      render: (row) => <StatusBadge label={String(row.user_count)} tone="info" />,
    },
    {
      key: 'permissions',
      header: t('roles.colPermissions'),
      render: (row) => <StatusBadge label={String(row.permission_count)} tone="primary" />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="auth.change_group">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              title={t('roles.editRole')}
              onClick={() => {
                setEditingRole(row)
                setRoleModalOpen(true)
              }}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="auth.delete_group">
            {row.name !== 'Super Administrator' && (
              <button
                type="button"
                className="btn btn-icon btn-sm btn-label-secondary"
                title={t('roles.deleteRole')}
                onClick={() => handleDeleteRole(row)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('users.pageTitle')}
        subtitle={t('users.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.users') },
        ]}
        actions={
          activeTab === 'users' ? (
            <PermissionGuard permission="accounts.add_user">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => {
                  setEditingUser(null)
                  setUserModalOpen(true)
                }}
              >
                <Plus size={16} />
                <span>{t('users.createUser')}</span>
              </button>
            </PermissionGuard>
          ) : (
            <PermissionGuard permission="auth.add_group">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => {
                  setEditingRole(null)
                  setRoleModalOpen(true)
                }}
              >
                <Plus size={16} />
                <span>{t('roles.createRole')}</span>
              </button>
            </PermissionGuard>
          )
        }
      />

      {/* Vuexy Pill Tabs */}
      <ul className="nav nav-pills mb-4 gap-2">
        {canViewUsers && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                activeTab === 'users' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={16} />
              <span>{t('users.tabUsers')}</span>
            </button>
          </li>
        )}
        {canViewRoles && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                activeTab === 'roles' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('roles')}
            >
              <Shield size={16} />
              <span>{t('users.tabRoles')}</span>
            </button>
          </li>
        )}
      </ul>

      {activeTab === 'users' && canViewUsers && (
        <div className="card">
          <div className="card-header">
            <div className="row g-3 align-items-center">
              <div className="col-md-5">
                <div className="input-group">
                  <span className="input-group-text bg-transparent">
                    <Search size={16} />
                  </span>
                  <input
                    type="search"
                    className="form-control"
                    placeholder={t('users.searchPlaceholder')}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>
              </div>
              <div className="col-sm-6 col-md-3">
                <select
                  className="form-select"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">{t('users.allRoles')}</option>
                  {rolesList.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6 col-md-3">
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">{t('users.allStatuses')}</option>
                  <option value="true">{t('common.active')}</option>
                  <option value="false">{t('users.inactive')}</option>
                </select>
              </div>
            </div>
          </div>

          {usersQuery.isError ? (
            <div className="card-body">
              <ErrorState
                title={t('users.loadError')}
                message={extractApiErrorMessage(usersQuery.error)}
                onRetry={() => usersQuery.refetch()}
              />
            </div>
          ) : (
            <DataTable
              columns={userColumns}
              data={usersQuery.data?.results || []}
              rowKey={(row) => row.id}
              loading={usersQuery.isLoading}
              page={usersQuery.data?.page || page}
              totalPages={usersQuery.data?.total_pages || 1}
              totalCount={usersQuery.data?.count || 0}
              pageSize={usersQuery.data?.page_size || 20}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {activeTab === 'roles' && canViewRoles && (
        <div className="card">
          {rolesQuery.isError ? (
            <div className="card-body">
              <ErrorState
                title={t('roles.loadError')}
                message={extractApiErrorMessage(rolesQuery.error)}
                onRetry={() => rolesQuery.refetch()}
              />
            </div>
          ) : (
            <DataTable
              columns={roleColumns}
              data={rolesList}
              rowKey={(row) => row.id}
              loading={rolesQuery.isLoading}
            />
          )}
        </div>
      )}

      <UserFormModal
        open={userModalOpen}
        user={editingUser}
        roles={rolesList.map((r) => ({ id: r.id, name: r.name }))}
        onClose={() => setUserModalOpen(false)}
        onSaved={() => {
          setUserModalOpen(false)
          showToast(
            editingUser ? t('users.userUpdated') : t('users.userCreated'),
            'success'
          )
          qc.invalidateQueries({ queryKey: ['users'] })
          qc.invalidateQueries({ queryKey: ['roles'] })
        }}
      />

      <ResetPasswordModal
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onSaved={() => {
          setResetTarget(null)
          showToast(t('users.passwordResetSuccess'), 'success')
        }}
      />

      <RoleFormModal
        open={roleModalOpen}
        role={editingRole}
        permissions={permissionsQuery.data || []}
        onClose={() => setRoleModalOpen(false)}
        onSaved={() => {
          setRoleModalOpen(false)
          showToast(
            editingRole ? t('roles.roleUpdated') : t('roles.roleCreated'),
            'success'
          )
          qc.invalidateQueries({ queryKey: ['roles'] })
        }}
      />
    </div>
  )
}
