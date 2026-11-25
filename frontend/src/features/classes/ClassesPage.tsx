import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building, Eye, Pencil, Plus, School, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { AcademicFilterBar, type AcademicFilterValues } from '@/components/AcademicFilterBar'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormModal } from '@/components/ui/FormModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge, type BadgeTone } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import {
  fetchAcademicYears,
  fetchDegrees,
  fetchMajors,
  fetchSemesters,
  fetchYearLevels,
} from '@/features/academics/academicsApi'
import {
  deleteClassroom,
  fetchClasses,
  fetchClassrooms,
  saveClassroom,
  saveClassSection,
  type ClassroomItem,
  type ClassSectionItem,
} from '@/features/classes/classesApi'

export function classStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'open':
      return 'success'
    case 'in_progress':
      return 'primary'
    case 'full':
      return 'warning'
    case 'completed':
      return 'info'
    default:
      return 'secondary'
  }
}

export function ClassesPage() {
  const { t, i18n } = useTranslation()
  const isKm = i18n.language === 'km'
  const { showToast } = useToast()
  const qc = useQueryClient()

  const [tab, setTab] = useState<'classes' | 'classrooms'>('classes')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<AcademicFilterValues>({})
  const [page, setPage] = useState(1)

  const [classModalOpen, setClassModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassSectionItem | null>(null)
  const [classForm, setClassForm] = useState({
    code: '',
    name: '',
    academic_year: '',
    semester: '',
    degree: '',
    major: '',
    year_level: '',
    default_classroom: '',
    capacity: 40,
    status: 'open' as ClassSectionItem['status'],
    notes: '',
  })

  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<ClassroomItem | null>(null)
  const [roomForm, setRoomForm] = useState({
    code: '',
    name: '',
    building: '',
    floor: '',
    capacity: 40,
    room_type: 'lecture' as ClassroomItem['room_type'],
    status: 'active' as ClassroomItem['status'],
  })

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const classesQuery = useQuery({
    queryKey: ['classes', { page, search, filters }],
    queryFn: () =>
      fetchClasses({
        page,
        search,
        academic_year: filters.academicYear || '',
        degree: filters.degree || '',
        major: filters.major || '',
        year_level: filters.yearLevel || '',
      }),
  })

  const roomsQuery = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => fetchClassrooms(),
  })

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => fetchAcademicYears(),
  })
  const degreesQuery = useQuery({
    queryKey: ['degrees'],
    queryFn: () => fetchDegrees({ status: 'active' }),
  })
  const yearLevelsQuery = useQuery({
    queryKey: ['year-levels'],
    queryFn: () => fetchYearLevels({ status: 'active' }),
  })
  const formSemestersQuery = useQuery({
    queryKey: ['semesters-cls-form', classForm.academic_year],
    queryFn: () =>
      fetchSemesters(classForm.academic_year ? { academic_year: classForm.academic_year } : undefined),
    enabled: classModalOpen && Boolean(classForm.academic_year),
  })
  const formMajorsQuery = useQuery({
    queryKey: ['majors-cls-form', classForm.degree],
    queryFn: () => fetchMajors(classForm.degree ? { degree: classForm.degree } : undefined),
    enabled: classModalOpen && Boolean(classForm.degree),
  })

  const openClassModal = (cls: ClassSectionItem | null) => {
    setFormError(null)
    setEditingClass(cls)
    if (cls) {
      setClassForm({
        code: cls.code,
        name: cls.name,
        academic_year: String(cls.academic_year),
        semester: cls.semester ? String(cls.semester) : '',
        degree: String(cls.degree),
        major: String(cls.major),
        year_level: String(cls.year_level),
        default_classroom: cls.default_classroom ? String(cls.default_classroom) : '',
        capacity: cls.capacity,
        status: cls.status,
        notes: cls.notes,
      })
    } else {
      setClassForm({
        code: '',
        name: '',
        academic_year: String(yearsQuery.data?.results.find((y) => y.is_current)?.id || ''),
        semester: '',
        degree: String(degreesQuery.data?.results[0]?.id || ''),
        major: '',
        year_level: String(yearLevelsQuery.data?.results[0]?.id || ''),
        default_classroom: '',
        capacity: 40,
        status: 'open',
        notes: '',
      })
    }
    setClassModalOpen(true)
  }

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await saveClassSection(
        {
          code: classForm.code,
          name: classForm.name,
          academic_year: Number(classForm.academic_year),
          semester: classForm.semester ? Number(classForm.semester) : null,
          degree: Number(classForm.degree),
          major: Number(classForm.major),
          year_level: Number(classForm.year_level),
          default_classroom: classForm.default_classroom
            ? Number(classForm.default_classroom)
            : null,
          capacity: Number(classForm.capacity),
          status: classForm.status,
          notes: classForm.notes,
        },
        editingClass?.id
      )
      setClassModalOpen(false)
      qc.invalidateQueries({ queryKey: ['classes'] })
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openRoomModal = (room: ClassroomItem | null) => {
    setFormError(null)
    setEditingRoom(room)
    if (room) {
      setRoomForm({
        code: room.code,
        name: room.name,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
        room_type: room.room_type,
        status: room.status,
      })
    } else {
      setRoomForm({
        code: '',
        name: '',
        building: '',
        floor: '',
        capacity: 40,
        room_type: 'lecture',
        status: 'active',
      })
    }
    setRoomModalOpen(true)
  }

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await saveClassroom(
        { ...roomForm, capacity: Number(roomForm.capacity) },
        editingRoom?.id
      )
      setRoomModalOpen(false)
      qc.invalidateQueries({ queryKey: ['classrooms'] })
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const classColumns: TableColumn<ClassSectionItem>[] = [
    {
      key: 'class',
      header: t('classes.colClass'),
      render: (row) => (
        <div>
          <Link to={`/classes/${row.id}`} className="fw-semibold text-decoration-none">
            {row.code} — {row.name}
          </Link>
          <div className="small text-body-secondary">
            {row.academic_year_name}
            {row.semester_name ? ` · ${row.semester_name}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'program',
      header: t('subjects.program'),
      render: (row) => (
        <div className="small">
          <div className="fw-medium">
            {row.major_code} — {isKm && row.major_name_km ? row.major_name_km : row.major_name_en}
          </div>
          <div className="text-body-secondary">
            {row.degree_code} ·{' '}
            {isKm && row.year_level_name_km ? row.year_level_name_km : row.year_level_name_en}
          </div>
        </div>
      ),
    },
    {
      key: 'room',
      header: t('classes.classroom'),
      render: (row) => <span className="small">{row.classroom_code || '—'}</span>,
    },
    {
      key: 'roster',
      header: t('classes.rosterCapacity'),
      render: (row) => (
        <StatusBadge
          label={`${row.active_student_count} / ${row.capacity}`}
          tone={row.active_student_count >= row.capacity ? 'warning' : 'primary'}
        />
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge label={row.status} tone={classStatusTone(row.status)} />,
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <Link
            to={`/classes/${row.id}`}
            className="btn btn-icon btn-sm btn-label-primary"
            title={t('classes.openDetail')}
          >
            <Eye size={15} />
          </Link>
          <PermissionGuard permission="classes.change_classsection">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => openClassModal(row)}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  const roomColumns: TableColumn<ClassroomItem>[] = [
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
          <div className="fw-semibold">{row.name}</div>
          {(row.building || row.floor) && (
            <div className="small text-body-secondary">
              {[row.building, row.floor].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('subjects.requirement'),
      render: (row) => <StatusBadge label={row.room_type} tone="info" />,
    },
    {
      key: 'capacity',
      header: t('classes.capacity'),
      render: (row) => <StatusBadge label={String(row.capacity)} tone="primary" />,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge label={row.status} tone={row.status === 'active' ? 'success' : 'secondary'} />
      ),
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard permission="classes.change_classroom">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openRoomModal(row)}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="classes.delete_classroom">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={async () => {
                try {
                  await deleteClassroom(row.id)
                  qc.invalidateQueries({ queryKey: ['classrooms'] })
                  showToast(t('academics.deletedSuccess'), 'success')
                } catch (err) {
                  showToast(extractApiErrorMessage(err), 'danger')
                }
              }}
            >
              <Trash2 size={15} />
            </button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('classes.pageTitle')}
        subtitle={t('classes.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.classes') },
        ]}
        actions={
          tab === 'classes' ? (
            <PermissionGuard permission="classes.add_classsection">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => openClassModal(null)}
              >
                <Plus size={16} />
                <span>{t('classes.createClass')}</span>
              </button>
            </PermissionGuard>
          ) : (
            <PermissionGuard permission="classes.add_classroom">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => openRoomModal(null)}
              >
                <Plus size={16} />
                <span>{t('classes.createRoom')}</span>
              </button>
            </PermissionGuard>
          )
        }
      />

      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link d-inline-flex align-items-center gap-2 ${
              tab === 'classes' ? 'active' : ''
            }`}
            onClick={() => setTab('classes')}
          >
            <School size={16} />
            <span>{t('classes.tabClasses')}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link d-inline-flex align-items-center gap-2 ${
              tab === 'classrooms' ? 'active' : ''
            }`}
            onClick={() => setTab('classrooms')}
          >
            <Building size={16} />
            <span>{t('classes.tabClassrooms')}</span>
          </button>
        </li>
      </ul>

      {tab === 'classes' ? (
        <div className="card">
          <div className="card-header d-flex flex-column gap-2">
            <div className="input-group" style={{ maxWidth: 420 }}>
              <span className="input-group-text bg-transparent">
                <Search size={16} />
              </span>
              <input
                type="search"
                className="form-control"
                placeholder={t('classes.searchPlaceholder')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <AcademicFilterBar
              values={filters}
              onChange={(next) => {
                setFilters(next)
                setPage(1)
              }}
              showYear
              showDegree
              showMajor
              showYearLevel
            />
          </div>
          {classesQuery.isError ? (
            <div className="card-body">
              <ErrorState
                title={t('classes.loadError')}
                message={extractApiErrorMessage(classesQuery.error)}
                onRetry={() => classesQuery.refetch()}
              />
            </div>
          ) : (
            <DataTable
              columns={classColumns}
              data={classesQuery.data?.results || []}
              rowKey={(r) => r.id}
              loading={classesQuery.isLoading}
              page={classesQuery.data?.page || page}
              totalPages={classesQuery.data?.total_pages || 1}
              totalCount={classesQuery.data?.count || 0}
              onPageChange={setPage}
            />
          )}
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={roomColumns}
            data={roomsQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={roomsQuery.isLoading}
          />
        </div>
      )}

      {/* Create/Edit Class Modal */}
      <FormModal
        open={classModalOpen}
        size="lg"
        title={editingClass ? t('classes.editClass') : t('classes.createClass')}
        onClose={() => setClassModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setClassModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="class-section-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="class-section-form" onSubmit={handleSaveClass} className="row g-3">
          <div className="col-md-4">
            <label className="form-label">{t('academics.code')} *</label>
            <input
              required
              className="form-control"
              placeholder="CS-Y1-A"
              value={classForm.code}
              onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
            />
          </div>
          <div className="col-md-8">
            <label className="form-label">{t('academics.name')} *</label>
            <input
              required
              className="form-control"
              value={classForm.name}
              onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.tabYears')} *</label>
            <select
              required
              className="form-select"
              value={classForm.academic_year}
              onChange={(e) =>
                setClassForm({ ...classForm, academic_year: e.target.value, semester: '' })
              }
            >
              <option value="">--</option>
              {(yearsQuery.data?.results || []).map((y) => (
                <option key={y.id} value={String(y.id)}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.tabSemesters')}</label>
            <select
              className="form-select"
              value={classForm.semester}
              onChange={(e) => setClassForm({ ...classForm, semester: e.target.value })}
            >
              <option value="">--</option>
              {(formSemestersQuery.data?.results || []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('academics.degree')} *</label>
            <select
              required
              className="form-select"
              value={classForm.degree}
              onChange={(e) => setClassForm({ ...classForm, degree: e.target.value, major: '' })}
            >
              <option value="">--</option>
              {(degreesQuery.data?.results || []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('academics.major')} *</label>
            <select
              required
              className="form-select"
              value={classForm.major}
              onChange={(e) => setClassForm({ ...classForm, major: e.target.value })}
            >
              <option value="">--</option>
              {(formMajorsQuery.data?.results || []).map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.code} — {m.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('academics.tabYearLevels')} *</label>
            <select
              required
              className="form-select"
              value={classForm.year_level}
              onChange={(e) => setClassForm({ ...classForm, year_level: e.target.value })}
            >
              <option value="">--</option>
              {(yearLevelsQuery.data?.results || []).map((yl) => (
                <option key={yl.id} value={String(yl.id)}>
                  {isKm && yl.name_km ? yl.name_km : yl.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('classes.classroom')}</label>
            <select
              className="form-select"
              value={classForm.default_classroom}
              onChange={(e) => setClassForm({ ...classForm, default_classroom: e.target.value })}
            >
              <option value="">--</option>
              {(roomsQuery.data?.results || []).map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.code} — {r.name} ({r.capacity})
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('classes.capacity')} *</label>
            <input
              required
              type="number"
              min={1}
              className="form-control"
              value={classForm.capacity}
              onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={classForm.status}
              onChange={(e) =>
                setClassForm({
                  ...classForm,
                  status: e.target.value as ClassSectionItem['status'],
                })
              }
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="full">Full</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </form>
      </FormModal>

      {/* Create/Edit Classroom Modal */}
      <FormModal
        open={roomModalOpen}
        title={editingRoom ? t('classes.editRoom') : t('classes.createRoom')}
        onClose={() => setRoomModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setRoomModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="classroom-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="classroom-form" onSubmit={handleSaveRoom} className="row g-3">
          <div className="col-md-4">
            <label className="form-label">{t('academics.code')} *</label>
            <input
              required
              className="form-control"
              placeholder="B1-204"
              value={roomForm.code}
              onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
            />
          </div>
          <div className="col-md-8">
            <label className="form-label">{t('academics.name')} *</label>
            <input
              required
              className="form-control"
              value={roomForm.name}
              onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('classes.building')}</label>
            <input
              className="form-control"
              value={roomForm.building}
              onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('classes.floor')}</label>
            <input
              className="form-control"
              value={roomForm.floor}
              onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('classes.capacity')} *</label>
            <input
              required
              type="number"
              min={1}
              className="form-control"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('subjects.requirement')}</label>
            <select
              className="form-select"
              value={roomForm.room_type}
              onChange={(e) =>
                setRoomForm({
                  ...roomForm,
                  room_type: e.target.value as ClassroomItem['room_type'],
                })
              }
            >
              <option value="lecture">Lecture Hall</option>
              <option value="lab">Lab</option>
              <option value="seminar">Seminar Room</option>
              <option value="auditorium">Auditorium</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={roomForm.status}
              onChange={(e) =>
                setRoomForm({
                  ...roomForm,
                  status: e.target.value as ClassroomItem['status'],
                })
              }
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </form>
      </FormModal>
    </div>
  )
}
