import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Plus,
  Printer,
  Scale,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormModal } from '@/components/ui/FormModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import { fetchSubjects } from '@/features/academics/academicsApi'
import { fetchClasses, fetchClassRoster } from '@/features/classes/classesApi'
import {
  bulkSaveScoresApi,
  calculateGradesApi,
  createAssessmentApi,
  fetchAssessmentScores,
  fetchAssessments,
  fetchAssessmentTypes,
  fetchGrades,
  fetchGradingScales,
  fetchStudentTranscript,
  type AssessmentItem,
} from '@/features/examinations/examinationsApi'
import { fetchStudents } from '@/features/students/studentsApi'

export function ExaminationsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const qc = useQueryClient()

  const isStudentOnly =
    !user?.is_superuser && user?.roles?.length === 1 && user.roles[0].name === 'Student'

  const [tab, setTab] = useState<'assessments' | 'grades' | 'transcript' | 'scales'>(
    isStudentOnly ? 'transcript' : 'assessments'
  )

  const [classFilter, setClassFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [transcriptStudentId, setTranscriptStudentId] = useState('')

  // Create Assessment Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [assessForm, setAssessForm] = useState({
    class_section: '',
    subject: '',
    assessment_type: '',
    title: '',
    max_score: '100',
    weight_percent: '25',
    assessment_date: new Date().toISOString().slice(0, 10),
  })

  // Score Entry Modal
  const [scoreModalAssessment, setScoreModalAssessment] = useState<AssessmentItem | null>(null)
  const [scoreInputs, setScoreInputs] = useState<Record<number, { score: string; remarks: string }>>({})
  const [submitting, setSubmitting] = useState(false)

  const typesQuery = useQuery({
    queryKey: ['assessment-types'],
    queryFn: fetchAssessmentTypes,
  })
  const scalesQuery = useQuery({
    queryKey: ['grading-scales'],
    queryFn: fetchGradingScales,
  })
  const classesQuery = useQuery({
    queryKey: ['exam-classes'],
    queryFn: () => fetchClasses({ page_size: 100 }),
  })
  const subjectsQuery = useQuery({
    queryKey: ['subjects-all'],
    queryFn: () => fetchSubjects({ page_size: 100 }),
  })
  const studentsQuery = useQuery({
    queryKey: ['exam-students'],
    queryFn: () => fetchStudents({ page_size: 100 }),
    enabled: tab === 'transcript' && !isStudentOnly,
  })

  const assessmentsQuery = useQuery({
    queryKey: ['assessments', classFilter, subjectFilter],
    queryFn: () =>
      fetchAssessments({ class_section: classFilter, subject: subjectFilter }),
    enabled: tab === 'assessments',
  })

  const gradesQuery = useQuery({
    queryKey: ['grades', classFilter, subjectFilter],
    queryFn: () => fetchGrades({ class_section: classFilter, subject: subjectFilter }),
    enabled: tab === 'grades',
  })

  const transcriptQuery = useQuery({
    queryKey: ['transcript', isStudentOnly ? 'self' : transcriptStudentId],
    queryFn: () => fetchStudentTranscript(isStudentOnly ? undefined : transcriptStudentId),
    enabled: tab === 'transcript' && (isStudentOnly || Boolean(transcriptStudentId)),
  })

  const modalRosterQuery = useQuery({
    queryKey: ['exam-modal-roster', scoreModalAssessment?.class_section],
    queryFn: () => fetchClassRoster(scoreModalAssessment!.class_section, 'active'),
    enabled: Boolean(scoreModalAssessment),
  })

  const existingScoresQuery = useQuery({
    queryKey: ['exam-modal-scores', scoreModalAssessment?.id],
    queryFn: () => fetchAssessmentScores(scoreModalAssessment!.id),
    enabled: Boolean(scoreModalAssessment),
  })

  useEffect(() => {
    if (!scoreModalAssessment) return
    const roster = modalRosterQuery.data || []
    const existingMap = new Map(
      (existingScoresQuery.data || []).map((s) => [s.enrollment, s])
    )
    const next: Record<number, { score: string; remarks: string }> = {}
    for (const m of roster) {
      const existing = existingMap.get(m.enrollment)
      next[m.enrollment] = {
        score: existing ? existing.score : '',
        remarks: existing ? existing.remarks : '',
      }
    }
    setScoreInputs(next)
  }, [scoreModalAssessment, modalRosterQuery.data, existingScoresQuery.data])

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createAssessmentApi({
        class_section: Number(assessForm.class_section),
        subject: Number(assessForm.subject),
        assessment_type: Number(assessForm.assessment_type),
        title: assessForm.title,
        max_score: assessForm.max_score,
        weight_percent: assessForm.weight_percent,
        assessment_date: assessForm.assessment_date || null,
      })
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['assessments'] })
      showToast(t('academics.savedSuccess'), 'success')
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveScores = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scoreModalAssessment) return
    const entries = Object.entries(scoreInputs)
      .filter(([, v]) => v.score.trim() !== '')
      .map(([enrollmentId, v]) => ({
        enrollment: Number(enrollmentId),
        score: v.score,
        remarks: v.remarks,
      }))
    if (entries.length === 0) return
    setSubmitting(true)
    try {
      await bulkSaveScoresApi(scoreModalAssessment.id, entries)
      setScoreModalAssessment(null)
      qc.invalidateQueries({ queryKey: ['assessments'] })
      showToast(t('exams.scoresSaved'), 'success')
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCalculateGrades = async (publish: boolean) => {
    if (!classFilter || !subjectFilter) {
      showToast(t('exams.selectClassAndSubject'), 'warning')
      return
    }
    setSubmitting(true)
    try {
      await calculateGradesApi({
        class_section: Number(classFilter),
        subject: Number(subjectFilter),
        publish,
      })
      qc.invalidateQueries({ queryKey: ['grades'] })
      qc.invalidateQueries({ queryKey: ['assessments'] })
      showToast(publish ? t('exams.gradesPublished') : t('exams.gradesCalculated'), 'success')
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="d-print-none">
        <PageHeader
          title={t('exams.pageTitle')}
          subtitle={t('exams.pageSubtitle')}
          breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t('nav.examinations') },
          ]}
          actions={
            tab === 'assessments' ? (
              <PermissionGuard permission="examinations.add_assessment">
                <button
                  type="button"
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus size={16} />
                  <span>{t('exams.createAssessment')}</span>
                </button>
              </PermissionGuard>
            ) : tab === 'transcript' ? (
              <button
                type="button"
                className="btn btn-label-secondary d-inline-flex align-items-center gap-2"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                <span>{t('exams.printTranscript')}</span>
              </button>
            ) : null
          }
        />

        <ul className="nav nav-pills mb-4 gap-2 flex-wrap">
          {!isStudentOnly && (
            <>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link d-inline-flex align-items-center gap-2 ${
                    tab === 'assessments' ? 'active' : ''
                  }`}
                  onClick={() => setTab('assessments')}
                >
                  <ClipboardList size={16} />
                  <span>{t('exams.tabAssessments')}</span>
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link d-inline-flex align-items-center gap-2 ${
                    tab === 'grades' ? 'active' : ''
                  }`}
                  onClick={() => setTab('grades')}
                >
                  <FileSpreadsheet size={16} />
                  <span>{t('exams.tabGrades')}</span>
                </button>
              </li>
            </>
          )}
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                tab === 'transcript' ? 'active' : ''
              }`}
              onClick={() => setTab('transcript')}
            >
              <GraduationCap size={16} />
              <span>{t('exams.tabTranscript')}</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link d-inline-flex align-items-center gap-2 ${
                tab === 'scales' ? 'active' : ''
              }`}
              onClick={() => setTab('scales')}
            >
              <Scale size={16} />
              <span>{t('exams.tabScales')}</span>
            </button>
          </li>
        </ul>
      </div>

      {/* 1. Assessments & Score Entry */}
      {tab === 'assessments' && (
        <div className="card">
          <div className="card-header">
            <div className="row g-2">
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="">{t('teachers.allClasses')}</option>
                  {(classesQuery.data?.results || []).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="">{t('exams.allSubjects')}</option>
                  {(subjectsQuery.data?.results || []).map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} — {s.name_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {(assessmentsQuery.data?.results || []).length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{t('exams.title')}</th>
                    <th>{t('classes.colClass')}</th>
                    <th>{t('subjects.subject')}</th>
                    <th>{t('exams.weightMax')}</th>
                    <th>{t('exams.scored')}</th>
                    <th className="text-end">{t('users.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(assessmentsQuery.data?.results || []).map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="fw-semibold">{a.title}</div>
                        <span className="small text-body-secondary">
                          {a.assessment_type_name} {a.assessment_date ? `· ${a.assessment_date}` : ''}
                        </span>
                      </td>
                      <td><code>{a.class_code}</code></td>
                      <td><code>{a.subject_code}</code> {a.subject_name_en}</td>
                      <td>
                        <StatusBadge label={`${a.weight_percent}%`} tone="primary" />{' '}
                        <span className="small text-body-secondary">/ {a.max_score} pts</span>
                      </td>
                      <td><StatusBadge label={String(a.scored_count)} tone="info" /></td>
                      <td className="text-end">
                        <PermissionGuard anyOf={['examinations.add_studentscore', 'examinations.change_studentscore']}>
                          <button
                            type="button"
                            className="btn btn-sm btn-label-primary"
                            onClick={() => setScoreModalAssessment(a)}
                          >
                            {t('exams.enterScores')}
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
      )}

      {/* 2. Grades Calculation & Publication */}
      {tab === 'grades' && (
        <div className="card">
          <div className="card-header">
            <div className="row g-2 align-items-center">
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
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
                <select
                  className="form-select"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="">{t('exams.allSubjects')}</option>
                  {(subjectsQuery.data?.results || []).map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.code} — {s.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 d-flex gap-2 justify-content-md-end flex-wrap">
                <PermissionGuard anyOf={['examinations.add_subjectgrade', 'examinations.change_subjectgrade']}>
                  <button
                    type="button"
                    className="btn btn-label-primary d-inline-flex align-items-center gap-1"
                    disabled={submitting}
                    onClick={() => handleCalculateGrades(false)}
                  >
                    <Calculator size={15} />
                    <span>{t('exams.calculateDraft')}</span>
                  </button>
                </PermissionGuard>
                <PermissionGuard permission="examinations.publish_grades">
                  <button
                    type="button"
                    className="btn btn-primary d-inline-flex align-items-center gap-1"
                    disabled={submitting}
                    onClick={() => handleCalculateGrades(true)}
                  >
                    <CheckCircle2 size={15} />
                    <span>{t('exams.calculateAndPublish')}</span>
                  </button>
                </PermissionGuard>
              </div>
            </div>
          </div>

          {(gradesQuery.data?.results || []).length === 0 ? (
            <EmptyState title={t('common.noData')} />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>{t('students.colStudent')}</th>
                    <th>{t('classes.colClass')}</th>
                    <th>{t('subjects.subject')}</th>
                    <th>{t('exams.percentage')}</th>
                    <th>{t('exams.letterGrade')}</th>
                    <th>GPA</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(gradesQuery.data?.results || []).map((g) => (
                    <tr key={g.id}>
                      <td>
                        <div className="fw-semibold">{g.student_name_en}</div>
                        <code className="small">{g.student_code}</code>
                      </td>
                      <td><code>{g.class_code}</code></td>
                      <td><code>{g.subject_code}</code> {g.subject_name_en}</td>
                      <td className="fw-semibold">{g.total_percentage}%</td>
                      <td>
                        <StatusBadge
                          label={g.letter_grade}
                          tone={g.is_passing ? 'success' : 'danger'}
                        />
                      </td>
                      <td>{g.grade_point}</td>
                      <td>
                        <StatusBadge
                          label={g.status}
                          tone={g.status === 'published' ? 'primary' : 'warning'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Academic Transcript & Cumulative GPA */}
      {tab === 'transcript' && (
        <div className="d-flex flex-column gap-4">
          {!isStudentOnly && (
            <div className="card d-print-none">
              <div className="card-body py-3">
                <div style={{ maxWidth: 420 }}>
                  <label className="form-label">{t('students.colStudent')}</label>
                  <select
                    className="form-select"
                    value={transcriptStudentId}
                    onChange={(e) => setTranscriptStudentId(e.target.value)}
                  >
                    <option value="">--</option>
                    {(studentsQuery.data?.results || []).map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.student_code} — {s.full_name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {transcriptQuery.data && (
            <>
              <div className="row g-4">
                <div className="col-sm-6 col-xl-3">
                  <StatCard
                    title={t('exams.cumulativeGpa')}
                    value={transcriptQuery.data.summary.cumulative_gpa}
                    subtitle="4.00 Scale"
                    icon={Award}
                    tone="primary"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <StatCard
                    title={t('exams.creditsEarned')}
                    value={`${transcriptQuery.data.summary.credits_earned} / ${transcriptQuery.data.summary.credits_attempted}`}
                    icon={GraduationCap}
                    tone="success"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <StatCard
                    title={t('subjects.tabSubjects')}
                    value={transcriptQuery.data.summary.subjects_count}
                    icon={FileSpreadsheet}
                    tone="info"
                  />
                </div>
                <div className="col-sm-6 col-xl-3">
                  <StatCard
                    title={t('students.studentCode')}
                    value={transcriptQuery.data.student.student_code}
                    subtitle={transcriptQuery.data.student.full_name_en}
                    icon={CheckCircle2}
                    tone="warning"
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h6 className="mb-0">
                    {t('exams.tabTranscript')} — {transcriptQuery.data.student.full_name_en}
                  </h6>
                </div>
                {transcriptQuery.data.grades.length === 0 ? (
                  <EmptyState title={t('common.noData')} />
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead>
                        <tr>
                          <th>{t('academics.tabYears')}</th>
                          <th>{t('subjects.subject')}</th>
                          <th>{t('subjects.credits')}</th>
                          <th>{t('exams.percentage')}</th>
                          <th>{t('exams.letterGrade')}</th>
                          <th>GPA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transcriptQuery.data.grades.map((g) => (
                          <tr key={g.id}>
                            <td className="small">{g.academic_year} ({g.year_level})</td>
                            <td>
                              <code className="me-2">{g.subject_code}</code>
                              {g.subject_name_en}
                            </td>
                            <td>{g.credits_earned} / {g.credits_attempted}</td>
                            <td>{g.total_percentage}%</td>
                            <td>
                              <StatusBadge
                                label={g.letter_grade}
                                tone={g.is_passing ? 'success' : 'danger'}
                              />
                            </td>
                            <td className="fw-semibold">{g.grade_point}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. Grading Scale & Assessment Types */}
      {tab === 'scales' && (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h6 className="mb-0">{t('exams.gradingScale')}</h6>
              </div>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>{t('exams.letterGrade')}</th>
                      <th>{t('exams.percentage')}</th>
                      <th>GPA</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(scalesQuery.data?.results || []).map((sc) => (
                      <tr key={sc.id}>
                        <td>
                          <StatusBadge
                            label={sc.letter_grade}
                            tone={sc.is_passing ? 'primary' : 'danger'}
                          />
                        </td>
                        <td className="small">
                          {sc.min_percentage}% – {sc.max_percentage}%
                        </td>
                        <td className="fw-semibold">{sc.grade_point}</td>
                        <td className="small text-body-secondary">{sc.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h6 className="mb-0">{t('exams.assessmentTypes')}</h6>
              </div>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>{t('academics.code')}</th>
                      <th>{t('academics.name')}</th>
                      <th>{t('exams.defaultWeight')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(typesQuery.data?.results || []).map((at) => (
                      <tr key={at.id}>
                        <td><code>{at.code}</code></td>
                        <td>
                          <div className="fw-medium">{at.name_en}</div>
                          {at.name_km && <div className="small text-body-secondary">{at.name_km}</div>}
                        </td>
                        <td><StatusBadge label={`${at.default_weight_percent}%`} tone="info" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Assessment Modal */}
      <FormModal
        open={createOpen}
        title={t('exams.createAssessment')}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-label-secondary" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="create-assessment-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>
        }
      >
        <form id="create-assessment-form" onSubmit={handleCreateAssessment} className="row g-3">
          <div className="col-md-6">
            <label className="form-label">{t('classes.colClass')} *</label>
            <select
              required
              className="form-select"
              value={assessForm.class_section}
              onChange={(e) => setAssessForm({ ...assessForm, class_section: e.target.value })}
            >
              <option value="">--</option>
              {(classesQuery.data?.results || []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('subjects.subject')} *</label>
            <select
              required
              className="form-select"
              value={assessForm.subject}
              onChange={(e) => setAssessForm({ ...assessForm, subject: e.target.value })}
            >
              <option value="">--</option>
              {(subjectsQuery.data?.results || []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.code} — {s.name_en}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('exams.assessmentTypes')} *</label>
            <select
              required
              className="form-select"
              value={assessForm.assessment_type}
              onChange={(e) => {
                const chosen = (typesQuery.data?.results || []).find(
                  (tItem) => String(tItem.id) === e.target.value
                )
                setAssessForm({
                  ...assessForm,
                  assessment_type: e.target.value,
                  weight_percent: chosen ? chosen.default_weight_percent : assessForm.weight_percent,
                })
              }}
            >
              <option value="">--</option>
              {(typesQuery.data?.results || []).map((at) => (
                <option key={at.id} value={String(at.id)}>
                  {at.name_en} ({at.default_weight_percent}%)
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('exams.title')} *</label>
            <input
              required
              className="form-control"
              placeholder="Midterm Exam"
              value={assessForm.title}
              onChange={(e) => setAssessForm({ ...assessForm, title: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('exams.maxScore')} *</label>
            <input
              required
              type="number"
              step="0.5"
              min="1"
              className="form-control"
              value={assessForm.max_score}
              onChange={(e) => setAssessForm({ ...assessForm, max_score: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('exams.weightPercent')} *</label>
            <input
              required
              type="number"
              step="0.5"
              min="0"
              max="100"
              className="form-control"
              value={assessForm.weight_percent}
              onChange={(e) => setAssessForm({ ...assessForm, weight_percent: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('attendance.sessionDate')}</label>
            <input
              type="date"
              className="form-control"
              value={assessForm.assessment_date}
              onChange={(e) => setAssessForm({ ...assessForm, assessment_date: e.target.value })}
            />
          </div>
        </form>
      </FormModal>

      {/* Spreadsheet Score Entry Grid Modal */}
      <FormModal
        open={Boolean(scoreModalAssessment)}
        size="xl"
        title={
          scoreModalAssessment
            ? `${t('exams.enterScores')} — ${scoreModalAssessment.title} (Max ${scoreModalAssessment.max_score})`
            : ''
        }
        onClose={() => setScoreModalAssessment(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-label-secondary"
              onClick={() => setScoreModalAssessment(null)}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" form="score-grid-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>
        }
      >
        <form id="score-grid-form" onSubmit={handleSaveScores}>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>{t('students.studentCode')}</th>
                  <th>{t('students.colStudent')}</th>
                  <th style={{ width: 150 }}>{t('exams.score')}</th>
                  <th>{t('students.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {(modalRosterQuery.data || []).map((m) => {
                  const val = scoreInputs[m.enrollment] || { score: '', remarks: '' }
                  return (
                    <tr key={m.id}>
                      <td><code>{m.student_code}</code></td>
                      <td className="fw-medium">{m.student_name_en}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={scoreModalAssessment?.max_score}
                          className="form-control form-control-sm"
                          value={val.score}
                          onChange={(e) =>
                            setScoreInputs((prev) => ({
                              ...prev,
                              [m.enrollment]: { ...val, score: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={val.remarks}
                          onChange={(e) =>
                            setScoreInputs((prev) => ({
                              ...prev,
                              [m.enrollment]: { ...val, remarks: e.target.value },
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
        </form>
      </FormModal>
    </div>
  )
}
