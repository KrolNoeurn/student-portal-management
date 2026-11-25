import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  BarChart3,
  CheckCheck,
  ClipboardCheck,
  Download,
  History,
  Pencil,
  Printer,
  Save,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { AcademicFilterBar, type AcademicFilterValues } from '@/components/AcademicFilterBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormModal } from '@/components/ui/FormModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge, type BadgeTone } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import { fetchSubjects } from '@/features/academics/academicsApi'
import {
  correctAttendanceApi,
  exportAttendanceCsv,
  fetchAttendanceRecords,
  fetchAttendanceSessions,
  fetchAttendanceSummary,
  submitBulkAttendanceApi,
  type AttendanceRecordItem,
  type AttendanceSessionItem,
  type AttendanceStatus,
} from '@/features/attendance/attendanceApi'
import { fetchClasses, fetchClassRoster, fetchClassSubjects } from '@/features/classes/classesApi'

const STATUS_OPTIONS: AttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'excused',
  'permission',
]

export function attendanceTone(status: AttendanceStatus | string): BadgeTone {
  switch (status) {
    case 'present':
      return 'success'
    case 'late':
      return 'warning'
    case 'excused':
    case 'permission':
      return 'info'
    case 'absent':
      return 'danger'
    default:
      return 'secondary'
  }
}

