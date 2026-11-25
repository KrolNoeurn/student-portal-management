import { apiClient } from '@/api/client'

export interface AttendanceOverviewStats {
  total: number
  present: number
  late: number
  absent: number
  excused: number
  permission: number
  attendance_rate: number
}

export interface CountItem {
  code?: string
  label: string
  count: number
}

export interface StatusCountItem {
  status: string
  count: number
}

export interface RecentActivityItem {
  id: number
  module: string
  action: string
  object_repr: string
  actor: string
  created_at: string
}

export interface ClassDistributionItem {
  id: number
  code: string
  name: string
  capacity: number
  active_students: number
}

export interface AdminDashboardPayload {
  dashboard_type: 'admin' | 'academic_officer'
  kpis: {
    total_students: number
    active_students: number
    total_academic_years: number
    total_degrees: number
    total_majors: number
    total_classes: number
    total_teachers: number
    active_enrollments: number
  }
  attendance: AttendanceOverviewStats
  enrollment_by_year: CountItem[]
  students_by_major: CountItem[]
  students_by_degree: CountItem[]
  students_by_status: StatusCountItem[]
  recent_activities: RecentActivityItem[]
  class_distribution?: ClassDistributionItem[]
}

export interface InstructorDashboardPayload {
  dashboard_type: 'instructor'
  kpis: {
    assigned_classes: number
    assigned_subjects: number
    total_students: number
    attendance_sessions_taken: number
  }
  assigned_classes_list: Array<{
    id: number
    class_code: string
    class_name: string
    subject_code: string
    subject_name: string
    academic_year: string
  }>
  schedules: Array<{
    id: number
    day_name: string
    start_time: string
    end_time: string
    class_code: string
    subject_code: string
    subject_name: string
    classroom_code: string
  }>
}

export interface StudentDashboardPayload {
  dashboard_type: 'student'
  profile: {
    id: number
    student_code: string
    full_name_en: string
    full_name_km: string
    status: string
  } | null
  enrollment: {
    registration_number: string
    academic_year: string
    degree: string
    major: string
    year_level: string
    class_code: string
  } | null
  attendance: AttendanceOverviewStats
  transcript_summary: {
    cumulative_gpa: string
    credits_earned: string
    subjects_count: number
  }
}

export type DashboardPayload =
  | AdminDashboardPayload
  | InstructorDashboardPayload
  | StudentDashboardPayload

export async function fetchDashboard(): Promise<DashboardPayload> {
  const { data } = await apiClient.get<DashboardPayload>('/dashboard/')
  return data
}
