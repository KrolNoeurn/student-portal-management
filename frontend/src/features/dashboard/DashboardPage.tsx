import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Award,
  BookOpen,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Layers,
  RefreshCw,
  School,
  UserCheck,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, type BadgeTone } from '@/components/ui/StatusBadge'
import {
  fetchDashboard,
  type AdminDashboardPayload,
  type AttendanceOverviewStats,
  type CountItem,
  type InstructorDashboardPayload,
  type StudentDashboardPayload,
} from '@/features/dashboard/dashboardApi'

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
    case 'present':
      return 'success'
    case 'graduated':
    case 'late':
      return 'info'
    case 'suspended':
    case 'deferred':
    case 'excused':
    case 'permission':
      return 'warning'
    case 'dropped':
    case 'absent':
    case 'transferred':
      return 'danger'
    default:
      return 'secondary'
  }
}

function ProgressListCard({
  title,
  items,
  tone = 'primary',
}: {
  title: string
  items: CountItem[]
  tone?: 'primary' | 'info' | 'success' | 'warning'
}) {
  const { t } = useTranslation()
  const maxVal = Math.max(1, ...items.map((i) => i.count))

  return (
    <div className="card h-100">
      <div className="card-header">
        <h6 className="card-title mb-0">{title}</h6>
      </div>
      <div className="card-body">
        {items.length === 0 ? (
          <EmptyState title={t('common.noData')} />
        ) : (
          <div className="d-flex flex-column gap-3">
            {items.map((item, idx) => {
              const pct = Math.round((item.count / maxVal) * 100)
              return (
                <div key={`${item.code || item.label}-${idx}`}>
                  <div className="d-flex justify-content-between align-items-center small mb-1">
                    <span className="fw-medium text-truncate pe-2">
                      {item.code ? (
                        <span className="badge bg-label-secondary me-2">{item.code}</span>
                      ) : null}
                      {item.label}
                    </span>
                    <span className="fw-semibold">{item.count}</span>
                  </div>
                  <div className="progress" style={{ height: 7 }}>
                    <div
                      className={`progress-bar bg-${tone}`}
                      role="progressbar"
                      style={{ width: `${pct}%` }}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AttendanceSummaryCard({
  attendance,
  title,
}: {
  attendance: AttendanceOverviewStats
  title: string
}) {
  const { t } = useTranslation()
  const total = Math.max(1, attendance.total)
  const items = [
    { key: 'present', label: t('attendance.status_present'), value: attendance.present, tone: 'success' as const },
    { key: 'late', label: t('attendance.status_late'), value: attendance.late, tone: 'info' as const },
    { key: 'excused', label: t('attendance.status_excused'), value: attendance.excused, tone: 'warning' as const },
    { key: 'permission', label: t('attendance.status_permission'), value: attendance.permission, tone: 'secondary' as const },
    { key: 'absent', label: t('attendance.status_absent'), value: attendance.absent, tone: 'danger' as const },
  ]

  return (
    <div className="card h-100">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h6 className="card-title mb-0">{title}</h6>
        <StatusBadge
          label={`${attendance.attendance_rate}%`}
          tone={attendance.attendance_rate >= 80 ? 'success' : attendance.total === 0 ? 'secondary' : 'warning'}
        />
      </div>
      <div className="card-body">
        <div className="d-flex align-items-baseline justify-content-between mb-3">
          <div>
            <div className="fs-4 fw-bold">{attendance.attendance_rate}%</div>
            <div className="small text-body-secondary">
              {t('dashboard.attendanceRecordsCount', { count: attendance.total })}
            </div>
          </div>
          <div className="progress flex-grow-1 ms-3" style={{ height: 10, maxWidth: 220 }}>
            <div
              className="progress-bar bg-success"
              style={{ width: `${Math.min(100, attendance.attendance_rate)}%` }}
            />
          </div>
        </div>
        <div className="row g-2">
          {items.map((item) => {
            const pct = attendance.total > 0 ? Math.round((item.value / total) * 100) : 0
            return (
              <div key={item.key} className="col-6 col-sm-4">
                <div className="p-2 rounded border d-flex flex-column gap-1">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="small text-body-secondary">{item.label}</span>
                    <StatusBadge label={String(item.value)} tone={item.tone} />
                  </div>
                  <div className="progress" style={{ height: 4 }}>
                    <div className={`progress-bar bg-${item.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AdminOrAcademicDashboard({ data }: { data: AdminDashboardPayload }) {
  const { t } = useTranslation()
  const isOfficer = data.dashboard_type === 'academic_officer'

  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.totalStudents')}
            value={data.kpis.total_students}
            subtitle={t('dashboard.activeCount', { count: data.kpis.active_students })}
            icon={GraduationCap}
            tone="primary"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.activeEnrollments')}
            value={data.kpis.active_enrollments}
            subtitle={t('dashboard.academicYearsCount', { count: data.kpis.total_academic_years })}
            icon={UserCheck}
            tone="success"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.totalClasses')}
            value={data.kpis.total_classes}
            subtitle={t('dashboard.degreesMajorsCount', {
              degrees: data.kpis.total_degrees,
              majors: data.kpis.total_majors,
            })}
            icon={School}
            tone="info"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.totalTeachers')}
            value={data.kpis.total_teachers}
            subtitle={`${t('dashboard.attendanceRate')}: ${data.attendance.attendance_rate}%`}
            icon={Users}
            tone="warning"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <ProgressListCard
            title={t('dashboard.enrollmentByYear')}
            items={data.enrollment_by_year}
            tone="primary"
          />
        </div>
        <div className="col-lg-6">
          <AttendanceSummaryCard
            attendance={data.attendance}
            title={t('dashboard.attendanceOverview')}
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-5">
          <ProgressListCard
            title={t('dashboard.studentsByMajor')}
            items={data.students_by_major}
            tone="info"
          />
        </div>
        <div className="col-lg-4">
          <ProgressListCard
            title={t('dashboard.studentsByDegree')}
            items={data.students_by_degree}
            tone="success"
          />
        </div>
        <div className="col-lg-3">
          <div className="card h-100">
            <div className="card-header">
              <h6 className="card-title mb-0">{t('dashboard.studentsByStatus')}</h6>
            </div>
            <div className="card-body">
              {data.students_by_status.length === 0 ? (
                <EmptyState title={t('common.noData')} />
              ) : (
                <div className="d-flex flex-column gap-2">
                  {data.students_by_status.map((item) => (
                    <div
                      key={item.status}
                      className="d-flex align-items-center justify-content-between p-2 rounded border"
                    >
                      <StatusBadge label={item.status} tone={statusTone(item.status)} />
                      <span className="fw-semibold">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isOfficer && data.class_distribution && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="card-title mb-0">{t('dashboard.classDistribution')}</h6>
            <Link to="/classes" className="btn btn-sm btn-label-primary">
              {t('nav.classes')}
            </Link>
          </div>
          <div className="card-body">
            {data.class_distribution.length === 0 ? (
              <EmptyState title={t('common.noData')} />
            ) : (
              <div className="row g-3">
                {data.class_distribution.map((cls) => {
                  const pct = cls.capacity > 0 ? Math.min(100, Math.round((cls.active_students / cls.capacity) * 100)) : 0
                  return (
                    <div key={cls.id} className="col-md-6">
                      <div className="d-flex justify-content-between small mb-1">
                        <Link to={`/classes/${cls.id}`} className="fw-semibold text-decoration-none">
                          {cls.code} — {cls.name}
                        </Link>
                        <span>
                          {cls.active_students} / {cls.capacity} ({pct}%)
                        </span>
                      </div>
                      <div className="progress" style={{ height: 7 }}>
                        <div
                          className={`progress-bar bg-${pct >= 95 ? 'danger' : pct >= 75 ? 'warning' : 'primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!isOfficer && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <Activity size={17} className="text-primary" />
              <h6 className="card-title mb-0">{t('dashboard.recentActivities')}</h6>
            </div>
            <Link to="/settings" className="btn btn-sm btn-label-secondary">
              {t('settings.tabAudit')}
            </Link>
          </div>
          <div className="table-responsive">
            {data.recent_activities.length === 0 ? (
              <div className="p-4">
                <EmptyState title={t('common.noData')} />
              </div>
            ) : (
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('settings.colTimestamp')}</th>
                    <th>{t('settings.colActor')}</th>
                    <th>{t('settings.colModule')}</th>
                    <th>{t('settings.colAction')}</th>
                    <th>{t('settings.colTarget')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_activities.map((item) => (
                    <tr key={item.id}>
                      <td className="small text-body-secondary text-nowrap">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="fw-medium">{item.actor}</td>
                      <td>
                        <span className="badge bg-label-secondary">{item.module}</span>
                      </td>
                      <td>
                        <span className="badge bg-label-primary">{item.action}</span>
                      </td>
                      <td className="small">{item.object_repr || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InstructorDashboard({ data }: { data: InstructorDashboardPayload }) {
  const { t } = useTranslation()
  return (
    <div className="d-flex flex-column gap-4">
      <div className="row g-3">
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.assignedClasses')}
            value={data.kpis.assigned_classes}
            icon={School}
            tone="primary"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.assignedSubjects')}
            value={data.kpis.assigned_subjects}
            icon={BookOpen}
            tone="info"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.totalStudents')}
            value={data.kpis.total_students}
            icon={GraduationCap}
            tone="success"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.attendanceSessionsTaken')}
            value={data.kpis.attendance_sessions_taken}
            icon={ClipboardCheck}
            tone="warning"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="card-title mb-0">{t('dashboard.myAssignedClasses')}</h6>
              <Link to="/attendance" className="btn btn-sm btn-label-primary">
                {t('nav.attendance')}
              </Link>
            </div>
            <div className="table-responsive">
              {data.assigned_classes_list.length === 0 ? (
                <div className="p-4">
                  <EmptyState title={t('common.noData')} />
                </div>
              ) : (
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{t('classes.colClass')}</th>
                      <th>{t('subjects.subject')}</th>
                      <th>{t('academics.yearName')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assigned_classes_list.map((row, idx) => (
                      <tr key={`${row.id}-${row.subject_code}-${idx}`}>
                        <td>
                          <Link to={`/classes/${row.id}`} className="fw-semibold text-decoration-none">
                            {row.class_code}
                          </Link>
                          <div className="small text-body-secondary">{row.class_name}</div>
                        </td>
                        <td>
                          <span className="badge bg-label-info me-1">{row.subject_code}</span>
                          <span className="small">{row.subject_name}</span>
                        </td>
                        <td className="small">{row.academic_year}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <h6 className="card-title mb-0">{t('dashboard.teachingSchedule')}</h6>
              </div>
              <Link to="/teachers" className="btn btn-sm btn-label-secondary">
                {t('teachers.tabSchedule')}
              </Link>
            </div>
            <div className="card-body">
              {data.schedules.length === 0 ? (
                <EmptyState title={t('common.noData')} />
              ) : (
                <div className="d-flex flex-column gap-2">
                  {data.schedules.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-2 rounded border d-flex justify-content-between align-items-center gap-2"
                    >
                      <div>
                        <div className="fw-semibold small">
                          {slot.day_name} · {slot.start_time} – {slot.end_time}
                        </div>
                        <div className="small text-body-secondary">
                          {slot.subject_code} — {slot.subject_name} ({slot.class_code})
                        </div>
                      </div>
                      <span className="badge bg-label-primary">{slot.classroom_code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentDashboard({ data }: { data: StudentDashboardPayload }) {
  const { t, i18n } = useTranslation()
  const isKm = i18n.language === 'km'

  return (
    <div className="d-flex flex-column gap-4">
      {data.profile && (
        <div className="card">
          <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-label-primary">{data.profile.student_code}</span>
                <StatusBadge label={data.profile.status} tone={statusTone(data.profile.status)} />
              </div>
              <h5 className="mb-1">
                {isKm && data.profile.full_name_km
                  ? data.profile.full_name_km
                  : data.profile.full_name_en}
              </h5>
              {data.enrollment ? (
                <div className="small text-body-secondary">
                  {data.enrollment.degree} · {data.enrollment.major} · {data.enrollment.year_level} ·{' '}
                  {data.enrollment.academic_year} · {t('classes.colClass')}:{' '}
                  <strong>{data.enrollment.class_code}</strong>
                </div>
              ) : (
                <div className="small text-body-secondary">{t('dashboard.noActiveEnrollment')}</div>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link to={`/students/${data.profile.id}`} className="btn btn-sm btn-label-primary">
                {t('students.viewProfile')}
              </Link>
              <Link to="/examinations" className="btn btn-sm btn-primary">
                {t('exams.tabTranscript')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('exams.cumulativeGpa')}
            value={data.transcript_summary.cumulative_gpa}
            icon={Award}
            tone="primary"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('exams.creditsEarned')}
            value={data.transcript_summary.credits_earned}
            icon={Layers}
            tone="success"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.publishedSubjects')}
            value={data.transcript_summary.subjects_count}
            icon={CheckCircle2}
            tone="info"
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('dashboard.attendanceRate')}
            value={`${data.attendance.attendance_rate}%`}
            icon={CalendarRange}
            tone={data.attendance.attendance_rate >= 80 ? 'success' : 'warning'}
          />
        </div>
      </div>

      <AttendanceSummaryCard
        attendance={data.attendance}
        title={t('dashboard.myAttendanceSummary')}
      />
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  })

  const personaSubtitle = (() => {
    switch (dashboardQuery.data?.dashboard_type) {
      case 'admin':
        return t('dashboard.subtitleAdmin')
      case 'academic_officer':
        return t('dashboard.subtitleAcademic')
      case 'instructor':
        return t('dashboard.subtitleInstructor')
      case 'student':
        return t('dashboard.subtitleStudent')
      default:
        return t('dashboard.subtitleDefault')
    }
  })()

  return (
    <div>
      <PageHeader
        title={t('nav.dashboard')}
        subtitle={personaSubtitle}
        breadcrumbs={[{ label: t('foundation.breadcrumbHome') }, { label: t('nav.dashboard') }]}
        actions={
          <button
            type="button"
            className="btn btn-label-primary d-inline-flex align-items-center gap-2"
            onClick={() => dashboardQuery.refetch()}
            disabled={dashboardQuery.isFetching}
          >
            <RefreshCw size={15} className={dashboardQuery.isFetching ? 'vx-spin' : ''} />
            <span>{t('dashboard.refresh')}</span>
          </button>
        }
      />

      {dashboardQuery.isLoading ? (
        <div className="card">
          <div className="card-body">
            <LoadingSkeleton rows={6} height={28} />
          </div>
        </div>
      ) : dashboardQuery.isError || !dashboardQuery.data ? (
        <ErrorState
          title={t('dashboard.loadError')}
          onRetry={() => dashboardQuery.refetch()}
        />
      ) : dashboardQuery.data.dashboard_type === 'instructor' ? (
        <InstructorDashboard data={dashboardQuery.data} />
      ) : dashboardQuery.data.dashboard_type === 'student' ? (
        <StudentDashboard data={dashboardQuery.data} />
      ) : (
        <AdminOrAcademicDashboard data={dashboardQuery.data} />
      )}
    </div>
  )
}