export function AttendancePage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const { showToast } = useToast()
  const qc = useQueryClient()

  const canTake =
    hasPermission('attendance.take_attendance') ||
    hasPermission('attendance.add_attendancesession')

  const [tab, setTab] = useState<'take' | 'history' | 'summary'>(canTake ? 'take' : 'history')

  // Cascading Take Attendance workflow state
  const [cascade, setCascade] = useState<AcademicFilterValues>({})
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessionSlot, setSessionSlot] = useState(1)
  const [topic, setTopic] = useState('')
  const [updateExisting, setUpdateExisting] = useState(false)
  const [marks, setMarks] = useState<
    Record<number, { status: AttendanceStatus; remarks: string }>
  >({})
  const [lastSavedSession, setLastSavedSession] = useState<AttendanceSessionItem | null>(null)
  const [saving, setSaving] = useState(false)

  // History & Summary filters
  const [historyClassFilter, setHistoryClassFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7))
  const [warningsOnly, setWarningsOnly] = useState(false)
  const [inspectSession, setInspectSession] = useState<AttendanceSessionItem | null>(null)
  const [correctTarget, setCorrectTarget] = useState<AttendanceRecordItem | null>(null)
  const [correctForm, setCorrectForm] = useState<{
    status: AttendanceStatus
    reason: string
    remarks: string
  }>({ status: 'excused', reason: '', remarks: '' })

  // Queries for cascading workflow
  const classesQuery = useQuery({
    queryKey: ['attendance-classes', cascade],
    queryFn: () =>
      fetchClasses({
        page_size: 100,
        academic_year: cascade.academicYear || '',
        degree: cascade.degree || '',
        major: cascade.major || '',
      }),
  })

  const classSubjectsQuery = useQuery({
    queryKey: ['attendance-class-subjects', selectedClassId],
    queryFn: () => fetchClassSubjects(selectedClassId),
    enabled: Boolean(selectedClassId),
  })

  const fallbackSubjectsQuery = useQuery({
    queryKey: ['subjects-all'],
    queryFn: () => fetchSubjects({ page_size: 100 }),
    enabled: Boolean(selectedClassId) && (classSubjectsQuery.data?.results.length || 0) === 0,
  })

  const rosterQuery = useQuery({
    queryKey: ['attendance-roster', selectedClassId],
    queryFn: () => fetchClassRoster(selectedClassId, 'active'),
    enabled: tab === 'take' && Boolean(selectedClassId),
  })

  // Initialize marks to 'present' when roster loads
  useEffect(() => {
    const roster = rosterQuery.data || []
    if (roster.length === 0) {
      setMarks({})
      return
    }
    setMarks((prev) => {
      const next: Record<number, { status: AttendanceStatus; remarks: string }> = {}
      for (const m of roster) {
        next[m.student] = prev[m.student] || { status: 'present', remarks: '' }
      }
      return next
    })
  }, [rosterQuery.data])

  const sessionsQuery = useQuery({
    queryKey: ['attendance-sessions', historyClassFilter],
    queryFn: () =>
      fetchAttendanceSessions(
        historyClassFilter ? { class_section: historyClassFilter } : undefined
      ),
    enabled: tab === 'history',
  })

  const inspectRecordsQuery = useQuery({
    queryKey: ['attendance-session-records', inspectSession?.id],
    queryFn: () => fetchAttendanceRecords({ session: inspectSession!.id }),
    enabled: Boolean(inspectSession),
  })

  const summaryQuery = useQuery({
    queryKey: ['attendance-summary', historyClassFilter, monthFilter, warningsOnly],
    queryFn: () =>
      fetchAttendanceSummary({
        class_section: historyClassFilter,
        month: monthFilter,
        warnings_only: warningsOnly ? 'true' : '',
      }),
    enabled: tab === 'summary',
  })

  const setAllStatus = (status: AttendanceStatus) => {
    const roster = rosterQuery.data || []
    const next: Record<number, { status: AttendanceStatus; remarks: string }> = {}
    for (const m of roster) {
      next[m.student] = { status, remarks: marks[m.student]?.remarks || '' }
    }
    setMarks(next)
  }

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault()
    const roster = rosterQuery.data || []
    if (!selectedClassId || !selectedSubjectId || roster.length === 0) return
    setSaving(true)
    try {
      const saved = await submitBulkAttendanceApi({
        class_section: Number(selectedClassId),
        subject: Number(selectedSubjectId),
        session_date: sessionDate,
        session_slot: Number(sessionSlot),
        topic,
        update_existing: updateExisting,
        records: roster.map((m) => ({
          student: m.student,
          status: marks[m.student]?.status || 'present',
          remarks: marks[m.student]?.remarks || '',
        })),
      })
      setLastSavedSession(saved)
      showToast(t('attendance.savedSuccess'), 'success')
      qc.invalidateQueries({ queryKey: ['attendance-sessions'] })
      qc.invalidateQueries({ queryKey: ['attendance-summary'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    } finally {
      setSaving(false)
    }
  }

  const handleCorrectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correctTarget) return
    try {
      await correctAttendanceApi(correctTarget.id, correctForm)
      setCorrectTarget(null)
      showToast(t('attendance.correctedSuccess'), 'success')
      qc.invalidateQueries({ queryKey: ['attendance-session-records', inspectSession?.id] })
      qc.invalidateQueries({ queryKey: ['attendance-sessions'] })
      qc.invalidateQueries({ queryKey: ['attendance-summary'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    }
  }

  const subjectChoices =
    (classSubjectsQuery.data?.results || []).length > 0
      ? (classSubjectsQuery.data?.results || []).map((cs) => ({
          id: cs.subject,
          label: `${cs.subject_code} — ${cs.subject_name_en}`,
        }))
      : (fallbackSubjectsQuery.data?.results || []).map((s) => ({
          id: s.id,
          label: `${s.code} — ${s.name_en}`,
        }))

  return (
    <div>
      <PageHeader
        title={t('attendance.pageTitle')}
        subtitle={t('attendance.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.attendance') },
        ]}
        actions={
          <div className="d-flex gap-2 d-print-none">
            <button
              type="button"
              className="btn btn-label-secondary d-inline-flex align-items-center gap-1"
              onClick={() => window.print()}
            >
              <Printer size={15} />
              <span>{t('attendance.print')}</span>
            </button>
            <PermissionGuard permission="attendance.export_attendance">
              <button
                type="button"
                className="btn btn-label-primary d-inline-flex align-items-center gap-1"
                onClick={async () => {
                  try {
                    await exportAttendanceCsv({
                      class_section: historyClassFilter,
                      month: monthFilter,
                    })
                    showToast(t('attendance.exportStarted'), 'success')
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <Download size={15} />
                <span>{t('attendance.exportExcel')}</span>
              </button>
            </PermissionGuard>
          </div>
        }
      />

      <ul className="nav nav-pills mb-4 gap-2 flex-wrap d-print-none">
        {canTake && (
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                tab === 'take' ? 'active' : ''
              }`}
              onClick={() => setTab('take')}
            >
              <ClipboardCheck size={16} />
              <span>{t('attendance.tabTake')}</span>
            </button>
          </li>
        )}
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link d-inline-flex align-items-center gap-2 ${
              tab === 'history' ? 'active' : ''
            }`}
            onClick={() => setTab('history')}
          >
            <History size={16} />
            <span>{t('attendance.tabHistory')}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link d-inline-flex align-items-center gap-2 ${
              tab === 'summary' ? 'active' : ''
            }`}
            onClick={() => setTab('summary')}
          >
            <BarChart3 size={16} />
            <span>{t('attendance.tabSummary')}</span>
          </button>
        </li>
      </ul>

      {/* 1. Take Attendance Workflow */}
      {tab === 'take' && canTake && (
        <div className="d-flex flex-column gap-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">{t('attendance.selectSessionTitle')}</h6>
            </div>
            <div className="card-body d-flex flex-column gap-3">
              <AcademicFilterBar
                values={cascade}
                onChange={(next) => {
                  setCascade(next)
                  setSelectedClassId('')
                  setSelectedSubjectId('')
                }}
                showYear
                showDegree
                showMajor
              />
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label">{t('classes.colClass')} *</label>
                  <select
                    className="form-select"
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value)
                      setSelectedSubjectId('')
                      setLastSavedSession(null)
                    }}
                  >
                    <option value="">--</option>
                    {(classesQuery.data?.results || []).map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t('subjects.subject')} *</label>
                  <select
                    className="form-select"
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                  >
                    <option value="">--</option>
                    {subjectChoices.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t('attendance.sessionDate')} *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
                <div className="col-md-1">
                  <label className="form-label">{t('attendance.slot')}</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="form-control"
                    value={sessionSlot}
                    onChange={(e) => setSessionSlot(Number(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t('attendance.topic')}</label>
                  <input
                    className="form-control"
                    placeholder={t('attendance.topicPlaceholder')}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {lastSavedSession && (
            <div className="alert alert-success border-0 d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0">
              <div className="fw-medium">
                {t('attendance.sessionStats')}: {lastSavedSession.class_code} ·{' '}
                {lastSavedSession.subject_code} ({lastSavedSession.session_date})
              </div>
              <div className="d-flex flex-wrap gap-2">
                <StatusBadge label={`Present: ${lastSavedSession.present_count}`} tone="success" />
                <StatusBadge label={`Late: ${lastSavedSession.late_count}`} tone="warning" />
                <StatusBadge label={`Absent: ${lastSavedSession.absent_count}`} tone="danger" />
                <StatusBadge label={`Excused: ${lastSavedSession.excused_count}`} tone="info" />
                <StatusBadge label={`Permission: ${lastSavedSession.permission_count}`} tone="primary" />
              </div>
            </div>
          )}

          {selectedClassId && (
            <form onSubmit={handleSaveBulk} className="card">
              <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="fw-semibold">
                    {t('attendance.rosterSheet')} ({(rosterQuery.data || []).length})
                  </span>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-label-primary"
                      onClick={() => setAllStatus('present')}
                    >
                      <CheckCheck size={14} className="me-1" />
                      {t('attendance.markAllPresent')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-label-secondary"
                      onClick={() => setAllStatus('absent')}
                    >
                      {t('attendance.markAllAbsent')}
                    </button>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="form-check form-switch mb-0">
                    <input
                      id="att-update-existing"
                      type="checkbox"
                      className="form-check-input"
                      checked={updateExisting}
                      onChange={(e) => setUpdateExisting(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="att-update-existing">
                      {t('attendance.allowUpdateExisting')}
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary d-inline-flex align-items-center gap-1"
                    disabled={
                      saving || !selectedSubjectId || (rosterQuery.data || []).length === 0
                    }
                  >
                    <Save size={15} />
                    <span>{saving ? t('common.loading') : t('attendance.saveAttendance')}</span>
                  </button>
                </div>
              </div>

              {(rosterQuery.data || []).length === 0 ? (
                <EmptyState title={t('attendance.noEnrolledStudents')} />
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead>
                      <tr>
                        <th>{t('students.studentCode')}</th>
                        <th>{t('students.colStudent')}</th>
                        <th>{t('common.status')}</th>
                        <th>{t('students.notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rosterQuery.data || []).map((m) => {
                        const current = marks[m.student] || { status: 'present', remarks: '' }
                        return (
                          <tr key={m.id}>
                            <td><code>{m.student_code}</code></td>
                            <td>
                              <div className="fw-medium">{m.student_name_en}</div>
                              {m.student_name_km && (
                                <div className="small text-body-secondary">{m.student_name_km}</div>
                              )}
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm flex-wrap" role="group">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    className={`btn text-capitalize ${
                                      current.status === opt
                                        ? 'btn-primary'
                                        : 'btn-outline-secondary'
                                    }`}
                                    onClick={() =>
                                      setMarks((prev) => ({
                                        ...prev,
                                        [m.student]: { ...current, status: opt },
                                      }))
                                    }
                                  >
                                    {t(`attendance.status_${opt}`)}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={{ minWidth: 180 }}>
                              <input
                                className="form-control form-control-sm"
                                value={current.remarks}
                                onChange={(e) =>
                                  setMarks((prev) => ({
                                    ...prev,
                                    [m.student]: { ...current, remarks: e.target.value },
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* 2. Attendance History */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-header">
            <div style={{ maxWidth: 320 }}>
              <select
                className="form-select"
                value={historyClassFilter}
                onChange={(e) => setHistoryClassFilter(e.target.value)}
              >
                <option value="">{t('teachers.allClasses')}</option>
                {(classesQuery.data?.results || []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(sessionsQuery.data?.results || []).length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>{t('attendance.sessionDate')}</th>
                    <th>{t('classes.colClass')}</th>
                    <th>{t('subjects.subject')}</th>
                    <th>{t('attendance.breakdown')}</th>
                    <th className="text-end">{t('users.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(sessionsQuery.data?.results || []).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="fw-semibold">{s.session_date}</div>
                        <div className="small text-body-secondary">Slot #{s.session_slot}</div>
                      </td>
                      <td><code>{s.class_code}</code></td>
                      <td>
                        <code className="me-2">{s.subject_code}</code>
                        {s.subject_name_en}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          <StatusBadge label={`P:${s.present_count}`} tone="success" />
                          <StatusBadge label={`L:${s.late_count}`} tone="warning" />
                          <StatusBadge label={`A:${s.absent_count}`} tone="danger" />
                          <StatusBadge label={`E:${s.excused_count}`} tone="info" />
                          <StatusBadge label={`Pm:${s.permission_count}`} tone="primary" />
                        </div>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-label-primary"
                          onClick={() => setInspectSession(s)}
                        >
                          {t('attendance.inspectRecords')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Summary & Absence Warnings */}
      {tab === 'summary' && (
        <div className="card">
          <div className="card-header">
            <div className="row g-2 align-items-center">
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={historyClassFilter}
                  onChange={(e) => setHistoryClassFilter(e.target.value)}
                >
                  <option value="">{t('teachers.allClasses')}</option>
                  {(classesQuery.data?.results || []).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <input
                  type="month"
                  className="form-control"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <div className="form-check form-switch">
                  <input
                    id="att-warnings-only"
                    type="checkbox"
                    className="form-check-input"
                    checked={warningsOnly}
                    onChange={(e) => setWarningsOnly(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="att-warnings-only">
                    {t('attendance.warningsOnly')} (&lt; {summaryQuery.data?.warning_threshold_percent ?? 80}%)
                  </label>
                </div>
              </div>
              <div className="col-md-2 text-md-end">
                <StatusBadge
                  label={`${t('attendance.warnings')}: ${summaryQuery.data?.warning_count ?? 0}`}
                  tone={(summaryQuery.data?.warning_count ?? 0) > 0 ? 'danger' : 'success'}
                />
              </div>
            </div>
          </div>

          {(summaryQuery.data?.results || []).length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{t('students.colStudent')}</th>
                    <th>{t('attendance.totalSessions')}</th>
                    <th>P / L / A / E / Pm</th>
                    <th>{t('attendance.rate')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(summaryQuery.data?.results || []).map((row) => (
                    <tr key={row.student_id}>
                      <td>
                        <div className="fw-semibold">{row.student_name_en}</div>
                        <code className="small">{row.student_code}</code>
                      </td>
                      <td>{row.total_sessions}</td>
                      <td className="small">
                        {row.present} / {row.late} / {row.absent} / {row.excused} / {row.permission}
                      </td>
                      <td>
                        <span className={`fw-semibold ${row.is_warning ? 'text-danger' : 'text-success'}`}>
                          {row.attendance_rate}%
                        </span>
                      </td>
                      <td>
                        {row.is_warning ? (
                          <span className="badge bg-label-danger d-inline-flex align-items-center gap-1">
                            <AlertTriangle size={13} />
                            {t('attendance.warningBadge')}
                          </span>
                        ) : (
                          <StatusBadge label={t('attendance.goodStanding')} tone="success" />
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

      {/* Session Records & Corrections Modal */}
      <FormModal
        open={Boolean(inspectSession)}
        size="xl"
        title={
          inspectSession
            ? `${inspectSession.class_code} · ${inspectSession.subject_code} (${inspectSession.session_date})`
            : ''
        }
        onClose={() => setInspectSession(null)}
      >
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>{t('students.studentCode')}</th>
                <th>{t('students.colStudent')}</th>
                <th>{t('common.status')}</th>
                <th>{t('students.notes')}</th>
                <th className="text-end" />
              </tr>
            </thead>
            <tbody>
              {(inspectRecordsQuery.data?.results || []).map((rec) => (
                <tr key={rec.id}>
                  <td><code>{rec.student_code}</code></td>
                  <td className="fw-medium">{rec.student_name_en}</td>
                  <td>
                    <StatusBadge label={t(`attendance.status_${rec.status}`)} tone={attendanceTone(rec.status)} />
                  </td>
                  <td className="small">{rec.remarks || '—'}</td>
                  <td className="text-end">
                    <PermissionGuard anyOf={['attendance.correct_attendance', 'attendance.change_attendancerecord']}>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-label-primary"
                        title={t('attendance.correctRecord')}
                        onClick={() => {
                          setCorrectTarget(rec)
                          setCorrectForm({
                            status: rec.status,
                            reason: '',
                            remarks: rec.remarks,
                          })
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    </PermissionGuard>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormModal>

      {/* Correction Modal */}
      <FormModal
        open={Boolean(correctTarget)}
        title={t('attendance.correctRecord')}
        onClose={() => setCorrectTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setCorrectTarget(null)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="correct-att-form" className="btn btn-primary">
              {t('common.save')}
            </button>
          </>
        }
      >
        <form id="correct-att-form" onSubmit={handleCorrectSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={correctForm.status}
              onChange={(e) =>
                setCorrectForm({ ...correctForm, status: e.target.value as AttendanceStatus })
              }
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`attendance.status_${opt}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.reason')} *</label>
            <textarea
              required
              minLength={3}
              rows={2}
              className="form-control"
              value={correctForm.reason}
              onChange={(e) => setCorrectForm({ ...correctForm, reason: e.target.value })}
            />
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.notes')}</label>
            <input
              className="form-control"
              value={correctForm.remarks}
              onChange={(e) => setCorrectForm({ ...correctForm, remarks: e.target.value })}
            />
          </div>
        </form>
      </FormModal>
    </div>
  )
}
