import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Activity,
  Building2,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { fetchApiHealth, fetchBootstrapConfig } from '@/api/systemApi'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, type BadgeTone } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'

interface RoadmapRow {
  id: string
  moduleKey: string
  phase: number
  apiPrefix: string
  status: 'active' | 'planned'
}

const ROADMAP_MODULES: RoadmapRow[] = [
  { id: 'foundation', moduleKey: 'nav.dashboard', phase: 1, apiPrefix: '/api/v1/health/', status: 'active' },
  { id: 'users', moduleKey: 'nav.users', phase: 2, apiPrefix: '/api/v1/auth/, /api/v1/users/, /api/v1/roles/', status: 'active' },
  { id: 'academics', moduleKey: 'nav.academics', phase: 3, apiPrefix: '/api/v1/academic-years/, /degrees/, /majors/', status: 'active' },
  { id: 'subjects', moduleKey: 'nav.subjects', phase: 3, apiPrefix: '/api/v1/subjects/, /api/v1/curricula/', status: 'active' },
  { id: 'students', moduleKey: 'nav.students', phase: 4, apiPrefix: '/api/v1/students/', status: 'active' },
  { id: 'enrollments', moduleKey: 'nav.enrollments', phase: 5, apiPrefix: '/api/v1/enrollments/', status: 'active' },
  { id: 'classes', moduleKey: 'nav.classes', phase: 6, apiPrefix: '/api/v1/classes/, /api/v1/classrooms/', status: 'active' },
  { id: 'teachers', moduleKey: 'nav.teachers', phase: 7, apiPrefix: '/api/v1/teachers/, /api/v1/schedules/', status: 'active' },
  { id: 'attendance', moduleKey: 'nav.attendance', phase: 8, apiPrefix: '/api/v1/attendance/', status: 'planned' },
  { id: 'examinations', moduleKey: 'nav.examinations', phase: 9, apiPrefix: '/api/v1/assessments/, /api/v1/grades/', status: 'planned' },
  { id: 'reports', moduleKey: 'nav.reports', phase: 10, apiPrefix: '/api/v1/reports/, /api/v1/dashboard/', status: 'planned' },
]

