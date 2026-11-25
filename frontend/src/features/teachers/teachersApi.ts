import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export interface TeacherItem {
  id: number
  user: number | null
  teacher_code: string
  full_name_en: string
  full_name_km: string
  gender: 'male' | 'female' | 'other'
  email: string
  phone: string
  specialization: string
  qualification: string
  employment_type: 'full_time' | 'part_time' | 'visiting'
  status: 'active' | 'on_leave' | 'inactive'
  notes: string
  assignment_count: number
}

export interface TeachingAssignmentItem {
  id: number
  teacher: number
  teacher_code: string
  teacher_name_en: string
  teacher_name_km: string
  academic_year: number
  academic_year_name: string
  semester: number | null
  semester_name: string
  class_section: number
  class_code: string
  class_name: string
  subject: number
  subject_code: string
  subject_name_en: string
  subject_name_km: string
  role: 'primary' | 'assistant'
  status: 'active' | 'completed' | 'cancelled'
}

export interface ClassScheduleItem {
  id: number
  teaching_assignment: number
  academic_year: number
  academic_year_name: string
  semester: number | null
  semester_name: string
  class_section: number
  class_code: string
  class_name: string
  teacher: number
  teacher_code: string
  teacher_name_en: string
  teacher_name_km: string
  subject: number
  subject_code: string
  subject_name_en: string
  subject_name_km: string
  classroom: number
  classroom_code: string
  classroom_name: string
  day_of_week: number
  day_name: string
  start_time: string
  end_time: string
  is_active: boolean
  notes: string
}

export interface ScheduleConflict {
  type: 'teacher' | 'classroom' | 'class_section'
  schedule_id: number
  message: string
}

export async function fetchTeachers(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 50 }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<TeacherItem>>('/teachers/', {
    params: clean,
  })
  return data
}
export async function saveTeacher(payload: Partial<TeacherItem>, id?: number) {
  const { data } = id
    ? await apiClient.patch<TeacherItem>(`/teachers/${id}/`, payload)
    : await apiClient.post<TeacherItem>('/teachers/', payload)
  return data
}
export async function archiveTeacher(id: number) {
  await apiClient.delete(`/teachers/${id}/`)
}

export async function fetchTeachingAssignments(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 100 }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<TeachingAssignmentItem>>(
    '/teaching-assignments/',
    { params: clean }
  )
  return data
}
export async function createTeachingAssignmentApi(payload: {
  teacher: number
  class_section: number
  subject: number
  semester?: number | null
  role: 'primary' | 'assistant'
}) {
  const { data } = await apiClient.post<TeachingAssignmentItem>('/teaching-assignments/', payload)
  return data
}
export async function cancelTeachingAssignmentApi(id: number) {
  await apiClient.delete(`/teaching-assignments/${id}/`)
}

export async function fetchSchedules(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 100, is_active: 'true' }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<ClassScheduleItem>>('/schedules/', {
    params: clean,
  })
  return data
}
export async function checkScheduleConflictsApi(payload: {
  teaching_assignment: number
  classroom: number
  day_of_week: number
  start_time: string
  end_time: string
  exclude_schedule_id?: number
}) {
  const { data } = await apiClient.post<{
    has_conflicts: boolean
    conflicts: ScheduleConflict[]
  }>('/schedules/check-conflicts/', payload)
  return data
}
export async function createScheduleApi(payload: {
  teaching_assignment: number
  classroom: number
  day_of_week: number
  start_time: string
  end_time: string
  notes?: string
}) {
  const { data } = await apiClient.post<ClassScheduleItem>('/schedules/', payload)
  return data
}
export async function deleteScheduleApi(id: number) {
  await apiClient.delete(`/schedules/${id}/`)
}
