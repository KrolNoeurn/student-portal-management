import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Download,
  FileText,
  History,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { PermissionGuard } from '@/auth/PermissionGuard'
import { ErrorState } from '@/components/ui/ErrorState'
import { FormModal } from '@/components/ui/FormModal'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/contexts/ToastContext'
import { StudentFormModal } from '@/features/students/StudentFormModal'
import { studentStatusTone } from '@/features/students/StudentsListPage'
import {
  enrollmentStatusTone,
} from '@/features/enrollments/EnrollmentsPage'
import { fetchEnrollments } from '@/features/enrollments/enrollmentsApi'
import {
  addStudentEducation,
  addStudentGuardian,
  changeStudentStatus,
  deleteStudentDocument,
  deleteStudentEducation,
  deleteStudentGuardian,
  downloadStudentDocument,
  fetchStudentDetail,
  uploadStudentDocument,
  uploadStudentPhoto,
  type StudentStatus,
} from '@/features/students/studentsApi'

type DetailTab = 'overview' | 'enrollments' | 'guardians' | 'education' | 'documents' | 'history'

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { showToast } = useToast()
  const qc = useQueryClient()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<DetailTab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusForm, setStatusForm] = useState<{ status: StudentStatus; reason: string }>({
    status: 'active',
    reason: '',
  })

  // Sub-entity forms
  const [guardianForm, setGuardianForm] = useState({
    full_name: '',
    relationship: 'father' as const,
    phone: '',
    occupation: '',
    is_primary: false,
  })
  const [eduForm, setEduForm] = useState({
    institution_name: '',
    qualification: '',
    graduation_year: '',
    gpa_or_grade: '',
  })
  const [docForm, setDocForm] = useState<{
    document_type: string
    title: string
    file: File | null
  }>({
    document_type: 'high_school_diploma',
    title: '',
    file: null,
  })

  const studentQuery = useQuery({
    queryKey: ['student-detail', id],
    queryFn: () => fetchStudentDetail(id!),
    enabled: Boolean(id),
  })

  const studentEnrollmentsQuery = useQuery({
    queryKey: ['student-enrollments', id],
    queryFn: () => fetchEnrollments({ student: id!, page_size: 50 }),
    enabled: Boolean(id),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['student-detail', id] })

  if (studentQuery.isLoading) {
    return (
      <div className="card p-4">
        <LoadingSkeleton rows={6} height={24} />
      </div>
    )
  }

  if (studentQuery.isError || !studentQuery.data) {
    return (
      <ErrorState
        title={t('students.loadError')}
        message={extractApiErrorMessage(studentQuery.error)}
        onRetry={() => studentQuery.refetch()}
      />
    )
  }

  const student = studentQuery.data
  const initials = student.full_name_en
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return
    try {
      await uploadStudentPhoto(student.id, file)
      showToast(t('students.photoUpdated'), 'success')
      refresh()
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    }
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await changeStudentStatus(student.id, statusForm)
      setStatusModalOpen(false)
      showToast(t('students.statusUpdated'), 'success')
      refresh()
      qc.invalidateQueries({ queryKey: ['students'] })
    } catch (err) {
      showToast(extractApiErrorMessage(err), 'danger')
    }
  }

  return (
    <div>
      <div className="d-print-none">
        <PageHeader
          title={student.full_name_en}
          subtitle={`${student.student_code}${student.full_name_km ? ` · ${student.full_name_km}` : ''}`}
          breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t('nav.students'), to: '/students' },
            { label: student.student_code },
          ]}
          actions={
            <>
              <Link to="/students" className="btn btn-label-secondary d-inline-flex align-items-center gap-1">
                <ArrowLeft size={15} />
                <span>{t('students.backToList')}</span>
              </Link>
              <PermissionGuard permission="students.print_student_profile">
                <button
                  type="button"
                  className="btn btn-label-secondary d-inline-flex align-items-center gap-1"
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  <span>{t('students.printProfile')}</span>
                </button>
              </PermissionGuard>
              <PermissionGuard permission="students.change_student">
                <button
                  type="button"
                  className="btn btn-label-primary d-inline-flex align-items-center gap-1"
                  onClick={() => {
                    setStatusForm({ status: student.status, reason: '' })
                    setStatusModalOpen(true)
                  }}
                >
                  <RefreshCcw size={15} />
                  <span>{t('students.changeStatus')}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary d-inline-flex align-items-center gap-1"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil size={15} />
                  <span>{t('students.editStudent')}</span>
                </button>
              </PermissionGuard>
            </>
          }
        />
      </div>

      {/* Profile Banner Card */}
      <div className="card mb-4">
        <div className="card-body d-flex flex-column flex-md-row align-items-md-center gap-4">
          <div className="position-relative">
            {student.profile_photo ? (
              <img
                src={student.profile_photo}
                alt={student.full_name_en}
                className="rounded-3 object-fit-cover"
                style={{ width: 88, height: 88 }}
              />
            ) : (
              <div
                className="vx-avatar bg-label-primary fs-3 rounded-3"
                style={{ width: 88, height: 88 }}
              >
                {initials}
              </div>
            )}
            <PermissionGuard permission="students.change_student">
              <button
                type="button"
                className="btn btn-icon btn-sm btn-primary position-absolute bottom-0 end-0 d-print-none"
                style={{ width: 28, height: 28 }}
                title={t('students.uploadPhoto')}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera size={14} />
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="d-none"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              />
            </PermissionGuard>
          </div>

          <div className="flex-grow-1">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <h4 className="mb-0">{student.full_name_en}</h4>
              <StatusBadge label={student.status} tone={studentStatusTone(student.status)} />
            </div>
            {student.full_name_km && (
              <div className="text-body-secondary mb-2">{student.full_name_km}</div>
            )}
            <div className="d-flex flex-wrap gap-3 small text-body-secondary">
              <span>
                <strong>ID:</strong> <code>{student.student_code}</code>
              </span>
              <span>
                <strong>{t('students.dob')}:</strong> {student.date_of_birth}
              </span>
              <span>
                <strong>{t('users.phone')}:</strong> {student.phone || '—'}
              </span>
              <span>
                <strong>{t('users.email')}:</strong> {student.email || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs (hidden when printing) */}
      <ul className="nav nav-pills mb-4 gap-2 flex-wrap d-print-none">
        {(
          [
            { id: 'overview', label: t('students.tabOverview'), icon: User },
            {
              id: 'enrollments',
              label: `${t('nav.enrollments')} (${studentEnrollmentsQuery.data?.count || 0})`,
              icon: RefreshCcw,
            },
            { id: 'guardians', label: `${t('students.tabGuardians')} (${student.guardians.length})`, icon: Users },
            { id: 'education', label: `${t('students.tabEducation')} (${student.education_history.length})`, icon: BookOpen },
            { id: 'documents', label: `${t('students.tabDocuments')} (${student.documents.length})`, icon: FileText },
            { id: 'history', label: `${t('students.tabHistory')} (${student.status_history.length})`, icon: History },
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

      {/* Overview Tab (also always visible in Print view) */}
      {(tab === 'overview' || false) && (
        <div className="row g-4">
          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h6 className="mb-0">{t('students.sectionPersonal')}</h6>
              </div>
              <div className="card-body">
                <dl className="row mb-0 small">
                  <dt className="col-5 text-body-secondary">{t('students.studentCode')}</dt>
                  <dd className="col-7"><code>{student.student_code}</code></dd>
                  <dt className="col-5 text-body-secondary">{t('students.gender')}</dt>
                  <dd className="col-7 text-capitalize">{student.gender}</dd>
                  <dt className="col-5 text-body-secondary">{t('students.dob')}</dt>
                  <dd className="col-7">{student.date_of_birth}</dd>
                  <dt className="col-5 text-body-secondary">{t('students.nationality')}</dt>
                  <dd className="col-7">{student.nationality || '—'}</dd>
                  <dt className="col-5 text-body-secondary">{t('students.nationalId')}</dt>
                  <dd className="col-7">{student.national_id_number || '—'}</dd>
                  <dt className="col-5 text-body-secondary">{t('students.registrationState')}</dt>
                  <dd className="col-7 text-capitalize">{student.registration_state}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card h-100">
              <div className="card-header">
                <h6 className="mb-0">{t('students.sectionContact')}</h6>
              </div>
              <div className="card-body">
                <dl className="row mb-0 small">
                  <dt className="col-5 text-body-secondary">{t('users.phone')}</dt>
                  <dd className="col-7">{student.phone || '—'}</dd>
                  <dt className="col-5 text-body-secondary">{t('users.email')}</dt>
                  <dd className="col-7">{student.email || '—'}</dd>
                  <dt className="col-5 text-body-secondary">{t('students.address')}</dt>
                  <dd className="col-7">
                    {[student.address_line, student.commune, student.district, student.province, student.country]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                  <dt className="col-5 text-body-secondary">{t('students.emergencyName')}</dt>
                  <dd className="col-7">
                    {student.emergency_contact_name
                      ? `${student.emergency_contact_name} (${student.emergency_contact_relationship || '-'}) · ${student.emergency_contact_phone || '-'}`
                      : '—'}
                  </dd>
                  <dt className="col-5 text-body-secondary">{t('students.notes')}</dt>
                  <dd className="col-7">{student.notes || '—'}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enrollments History Tab */}
      {tab === 'enrollments' && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h6 className="mb-0">{t('enrollments.historyTitle')}</h6>
            <Link to="/enrollments" className="btn btn-sm btn-label-primary">
              {t('nav.enrollments')}
            </Link>
          </div>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>{t('enrollments.regNumber')}</th>
                  <th>{t('academics.tabYears')}</th>
                  <th>{t('subjects.program')}</th>
                  <th>{t('academics.tabYearLevels')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(studentEnrollmentsQuery.data?.results || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-body-secondary py-4 small">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  (studentEnrollmentsQuery.data?.results || []).map((enr) => (
                    <tr key={enr.id}>
                      <td><code>{enr.registration_number}</code></td>
                      <td>{enr.academic_year_name}</td>
                      <td>{enr.degree_code} — {enr.major_name_en}</td>
                      <td>{enr.year_level_name_en}</td>
                      <td>
                        <StatusBadge label={enr.status} tone={enrollmentStatusTone(enr.status)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guardians Tab */}
      {tab === 'guardians' && (
        <div className="card">
          <div className="card-body">
            <PermissionGuard permission="students.add_studentguardian">
              <form
                className="row g-2 align-items-end mb-4 pb-3 border-bottom"
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    await addStudentGuardian({ ...guardianForm, student: student.id })
                    setGuardianForm({ full_name: '', relationship: 'father', phone: '', occupation: '', is_primary: false })
                    showToast(t('academics.savedSuccess'), 'success')
                    refresh()
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <div className="col-md-3">
                  <label className="form-label">{t('academics.name')} *</label>
                  <input
                    required
                    className="form-control"
                    value={guardianForm.full_name}
                    onChange={(e) => setGuardianForm({ ...guardianForm, full_name: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t('students.emergencyRelationship')}</label>
                  <select
                    className="form-select"
                    value={guardianForm.relationship}
                    onChange={(e) =>
                      setGuardianForm({
                        ...guardianForm,
                        relationship: e.target.value as typeof guardianForm.relationship,
                      })
                    }
                  >
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Guardian</option>
                    <option value="sibling">Sibling</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t('users.phone')}</label>
                  <input
                    className="form-control"
                    value={guardianForm.phone}
                    onChange={(e) => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t('students.occupation')}</label>
                  <input
                    className="form-control"
                    value={guardianForm.occupation}
                    onChange={(e) => setGuardianForm({ ...guardianForm, occupation: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100">
                    <Plus size={15} className="me-1" />
                    {t('academics.addNew')}
                  </button>
                </div>
              </form>
            </PermissionGuard>

            {student.guardians.length === 0 ? (
              <p className="text-body-secondary small mb-0">{t('common.noData')}</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>{t('academics.name')}</th>
                      <th>{t('students.emergencyRelationship')}</th>
                      <th>{t('users.phone')}</th>
                      <th>{t('students.occupation')}</th>
                      <th className="text-end" />
                    </tr>
                  </thead>
                  <tbody>
                    {student.guardians.map((g) => (
                      <tr key={g.id}>
                        <td className="fw-medium">{g.full_name}</td>
                        <td className="text-capitalize">{g.relationship}</td>
                        <td>{g.phone || '—'}</td>
                        <td>{g.occupation || '—'}</td>
                        <td className="text-end">
                          <PermissionGuard permission="students.delete_studentguardian">
                            <button
                              type="button"
                              className="btn btn-icon btn-sm btn-label-secondary"
                              onClick={async () => {
                                await deleteStudentGuardian(g.id)
                                refresh()
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

      {/* Education History Tab */}
      {tab === 'education' && (
        <div className="card">
          <div className="card-body">
            <PermissionGuard permission="students.add_studenteducationhistory">
              <form
                className="row g-2 align-items-end mb-4 pb-3 border-bottom"
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    await addStudentEducation({
                      student: student.id,
                      institution_name: eduForm.institution_name,
                      qualification: eduForm.qualification,
                      graduation_year: eduForm.graduation_year ? Number(eduForm.graduation_year) : null,
                      gpa_or_grade: eduForm.gpa_or_grade,
                    })
                    setEduForm({ institution_name: '', qualification: '', graduation_year: '', gpa_or_grade: '' })
                    showToast(t('academics.savedSuccess'), 'success')
                    refresh()
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <div className="col-md-4">
                  <label className="form-label">{t('students.schoolName')} *</label>
                  <input
                    required
                    className="form-control"
                    value={eduForm.institution_name}
                    onChange={(e) => setEduForm({ ...eduForm, institution_name: e.target.value })}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t('students.qualification')} *</label>
                  <input
                    required
                    className="form-control"
                    placeholder="High School Diploma"
                    value={eduForm.qualification}
                    onChange={(e) => setEduForm({ ...eduForm, qualification: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">{t('students.gradYear')}</label>
                  <input
                    type="number"
                    className="form-control"
                    value={eduForm.graduation_year}
                    onChange={(e) => setEduForm({ ...eduForm, graduation_year: e.target.value })}
                  />
                </div>
                <div className="col-md-1">
                  <label className="form-label">{t('students.grade')}</label>
                  <input
                    className="form-control"
                    value={eduForm.gpa_or_grade}
                    onChange={(e) => setEduForm({ ...eduForm, gpa_or_grade: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100">
                    <Plus size={15} className="me-1" />
                    {t('academics.addNew')}
                  </button>
                </div>
              </form>
            </PermissionGuard>

            {student.education_history.length === 0 ? (
              <p className="text-body-secondary small mb-0">{t('common.noData')}</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>{t('students.schoolName')}</th>
                      <th>{t('students.qualification')}</th>
                      <th>{t('students.gradYear')}</th>
                      <th>{t('students.grade')}</th>
                      <th className="text-end" />
                    </tr>
                  </thead>
                  <tbody>
                    {student.education_history.map((ed) => (
                      <tr key={ed.id}>
                        <td className="fw-medium">{ed.institution_name}</td>
                        <td>{ed.qualification}</td>
                        <td>{ed.graduation_year || '—'}</td>
                        <td>{ed.gpa_or_grade || '—'}</td>
                        <td className="text-end">
                          <PermissionGuard permission="students.delete_studenteducationhistory">
                            <button
                              type="button"
                              className="btn btn-icon btn-sm btn-label-secondary"
                              onClick={async () => {
                                await deleteStudentEducation(ed.id)
                                refresh()
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

      {/* Documents Tab */}
      {tab === 'documents' && (
        <div className="card">
          <div className="card-body">
            <PermissionGuard permission="students.add_studentdocument">
              <form
                className="row g-2 align-items-end mb-4 pb-3 border-bottom"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!docForm.file) return
                  try {
                    await uploadStudentDocument({
                      student: student.id,
                      document_type: docForm.document_type,
                      title: docForm.title,
                      file: docForm.file,
                    })
                    setDocForm({ document_type: 'high_school_diploma', title: '', file: null })
                    showToast(t('academics.savedSuccess'), 'success')
                    refresh()
                  } catch (err) {
                    showToast(extractApiErrorMessage(err), 'danger')
                  }
                }}
              >
                <div className="col-md-3">
                  <label className="form-label">{t('students.docType')}</label>
                  <select
                    className="form-select"
                    value={docForm.document_type}
                    onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
                  >
                    <option value="national_id">National ID / Passport</option>
                    <option value="birth_certificate">Birth Certificate</option>
                    <option value="high_school_diploma">High School Diploma</option>
                    <option value="transcript">Transcript</option>
                    <option value="photo">ID Photo</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">{t('students.docTitle')} *</label>
                  <input
                    required
                    className="form-control"
                    value={docForm.title}
                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t('students.docFile')} *</label>
                  <input
                    required
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="form-control"
                    onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] || null })}
                  />
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100">
                    <Plus size={15} className="me-1" />
                    {t('students.upload')}
                  </button>
                </div>
              </form>
            </PermissionGuard>

            {student.documents.length === 0 ? (
              <p className="text-body-secondary small mb-0">{t('common.noData')}</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>{t('students.docTitle')}</th>
                      <th>{t('students.docType')}</th>
                      <th>{t('students.docSize')}</th>
                      <th className="text-end">{t('users.colActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="fw-medium">{doc.title}</td>
                        <td><StatusBadge label={doc.document_type} tone="info" /></td>
                        <td className="small">{Math.max(1, Math.round(doc.file_size / 1024))} KB</td>
                        <td className="text-end">
                          <div className="d-inline-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-icon btn-sm btn-label-primary"
                              onClick={() => downloadStudentDocument(doc.id, doc.title)}
                            >
                              <Download size={15} />
                            </button>
                            <PermissionGuard permission="students.delete_studentdocument">
                              <button
                                type="button"
                                className="btn btn-icon btn-sm btn-label-secondary"
                                onClick={async () => {
                                  await deleteStudentDocument(doc.id)
                                  refresh()
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </PermissionGuard>
                          </div>
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

      {/* Status History Tab */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-header">
            <h6 className="mb-0">{t('students.tabHistory')}</h6>
          </div>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>{t('students.effectiveDate')}</th>
                  <th>{t('students.transition')}</th>
                  <th>{t('students.reason')}</th>
                  <th>{t('students.changedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {student.status_history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="small">{entry.effective_date}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {entry.previous_status && (
                          <StatusBadge
                            label={entry.previous_status}
                            tone={studentStatusTone(entry.previous_status)}
                          />
                        )}
                        <span>→</span>
                        <StatusBadge
                          label={entry.new_status}
                          tone={studentStatusTone(entry.new_status)}
                        />
                      </div>
                    </td>
                    <td className="small">{entry.reason || '—'}</td>
                    <td className="small text-body-secondary">{entry.changed_by_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <StudentFormModal
        open={editOpen}
        student={student}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          showToast(t('students.updatedSuccess'), 'success')
          refresh()
        }}
      />

      {/* Change Status Modal */}
      <FormModal
        open={statusModalOpen}
        title={t('students.changeStatus')}
        onClose={() => setStatusModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-label-secondary"
              onClick={() => setStatusModalOpen(false)}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" form="student-status-form" className="btn btn-primary">
              {t('common.save')}
            </button>
          </>
        }
      >
        <form id="student-status-form" onSubmit={handleStatusSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={statusForm.status}
              onChange={(e) =>
                setStatusForm({ ...statusForm, status: e.target.value as StudentStatus })
              }
            >
              <option value="applicant">Applicant</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="leave">On Leave</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('students.reason')}</label>
            <textarea
              rows={3}
              className="form-control"
              value={statusForm.reason}
              onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
            />
          </div>
        </form>
      </FormModal>
    </div>
  )
}
