import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export interface AssessmentTypeItem {
  id: number
  code: string
  name_en: string
  name_km: string
  default_weight_percent: string
  status: 'active' | 'inactive'
}

export interface GradingScaleItem {
  id: number
  letter_grade: string
  min_percentage: string
  max_percentage: string
  grade_point: string
  is_passing: boolean
  description: string
}

export interface AssessmentItem {
  id: number
  academic_year: number
  academic_year_name: string
  semester: number | null
  class_section: number
  class_code: string
  subject: number
  subject_code: string
  subject_name_en: string
  assessment_type: number
  assessment_type_code: string
  assessment_type_name: string
  title: string
  max_score: string
  weight_percent: string
  assessment_date: string | null
  is_published: boolean
  scored_count: number
}

export interface StudentScoreItem {
  id: number
  assessment: number
  enrollment: number
  student: number
  student_code: string
  student_name_en: string
  student_name_km: string
  score: string
  remarks: string
}

export interface SubjectGradeItem {
  id: number
  enrollment: number
  student: number
  student_code: string
  student_name_en: string
  student_name_km: string
  class_section: number
  class_code: string
  subject: number
  subject_code: string
  subject_name_en: string
  total_percentage: string
  letter_grade: string
  grade_point: string
  credits_attempted: string
  credits_earned: string
  is_passing: boolean
  status: 'draft' | 'verified' | 'published'
}

export interface TranscriptResponse {
  student: {
    id: number
    student_code: string
    full_name_en: string
    full_name_km: string
    status: string
  }
  summary: {
    cumulative_gpa: string
    credits_attempted: string
    credits_earned: string
    subjects_count: number
  }
  grades: Array<{
    id: number
    academic_year: string
    major_code: string
    year_level: string
    class_code: string
    subject_code: string
    subject_name_en: string
    subject_name_km: string
    credits_attempted: string
    credits_earned: string
    total_percentage: string
    letter_grade: string
    grade_point: string
    is_passing: boolean
    status: string
  }>
}

export async function fetchAssessmentTypes() {
  const { data } = await apiClient.get<PaginatedResponse<AssessmentTypeItem>>(
    '/assessment-types/',
    { params: { page_size: 100 } }
  )
  return data
}

export async function fetchGradingScales() {
  const { data } = await apiClient.get<PaginatedResponse<GradingScaleItem>>('/grading-scales/', {
    params: { page_size: 100 },
  })
  return data
}

export async function fetchAssessments(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 100 }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<AssessmentItem>>('/assessments/', {
    params: clean,
  })
  return data
}

export async function createAssessmentApi(payload: {
  class_section: number
  subject: number
  assessment_type: number
  title: string
  max_score: string
  weight_percent: string
  assessment_date?: string | null
}) {
  const { data } = await apiClient.post<AssessmentItem>('/assessments/', payload)
  return data
}

export async function fetchAssessmentScores(assessmentId: number) {
  const { data } = await apiClient.get<StudentScoreItem[]>(`/assessments/${assessmentId}/scores/`)
  return data
}

export async function bulkSaveScoresApi(
  assessmentId: number,
  scores: Array<{ enrollment: number; score: string; remarks?: string }>
) {
  const { data } = await apiClient.post<StudentScoreItem[]>(
    `/assessments/${assessmentId}/bulk-scores/`,
    { scores }
  )
  return data
}

export async function fetchGrades(params?: Record<string, string | number>) {
  const clean: Record<string, string | number> = { page_size: 100 }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined && v !== null) clean[k] = v
    }
  }
  const { data } = await apiClient.get<PaginatedResponse<SubjectGradeItem>>('/grades/', {
    params: clean,
  })
  return data
}

export async function calculateGradesApi(payload: {
  class_section: number
  subject: number
  publish: boolean
}) {
  const { data } = await apiClient.post<SubjectGradeItem[]>('/grades/calculate/', payload)
  return data
}

export async function fetchStudentTranscript(studentId?: number | string) {
  const { data } = await apiClient.get<TranscriptResponse>('/grades/transcript/', {
    params: studentId ? { student: studentId } : undefined,
  })
  return data
}
