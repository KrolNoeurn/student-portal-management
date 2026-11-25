import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export type StudentStatus =
  | 'applicant'
  | 'active'
  | 'suspended'
  | 'leave'
  | 'transferred'
  | 'graduated'
  | 'withdrawn'

export interface StudentGuardian {
  id: number
  student: number
  full_name: string
  relationship: 'father' | 'mother' | 'guardian' | 'sibling' | 'other'
  phone: string
  email: string
  occupation: string
  address: string
  is_primary: boolean
}

export interface StudentEducation {
  id: number
  student: number
  institution_name: string
  qualification: string
  graduation_year: number | null
  gpa_or_grade: string
  certificate_number: string
  notes: string
}

export interface StudentDocument {
  id: number
  student: number
  document_type:
    | 'national_id'
    | 'birth_certificate'
    | 'high_school_diploma'
    | 'transcript'
    | 'photo'
    | 'other'
  title: string
  file: string
  file_size: number
  mime_type: string
  uploaded_by_name: string
  created_at: string
}

export interface StudentStatusLog {
  id: number
  previous_status: string
  new_status: string
  effective_date: string
  reason: string
  changed_by_name: string
  created_at: string
}

export interface StudentListItem {
  id: number
  public_id: string
  student_code: string
  full_name_en: string
  full_name_km: string
  gender: 'male' | 'female' | 'other'
  date_of_birth: string
  nationality: string
  phone: string
  email: string
  province: string
  profile_photo: string | null
  status: StudentStatus
  registration_state: 'draft' | 'completed'
  created_at: string
}

export interface StudentDetail extends StudentListItem {
  user: number | null
  national_id_number: string
  address_line: string
  commune: string
  district: string
  country: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
  notes: string
  guardians: StudentGuardian[]
  education_history: StudentEducation[]
  documents: StudentDocument[]
  status_history: StudentStatusLog[]
  is_deleted: boolean
  updated_at: string
}

export async function fetchStudents(params: Record<string, string | number>) {
  const clean: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) clean[k] = v
  }
  const { data } = await apiClient.get<PaginatedResponse<StudentListItem>>('/students/', {
    params: clean,
  })
  return data
}

export async function fetchStudentDetail(id: number | string) {
  const { data } = await apiClient.get<StudentDetail>(`/students/${id}/`)
  return data
}

export async function saveStudent(payload: Partial<StudentDetail>, id?: number) {
  const { data } = id
    ? await apiClient.patch<StudentDetail>(`/students/${id}/`, payload)
    : await apiClient.post<StudentDetail>('/students/', payload)
  return data
}

export async function archiveStudent(id: number) {
  await apiClient.delete(`/students/${id}/`)
}

export async function checkDuplicateStudent(payload: {
  full_name_en?: string
  date_of_birth?: string
  national_id_number?: string
  exclude_id?: number
}) {
  const { data } = await apiClient.post<{
    has_duplicates: boolean
    matches: StudentListItem[]
  }>('/students/check-duplicate/', payload)
  return data
}

export async function changeStudentStatus(
  id: number,
  payload: { status: StudentStatus; effective_date?: string; reason?: string }
) {
  const { data } = await apiClient.post<StudentDetail>(`/students/${id}/change-status/`, payload)
  return data
}

export async function uploadStudentPhoto(id: number, file: File) {
  const formData = new FormData()
  formData.append('profile_photo', file)
  const { data } = await apiClient.post<StudentDetail>(`/students/${id}/upload-photo/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function exportStudentsCsv(params: Record<string, string | number>) {
  const clean: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) clean[k] = v
  }
  const response = await apiClient.get('/students/export/', {
    params: clean,
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'students_export.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// Guardians
export async function addStudentGuardian(payload: Partial<StudentGuardian>) {
  const { data } = await apiClient.post<StudentGuardian>('/student-guardians/', payload)
  return data
}
export async function deleteStudentGuardian(id: number) {
  await apiClient.delete(`/student-guardians/${id}/`)
}

// Education
export async function addStudentEducation(payload: Partial<StudentEducation>) {
  const { data } = await apiClient.post<StudentEducation>('/student-education/', payload)
  return data
}
export async function deleteStudentEducation(id: number) {
  await apiClient.delete(`/student-education/${id}/`)
}

// Documents
export async function uploadStudentDocument(payload: {
  student: number
  document_type: string
  title: string
  file: File
}) {
  const formData = new FormData()
  formData.append('student', String(payload.student))
  formData.append('document_type', payload.document_type)
  formData.append('title', payload.title)
  formData.append('file', payload.file)
  const { data } = await apiClient.post<StudentDocument>('/student-documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function downloadStudentDocument(id: number, title: string) {
  const response = await apiClient.get(`/student-documents/${id}/download/`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', title)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function deleteStudentDocument(id: number) {
  await apiClient.delete(`/student-documents/${id}/`)
}
