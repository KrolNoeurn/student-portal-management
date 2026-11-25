import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { extractApiErrorMessage } from '@/api/client'
import { FormModal } from '@/components/ui/FormModal'
import {
  checkDuplicateStudent,
  saveStudent,
  type StudentDetail,
  type StudentListItem,
  type StudentStatus,
} from '@/features/students/studentsApi'

interface StudentFormModalProps {
  open: boolean
  student: StudentDetail | null
  onClose: () => void
  onSaved: (saved: StudentDetail) => void
}

const EMPTY_FORM = {
  student_code: '',
  full_name_en: '',
  full_name_km: '',
  gender: 'male' as 'male' | 'female' | 'other',
  date_of_birth: '',
  nationality: 'Cambodian',
  national_id_number: '',
  phone: '',
  email: '',
  address_line: '',
  commune: '',
  district: '',
  province: '',
  country: 'Cambodia',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: '',
  status: 'active' as StudentStatus,
  registration_state: 'completed' as 'draft' | 'completed',
  notes: '',
}

export function StudentFormModal({ open, student, onClose, onSaved }: StudentFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY_FORM)
  const [duplicates, setDuplicates] = useState<StudentListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setDuplicates([])
    if (student) {
      setForm({
        student_code: student.student_code,
        full_name_en: student.full_name_en,
        full_name_km: student.full_name_km,
        gender: student.gender,
        date_of_birth: student.date_of_birth,
        nationality: student.nationality,
        national_id_number: student.national_id_number,
        phone: student.phone,
        email: student.email,
        address_line: student.address_line,
        commune: student.commune,
        district: student.district,
        province: student.province,
        country: student.country,
        emergency_contact_name: student.emergency_contact_name,
        emergency_contact_relationship: student.emergency_contact_relationship,
        emergency_contact_phone: student.emergency_contact_phone,
        status: student.status,
        registration_state: student.registration_state,
        notes: student.notes,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [open, student])

  const runDuplicateCheck = async () => {
    if (!form.full_name_en.trim() && !form.national_id_number.trim()) return
    try {
      const res = await checkDuplicateStudent({
        full_name_en: form.full_name_en,
        date_of_birth: form.date_of_birth || undefined,
        national_id_number: form.national_id_number,
        exclude_id: student?.id,
      })
      setDuplicates(res.matches)
    } catch {
      // Non-blocking check
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const saved = await saveStudent(form, student?.id)
      onSaved(saved)
    } catch (err) {
      setError(extractApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal
      open={open}
      size="xl"
      title={student ? t('students.editStudent') : t('students.registerStudent')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-label-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="student-reg-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? t('common.loading') : t('common.save')}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger py-2 px-3 small mb-3">{error}</div>}

      {duplicates.length > 0 && (
        <div className="alert alert-warning d-flex gap-2 align-items-start py-2 px-3 small mb-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-1" />
          <div>
            <div className="fw-semibold">{t('students.duplicateWarning')}</div>
            <ul className="mb-0 ps-3">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <code>{d.student_code}</code> — {d.full_name_en} ({d.date_of_birth})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <form id="student-reg-form" onSubmit={handleSubmit}>
        <h6 className="text-primary small text-uppercase mb-3">{t('students.sectionPersonal')}</h6>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label">{t('students.studentCode')}</label>
            <input
              className="form-control"
              placeholder={t('students.autoGeneratedPlaceholder')}
              value={form.student_code}
              onChange={(e) => setForm({ ...form, student_code: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.fullNameEn')} *</label>
            <input
              required
              className="form-control"
              value={form.full_name_en}
              onBlur={runDuplicateCheck}
              onChange={(e) => setForm({ ...form, full_name_en: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.fullNameKm')}</label>
            <input
              className="form-control"
              value={form.full_name_km}
              onChange={(e) => setForm({ ...form, full_name_km: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">{t('students.gender')} *</label>
            <select
              className="form-select"
              value={form.gender}
              onChange={(e) =>
                setForm({ ...form, gender: e.target.value as 'male' | 'female' | 'other' })
              }
            >
              <option value="male">{t('students.genderMale')}</option>
              <option value="female">{t('students.genderFemale')}</option>
              <option value="other">{t('students.genderOther')}</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">{t('students.dob')} *</label>
            <input
              required
              type="date"
              className="form-control"
              value={form.date_of_birth}
              onBlur={runDuplicateCheck}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">{t('students.nationality')}</label>
            <input
              className="form-control"
              value={form.nationality}
              onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">{t('students.nationalId')}</label>
            <input
              className="form-control"
              value={form.national_id_number}
              onBlur={runDuplicateCheck}
              onChange={(e) => setForm({ ...form, national_id_number: e.target.value })}
            />
          </div>
        </div>

        <h6 className="text-primary small text-uppercase mb-3">{t('students.sectionContact')}</h6>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label">{t('users.phone')}</label>
            <input
              className="form-control"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('users.email')}</label>
            <input
              type="email"
              className="form-control"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.province')}</label>
            <input
              className="form-control"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.district')}</label>
            <input
              className="form-control"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </div>
          <div className="col-md-8">
            <label className="form-label">{t('students.address')}</label>
            <input
              className="form-control"
              value={form.address_line}
              onChange={(e) => setForm({ ...form, address_line: e.target.value })}
            />
          </div>
        </div>

        <h6 className="text-primary small text-uppercase mb-3">
          {t('students.sectionEmergencyStatus')}
        </h6>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">{t('students.emergencyName')}</label>
            <input
              className="form-control"
              value={form.emergency_contact_name}
              onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.emergencyRelationship')}</label>
            <input
              className="form-control"
              value={form.emergency_contact_relationship}
              onChange={(e) =>
                setForm({ ...form, emergency_contact_relationship: e.target.value })
              }
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.emergencyPhone')}</label>
            <input
              className="form-control"
              value={form.emergency_contact_phone}
              onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('common.status')}</label>
            <select
              className="form-select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
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
          <div className="col-md-4">
            <label className="form-label">{t('students.registrationState')}</label>
            <select
              className="form-select"
              value={form.registration_state}
              onChange={(e) =>
                setForm({
                  ...form,
                  registration_state: e.target.value as 'draft' | 'completed',
                })
              }
            >
              <option value="completed">{t('common.completed')}</option>
              <option value="draft">{t('students.draft')}</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.notes')}</label>
            <input
              className="form-control"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </form>
    </FormModal>
  )
}
