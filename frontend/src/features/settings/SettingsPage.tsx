import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Edit3, History, Search, Shield, Sliders } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormModal } from '@/components/ui/FormModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import {
  createDatabaseBackup,
  fetchAuditLogs,
  fetchBackups,
  fetchSystemSettings,
  updateSystemSetting,
  type AuditLogItem,
  type BackupRecordItem,
  type SystemSettingItem,
} from '@/features/settings/settingsApi'

type SettingsTab = 'config' | 'backups' | 'audit'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function serializeSettingValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { hasAnyPermission } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const canViewConfig = hasAnyPermission([
    'system_settings.manage_system_settings',
    'system_settings.view_systemsetting',
  ])
  const canManageBackups = hasAnyPermission(['system_settings.manage_backups'])
  const canViewAudit = hasAnyPermission(['auditlogs.view_audit_logs', 'auditlogs.view_auditlog'])

  const defaultTab: SettingsTab = canViewConfig
    ? 'config'
    : canManageBackups
      ? 'backups'
      : 'audit'

  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab)
  const [categoryFilter, setCategoryFilter] = useState('')

  // Setting edit modal state
  const [editingSetting, setEditingSetting] = useState<SystemSettingItem | null>(null)
  const [editValueText, setEditValueText] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingSetting, setSavingSetting] = useState(false)

  // Backup action state
  const [creatingBackup, setCreatingBackup] = useState(false)

  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('')
  const [auditModule, setAuditModule] = useState('')
  const [auditPage, setAuditPage] = useState(1)

  const settingsQuery = useQuery({
    queryKey: ['system-settings', categoryFilter],
    queryFn: () => fetchSystemSettings(categoryFilter ? { category: categoryFilter } : undefined),
    enabled: activeTab === 'config' && canViewConfig,
  })

  const backupsQuery = useQuery({
    queryKey: ['system-backups'],
    queryFn: () => fetchBackups({ page_size: 25 }),
    enabled: activeTab === 'backups' && canManageBackups,
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs', auditSearch, auditModule, auditPage],
    queryFn: () =>
      fetchAuditLogs({
        page: auditPage,
        ...(auditSearch.trim() ? { search: auditSearch.trim() } : {}),
        ...(auditModule ? { module: auditModule } : {}),
      }),
    enabled: activeTab === 'audit' && canViewAudit,
  })

  const openEditModal = (item: SystemSettingItem) => {
    setEditingSetting(item)
    setEditValueText(serializeSettingValue(item.value))
    setEditDesc(item.description || '')
  }

  const handleSaveSetting = async () => {
    if (!editingSetting) return
    setSavingSetting(true)
    try {
      let parsedValue: unknown = editValueText
      if (typeof editingSetting.value === 'boolean') {
        parsedValue = editValueText.trim().toLowerCase() === 'true'
      } else if (typeof editingSetting.value === 'number') {
        const num = Number(editValueText)
        if (Number.isNaN(num)) {
          showToast(t('settings.invalidNumber'), 'danger')
          setSavingSetting(false)
          return
        }
        parsedValue = num
      } else if (typeof editingSetting.value === 'object' && editingSetting.value !== null) {
        try {
          parsedValue = JSON.parse(editValueText)
        } catch {
          showToast(t('settings.invalidJson'), 'danger')
          setSavingSetting(false)
          return
        }
      }
      await updateSystemSetting(editingSetting.id, {
        value: parsedValue,
        description: editDesc,
      })
      showToast(t('settings.settingSaved'), 'success')
      setEditingSetting(null)
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    } finally {
      setSavingSetting(false)
    }
  }

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    try {
      const record = await createDatabaseBackup()
      showToast(
        t('settings.backupCreated', { filename: record.filename }),
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['system-backups'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    } finally {
      setCreatingBackup(false)
    }
  }

  const settingColumns: TableColumn<SystemSettingItem>[] = useMemo(
    () => [
      {
        key: 'key',
        header: t('settings.colKey'),
        render: (row) => (
          <div>
            <code className="fw-semibold">{row.key}</code>
            {row.description && (
              <div className="small text-body-secondary">{row.description}</div>
            )}
          </div>
        ),
      },
      {
        key: 'category',
        header: t('settings.colCategory'),
        render: (row) => <span className="badge bg-label-secondary">{row.category}</span>,
      },
      {
        key: 'value',
        header: t('settings.colValue'),
        render: (row) => (
          <code className="small text-break">
            {typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value)}
          </code>
        ),
      },
      {
        key: 'scope',
        header: t('settings.colVisibility'),
        render: (row) => (
          <StatusBadge
            label={row.is_public ? t('settings.public') : t('settings.internal')}
            tone={row.is_public ? 'info' : 'secondary'}
          />
        ),
      },
      {
        key: 'actions',
        header: t('users.colActions'),
        className: 'text-end',
        render: (row) => (
          <PermissionGuard permission="system_settings.manage_system_settings">
            <button
              type="button"
              className="btn btn-sm btn-label-primary d-inline-flex align-items-center gap-1"
              onClick={() => openEditModal(row)}
            >
              <Edit3 size={14} />
              <span>{t('settings.edit')}</span>
            </button>
          </PermissionGuard>
        ),
      },
    ],
    [t],
  )

  const backupColumns: TableColumn<BackupRecordItem>[] = useMemo(
    () => [
      {
        key: 'filename',
        header: t('settings.colBackupFile'),
        render: (row) => (
          <div>
            <div className="fw-semibold small">{row.filename}</div>
            {row.sha256_checksum && (
              <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                SHA-256: <code>{row.sha256_checksum.slice(0, 16)}…</code>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'size',
        header: t('students.docSize'),
        render: (row) => formatBytes(row.file_size_bytes),
      },
      {
        key: 'type',
        header: t('settings.colBackupType'),
        render: (row) => <span className="badge bg-label-info">{row.backup_type}</span>,
      },
      {
        key: 'status',
        header: t('common.status'),
        render: (row) => (
          <StatusBadge
            label={row.status}
            tone={
              row.status === 'completed' || row.status === 'success'
                ? 'success'
                : row.status === 'pending'
                  ? 'warning'
                  : 'danger'
            }
          />
        ),
      },
      {
        key: 'triggered_by',
        header: t('settings.colActor'),
        render: (row) => row.triggered_by_name,
      },
      {
        key: 'created_at',
        header: t('settings.colTimestamp'),
        render: (row) => (
          <span className="small text-body-secondary text-nowrap">
            {new Date(row.created_at).toLocaleString()}
          </span>
        ),
      },
    ],
    [t],
  )

  const auditColumns: TableColumn<AuditLogItem>[] = useMemo(
    () => [
      {
        key: 'created_at',
        header: t('settings.colTimestamp'),
        render: (row) => (
          <span className="small text-body-secondary text-nowrap">
            {new Date(row.created_at).toLocaleString()}
          </span>
        ),
      },
      {
        key: 'actor',
        header: t('settings.colActor'),
        render: (row) => <span className="fw-medium">{row.actor_name}</span>,
      },
      {
        key: 'module',
        header: t('settings.colModule'),
        render: (row) => <span className="badge bg-label-secondary">{row.module}</span>,
      },
      {
        key: 'action',
        header: t('settings.colAction'),
        render: (row) => <span className="badge bg-label-primary">{row.action}</span>,
      },
      {
        key: 'target',
        header: t('settings.colTarget'),
        render: (row) => (
          <div className="small">
            <div>{row.object_repr || row.object_id || '—'}</div>
            {row.ip_address && (
              <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                IP: {row.ip_address}
              </div>
            )}
          </div>
        ),
      },
    ],
    [t],
  )

  const auditTotalPages = Math.max(1, Math.ceil((auditQuery.data?.count || 0) / 20))

  return (
    <div>
      <PageHeader
        title={t('settings.pageTitle')}
        subtitle={t('settings.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.settings') },
        ]}
      />

      <ul className="nav nav-pills mb-4 gap-2">
        {canViewConfig && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                activeTab === 'config' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('config')}
            >
              <Sliders size={16} />
              <span>{t('settings.tabConfig')}</span>
            </button>
          </li>
        )}
        {canManageBackups && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                activeTab === 'backups' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('backups')}
            >
              <Database size={16} />
              <span>{t('settings.tabBackups')}</span>
            </button>
          </li>
        )}
        {canViewAudit && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                activeTab === 'audit' ? 'active' : ''
              }`}
              onClick={() => setActiveTab('audit')}
            >
              <History size={16} />
              <span>{t('settings.tabAudit')}</span>
            </button>
          </li>
        )}
      </ul>

      {activeTab === 'config' && canViewConfig && (
        <div className="card">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2">
              <Shield size={17} className="text-primary" />
              <h6 className="card-title mb-0">{t('settings.tabConfig')}</h6>
            </div>
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 220 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">{t('settings.allCategories')}</option>
              <option value="institution">institution</option>
              <option value="academic">academic</option>
              <option value="localization">localization</option>
              <option value="security">security</option>
              <option value="attendance">attendance</option>
              <option value="general">general</option>
            </select>
          </div>
          {settingsQuery.isError ? (
            <div className="p-4">
              <ErrorState
                title={t('settings.loadError')}
                onRetry={() => settingsQuery.refetch()}
              />
            </div>
          ) : (
            <DataTable
              columns={settingColumns}
              data={settingsQuery.data?.results || []}
              rowKey={(row) => row.id}
              loading={settingsQuery.isLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'backups' && canManageBackups && (
        <div className="card">
          <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h6 className="card-title mb-1">{t('settings.tabBackups')}</h6>
              <p className="small text-body-secondary mb-0">{t('settings.backupHint')}</p>
            </div>
            <PermissionGuard permission="system_settings.manage_backups">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={handleCreateBackup}
                disabled={creatingBackup}
              >
                <Database size={16} />
                <span>
                  {creatingBackup ? t('common.loading') : t('settings.createBackupNow')}
                </span>
              </button>
            </PermissionGuard>
          </div>
          {backupsQuery.isError ? (
            <div className="p-4">
              <ErrorState
                title={t('settings.loadError')}
                onRetry={() => backupsQuery.refetch()}
              />
            </div>
          ) : (
            <DataTable
              columns={backupColumns}
              data={backupsQuery.data?.results || []}
              rowKey={(row) => row.id}
              loading={backupsQuery.isLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'audit' && canViewAudit && (
        <div className="card">
          <div className="card-header">
            <div className="row g-2 align-items-center">
              <div className="col-md-6">
                <div className="input-group">
                  <span className="input-group-text">
                    <Search size={15} />
                  </span>
                  <input
                    type="search"
                    className="form-control"
                    placeholder={t('settings.auditSearchPlaceholder')}
                    value={auditSearch}
                    onChange={(e) => {
                      setAuditSearch(e.target.value)
                      setAuditPage(1)
                    }}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={auditModule}
                  onChange={(e) => {
                    setAuditModule(e.target.value)
                    setAuditPage(1)
                  }}
                >
                  <option value="">{t('settings.allModules')}</option>
                  <option value="accounts">accounts</option>
                  <option value="academics">academics</option>
                  <option value="students">students</option>
                  <option value="enrollments">enrollments</option>
                  <option value="classes">classes</option>
                  <option value="teachers">teachers</option>
                  <option value="attendance">attendance</option>
                  <option value="examinations">examinations</option>
                  <option value="reports">reports</option>
                  <option value="system_settings">system_settings</option>
                </select>
              </div>
            </div>
          </div>
          {auditQuery.isError ? (
            <div className="p-4">
              <ErrorState
                title={t('settings.loadError')}
                onRetry={() => auditQuery.refetch()}
              />
            </div>
          ) : (
            <DataTable
              columns={auditColumns}
              data={auditQuery.data?.results || []}
              rowKey={(row) => row.id}
              loading={auditQuery.isLoading}
              page={auditPage}
              totalPages={auditTotalPages}
              totalCount={auditQuery.data?.count}
              onPageChange={setAuditPage}
            />
          )}
        </div>
      )}

      <FormModal
        open={Boolean(editingSetting)}
        title={
          editingSetting
            ? t('settings.editSettingTitle', { key: editingSetting.key })
            : t('settings.edit')
        }
        onClose={() => setEditingSetting(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-label-secondary"
              onClick={() => setEditingSetting(null)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveSetting}
              disabled={savingSetting}
            >
              {savingSetting ? t('common.loading') : t('common.save')}
            </button>
          </>
        }
      >
        {editingSetting && (
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="form-label">{t('settings.colValue')}</label>
              {typeof editingSetting.value === 'boolean' ? (
                <select
                  className="form-select"
                  value={editValueText}
                  onChange={(e) => setEditValueText(e.target.value)}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : typeof editingSetting.value === 'object' && editingSetting.value !== null ? (
                <textarea
                  className="form-control font-monospace"
                  rows={5}
                  value={editValueText}
                  onChange={(e) => setEditValueText(e.target.value)}
                />
              ) : (
                <input
                  type={typeof editingSetting.value === 'number' ? 'number' : 'text'}
                  className="form-control"
                  value={editValueText}
                  onChange={(e) => setEditValueText(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="form-label">{t('academics.description')}</label>
              <input
                type="text"
                className="form-control"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          </div>
        )}
      </FormModal>
    </div>
  )
}
