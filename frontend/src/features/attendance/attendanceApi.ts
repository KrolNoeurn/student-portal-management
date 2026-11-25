import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'permission'

export interface AttendanceSessionItem {
  id: number
  academic_year: number
  academic_year_name: string
  class_section: number
  class_code: string
  class_name: string
  subject: number
  subject_code: string
  subject_name_en: string
  teacher: number | null
  teacher_name_en: string
  session_date: string
  session_slot: number
  topic: string
  status: 'draft' | 'submitted' | 'locked'
  total_count: number
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  permission_count: number
}

export interface AttendanceCorrectionItem {
  id: number
  previous_status: AttendanceStatus
  new_status: AttendanceStatus
  reason: string
  corrected_by_name: string
  corrected_at: string
}

export interface AttendanceRecordItem {
  id: number
  session: number
  session_date: string
  class_code: string
  subject_code: string
  subject_name_en: string
  student: number
  student_code: string
  student_name_en: string
  student_name_km: string
  enrollment: number
  status: AttendanceStatus
  remarks: string
  marked_at: string
  corrections: AttendanceCorrectionItem[]
}

export interface AttendanceSummaryRow {
  student_id: number
  student_code: string
  student_name_en: string
  student_name_km: string
  total_sessions: number
  present: number
  late: number
  absent: number
  excused: number
  permission: number
  attendance_rate: number
  is_warning: boolean
}

export interface AttendanceSummaryResponse {
  warning_threshold_percent: number
  student_count: number
  warning_count: number
  results: AttendanceSummaryRow[]
}

export async function fetchAttendanceSessions(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 50 }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<AttendanceSessionItem>>(
    '/attendance/sessions/',
    { params: clean }
  )
  return data
}

export async function fetchAttendanceRecords(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 100 }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<AttendanceRecordItem>>(
    '/attendance/records/',
    { params: clean }
  )
  return data
}

export async function submitBulkAttendanceApi(payload: {
  class_section: number
  subject: number
  session_date: string
  session_slot: number
  topic?: string
  update_existing?: boolean
  records: Array<{ student: number; status: AttendanceStatus; remarks?: string }>
}) {
  const { data } = await apiClient.post<AttendanceSessionItem>('/attendance/bulk-mark/', payload)
  return data
}

export async function correctAttendanceApi(
  recordId: number,
  payload: { status: AttendanceStatus; reason: string; remarks?: string }
) {
  const { data } = await apiClient.post<AttendanceRecordItem>(
    `/attendance/records/${recordId}/correct/`,
    payload
  )
  return data
}

export async function fetchAttendanceSummary(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = {}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<AttendanceSummaryResponse>('/attendance/summary/', {
    params: clean,
  })
  return data
}

export async function exportAttendanceCsv(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = {}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const response = await apiClient.get('/attendance/export/', {
    params: clean,
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'attendance_report.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