export function FoundationOverviewPage() {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()

  const healthQuery = useQuery({
    queryKey: ['api-health'],
    queryFn: fetchApiHealth,
  })

  const bootstrapQuery = useQuery({
    queryKey: ['system-bootstrap'],
    queryFn: fetchBootstrapConfig,
  })

  const schema = useMemo(
    () =>
      z.object({
        institutionName: z.string().min(3, t('foundation.validationNameMin')),
        studentIdPrefix: z
          .string()
          .regex(/^[A-Z]{2,6}$/, t('foundation.validationPrefixFormat')),
        language: z.enum(['en', 'km']),
      }),
    [t]
  )

  type VerificationFormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VerificationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      institutionName: 'University Student Portal',
      studentIdPrefix: 'STU',
      language: i18n.language === 'km' ? 'km' : 'en',
    },
  })

  const handleRefresh = async () => {
    await Promise.all([healthQuery.refetch(), bootstrapQuery.refetch()])
    showToast(t('foundation.toastRefreshed'), 'success')
  }

  const onSubmit = (_data: VerificationFormValues) => {
    showToast(t('foundation.validationSuccess'), 'success')
  }

  const columns: TableColumn<RoadmapRow>[] = [
    {
      key: 'module',
      header: t('foundation.colModule'),
      render: (row) => <span className="fw-medium">{t(row.moduleKey)}</span>,
    },
    {
      key: 'phase',
      header: t('foundation.colPhase'),
      render: (row) => (
        <StatusBadge
          label={`${t('common.phase')} ${row.phase}`}
          tone={row.phase === 1 ? 'primary' : 'secondary'}
        />
      ),
    },
    {
      key: 'api',
      header: t('foundation.colApiPrefix'),
      render: (row) => <code className="small">{row.apiPrefix}</code>,
    },
    {
      key: 'status',
      header: t('foundation.colState'),
      render: (row) => {
        const tone: BadgeTone = row.status === 'active' ? 'success' : 'info'
        return (
          <StatusBadge
            label={row.status === 'active' ? t('common.active') : t('common.planned')}
            tone={tone}
          />
        )
      },
    },
  ]

  const institutionDisplay =
    i18n.language === 'km'
      ? bootstrapQuery.data?.institution.name_km
      : bootstrapQuery.data?.institution.name_en

  return (
    <div>
      <PageHeader
        title={t('foundation.title')}
        subtitle={t('foundation.subtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('foundation.breadcrumbCurrent') },
        ]}
        actions={
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            onClick={handleRefresh}
            disabled={healthQuery.isFetching || bootstrapQuery.isFetching}
          >
            <RefreshCw size={16} className={healthQuery.isFetching ? 'spin' : ''} />
            <span>{t('foundation.refreshHealth')}</span>
          </button>
        }
      />

      {healthQuery.isError && (
        <div className="mb-4">
          <ErrorState
            title={t('foundation.apiErrorTitle')}
            message={`${t('foundation.apiErrorMessage')} (${extractApiErrorMessage(healthQuery.error)})`}
            onRetry={handleRefresh}
          />
        </div>
      )}

      {/* Live API & Environment KPI Cards */}
      <div className="row g-4 mb-4">
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('foundation.apiStatus')}
            value={
              healthQuery.data?.status === 'ok'
                ? t('common.connected')
                : t('common.disconnected')
            }
            subtitle={healthQuery.data?.service || 'student-portal-api'}
            icon={Activity}
            tone={healthQuery.data?.status === 'ok' ? 'success' : 'danger'}
            loading={healthQuery.isLoading}
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('foundation.apiVersion')}
            value={healthQuery.data?.api_version?.toUpperCase() || '—'}
            subtitle="/api/v1/"
            icon={Server}
            tone="primary"
            loading={healthQuery.isLoading}
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('foundation.database')}
            value={healthQuery.data?.database.vendor?.toUpperCase() || '—'}
            subtitle={
              healthQuery.data?.database.connected
                ? t('common.connected')
                : t('common.disconnected')
            }
            icon={Database}
            tone="info"
            loading={healthQuery.isLoading}
          />
        </div>
        <div className="col-sm-6 col-xl-3">
          <StatCard
            title={t('foundation.institution')}
            value={bootstrapQuery.data?.institution.short_name || '—'}
            subtitle={institutionDisplay || '—'}
            icon={Building2}
            tone="warning"
            loading={bootstrapQuery.isLoading}
          />
        </div>
      </div>

      {/* Form Validation & Layout/Language State Preservation Card */}
      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="card-title mb-1">{t('foundation.layoutTestTitle')}</h5>
              <p className="text-body-secondary small mb-0">{t('foundation.layoutTestDesc')}</p>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="mb-3">
                  <label htmlFor="institutionName" className="form-label">
                    {t('foundation.fieldInstitution')}
                  </label>
                  <input
                    id="institutionName"
                    type="text"
                    className={`form-control ${errors.institutionName ? 'is-invalid' : ''}`}
                    placeholder={t('foundation.fieldInstitutionPlaceholder')}
                    {...register('institutionName')}
                  />
                  {errors.institutionName && (
                    <div className="invalid-feedback">{errors.institutionName.message}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="studentIdPrefix" className="form-label">
                    {t('foundation.fieldCodePrefix')}
                  </label>
                  <input
                    id="studentIdPrefix"
                    type="text"
                    className={`form-control ${errors.studentIdPrefix ? 'is-invalid' : ''}`}
                    placeholder={t('foundation.fieldCodePrefixPlaceholder')}
                    {...register('studentIdPrefix')}
                  />
                  {errors.studentIdPrefix && (
                    <div className="invalid-feedback">{errors.studentIdPrefix.message}</div>
                  )}
                </div>

                <div className="mb-4">
                  <label htmlFor="language" className="form-label">
                    {t('foundation.fieldLanguage')}
                  </label>
                  <select id="language" className="form-select" {...register('language')}>
                    <option value="en">English (EN)</option>
                    <option value="km">ភាសាខ្មែរ (KM)</option>
                  </select>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary d-inline-flex align-items-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    <span>{t('foundation.validateForm')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-label-secondary"
                    onClick={() => reset()}
                  >
                    {t('common.reset')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Modular Roadmap Status DataTable */}
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">{t('foundation.roadmapTitle')}</h5>
              <StatusBadge label={t('app.phaseBadge')} tone="primary" />
            </div>
            <DataTable
              columns={columns}
              data={ROADMAP_MODULES}
              rowKey={(row) => row.id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
