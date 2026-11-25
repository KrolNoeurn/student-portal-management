import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, ArrowUpRight, History, Plus, Search } from 'lucide-react'
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
  changeProgramApi,
  createEnrollmentApi,
  fetchEnrollments,
  promoteEnrollmentApi,
  type EnrollmentItem,
  type EnrollmentStatus,
  type EnrollmentType,
} from '@/features/enrollments/enrollmentsApi'
import { fetchStudents } from '@/features/students/studentsApi'

export function enrollmentStatusTone(status: EnrollmentStatus | string): BadgeTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'promoted':
    case 'completed':
      return 'primary'
    case 'pending':
      return 'info'
    case 'transferred':
    case 'suspended':
      return 'warning'
    case 'withdrawn':
    case 'cancelled':
      return 'danger'
    default:
      return 'secondary'
  }
}

export function EnrollmentsPage() {
  const { t, i18n } = useTranslation()
  const isKm = i18n.language === 'km'
  const { showToast } = useToast()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<AcademicFilterValues>({})
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  // Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [promoteTarget, setPromoteTarget] = useState<EnrollmentItem | null>(null)
  const [changeTarget, setChangeTarget] = useState<EnrollmentItem | null>(null)
  const [historyTarget, setHistoryTarget] = useState<EnrollmentItem | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // New enrollment form
  const [newForm, setNewForm] = useState({
    student: '',
    academic_year: '',
    semester: '',
    degree: '',
    major: '',
    year_level: '',
    enrollment_type: 'new' as EnrollmentType,
    enrollment_date: new Date().toISOString().slice(0, 10),
    status: 'active' as EnrollmentStatus,
    remarks: '',
  })

  // Promote / Re-enroll form
  const [promoForm, setPromoForm] = useState({
    target_academic_year: '',
    target_year_level: '',
    target_semester: '',
    enrollment_type: 'promotion' as 'promotion' | 're_enrollment',
    remarks: '',
  })

  // Program change / transfer form
  const [changeForm, setChangeForm] = useState({
    degree: '',
    major: '',
    year_level: '',
    status: '' as '' | EnrollmentStatus,
    reason: '',
  })

  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', { page, search, filters, statusFilter }],
    queryFn: () =>
      fetchEnrollments({
        page,
        search,
        academic_year: filters.academicYear || '',
        degree: filters.degree || '',
        major: filters.major || '',
        year_level: filters.yearLevel || '',
        status: statusFilter,
      }),
  })

  const studentsOptQuery = useQuery({
    queryKey: ['students-enroll-options'],
    queryFn: () => fetchStudents({ page_size: 100 }),
    enabled: createOpen,
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
  const newSemestersQuery = useQuery({
    queryKey: ['semesters-new', newForm.academic_year],
    queryFn: () =>
      fetchSemesters(newForm.academic_year ? { academic_year: newForm.academic_year } : undefined),
    enabled: createOpen && Boolean(newForm.academic_year),
  })
  const newMajorsQuery = useQuery({
    queryKey: ['majors-new', newForm.degree],
    queryFn: () => fetchMajors(newForm.degree ? { degree: newForm.degree } : undefined),
    enabled: createOpen && Boolean(newForm.degree),
  })
  const promoSemestersQuery = useQuery({
    queryKey: ['semesters-promo', promoForm.target_academic_year],
    queryFn: () =>
      fetchSemesters(
        promoForm.target_academic_year
          ? { academic_year: promoForm.target_academic_year }
          : undefined
      ),
    enabled: Boolean(promoteTarget) && Boolean(promoForm.target_academic_year),
  })
  const changeMajorsQuery = useQuery({
    queryKey: ['majors-change', changeForm.degree],
    queryFn: () => fetchMajors(changeForm.degree ? { degree: changeForm.degree } : undefined),
    enabled: Boolean(changeTarget) && Boolean(changeForm.degree),
  })

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await createEnrollmentApi({
        student: Number(newForm.student),
        academic_year: Number(newForm.academic_year),
        semester: newForm.semester ? Number(newForm.semester) : null,
        degree: Number(newForm.degree),
        major: Number(newForm.major),
        year_level: Number(newForm.year_level),
        enrollment_type: newForm.enrollment_type,
        enrollment_date: newForm.enrollment_date,
        status: newForm.status,
        remarks: newForm.remarks,
      })
      setCreateOpen(false)
      showToast(t('enrollments.createdSuccess'), 'success')
      qc.invalidateQueries({ queryKey: ['enrollments'] })
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteTarget) return
    setSubmitting(true)
    setFormError(null)
    try {
      await promoteEnrollmentApi(promoteTarget.id, {
        target_academic_year: Number(promoForm.target_academic_year),
        target_year_level: Number(promoForm.target_year_level),
        target_semester: promoForm.target_semester ? Number(promoForm.target_semester) : null,
        enrollment_type: promoForm.enrollment_type,
        remarks: promoForm.remarks,
      })
      setPromoteTarget(null)
      showToast(t('enrollments.promotedSuccess'), 'success')
      qc.invalidateQueries({ queryKey: ['enrollments'] })
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangeProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changeTarget) return
    setSubmitting(true)
    setFormError(null)
    try {
      await changeProgramApi(changeTarget.id, {
        degree: changeForm.degree ? Number(changeForm.degree) : undefined,
        major: changeForm.major ? Number(changeForm.major) : undefined,
        year_level: changeForm.year_level ? Number(changeForm.year_level) : undefined,
        status: changeForm.status || undefined,
        reason: changeForm.reason,
      })
      setChangeTarget(null)
      showToast(t('enrollments.programChangedSuccess'), 'success')
      qc.invalidateQueries({ queryKey: ['enrollments'] })
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const columns: TableColumn<EnrollmentItem>[] = [
    {
      key: 'reg',
      header: t('enrollments.regNumber'),
      render: (row) => (
        <div>
          <code className="fw-semibold">{row.registration_number}</code>
          <div className="small text-body-secondary">{row.enrollment_date}</div>
        </div>
      ),
    },
    {
      key: 'student',
      header: t('students.colStudent'),
      render: (row) => (
        <div>
          <Link to={`/students/${row.student}`} className="fw-semibold text-decoration-none">
            {row.student_name_en}
          </Link>
          {row.student_name_km && (
            <div className="small text-body-secondary">{row.student_name_km}</div>
          )}
          <code className="small">{row.student_code}</code>
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
      key: 'year',
      header: t('academics.tabYears'),
      render: (row) => (
        <div className="small">
          <div className="fw-medium">{row.academic_year_name}</div>
          {row.semester_name && <div className="text-body-secondary">{row.semester_name}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <div className="d-flex flex-column gap-1 align-items-start">
          <StatusBadge label={row.status} tone={enrollmentStatusTone(row.status)} />
          <span className="small text-body-secondary text-capitalize">
            {row.enrollment_type.replace('_', ' ')}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <PermissionGuard anyOf={['enrollments.promote_enrollment', 'enrollments.add_enrollment']}>
            {row.status === 'active' && (
              <button
                type="button"
                className="btn btn-icon btn-sm btn-label-primary"
                title={t('enrollments.promoteOrReenroll')}
                onClick={() => {
                  setFormError(null)
                  setPromoForm({
                    target_academic_year: '',
                    target_year_level: String(row.year_level),
                    target_semester: '',
                    enrollment_type: 'promotion',
                    remarks: '',
                  })
                  setPromoteTarget(row)
                }}
              >
                <ArrowUpRight size={15} />
              </button>
            )}
          </PermissionGuard>
          <PermissionGuard anyOf={['enrollments.transfer_enrollment', 'enrollments.change_enrollment']}>
            {row.status === 'active' && (
              <button
                type="button"
                className="btn btn-icon btn-sm btn-label-secondary"
                title={t('enrollments.changeProgram')}
                onClick={() => {
                  setFormError(null)
                  setChangeForm({
                    degree: String(row.degree),
                    major: String(row.major),
                    year_level: String(row.year_level),
                    status: '',
                    reason: '',
                  })
                  setChangeTarget(row)
                }}
              >
                <ArrowRightLeft size={15} />
              </button>
            )}
          </PermissionGuard>
          <button
            type="button"
            className="btn btn-icon btn-sm btn-label-secondary"
            title={t('enrollments.viewHistory')}
            onClick={() => setHistoryTarget(row)}
          >
            <History size={15} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('enrollments.pageTitle')}
        subtitle={t('enrollments.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.enrollments') },
        ]}
        actions={
          <PermissionGuard permission="enrollments.add_enrollment">
            <button
              type="button"
              className="btn btn-primary d-inline-flex align-items-center gap-2"
              onClick={() => {
                setFormError(null)
                setCreateOpen(true)
              }}
            >
              <Plus size={16} />
              <span>{t('enrollments.newEnrollment')}</span>
            </button>
          </PermissionGuard>
        }
      />

      <div className="card">
        <div className="card-header d-flex flex-column gap-2">
          <div className="row g-2">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-transparent">
                  <Search size={16} />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder={t('enrollments.searchPlaceholder')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">{t('users.allStatuses')}</option>
                <option value="active">Active</option>
                <option value="promoted">Promoted</option>
                <option value="completed">Completed</option>
                <option value="transferred">Transferred</option>
                <option value="pending">Pending</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
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

        {enrollmentsQuery.isError ? (
          <div className="card-body">
            <ErrorState
              title={t('enrollments.loadError')}
              message={extractApiErrorMessage(enrollmentsQuery.error)}
              onRetry={() => enrollmentsQuery.refetch()}
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={enrollmentsQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={enrollmentsQuery.isLoading}
            page={enrollmentsQuery.data?.page || page}
            totalPages={enrollmentsQuery.data?.total_pages || 1}
            totalCount={enrollmentsQuery.data?.count || 0}
            pageSize={enrollmentsQuery.data?.page_size || 20}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* New Enrollment Modal */}
      <FormModal
        open={createOpen}
        size="lg"
        title={t('enrollments.newEnrollment')}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="new-enrollment-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="new-enrollment-form" onSubmit={handleCreateSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('students.colStudent')} *</label>
            <select
              required
              className="form-select"
              value={newForm.student}
              onChange={(e) => setNewForm({ ...newForm, student: e.target.value })}
            >
              <option value="">--</option>
              {(studentsOptQuery.data?.results || []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.student_code} — {s.full_name_en} {s.full_name_km ? `(${s.full_name_km})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.tabYears')} *</label>
            <select
              required
              className="form-select"
              value={newForm.academic_year}
              onChange={(e) =>
                setNewForm({ ...newForm, academic_year: e.target.value, semester: '' })
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
              value={newForm.semester}
              onChange={(e) => setNewForm({ ...newForm, semester: e.target.value })}
            >
              <option value="">--</option>
              {(newSemestersQuery.data?.results || []).map((s) => (
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
              value={newForm.degree}
              onChange={(e) => setNewForm({ ...newForm, degree: e.target.value, major: '' })}
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
              value={newForm.major}
              onChange={(e) => setNewForm({ ...newForm, major: e.target.value })}
            >
              <option value="">--</option>
              {(newMajorsQuery.data?.results || []).map((m) => (
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
              value={newForm.year_level}
              onChange={(e) => setNewForm({ ...newForm, year_level: e.target.value })}
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
            <label className="form-label">{t('enrollments.enrollmentType')}</label>
            <select
              className="form-select"
              value={newForm.enrollment_type}
              onChange={(e) =>
                setNewForm({ ...newForm, enrollment_type: e.target.value as EnrollmentType })
              }
            >
              <option value="new">New Enrollment</option>
              <option value="re_enrollment">Re-Enrollment</option>
              <option value="transfer_in">Transfer In</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('enrollments.enrollmentDate')} *</label>
            <input
              required
              type="date"
              className="form-control"
              value={newForm.enrollment_date}
              onChange={(e) => setNewForm({ ...newForm, enrollment_date: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={newForm.status}
              onChange={(e) =>
                setNewForm({ ...newForm, status: e.target.value as EnrollmentStatus })
              }
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.notes')}</label>
            <textarea
              rows={2}
              className="form-control"
              value={newForm.remarks}
              onChange={(e) => setNewForm({ ...newForm, remarks: e.target.value })}
            />
          </div>
        </form>
      </FormModal>

      {/* Promote / Re-Enroll Modal */}
      <FormModal
        open={Boolean(promoteTarget)}
        title={t('enrollments.promoteOrReenroll')}
        onClose={() => setPromoteTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setPromoteTarget(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="promote-form" className="btn btn-primary" disabled={submitting}>
              {t('common.confirm')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        {promoteTarget && (
          <div className="alert alert-primary py-2 px-3 small mb-3">
            <strong>{promoteTarget.student_code}</strong> — {promoteTarget.student_name_en} (
            {promoteTarget.academic_year_name} · {promoteTarget.major_code} ·{' '}
            {promoteTarget.year_level_code})
          </div>
        )}
        <form id="promote-form" onSubmit={handlePromoteSubmit} className="row g-3">
          <div className="col-md-6">
            <label className="form-label">{t('enrollments.targetYear')} *</label>
            <select
              required
              className="form-select"
              value={promoForm.target_academic_year}
              onChange={(e) =>
                setPromoForm({ ...promoForm, target_academic_year: e.target.value, target_semester: '' })
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
            <label className="form-label">{t('enrollments.targetYearLevel')} *</label>
            <select
              required
              className="form-select"
              value={promoForm.target_year_level}
              onChange={(e) => setPromoForm({ ...promoForm, target_year_level: e.target.value })}
            >
              <option value="">--</option>
              {(yearLevelsQuery.data?.results || []).map((yl) => (
                <option key={yl.id} value={String(yl.id)}>
                  {isKm && yl.name_km ? yl.name_km : yl.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.tabSemesters')}</label>
            <select
              className="form-select"
              value={promoForm.target_semester}
              onChange={(e) => setPromoForm({ ...promoForm, target_semester: e.target.value })}
            >
              <option value="">--</option>
              {(promoSemestersQuery.data?.results || []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('enrollments.enrollmentType')}</label>
            <select
              className="form-select"
              value={promoForm.enrollment_type}
              onChange={(e) =>
                setPromoForm({
                  ...promoForm,
                  enrollment_type: e.target.value as 'promotion' | 're_enrollment',
                })
              }
            >
              <option value="promotion">Promotion</option>
              <option value="re_enrollment">Re-Enrollment</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.reason')}</label>
            <textarea
              rows={2}
              className="form-control"
              value={promoForm.remarks}
              onChange={(e) => setPromoForm({ ...promoForm, remarks: e.target.value })}
            />
          </div>
        </form>
      </FormModal>

      {/* Change Program / Transfer Modal */}
      <FormModal
        open={Boolean(changeTarget)}
        title={t('enrollments.changeProgram')}
        onClose={() => setChangeTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setChangeTarget(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="change-program-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="change-program-form" onSubmit={handleChangeProgramSubmit} className="row g-3">
          <div className="col-md-6">
            <label className="form-label">{t('academics.degree')}</label>
            <select
              className="form-select"
              value={changeForm.degree}
              onChange={(e) => setChangeForm({ ...changeForm, degree: e.target.value, major: '' })}
            >
              {(degreesQuery.data?.results || []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.major')}</label>
            <select
              required
              className="form-select"
              value={changeForm.major}
              onChange={(e) => setChangeForm({ ...changeForm, major: e.target.value })}
            >
              <option value="">--</option>
              {(changeMajorsQuery.data?.results || []).map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.code} — {m.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.tabYearLevels')}</label>
            <select
              className="form-select"
              value={changeForm.year_level}
              onChange={(e) => setChangeForm({ ...changeForm, year_level: e.target.value })}
            >
              {(yearLevelsQuery.data?.results || []).map((yl) => (
                <option key={yl.id} value={String(yl.id)}>
                  {isKm && yl.name_km ? yl.name_km : yl.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={changeForm.status}
              onChange={(e) =>
                setChangeForm({ ...changeForm, status: e.target.value as '' | EnrollmentStatus })
              }
            >
              <option value="">{t('enrollments.keepCurrentStatus')}</option>
              <option value="active">Active</option>
              <option value="transferred">Transferred</option>
              <option value="suspended">Suspended</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.reason')}</label>
            <textarea
              rows={2}
              className="form-control"
              value={changeForm.reason}
              onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })}
            />
          </div>
        </form>
      </FormModal>

      {/* History Modal */}
      <FormModal
        open={Boolean(historyTarget)}
        size="lg"
        title={
          historyTarget
            ? `${t('enrollments.viewHistory')} — ${historyTarget.registration_number}`
            : ''
        }
        onClose={() => setHistoryTarget(null)}
      >
        {historyTarget && (
          <div className="table-responsive">
            <table className="table align-middle small">
              <thead>
                <tr>
                  <th>{t('enrollments.event')}</th>
                  <th>{t('students.reason')}</th>
                  <th>{t('students.changedBy')}</th>
                  <th>{t('enrollments.date')}</th>
                </tr>
              </thead>
              <tbody>
                {historyTarget.history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <StatusBadge label={h.event_type} tone="primary" />
                    </td>
                    <td>{h.reason || '—'}</td>
                    <td>{h.actor_name || '—'}</td>
                    <td className="text-body-secondary">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormModal>
    </div>
  )
}
