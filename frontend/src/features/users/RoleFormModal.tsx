import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { FormModal } from '@/components/ui/FormModal'
import {
  createRole,
  updateRole,
  type PermissionItem,
  type RoleDetail,
} from '@/features/users/usersApi'

interface RoleFormModalProps {
  open: boolean
  role: RoleDetail | null
  permissions: PermissionItem[]
  onClose: () => void
  onSaved: () => void
}

export function RoleFormModal({
  open,
  role,
  permissions,
  onClose,
  onSaved,
}: RoleFormModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (role) {
      setName(role.name)
      setSelectedIds(new Set(role.permissions.map((p) => p.id)))
    } else {
      setName('')
      setSelectedIds(new Set())
    }
  }, [open, role])

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>()
    for (const perm of permissions) {
      const list = groups.get(perm.app_label) || []
      list.push(perm)
      groups.set(perm.app_label, list)
    }
    return Array.from(groups.entries())
  }, [permissions])

  const togglePermission = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAppGroup = (items: PermissionItem[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allChecked = items.every((item) => next.has(item.id))
      for (const item of items) {
        if (allChecked) next.delete(item.id)
        else next.add(item.id)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('roles.validationName'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        permission_ids: Array.from(selectedIds),
      }
      if (role) {
        await updateRole(role.id, payload)
      } else {
        await createRole(payload)
      }
      onSaved()
    } catch (err) {
      setError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal
      open={open}
      size="lg"
      title={role ? t('roles.editRole') : t('roles.createRole')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-label-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="role-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? t('common.loading') : t('common.save')}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
          {error}
        </div>
      )}

      <form id="role-form" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="form-label">{t('roles.roleName')} *</label>
          <input
            type="text"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('roles.roleNamePlaceholder')}
          />
        </div>

        <div>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <label className="form-label mb-0">{t('roles.permissionsMatrix')}</label>
            <span className="badge bg-label-primary">
              {selectedIds.size} / {permissions.length}
            </span>
          </div>

          <div
            className="border rounded p-3 overflow-auto"
            style={{ maxHeight: 340, borderColor: 'var(--vx-border)' }}
          >
            {groupedPermissions.map(([appLabel, items]) => {
              const allChecked = items.every((item) => selectedIds.has(item.id))
              return (
                <div key={appLabel} className="mb-3 pb-2 border-bottom">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-semibold text-uppercase small text-primary">
                      {appLabel}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 text-decoration-none small"
                      onClick={() => toggleAppGroup(items)}
                    >
                      {allChecked ? t('roles.unselectAll') : t('roles.selectAll')}
                    </button>
                  </div>
                  <div className="row g-2">
                    {items.map((perm) => (
                      <div key={perm.id} className="col-md-6">
                        <div className="form-check">
                          <input
                            id={`perm-${perm.id}`}
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedIds.has(perm.id)}
                            onChange={() => togglePermission(perm.id)}
                          />
                          <label className="form-check-label small" htmlFor={`perm-${perm.id}`}>
                            <div>{perm.name}</div>
                            <code className="text-body-secondary" style={{ fontSize: '0.72rem' }}>
                              {perm.code}
                            </code>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </form>
    </FormModal>
  )
}
