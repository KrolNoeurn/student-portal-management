import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  Calendar,
  CalendarRange,
  CheckCircle2,
  GitBranch,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/FormModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge, type BadgeTone } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import {
  deleteAcademicYear,
  deleteDegree,
  deleteMajor,
  deleteSemester,
  deleteYearLevel,
  fetchAcademicYears,
  fetchDegrees,
  fetchMajors,
  fetchSemesters,
  fetchYearLevels,
  saveAcademicYear,
  saveDegree,
  saveMajor,
  saveSemester,
  saveYearLevel,
  setCurrentAcademicYear,
  setCurrentSemester,
  type AcademicYear,
  type Degree,
  type Major,
  type Semester,
  type YearLevel,
} from '@/features/academics/academicsApi'

type AcademicsTab = 'years' | 'semesters' | 'degrees' | 'majors' | 'yearLevels'

export function AcademicsPage() {
  const { t, i18n } = useTranslation()
  const isKm = i18n.language === 'km'
  const { showToast } = useToast()
  const qc = useQueryClient()

  const [tab, setTab] = useState<AcademicsTab>('years')
  const [semesterYearFilter, setSemesterYearFilter] = useState('')
  const [majorDegreeFilter, setMajorDegreeFilter] = useState('')

  // Generic modal state for the active tab
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formState, setFormState] = useState<Record<string, unknown>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => fetchAcademicYears(),
  })

  const semestersQuery = useQuery({
    queryKey: ['semesters', semesterYearFilter],
    queryFn: () =>
      fetchSemesters(semesterYearFilter ? { academic_year: semesterYearFilter } : undefined),
  })

  const degreesQuery = useQuery({
    queryKey: ['degrees'],
    queryFn: () => fetchDegrees(),
  })

  const majorsQuery = useQuery({
    queryKey: ['majors', majorDegreeFilter],
    queryFn: () => fetchMajors(majorDegreeFilter ? { degree: majorDegreeFilter } : undefined),
  })

  const yearLevelsQuery = useQuery({
    queryKey: ['year-levels'],
    queryFn: () => fetchYearLevels(),
  })

  const yearsList = yearsQuery.data?.results || []
  const degreesList = degreesQuery.data?.results || []

  const openCreateModal = () => {
    setEditingId(null)
    setFormError(null)
    if (tab === 'years') {
      setFormState({
        name: '',
        start_date: '',
        end_date: '',
        status: 'planned',
        is_current: false,
        description: '',
      })
    } else if (tab === 'semesters') {
      setFormState({
        academic_year: semesterYearFilter || String(yearsList[0]?.id || ''),
        name: '',
        code: '',
        sequence_number: 1,
        start_date: '',
        end_date: '',
        status: 'planned',
        is_current: false,
      })
    } else if (tab === 'degrees') {
      setFormState({
        code: '',
        name_en: '',
        name_km: '',
        level: 'bachelor',
        duration_years: 4,
        description: '',
        status: 'active',
      })
    } else if (tab === 'majors') {
      setFormState({
        degree: majorDegreeFilter || String(degreesList[0]?.id || ''),
        code: '',
        name_en: '',
        name_km: '',
        description: '',
        status: 'active',
      })
    } else {
      setFormState({
        code: '',
        name_en: '',
        name_km: '',
        order_index: (yearLevelsQuery.data?.results.length || 0) + 1,
        status: 'active',
      })
    }
    setModalOpen(true)
  }

  const openEditModal = (id: number, data: Record<string, unknown>) => {
    setEditingId(id)
    setFormError(null)
    setFormState(data)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      if (tab === 'years') {
        await saveAcademicYear(formState as Partial<AcademicYear>, editingId ?? undefined)
        qc.invalidateQueries({ queryKey: ['academic-years'] })
      } else if (tab === 'semesters') {
        await saveSemester(
          {
            ...formState,
            academic_year: Number(formState.academic_year),
            sequence_number: Number(formState.sequence_number),
          } as Partial<Semester>,
          editingId ?? undefined
        )
        qc.invalidateQueries({ queryKey: ['semesters'] })
        qc.invalidateQueries({ queryKey: ['academic-years'] })
      } else if (tab === 'degrees') {
        await saveDegree(
          { ...formState, duration_years: Number(formState.duration_years) } as Partial<Degree>,
          editingId ?? undefined
        )
        qc.invalidateQueries({ queryKey: ['degrees'] })
      } else if (tab === 'majors') {
        await saveMajor(
          { ...formState, degree: Number(formState.degree) } as Partial<Major>,
          editingId ?? undefined
        )
        qc.invalidateQueries({ queryKey: ['majors'] })
        qc.invalidateQueries({ queryKey: ['degrees'] })
      } else {
        await saveYearLevel(
          { ...formState, order_index: Number(formState.order_index) } as Partial<YearLevel>,
          editingId ?? undefined
        )
        qc.invalidateQueries({ queryKey: ['year-levels'] })
      }
      setModalOpen(false)
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      if (tab === 'years') {
        await deleteAcademicYear(id)
        qc.invalidateQueries({ queryKey: ['academic-years'] })
      } else if (tab === 'semesters') {
        await deleteSemester(id)
        qc.invalidateQueries({ queryKey: ['semesters'] })
      } else if (tab === 'degrees') {
        await deleteDegree(id)
        qc.invalidateQueries({ queryKey: ['degrees'] })
      } else if (tab === 'majors') {
        await deleteMajor(id)
        qc.invalidateQueries({ queryKey: ['majors'] })
      } else {
        await deleteYearLevel(id)
        qc.invalidateQueries({ queryKey: ['year-levels'] })
      }
      showToast(t('academics.deletedSuccess'), 'success')
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    }
  }

  const statusTone = (status: string): BadgeTone => {
    if (status === 'active') return 'success'
    if (status === 'planned') return 'info'
    if (status === 'completed') return 'primary'
    return 'secondary'
  }

  const yearColumns: TableColumn<AcademicYear>[] = [
    {
      key: 'name',
      header: t('academics.yearName'),
      render: (row) => (
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold">{row.name}</span>
          {row.is_current && <StatusBadge label={t('academics.current')} tone="primary" />}
        </div>
      ),
    },
    {
      key: 'dates',
      header: t('academics.dateRange'),
      render: (row) => (
        <span className="small">
          {row.start_date} → {row.end_date}
        </span>
      ),
    },
    {
      key: 'semesters',
      header: t('academics.tabSemesters'),
      render: (row) => <StatusBadge label={String(row.semester_count)} tone="info" />,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge label={row.status} tone={statusTone(row.status)} />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="academics.change_academicyear">
            {!row.is_current && (
              <button
                type="button"
                className="btn btn-icon btn-sm btn-label-secondary"
                title={t('academics.setCurrent')}
                onClick={async () => {
                  try {
                    await setCurrentAcademicYear(row.id)
                    qc.invalidateQueries({ queryKey: ['academic-years'] })
                    showToast(t('academics.currentUpdated'), 'success')
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <CheckCircle2 size={15} />
              </button>
            )}
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openEditModal(row.id, { ...row })}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="academics.delete_academicyear">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const semesterColumns: TableColumn<Semester>[] = [
    {
      key: 'year',
      header: t('academics.tabYears'),
      render: (row) => <span className="fw-medium">{row.academic_year_name}</span>,
    },
    {
      key: 'name',
      header: t('academics.semesterName'),
      render: (row) => (
        <div className="d-flex align-items-center gap-2">
          <code className="small">{row.code}</code>
          <span className="fw-semibold">{row.name}</span>
          {row.is_current && <StatusBadge label={t('academics.current')} tone="primary" />}
        </div>
      ),
    },
    {
      key: 'dates',
      header: t('academics.dateRange'),
      render: (row) => (
        <span className="small">
          {row.start_date} → {row.end_date}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge label={row.status} tone={statusTone(row.status)} />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="academics.change_semester">
            {!row.is_current && (
              <button
                type="button"
                className="btn btn-icon btn-sm btn-label-secondary"
                title={t('academics.setCurrent')}
                onClick={async () => {
                  try {
                    await setCurrentSemester(row.id)
                    qc.invalidateQueries({ queryKey: ['semesters'] })
                    showToast(t('academics.currentUpdated'), 'success')
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <CheckCircle2 size={15} />
              </button>
            )}
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openEditModal(row.id, { ...row, academic_year: String(row.academic_year) })}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="academics.delete_semester">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const degreeColumns: TableColumn<Degree>[] = [
    {
      key: 'code',
      header: t('academics.code'),
      render: (row) => <code className="fw-semibold">{row.code}</code>,
    },
    {
      key: 'name',
      header: t('academics.name'),
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.name_en}</div>
          {row.name_km && <div className="small text-body-secondary">{row.name_km}</div>}
        </div>
      ),
    },
    {
      key: 'level',
      header: t('academics.level'),
      render: (row) => <StatusBadge label={row.level} tone="info" />,
    },
    {
      key: 'duration',
      header: t('academics.durationYears'),
      render: (row) => <span>{row.duration_years}</span>,
    },
    {
      key: 'majors',
      header: t('academics.tabMajors'),
      render: (row) => <StatusBadge label={String(row.major_count)} tone="primary" />,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge label={row.status} tone={statusTone(row.status)} />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="academics.change_degree">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openEditModal(row.id, { ...row })}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="academics.delete_degree">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const majorColumns: TableColumn<Major>[] = [
    {
      key: 'code',
      header: t('academics.code'),
      render: (row) => <code className="fw-semibold">{row.code}</code>,
    },
    {
      key: 'name',
      header: t('academics.name'),
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.name_en}</div>
          {row.name_km && <div className="small text-body-secondary">{row.name_km}</div>}
        </div>
      ),
    },
    {
      key: 'degree',
      header: t('academics.degree'),
      render: (row) => (
        <StatusBadge
          label={`${row.degree_code} — ${isKm && row.degree_name_km ? row.degree_name_km : row.degree_name_en}`}
          tone="primary"
        />
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge label={row.status} tone={statusTone(row.status)} />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="academics.change_major">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openEditModal(row.id, { ...row, degree: String(row.degree) })}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="academics.delete_major">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const yearLevelColumns: TableColumn<YearLevel>[] = [
    {
      key: 'order',
      header: '#',
      render: (row) => <StatusBadge label={String(row.order_index)} tone="primary" />,
    },
    {
      key: 'code',
      header: t('academics.code'),
      render: (row) => <code className="fw-semibold">{row.code}</code>,
    },
    {
      key: 'name',
      header: t('academics.name'),
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.name_en}</div>
          {row.name_km && <div className="small text-body-secondary">{row.name_km}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge label={row.status} tone={statusTone(row.status)} />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="academics.change_yearlevel">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openEditModal(row.id, { ...row })}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="academics.delete_yearlevel">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const addPermByTab: Record<AcademicsTab, string> = {
    years: 'academics.add_academicyear',
    semesters: 'academics.add_semester',
    degrees: 'academics.add_degree',
    majors: 'academics.add_major',
    yearLevels: 'academics.add_yearlevel',
  }

  return (
    <div>
      <PageHeader
        title={t('academics.pageTitle')}
        subtitle={t('academics.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.academics') },
        ]}
        actions={
          <PermissionGuard permission={addPermByTab[tab]}>
            <button
              type="button"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              onClick={openCreateModal}
            >
              <Plus size={16} />
              <span>{t('academics.addNew')}</span>
            </button>
          </PermissionGuard>
        }
      />

      <ul className="nav nav-pills mb-4 gap-2 flex-wrap">
        {(
          [
            { id: 'years', label: t('academics.tabYears'), icon: CalendarRange },
            { id: 'semesters', label: t('academics.tabSemesters'), icon: Calendar },
            { id: 'degrees', label: t('academics.tabDegrees'), icon: Award },
            { id: 'majors', label: t('academics.tabMajors'), icon: GitBranch },
            { id: 'yearLevels', label: t('academics.tabYearLevels'), icon: Layers },
          ] as const
        ).map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id} className="nav-item">
              <button
                type="button"
                className={`nav-link d-inline-flex align-items-center gap-2 ${
                  tab === item.id ? 'active' : ''
                }`}
                onClick={() => setTab(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="card">
        {tab === 'semesters' && (
          <div className="card-header">
            <div style={{ maxWidth: 280 }}>
              <select
                className="form-select"
                value={semesterYearFilter}
                onChange={(e) => setSemesterYearFilter(e.target.value)}
              >
                <option value="">{t('academics.allAcademicYears')}</option>
                {yearsList.map((y) => (
                  <option key={y.id} value={String(y.id)}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tab === 'majors' && (
          <div className="card-header">
            <div style={{ maxWidth: 300 }}>
              <select
                className="form-select"
                value={majorDegreeFilter}
                onChange={(e) => setMajorDegreeFilter(e.target.value)}
              >
                <option value="">{t('academics.allDegrees')}</option>
                {degreesList.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {isKm && d.name_km ? d.name_km : d.name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tab === 'years' && (
          <DataTable
            columns={yearColumns}
            data={yearsList}
            rowKey={(r) => r.id}
            loading={yearsQuery.isLoading}
          />
        )}
        {tab === 'semesters' && (
          <DataTable
            columns={semesterColumns}
            data={semestersQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={semestersQuery.isLoading}
          />
        )}
        {tab === 'degrees' && (
          <DataTable
            columns={degreeColumns}
            data={degreesList}
            rowKey={(r) => r.id}
            loading={degreesQuery.isLoading}
          />
        )}
        {tab === 'majors' && (
          <DataTable
            columns={majorColumns}
            data={majorsQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={majorsQuery.isLoading}
          />
        )}
        {tab === 'yearLevels' && (
          <DataTable
            columns={yearLevelColumns}
            data={yearLevelsQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={yearLevelsQuery.isLoading}
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <FormModal
        open={modalOpen}
        title={editingId ? t('academics.editItem') : t('academics.createItem')}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-label-secondary"
              onClick={() => setModalOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="academics-modal-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </>
        }
      >
        {formError && (
          <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>
        )}

        <form id="academics-modal-form" onSubmit={handleSave} className="row g-3">
          {tab === 'years' && (
            <>
              <div className="col-12">
                <label className="form-label">{t('academics.yearName')} *</label>
                <input
                  required
                  className="form-control"
                  placeholder="2026-2027"
                  value={String(formState.name || '')}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.startDate')} *</label>
                <input
                  required
                  type="date"
                  className="form-control"
                  value={String(formState.start_date || '')}
                  onChange={(e) => setFormState({ ...formState, start_date: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.endDate')} *</label>
                <input
                  required
                  type="date"
                  className="form-control"
                  value={String(formState.end_date || '')}
                  onChange={(e) => setFormState({ ...formState, end_date: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('common.status')}</label>
                <select
                  className="form-select"
                  value={String(formState.status || 'planned')}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <div className="form-check form-switch mb-2">
                  <input
                    id="ay-current"
                    type="checkbox"
                    className="form-check-input"
                    checked={Boolean(formState.is_current)}
                    onChange={(e) => setFormState({ ...formState, is_current: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="ay-current">
                    {t('academics.setCurrent')}
                  </label>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">{t('academics.description')}</label>
                <textarea
                  rows={2}
                  className="form-control"
                  value={String(formState.description || '')}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                />
              </div>
            </>
          )}

          {tab === 'semesters' && (
            <>
              <div className="col-12">
                <label className="form-label">{t('academics.tabYears')} *</label>
                <select
                  required
                  className="form-select"
                  value={String(formState.academic_year || '')}
                  onChange={(e) => setFormState({ ...formState, academic_year: e.target.value })}
                >
                  <option value="">--</option>
                  {yearsList.map((y) => (
                    <option key={y.id} value={String(y.id)}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">{t('academics.code')} *</label>
                <input
                  required
                  className="form-control"
                  placeholder="S1"
                  value={String(formState.code || '')}
                  onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label">{t('academics.semesterName')} *</label>
                <input
                  required
                  className="form-control"
                  placeholder="Semester 1"
                  value={String(formState.name || '')}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label"># *</label>
                <input
                  required
                  type="number"
                  min={1}
                  className="form-control"
                  value={Number(formState.sequence_number || 1)}
                  onChange={(e) =>
                    setFormState({ ...formState, sequence_number: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.startDate')} *</label>
                <input
                  required
                  type="date"
                  className="form-control"
                  value={String(formState.start_date || '')}
                  onChange={(e) => setFormState({ ...formState, start_date: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.endDate')} *</label>
                <input
                  required
                  type="date"
                  className="form-control"
                  value={String(formState.end_date || '')}
                  onChange={(e) => setFormState({ ...formState, end_date: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('common.status')}</label>
                <select
                  className="form-select"
                  value={String(formState.status || 'planned')}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <div className="form-check form-switch mb-2">
                  <input
                    id="sem-current"
                    type="checkbox"
                    className="form-check-input"
                    checked={Boolean(formState.is_current)}
                    onChange={(e) => setFormState({ ...formState, is_current: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="sem-current">
                    {t('academics.setCurrent')}
                  </label>
                </div>
              </div>
            </>
          )}

          {tab === 'degrees' && (
            <>
              <div className="col-md-4">
                <label className="form-label">{t('academics.code')} *</label>
                <input
                  required
                  className="form-control"
                  placeholder="BACH"
                  value={String(formState.code || '')}
                  onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                />
              </div>
              <div className="col-md-8">
                <label className="form-label">{t('academics.nameEn')} *</label>
                <input
                  required
                  className="form-control"
                  value={String(formState.name_en || '')}
                  onChange={(e) => setFormState({ ...formState, name_en: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.nameKm')}</label>
                <input
                  className="form-control"
                  value={String(formState.name_km || '')}
                  onChange={(e) => setFormState({ ...formState, name_km: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.level')}</label>
                <select
                  className="form-select"
                  value={String(formState.level || 'bachelor')}
                  onChange={(e) => setFormState({ ...formState, level: e.target.value })}
                >
                  <option value="higher_diploma">Higher Diploma</option>
                  <option value="bachelor">Bachelor&apos;s Degree</option>
                  <option value="associate">Associate Degree</option>
                  <option value="master">Master&apos;s Degree</option>
                  <option value="doctorate">Doctorate</option>
                  <option value="certificate">Certificate</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.durationYears')} *</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={10}
                  className="form-control"
                  value={Number(formState.duration_years || 4)}
                  onChange={(e) =>
                    setFormState({ ...formState, duration_years: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('common.status')}</label>
                <select
                  className="form-select"
                  value={String(formState.status || 'active')}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </>
          )}

          {tab === 'majors' && (
            <>
              <div className="col-12">
                <label className="form-label">{t('academics.degree')} *</label>
                <select
                  required
                  className="form-select"
                  value={String(formState.degree || '')}
                  onChange={(e) => setFormState({ ...formState, degree: e.target.value })}
                >
                  <option value="">--</option>
                  {degreesList.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.code} — {isKm && d.name_km ? d.name_km : d.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">{t('academics.code')} *</label>
                <input
                  required
                  className="form-control"
                  placeholder="CS"
                  value={String(formState.code || '')}
                  onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                />
              </div>
              <div className="col-md-8">
                <label className="form-label">{t('academics.nameEn')} *</label>
                <input
                  required
                  className="form-control"
                  value={String(formState.name_en || '')}
                  onChange={(e) => setFormState({ ...formState, name_en: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.nameKm')}</label>
                <input
                  className="form-control"
                  value={String(formState.name_km || '')}
                  onChange={(e) => setFormState({ ...formState, name_km: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('common.status')}</label>
                <select
                  className="form-select"
                  value={String(formState.status || 'active')}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </>
          )}

          {tab === 'yearLevels' && (
            <>
              <div className="col-md-4">
                <label className="form-label">{t('academics.code')} *</label>
                <input
                  required
                  className="form-control"
                  placeholder="Y1"
                  value={String(formState.code || '')}
                  onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label"># *</label>
                <input
                  required
                  type="number"
                  min={1}
                  className="form-control"
                  value={Number(formState.order_index || 1)}
                  onChange={(e) =>
                    setFormState({ ...formState, order_index: Number(e.target.value) })
                  }
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">{t('common.status')}</label>
                <select
                  className="form-select"
                  value={String(formState.status || 'active')}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.nameEn')} *</label>
                <input
                  required
                  className="form-control"
                  value={String(formState.name_en || '')}
                  onChange={(e) => setFormState({ ...formState, name_en: e.target.value })}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">{t('academics.nameKm')}</label>
                <input
                  className="form-control"
                  value={String(formState.name_km || '')}
                  onChange={(e) => setFormState({ ...formState, name_km: e.target.value })}
                />
              </div>
            </>
          )}
        </form>
      </FormModal>
    </div>
  )
}
