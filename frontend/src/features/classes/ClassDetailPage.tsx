import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  LayoutGrid,
  Plus,
  Printer,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormModal } from '@/components/ui/FormModal'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import { fetchSubjects } from '@/features/academics/academicsApi'
import { classStatusTone } from '@/features/classes/ClassesPage'
import { fetchSchedules, fetchTeachingAssignments } from '@/features/teachers/teachersApi'
import {
  addClassSubjectApi,
  assignStudentToClassApi,
  dropClassMembership,
  fetchClassDetail,
  fetchClasses,
  fetchClassRoster,
  fetchClassSubjects,
  fetchClassTransfers,
  fetchEligibleEnrollments,
  removeClassSubjectApi,
  transferStudentClassApi,
  type ClassMembershipItem,
} from '@/features/classes/classesApi'

type ClassTab =
  | 'overview'
  | 'students'
  | 'subjects'
  | 'teachers'
  | 'schedule'
  | 'attendance'
  | 'reports'

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const isKm = i18n.language === 'km'
  const { showToast } = useToast()
  const qc = useQueryClient()

  const [tab, setTab] = useState<ClassTab>('overview')
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedEnrollment, setSelectedEnrollment] = useState('')
  const [transferTarget, setTransferTarget] = useState<ClassMembershipItem | null>(null)
  const [transferClassId, setTransferClassId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [newSubjectId, setNewSubjectId] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const classQuery = useQuery({
    queryKey: ['class-detail', id],
    queryFn: () => fetchClassDetail(id!),
    enabled: Boolean(id),
  })
  const rosterQuery = useQuery({
    queryKey: ['class-roster', id],
    queryFn: () => fetchClassRoster(id!),
    enabled: Boolean(id),
  })
  const classSubjectsQuery = useQuery({
    queryKey: ['class-subjects', id],
    queryFn: () => fetchClassSubjects(id!),
    enabled: Boolean(id),
  })
  const transfersQuery = useQuery({
    queryKey: ['class-transfers', id],
    queryFn: () => fetchClassTransfers(id!),
    enabled: Boolean(id),
  })
  const eligibleQuery = useQuery({
    queryKey: ['class-eligible', id],
    queryFn: () => fetchEligibleEnrollments(id!),
    enabled: assignOpen && Boolean(id),
  })
  const allSubjectsQuery = useQuery({
    queryKey: ['subjects-all'],
    queryFn: () => fetchSubjects({ page_size: 100 }),
    enabled: tab === 'subjects',
  })
  const classTeachersQuery = useQuery({
    queryKey: ['class-teaching-assignments', id],
    queryFn: () => fetchTeachingAssignments({ class_section: id!, status: 'active' }),
    enabled: Boolean(id),
  })
  const classScheduleQuery = useQuery({
    queryKey: ['class-schedules', id],
    queryFn: () => fetchSchedules({ class_section: id! }),
    enabled: Boolean(id),
  })

  const cls = classQuery.data
  const peerClassesQuery = useQuery({
    queryKey: ['peer-classes', cls?.academic_year, cls?.major, cls?.year_level],
    queryFn: () =>
      fetchClasses({
        academic_year: cls!.academic_year,
        degree: cls!.degree,
        major: cls!.major,
        year_level: cls!.year_level,
        page_size: 100,
      }),
    enabled: Boolean(transferTarget && cls),
  })

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['class-detail', id] })
    qc.invalidateQueries({ queryKey: ['class-roster', id] })
    qc.invalidateQueries({ queryKey: ['class-transfers', id] })
    qc.invalidateQueries({ queryKey: ['class-eligible', id] })
  }

  if (classQuery.isLoading) {
    return (
      <div className="card p-4">
        <LoadingSkeleton rows={6} height={24} />
      </div>
    )
  }

  if (classQuery.isError || !cls) {
    return (
      <ErrorState
        title={t('classes.loadError')}
        message={extractApiErrorMessage(classQuery.error)}
        onRetry={() => classQuery.refetch()}
      />
    )
  }

  const roster = rosterQuery.data || []
  const activeRoster = roster.filter((m) => m.status === 'active')
  const utilizationPct = Math.min(100, Math.round((cls.active_student_count / cls.capacity) * 100))

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEnrollment) return
    setSubmitting(true)
    setModalError(null)
    try {
      await assignStudentToClassApi(cls.id, Number(selectedEnrollment))
      setAssignOpen(false)
      setSelectedEnrollment('')
      showToast(t('classes.studentAssigned'), 'success')
      refreshAll()
    } catch (err) {
      setModalError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferTarget || !transferClassId) return
    setSubmitting(true)
    setModalError(null)
    try {
      await transferStudentClassApi(cls.id, {
        membership: transferTarget.id,
        target_class_section: Number(transferClassId),
        reason: transferReason,
      })
      setTransferTarget(null)
      setTransferClassId('')
      setTransferReason('')
      showToast(t('classes.studentTransferred'), 'success')
      refreshAll()
    } catch (err) {
      setModalError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="d-print-none">
        <PageHeader
          title={`${cls.code} — ${cls.name}`}
          subtitle={`${cls.academic_year_name} · ${cls.degree_code} / ${
            isKm && cls.major_name_km ? cls.major_name_km : cls.major_name_en
          } · ${isKm && cls.year_level_name_km ? cls.year_level_name_km : cls.year_level_name_en}`}
          breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t('nav.classes'), to: '/classes' },
            { label: cls.code },
          ]}
          actions={
            <>
              <Link to="/classes" className="btn btn-label-secondary d-inline-flex align-items-center gap-1">
                <ArrowLeft size={15} />
                <span>{t('classes.backToClasses')}</span>
              </Link>
              <button
                type="button"
                className="btn btn-label-secondary d-inline-flex align-items-center gap-1"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>{t('classes.printRoster')}</span>
              </button>
            </>
          }
        />
      </div>

      {/* 7 Required Tabs: Overview, Students, Subjects, Teachers, Schedule, Attendance, Reports */}
      <ul className="nav nav-pills mb-4 gap-2 flex-wrap d-print-none">
        {(
          [
            { id: 'overview', label: t('classes.tabOverview'), icon: LayoutGrid },
            { id: 'students', label: `${t('classes.tabStudents')} (${activeRoster.length})`, icon: Users },
            { id: 'subjects', label: `${t('classes.tabSubjects')} (${classSubjectsQuery.data?.count || 0})`, icon: BookOpen },
            { id: 'teachers', label: t('classes.tabTeachers'), icon: UserCheck },
            { id: 'schedule', label: t('classes.tabSchedule'), icon: CalendarClock },
            { id: 'attendance', label: t('classes.tabAttendance'), icon: ClipboardCheck },
            { id: 'reports', label: t('classes.tabReports'), icon: BarChart3 },
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
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* 1. Overview Tab */}
      {tab === 'overview' && (
        <div className="row g-4">
          <div className="col-sm-6 col-xl-3">
            <StatCard
              title={t('classes.rosterCapacity')}
              value={`${cls.active_student_count} / ${cls.capacity}`}
              subtitle={`${utilizationPct}%`}
              icon={Users}
              tone={utilizationPct >= 100 ? 'warning' : 'primary'}
            />
          </div>
          <div className="col-sm-6 col-xl-3">
            <StatCard
              title={t('classes.tabSubjects')}
              value={cls.subject_count}
              subtitle={cls.academic_year_name}
              icon={BookOpen}
              tone="info"
            />
          </div>
          <div className="col-sm-6 col-xl-3">
            <StatCard
              title={t('classes.classroom')}
              value={cls.classroom_code || '—'}
              subtitle={cls.classroom_name || t('classes.unassigned')}
              icon={LayoutGrid}
              tone="success"
            />
          </div>
          <div className="col-sm-6 col-xl-3">
            <StatCard
              title={t('common.status')}
              value={cls.status.toUpperCase()}
              subtitle={cls.year_level_name_en}
              icon={ClipboardCheck}
              tone={classStatusTone(cls.status)}
            />
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h6 className="mb-0">{t('classes.tabOverview')}</h6>
              </div>
              <div className="card-body">
                <dl className="row mb-0 small">
                  <dt className="col-5 text-body-secondary">{t('academics.code')}</dt>
                  <dd className="col-7"><code>{cls.code}</code></dd>
                  <dt className="col-5 text-body-secondary">{t('academics.tabYears')}</dt>
                  <dd className="col-7">{cls.academic_year_name}</dd>
                  <dt className="col-5 text-body-secondary">{t('academics.degree')}</dt>
                  <dd className="col-7">{cls.degree_code} — {cls.degree_name_en}</dd>
                  <dt className="col-5 text-body-secondary">{t('academics.major')}</dt>
                  <dd className="col-7">{cls.major_code} — {cls.major_name_en}</dd>
                  <dt className="col-5 text-body-secondary">{t('academics.tabYearLevels')}</dt>
                  <dd className="col-7">{cls.year_level_name_en}</dd>
                  <dt className="col-5 text-body-secondary">{t('students.notes')}</dt>
                  <dd className="col-7">{cls.notes || '—'}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h6 className="mb-0">{t('classes.recentTransfers')}</h6>
              </div>
              <div className="card-body">
                {(transfersQuery.data || []).length === 0 ? (
                  <p className="text-body-secondary small mb-0">{t('common.noData')}</p>
                ) : (
                  <ul className="list-group list-group-flush small">
                    {(transfersQuery.data || []).slice(0, 6).map((tr) => (
                      <li key={tr.id} className="list-group-item px-0 bg-transparent">
                        <div className="fw-medium">
                          {tr.student_code} — {tr.student_name_en}
                        </div>
                        <div className="text-body-secondary">
                          {tr.from_class_code} → {tr.to_class_code} ({tr.transfer_date})
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Students Roster Tab */}
      {tab === 'students' && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">
              {t('classes.tabStudents')} ({activeRoster.length} / {cls.capacity})
            </h6>
            <PermissionGuard anyOf={['classes.assign_class_student', 'classes.add_classmembership']}>
              <button
                type="button"
                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 d-print-none"
                onClick={() => {
                  setModalError(null)
                  setAssignOpen(true)
                }}
              >
                <Plus size={15} />
                <span>{t('classes.assignStudent')}</span>
              </button>
            </PermissionGuard>
          </div>

          {roster.length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{t('students.studentCode')}</th>
                    <th>{t('students.colStudent')}</th>
                    <th>{t('enrollments.regNumber')}</th>
                    <th>{t('classes.assignedDate')}</th>
                    <th>{t('common.status')}</th>
                    <th className="text-end d-print-none">{t('users.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((m) => (
                    <tr key={m.id}>
                      <td><code>{m.student_code}</code></td>
                      <td>
                        <Link to={`/students/${m.student}`} className="fw-medium text-decoration-none">
                          {m.student_name_en}
                        </Link>
                        {m.student_name_km && (
                          <div className="small text-body-secondary">{m.student_name_km}</div>
                        )}
                      </td>
                      <td><code className="small">{m.registration_number}</code></td>
                      <td className="small">{m.assigned_date}</td>
                      <td>
                        <StatusBadge
                          label={m.status}
                          tone={m.status === 'active' ? 'success' : m.status === 'transferred' ? 'warning' : 'secondary'}
                        />
                      </td>
                      <td className="text-end d-print-none">
                        {m.status === 'active' && (
                          <div className="d-inline-flex gap-1">
                            <PermissionGuard anyOf={['classes.transfer_class_student', 'classes.change_classmembership']}>
                              <button
                                type="button"
                                className="btn btn-icon btn-sm btn-label-primary"
                                title={t('classes.transferStudent')}
                                onClick={() => {
                                  setModalError(null)
                                  setTransferTarget(m)
                                }}
                              >
                                <ArrowRightLeft size={15} />
                              </button>
                            </PermissionGuard>
                            <PermissionGuard permission="classes.delete_classmembership">
                              <button
                                type="button"
                                className="btn btn-icon btn-sm btn-label-secondary"
                                title={t('classes.dropStudent')}
                                onClick={async () => {
                                  await dropClassMembership(m.id)
                                  showToast(t('academics.deletedSuccess'), 'warning')
                                  refreshAll()
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </PermissionGuard>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Subjects Tab */}
      {tab === 'subjects' && (
        <div className="card">
          <div className="card-body">
            <PermissionGuard permission="classes.add_classsubject">
              <form
                className="row g-2 align-items-end mb-4 pb-3 border-bottom"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newSubjectId) return
                  try {
                    await addClassSubjectApi({
                      class_section: cls.id,
                      subject: Number(newSubjectId),
                      semester: cls.semester,
                    })
                    setNewSubjectId('')
                    qc.invalidateQueries({ queryKey: ['class-subjects', id] })
                    qc.invalidateQueries({ queryKey: ['class-detail', id] })
                    showToast(t('academics.savedSuccess'), 'success')
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <div className="col-md-8">
                  <label className="form-label">{t('subjects.subject')}</label>
                  <select
                    required
                    className="form-select"
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                  >
                    <option value="">--</option>
                    {(allSubjectsQuery.data?.results || []).map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.code} — {s.name_en} ({s.credits} cr)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <button type="submit" className="btn btn-primary w-100">
                    <Plus size={15} className="me-1" />
                    {t('academics.addNew')}
                  </button>
                </div>
              </form>
            </PermissionGuard>

            {(classSubjectsQuery.data?.results || []).length === 0 ? (
              <EmptyState title={t('common.noData')} />
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>{t('academics.code')}</th>
                      <th>{t('subjects.subject')}</th>
                      <th>{t('subjects.credits')}</th>
                      <th>{t('common.status')}</th>
                      <th className="text-end" />
                    </tr>
                  </thead>
                  <tbody>
                    {(classSubjectsQuery.data?.results || []).map((cs) => (
                      <tr key={cs.id}>
                        <td><code>{cs.subject_code}</code></td>
                        <td className="fw-medium">
                          {isKm && cs.subject_name_km ? cs.subject_name_km : cs.subject_name_en}
                        </td>
                        <td><StatusBadge label={cs.subject_credits} tone="primary" /></td>
                        <td><StatusBadge label={cs.status} tone="success" /></td>
                        <td className="text-end">
                          <PermissionGuard permission="classes.delete_classsubject">
                            <button
                              type="button"
                              className="btn btn-icon btn-sm btn-label-secondary"
                              onClick={async () => {
                                await removeClassSubjectApi(cs.id)
                                qc.invalidateQueries({ queryKey: ['class-subjects', id] })
                                qc.invalidateQueries({ queryKey: ['class-detail', id] })
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </PermissionGuard>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Teachers Tab (Live Teaching Assignments) */}
      {tab === 'teachers' && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">{t('classes.tabTeachers')}</h6>
            <Link to="/teachers" className="btn btn-sm btn-label-primary">
              {t('nav.teachers')}
            </Link>
          </div>
          {(classTeachersQuery.data?.results || []).length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{t('teachers.colTeacher')}</th>
                    <th>{t('subjects.subject')}</th>
                    <th>{t('teachers.role')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(classTeachersQuery.data?.results || []).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="fw-medium">{a.teacher_name_en}</div>
                        <code className="small">{a.teacher_code}</code>
                      </td>
                      <td>
                        <code className="me-2">{a.subject_code}</code>
                        {a.subject_name_en}
                      </td>
                      <td><StatusBadge label={a.role} tone="primary" /></td>
                      <td><StatusBadge label={a.status} tone="success" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Schedule Tab (Live Weekly Timetable) */}
      {tab === 'schedule' && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">{t('classes.tabSchedule')}</h6>
            <Link to="/teachers" className="btn btn-sm btn-label-primary">
              {t('teachers.tabSchedule')}
            </Link>
          </div>
          {(classScheduleQuery.data?.results || []).length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{t('teachers.dayOfWeek')}</th>
                    <th>{t('teachers.startTime')}</th>
                    <th>{t('subjects.subject')}</th>
                    <th>{t('teachers.colTeacher')}</th>
                    <th>{t('classes.classroom')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(classScheduleQuery.data?.results || []).map((s) => (
                    <tr key={s.id}>
                      <td className="fw-semibold">{s.day_name}</td>
                      <td>
                        <code>
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        </code>
                      </td>
                      <td>
                        <code className="me-2">{s.subject_code}</code>
                        {s.subject_name_en}
                      </td>
                      <td>{s.teacher_name_en}</td>
                      <td><StatusBadge label={s.classroom_code} tone="info" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Attendance Tab (Connected in Phase 8) */}
      {tab === 'attendance' && (
        <div className="card">
          <EmptyState
            title={t('classes.tabAttendance')}
            description={t('classes.phase8Ready')}
          />
        </div>
      )}

      {/* 7. Reports Tab */}
      {tab === 'reports' && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">{t('classes.tabReports')}</h6>
            <button
              type="button"
              className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
              onClick={() => window.print()}
            >
              <Printer size={15} />
              <span>{t('classes.printRoster')}</span>
            </button>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <div className="p-3 rounded border" style={{ borderColor: 'var(--vx-border)' }}>
                  <div className="small text-body-secondary">{t('classes.activeStudents')}</div>
                  <div className="fs-4 fw-bold">{activeRoster.length}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 rounded border" style={{ borderColor: 'var(--vx-border)' }}>
                  <div className="small text-body-secondary">{t('classes.capacityUtilization')}</div>
                  <div className="fs-4 fw-bold">{utilizationPct}%</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 rounded border" style={{ borderColor: 'var(--vx-border)' }}>
                  <div className="small text-body-secondary">{t('classes.recentTransfers')}</div>
                  <div className="fs-4 fw-bold">{(transfersQuery.data || []).length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Enrolled Student Modal */}
      <FormModal
        open={assignOpen}
        title={t('classes.assignStudent')}
        onClose={() => setAssignOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setAssignOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="assign-student-form" className="btn btn-primary" disabled={submitting}>
              {t('common.confirm')}
            </button>
          </>
        }
      >
        {modalError && <div className="alert alert-danger py-2 px-3 small mb-3">{modalError}</div>}
        <form id="assign-student-form" onSubmit={handleAssignSubmit}>
          <label className="form-label">{t('classes.eligibleStudents')} *</label>
          <select
            required
            className="form-select"
            value={selectedEnrollment}
            onChange={(e) => setSelectedEnrollment(e.target.value)}
          >
            <option value="">--</option>
            {(eligibleQuery.data || []).map((enr) => (
              <option key={enr.id} value={String(enr.id)}>
                {enr.student_code} — {enr.student_name_en} ({enr.registration_number})
              </option>
            ))}
          </select>
          <div className="form-text small">{t('classes.eligibleHint')}</div>
        </form>
      </FormModal>

      {/* Transfer Student Modal */}
      <FormModal
        open={Boolean(transferTarget)}
        title={t('classes.transferStudent')}
        onClose={() => setTransferTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setTransferTarget(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="transfer-student-form" className="btn btn-primary" disabled={submitting}>
              {t('common.confirm')}
            </button>
          </>
        }
      >
        {modalError && <div className="alert alert-danger py-2 px-3 small mb-3">{modalError}</div>}
        {transferTarget && (
          <div className="alert alert-primary py-2 px-3 small mb-3">
            <strong>{transferTarget.student_code}</strong> — {transferTarget.student_name_en}
          </div>
        )}
        <form id="transfer-student-form" onSubmit={handleTransferSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('classes.targetClass')} *</label>
            <select
              required
              className="form-select"
              value={transferClassId}
              onChange={(e) => setTransferClassId(e.target.value)}
            >
              <option value="">--</option>
              {(peerClassesQuery.data?.results || [])
                .filter((c) => c.id !== cls.id)
                .map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.code} — {c.name} ({c.active_student_count}/{c.capacity})
                  </option>
                ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.reason')}</label>
            <textarea
              rows={2}
              className="form-control"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
            />
          </div>
        </form>
      </FormModal>
    </div>
  )
}
