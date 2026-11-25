import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ListChecks, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { FormModal } from '@/components/ui/FormModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import {
  addCurriculumSubject,
  deleteCurriculum,
  deleteCurriculumSubject,
  deleteSubject,
  fetchAcademicYears,
  fetchCurricula,
  fetchCurriculumSubjects,
  fetchDegrees,
  fetchMajors,
  fetchSubjects,
  fetchYearLevels,
  saveCurriculum,
  saveSubject,
  type Curriculum,
  type CurriculumSubject,
  type Subject,
} from '@/features/academics/academicsApi'

export function SubjectsCurriculumPage() {
  const { t, i18n } = useTranslation()
  const isKm = i18n.language === 'km'
  const { showToast } = useToast()
  const qc = useQueryClient()

  const [tab, setTab] = useState<'subjects' | 'curricula'>('subjects')
  const [search, setSearch] = useState('')
  const [degreeFilter, setDegreeFilter] = useState('')

  // Subject modal state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name_en: '',
    name_km: '',
    credits: '3.0',
    theory_hours: 30,
    practical_hours: 15,
    description: '',
    status: 'active',
  })

  // Curriculum modal state
  const [currModalOpen, setCurrModalOpen] = useState(false)
  const [editingCurr, setEditingCurr] = useState<Curriculum | null>(null)
  const [currForm, setCurrForm] = useState({
    degree: '',
    major: '',
    version: '',
    effective_academic_year: '',
    description: '',
    status: 'active',
  })

  // Curriculum Subject Builder drawer/modal
  const [selectedCurr, setSelectedCurr] = useState<Curriculum | null>(null)
  const [csForm, setCsForm] = useState({
    subject: '',
    year_level: '',
    semester_number: 1,
    is_required: true,
    prerequisite_subject: '',
  })

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const subjectsQuery = useQuery({
    queryKey: ['subjects', search],
    queryFn: () => fetchSubjects(search.trim() ? { search: search.trim() } : undefined),
  })

  const allSubjectsQuery = useQuery({
    queryKey: ['subjects-all'],
    queryFn: () => fetchSubjects({ page_size: 100 }),
  })

  const curriculaQuery = useQuery({
    queryKey: ['curricula', degreeFilter],
    queryFn: () => fetchCurricula(degreeFilter ? { degree: degreeFilter } : undefined),
  })

  const degreesQuery = useQuery({
    queryKey: ['degrees'],
    queryFn: () => fetchDegrees(),
  })

  const majorsForFormQuery = useQuery({
    queryKey: ['majors-for-curr', currForm.degree],
    queryFn: () => fetchMajors(currForm.degree ? { degree: currForm.degree } : undefined),
  })

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => fetchAcademicYears(),
  })

  const yearLevelsQuery = useQuery({
    queryKey: ['year-levels'],
    queryFn: () => fetchYearLevels({ status: 'active' }),
  })

  const currItemsQuery = useQuery({
    queryKey: ['curriculum-subjects', selectedCurr?.id],
    queryFn: () => fetchCurriculumSubjects(selectedCurr!.id),
    enabled: Boolean(selectedCurr),
  })

  const openSubjectModal = (subj: Subject | null) => {
    setFormError(null)
    setEditingSubject(subj)
    if (subj) {
      setSubjectForm({
        code: subj.code,
        name_en: subj.name_en,
        name_km: subj.name_km,
        credits: subj.credits,
        theory_hours: subj.theory_hours,
        practical_hours: subj.practical_hours,
        description: subj.description,
        status: subj.status,
      })
    } else {
      setSubjectForm({
        code: '',
        name_en: '',
        name_km: '',
        credits: '3.0',
        theory_hours: 30,
        practical_hours: 15,
        description: '',
        status: 'active',
      })
    }
    setSubjectModalOpen(true)
  }

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await saveSubject(
        {
          ...subjectForm,
          theory_hours: Number(subjectForm.theory_hours),
          practical_hours: Number(subjectForm.practical_hours),
          status: subjectForm.status as 'active' | 'inactive',
        },
        editingSubject?.id
      )
      setSubjectModalOpen(false)
      qc.invalidateQueries({ queryKey: ['subjects'] })
      qc.invalidateQueries({ queryKey: ['subjects-all'] })
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openCurrModal = (curr: Curriculum | null) => {
    setFormError(null)
    setEditingCurr(curr)
    if (curr) {
      setCurrForm({
        degree: String(curr.degree),
        major: String(curr.major),
        version: curr.version,
        effective_academic_year: curr.effective_academic_year
          ? String(curr.effective_academic_year)
          : '',
        description: curr.description,
        status: curr.status,
      })
    } else {
      setCurrForm({
        degree: String(degreesQuery.data?.results[0]?.id || ''),
        major: '',
        version: '2026-v1',
        effective_academic_year: '',
        description: '',
        status: 'active',
      })
    }
    setCurrModalOpen(true)
  }

  const handleSaveCurriculum = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await saveCurriculum(
        {
          degree: Number(currForm.degree),
          major: Number(currForm.major),
          version: currForm.version,
          effective_academic_year: currForm.effective_academic_year
            ? Number(currForm.effective_academic_year)
            : null,
          description: currForm.description,
          status: currForm.status as 'draft' | 'active' | 'archived',
        },
        editingCurr?.id
      )
      setCurrModalOpen(false)
      qc.invalidateQueries({ queryKey: ['curricula'] })
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddCurrSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCurr) return
    setSubmitting(true)
    setFormError(null)
    try {
      await addCurriculumSubject({
        curriculum: selectedCurr.id,
        subject: Number(csForm.subject),
        year_level: Number(csForm.year_level),
        semester_number: Number(csForm.semester_number),
        is_required: csForm.is_required,
        prerequisite_subject: csForm.prerequisite_subject
          ? Number(csForm.prerequisite_subject)
          : null,
      })
      setCsForm({
        subject: '',
        year_level: csForm.year_level,
        semester_number: csForm.semester_number,
        is_required: true,
        prerequisite_subject: '',
      })
      qc.invalidateQueries({ queryKey: ['curriculum-subjects', selectedCurr.id] })
      qc.invalidateQueries({ queryKey: ['curricula'] })
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      setFormError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const subjectColumns: TableColumn<Subject>[] = [
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
      key: 'credits',
      header: t('subjects.credits'),
      render: (row) => <StatusBadge label={row.credits} tone="primary" />,
    },
    {
      key: 'hours',
      header: t('subjects.hours'),
      render: (row) => (
        <span className="small">
          {row.theory_hours}T / {row.practical_hours}P ({row.total_hours}h)
        </span>
      ),
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
          <PermissionGuard permission="subjects.change_subject">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-primary"
              onClick={() => openSubjectModal(row)}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="subjects.delete_subject">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={async () => {
                try {
                  await deleteSubject(row.id)
                  qc.invalidateQueries({ queryKey: ['subjects'] })
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

  const curriculumColumns: TableColumn<Curriculum>[] = [
    {
      key: 'program',
      header: t('subjects.program'),
      render: (row) => (
        <div>
          <div className="fw-semibold">
            {row.major_code} — {isKm && row.major_name_km ? row.major_name_km : row.major_name_en}
          </div>
          <div className="small text-body-secondary">
            {row.degree_code} — {isKm && row.degree_name_km ? row.degree_name_km : row.degree_name_en}
          </div>
        </div>
      ),
    },
    {
      key: 'version',
      header: t('subjects.version'),
      render: (row) => <code className="fw-semibold">{row.version}</code>,
    },
    {
      key: 'subjects',
      header: t('subjects.tabSubjects'),
      render: (row) => <StatusBadge label={String(row.subject_count)} tone="info" />,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge
          label={row.status}
          tone={row.status === 'active' ? 'success' : row.status === 'draft' ? 'warning' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: t('users.colActions'),
      className: 'text-end',
      render: (row) => (
        <div className="d-inline-flex gap-1">
          <button
            type="button"
            className="btn btn-sm btn-label-primary d-inline-flex align-items-center gap-1"
            onClick={() => {
              setFormError(null)
              setSelectedCurr(row)
            }}
          >
            <ListChecks size={15} />
            <span>{t('subjects.manageSubjects')}</span>
          </button>
          <PermissionGuard permission="subjects.change_curriculum">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={() => openCurrModal(row)}
            >
              <Pencil size={15} />
            </button>
          </PermissionGuard>
          <PermissionGuard permission="subjects.delete_curriculum">
            <button
              type="button"
              className="btn btn-icon btn-sm btn-label-secondary"
              onClick={async () => {
                try {
                  await deleteCurriculum(row.id)
                  qc.invalidateQueries({ queryKey: ['curricula'] })
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

  const currItemColumns: TableColumn<CurriculumSubject>[] = [
    {
      key: 'term',
      header: t('subjects.term'),
      render: (row) => (
        <span className="small fw-medium">
          {isKm && row.year_level_name_km ? row.year_level_name_km : row.year_level_name_en} · S
          {row.semester_number}
        </span>
      ),
    },
    {
      key: 'subject',
      header: t('subjects.subject'),
      render: (row) => (
        <div>
          <code className="me-2">{row.subject_code}</code>
          <span className="fw-medium">
            {isKm && row.subject_name_km ? row.subject_name_km : row.subject_name_en}
          </span>
        </div>
      ),
    },
    {
      key: 'credits',
      header: t('subjects.credits'),
      render: (row) => <StatusBadge label={row.subject_credits} tone="primary" />,
    },
    {
      key: 'type',
      header: t('subjects.requirement'),
      render: (row) => (
        <StatusBadge
          label={row.is_required ? t('subjects.required') : t('subjects.elective')}
          tone={row.is_required ? 'success' : 'secondary'}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (row) => (
        <PermissionGuard permission="subjects.delete_curriculumsubject">
          <button
            type="button"
            className="btn btn-icon btn-sm btn-label-secondary"
            onClick={async () => {
              try {
                await deleteCurriculumSubject(row.id)
                qc.invalidateQueries({ queryKey: ['curriculum-subjects', selectedCurr?.id] })
                qc.invalidateQueries({ queryKey: ['curricula'] })
                showToast(t('academics.deletedSuccess'), 'success')
              } catch (err) {
                showToast(extractApiErrorMessage(err), 'danger')
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </PermissionGuard>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('subjects.pageTitle')}
        subtitle={t('subjects.pageSubtitle')}
        breadcrumbs={[
          { label: t('foundation.breadcrumbHome'), to: '/' },
          { label: t('nav.subjects') },
        ]}
        actions={
          tab === 'subjects' ? (
            <PermissionGuard permission="subjects.add_subject">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => openSubjectModal(null)}
              >
                <Plus size={16} />
                <span>{t('subjects.createSubject')}</span>
              </button>
            </PermissionGuard>
          ) : (
            <PermissionGuard permission="subjects.add_curriculum">
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => openCurrModal(null)}
              >
                <Plus size={16} />
                <span>{t('subjects.createCurriculum')}</span>
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
              tab === 'subjects' ? 'active' : ''
            }`}
            onClick={() => setTab('subjects')}
          >
            <BookOpen size={16} />
            <span>{t('subjects.tabSubjects')}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link d-inline-flex align-items-center gap-2 ${
              tab === 'curricula' ? 'active' : ''
            }`}
            onClick={() => setTab('curricula')}
          >
            <ListChecks size={16} />
            <span>{t('subjects.tabCurricula')}</span>
          </button>
        </li>
      </ul>

      {tab === 'subjects' ? (
        <div className="card">
          <div className="card-header">
            <div className="input-group" style={{ maxWidth: 360 }}>
              <span className="input-group-text bg-transparent">
                <Search size={16} />
              </span>
              <input
                type="search"
                className="form-control"
                placeholder={t('subjects.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <DataTable
            columns={subjectColumns}
            data={subjectsQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={subjectsQuery.isLoading}
          />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div style={{ maxWidth: 300 }}>
              <select
                className="form-select"
                value={degreeFilter}
                onChange={(e) => setDegreeFilter(e.target.value)}
              >
                <option value="">{t('academics.allDegrees')}</option>
                {(degreesQuery.data?.results || []).map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.code} — {isKm && d.name_km ? d.name_km : d.name_en}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DataTable
            columns={curriculumColumns}
            data={curriculaQuery.data?.results || []}
            rowKey={(r) => r.id}
            loading={curriculaQuery.isLoading}
          />
        </div>
      )}

      {/* Subject Modal */}
      <FormModal
        open={subjectModalOpen}
        title={editingSubject ? t('subjects.editSubject') : t('subjects.createSubject')}
        onClose={() => setSubjectModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-label-secondary"
              onClick={() => setSubjectModalOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="subject-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="subject-form" onSubmit={handleSaveSubject} className="row g-3">
          <div className="col-md-4">
            <label className="form-label">{t('academics.code')} *</label>
            <input
              required
              className="form-control"
              placeholder="CS101"
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
            />
          </div>
          <div className="col-md-8">
            <label className="form-label">{t('academics.nameEn')} *</label>
            <input
              required
              className="form-control"
              value={subjectForm.name_en}
              onChange={(e) => setSubjectForm({ ...subjectForm, name_en: e.target.value })}
            />
          </div>
          <div className="col-md-8">
            <label className="form-label">{t('academics.nameKm')}</label>
            <input
              className="form-control"
              value={subjectForm.name_km}
              onChange={(e) => setSubjectForm({ ...subjectForm, name_km: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('subjects.credits')} *</label>
            <input
              required
              type="number"
              step="0.5"
              min="0"
              className="form-control"
              value={subjectForm.credits}
              onChange={(e) => setSubjectForm({ ...subjectForm, credits: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('subjects.theoryHours')}</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={subjectForm.theory_hours}
              onChange={(e) =>
                setSubjectForm({ ...subjectForm, theory_hours: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('subjects.practicalHours')}</label>
            <input
              type="number"
              min="0"
              className="form-control"
              value={subjectForm.practical_hours}
              onChange={(e) =>
                setSubjectForm({ ...subjectForm, practical_hours: Number(e.target.value) })
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={subjectForm.status}
              onChange={(e) => setSubjectForm({ ...subjectForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </form>
      </FormModal>

      {/* Curriculum Modal */}
      <FormModal
        open={currModalOpen}
        title={editingCurr ? t('subjects.editCurriculum') : t('subjects.createCurriculum')}
        onClose={() => setCurrModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-label-secondary"
              onClick={() => setCurrModalOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="curriculum-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="curriculum-form" onSubmit={handleSaveCurriculum} className="row g-3">
          <div className="col-md-6">
            <label className="form-label">{t('academics.degree')} *</label>
            <select
              required
              className="form-select"
              value={currForm.degree}
              onChange={(e) => setCurrForm({ ...currForm, degree: e.target.value, major: '' })}
            >
              <option value="">--</option>
              {(degreesQuery.data?.results || []).map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.code} — {d.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('academics.major')} *</label>
            <select
              required
              className="form-select"
              value={currForm.major}
              onChange={(e) => setCurrForm({ ...currForm, major: e.target.value })}
            >
              <option value="">--</option>
              {(majorsForFormQuery.data?.results || []).map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.code} — {m.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('subjects.version')} *</label>
            <input
              required
              className="form-control"
              value={currForm.version}
              onChange={(e) => setCurrForm({ ...currForm, version: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('academics.tabYears')}</label>
            <select
              className="form-select"
              value={currForm.effective_academic_year}
              onChange={(e) =>
                setCurrForm({ ...currForm, effective_academic_year: e.target.value })
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
          <div className="col-md-4">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={currForm.status}
              onChange={(e) => setCurrForm({ ...currForm, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </form>
      </FormModal>

      {/* Curriculum Subjects Builder Modal */}
      <FormModal
        open={Boolean(selectedCurr)}
        size="xl"
        title={
          selectedCurr
            ? `${t('subjects.curriculumBuilder')} — ${selectedCurr.major_code} (${selectedCurr.version})`
            : ''
        }
        onClose={() => setSelectedCurr(null)}
      >
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}

        <PermissionGuard permission="subjects.add_curriculumsubject">
          <form onSubmit={handleAddCurrSubject} className="row g-2 align-items-end mb-4 pb-3 border-bottom">
            <div className="col-md-4">
              <label className="form-label">{t('subjects.subject')} *</label>
              <select
                required
                className="form-select"
                value={csForm.subject}
                onChange={(e) => setCsForm({ ...csForm, subject: e.target.value })}
              >
                <option value="">--</option>
                {(allSubjectsQuery.data?.results || []).map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.code} — {s.name_en}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">{t('academics.tabYearLevels')} *</label>
              <select
                required
                className="form-select"
                value={csForm.year_level}
                onChange={(e) => setCsForm({ ...csForm, year_level: e.target.value })}
              >
                <option value="">--</option>
                {(yearLevelsQuery.data?.results || []).map((yl) => (
                  <option key={yl.id} value={String(yl.id)}>
                    {isKm && yl.name_km ? yl.name_km : yl.name_en}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">{t('subjects.semesterNum')} *</label>
              <input
                required
                type="number"
                min={1}
                max={4}
                className="form-control"
                value={csForm.semester_number}
                onChange={(e) =>
                  setCsForm({ ...csForm, semester_number: Number(e.target.value) })
                }
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                <Plus size={15} className="me-1" />
                {t('academics.addNew')}
              </button>
            </div>
          </form>
        </PermissionGuard>

        <DataTable
          columns={currItemColumns}
          data={currItemsQuery.data?.results || []}
          rowKey={(r) => r.id}
          loading={currItemsQuery.isLoading}
        />
      </FormModal>
    </div>
  )
}
