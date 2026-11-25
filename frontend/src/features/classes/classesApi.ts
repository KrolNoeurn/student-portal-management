import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'
import type { EnrollmentItem } from '@/features/enrollments/enrollmentsApi'

export interface ClassroomItem {
  id: number
  code: string
  name: string
  building: string
  floor: string
  capacity: number
  room_type: 'lecture' | 'lab' | 'seminar' | 'auditorium'
  status: 'active' | 'maintenance' | 'inactive'
}

export interface ClassSectionItem {
  id: number
  code: string
  name: string
  academic_year: number
  academic_year_name: string
  semester: number | null
  semester_name: string
  degree: number
  degree_code: string
  degree_name_en: string
  degree_name_km: string
  major: number
  major_code: string
  major_name_en: string
  major_name_km: string
  year_level: number
  year_level_code: string
  year_level_name_en: string
  year_level_name_km: string
  default_classroom: number | null
  classroom_code: string
  classroom_name: string
  homeroom_advisor: number | null
  advisor_name: string
  capacity: number
  active_student_count: number
  subject_count: number
  status: 'open' | 'full' | 'in_progress' | 'completed' | 'archived'
  notes: string
}

export interface ClassSubjectItem {
  id: number
  class_section: number
  subject: number
  subject_code: string
  subject_name_en: string
  subject_name_km: string
  subject_credits: string
  semester: number | null
  semester_name: string
  status: 'active' | 'completed'
}

export interface ClassMembershipItem {
  id: number
  class_section: number
  class_code: string
  enrollment: number
  registration_number: string
  student: number
  student_code: string
  student_name_en: string
  student_name_km: string
  student_gender: string
  student_phone: string
  assigned_date: string
  left_date: string | null
  status: 'active' | 'transferred' | 'completed' | 'dropped'
}

export interface ClassTransferItem {
  id: number
  student: number
  student_code: string
  student_name_en: string
  from_class_section: number
  from_class_code: string
  to_class_section: number
  to_class_code: string
  transfer_date: string
  reason: string
  transferred_by_name: string
  created_at: string
}

// Classrooms
export async function fetchClassrooms(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<ClassroomItem>>('/classrooms/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveClassroom(payload: Partial<ClassroomItem>, id?: number) {
  const { data } = id
    ? await apiClient.patch<ClassroomItem>(`/classrooms/${id}/`, payload)
    : await apiClient.post<ClassroomItem>('/classrooms/', payload)
  return data
}
export async function deleteClassroom(id: number) {
  await apiClient.delete(`/classrooms/${id}/`)
}

// Class Sections
export async function fetchClasses(params: Record<string, string | number>) {
  const clean: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) clean[k] = v
  }
  const { data } = await apiClient.get<PaginatedResponse<ClassSectionItem>>('/classes/', {
    params: clean,
  })
  return data
}
export async function fetchClassDetail(id: number | string) {
  const { data } = await apiClient.get<ClassSectionItem>(`/classes/${id}/`)
  return data
}
export async function saveClassSection(payload: Partial<ClassSectionItem>, id?: number) {
  const { data } = id
    ? await apiClient.patch<ClassSectionItem>(`/classes/${id}/`, payload)
    : await apiClient.post<ClassSectionItem>('/classes/', payload)
  return data
}
export async function archiveClassSection(id: number) {
  await apiClient.delete(`/classes/${id}/`)
}

// Class Roster & Transfers
export async function fetchClassRoster(classId: number | string, statusFilter?: string) {
  const { data } = await apiClient.get<ClassMembershipItem[]>(`/classes/${classId}/students/`, {
    params: statusFilter ? { status: statusFilter } : undefined,
  })
  return data
}
export async function fetchEligibleEnrollments(classId: number | string) {
  const { data } = await apiClient.get<EnrollmentItem[]>(
    `/classes/${classId}/eligible-enrollments/`
  )
  return data
}
export async function assignStudentToClassApi(classId: number | string, enrollmentId: number) {
  const { data } = await apiClient.post<ClassMembershipItem>(
    `/classes/${classId}/assign-student/`,
    { enrollment: enrollmentId }
  )
  return data
}
export async function transferStudentClassApi(
  classId: number | string,
  payload: { membership: number; target_class_section: number; reason?: string }
) {
  const { data } = await apiClient.post<ClassMembershipItem>(
    `/classes/${classId}/transfer-student/`,
    payload
  )
  return data
}
export async function fetchClassTransfers(classId: number | string) {
  const { data } = await apiClient.get<ClassTransferItem[]>(`/classes/${classId}/transfers/`)
  return data
}
export async function dropClassMembership(membershipId: number) {
  await apiClient.delete(`/class-memberships/${membershipId}/`)
}

// Class Subjects
export async function fetchClassSubjects(classId: number | string) {
  const { data } = await apiClient.get<PaginatedResponse<ClassSubjectItem>>('/class-subjects/', {
    params: { class_section: classId, page_size: 100 },
  })
  return data
}
export async function addClassSubjectApi(payload: {
  class_section: number
  subject: number
  semester?: number | null
}) {
  const { data } = await apiClient.post<ClassSubjectItem>('/class-subjects/', payload)
  return data
}
export async function removeClassSubjectApi(id: number) {
  await apiClient.delete(`/class-subjects/${id}/`)
}
