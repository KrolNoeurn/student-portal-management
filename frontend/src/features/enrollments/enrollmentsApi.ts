import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export type EnrollmentType =
  | 'new'
  | 're_enrollment'
  | 'promotion'
  | 'transfer_in'
  | 'program_change'

export type EnrollmentStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'promoted'
  | 'transferred'
  | 'suspended'
  | 'withdrawn'
  | 'cancelled'

export interface EnrollmentHistoryItem {
  id: number
  event_type: string
  previous_data: Record<string, unknown>
  new_data: Record<string, unknown>
  reason: string
  actor_name: string
  created_at: string
}

export interface EnrollmentItem {
  id: number
  registration_number: string
  student: number
  student_code: string
  student_name_en: string
  student_name_km: string
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
  enrollment_type: EnrollmentType
  enrollment_date: string
  status: EnrollmentStatus
  previous_enrollment: number | null
  previous_registration_number: string
  remarks: string
  history: EnrollmentHistoryItem[]
  created_at: string
}

export async function fetchEnrollments(params: Record<string, string | number>) {
  const clean: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined && v !== null) clean[k] = v
  }
  const { data } = await apiClient.get<PaginatedResponse<EnrollmentItem>>('/enrollments/', {
    params: clean,
  })
  return data
}

export async function createEnrollmentApi(payload: {
  student: number
  academic_year: number
  semester?: number | null
  degree: number
  major: number
  year_level: number
  enrollment_type: EnrollmentType
  enrollment_date: string
  status: EnrollmentStatus
  remarks?: string
}) {
  const { data } = await apiClient.post<EnrollmentItem>('/enrollments/', payload)
  return data
}

export async function promoteEnrollmentApi(
  id: number,
  payload: {
    target_academic_year: number
    target_year_level: number
    target_semester?: number | null
    enrollment_type: 'promotion' | 're_enrollment'
    remarks?: string
  }
) {
  const { data } = await apiClient.post<EnrollmentItem>(`/enrollments/${id}/promote/`, payload)
  return data
}

export async function changeProgramApi(
  id: number,
  payload: {
    degree?: number
    major?: number
    year_level?: number
    status?: EnrollmentStatus
    reason?: string
  }
) {
  const { data } = await apiClient.post<EnrollmentItem>(
    `/enrollments/${id}/change-program/`,
    payload
  )
  return data
}
