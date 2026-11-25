import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export interface AcademicYear {
  id: number
  name: string
  start_date: string
  end_date: string
  status: 'planned' | 'active' | 'completed' | 'archived'
  is_current: boolean
  description: string
  semester_count: number
}

export interface Semester {
  id: number
  academic_year: number
  academic_year_name: string
  name: string
  code: string
  sequence_number: number
  start_date: string
  end_date: string
  is_current: boolean
  status: 'planned' | 'active' | 'completed'
}

export interface Degree {
  id: number
  code: string
  name_en: string
  name_km: string
  level:
    | 'certificate'
    | 'higher_diploma'
    | 'associate'
    | 'bachelor'
    | 'master'
    | 'doctorate'
    | 'other'
  duration_years: number
  description: string
  status: 'active' | 'inactive'
  major_count: number
}

export interface Major {
  id: number
  degree: number
  degree_code: string
  degree_name_en: string
  degree_name_km: string
  code: string
  name_en: string
  name_km: string
  description: string
  status: 'active' | 'inactive'
}

export interface YearLevel {
  id: number
  code: string
  name_en: string
  name_km: string
  order_index: number
  status: 'active' | 'inactive'
}

export interface Subject {
  id: number
  code: string
  name_en: string
  name_km: string
  description: string
  credits: string
  theory_hours: number
  practical_hours: number
  total_hours: number
  status: 'active' | 'inactive'
}

export interface Curriculum {
  id: number
  degree: number
  degree_code: string
  degree_name_en: string
  degree_name_km: string
  major: number
  major_code: string
  major_name_en: string
  major_name_km: string
  version: string
  effective_academic_year: number | null
  effective_academic_year_name: string
  description: string
  status: 'draft' | 'active' | 'archived'
  subject_count: number
}

export interface CurriculumSubject {
  id: number
  curriculum: number
  subject: number
  subject_code: string
  subject_name_en: string
  subject_name_km: string
  subject_credits: string
  year_level: number
  year_level_code: string
  year_level_name_en: string
  year_level_name_km: string
  semester_number: number
  is_required: boolean
  prerequisite_subject: number | null
  prerequisite_code: string
}

// Academic Years
export async function fetchAcademicYears(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<AcademicYear>>('/academic-years/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveAcademicYear(payload: Partial<AcademicYear>, id?: number) {
  const { data } = id
    ? await apiClient.patch<AcademicYear>(`/academic-years/${id}/`, payload)
    : await apiClient.post<AcademicYear>('/academic-years/', payload)
  return data
}
export async function deleteAcademicYear(id: number) {
  await apiClient.delete(`/academic-years/${id}/`)
}
export async function setCurrentAcademicYear(id: number) {
  const { data } = await apiClient.post<AcademicYear>(`/academic-years/${id}/set-current/`)
  return data
}

// Semesters
export async function fetchSemesters(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<Semester>>('/semesters/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveSemester(payload: Partial<Semester>, id?: number) {
  const { data } = id
    ? await apiClient.patch<Semester>(`/semesters/${id}/`, payload)
    : await apiClient.post<Semester>('/semesters/', payload)
  return data
}
export async function deleteSemester(id: number) {
  await apiClient.delete(`/semesters/${id}/`)
}
export async function setCurrentSemester(id: number) {
  const { data } = await apiClient.post<Semester>(`/semesters/${id}/set-current/`)
  return data
}

// Degrees
export async function fetchDegrees(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<Degree>>('/degrees/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveDegree(payload: Partial<Degree>, id?: number) {
  const { data } = id
    ? await apiClient.patch<Degree>(`/degrees/${id}/`, payload)
    : await apiClient.post<Degree>('/degrees/', payload)
  return data
}
export async function deleteDegree(id: number) {
  await apiClient.delete(`/degrees/${id}/`)
}

// Majors
export async function fetchMajors(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<Major>>('/majors/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveMajor(payload: Partial<Major>, id?: number) {
  const { data } = id
    ? await apiClient.patch<Major>(`/majors/${id}/`, payload)
    : await apiClient.post<Major>('/majors/', payload)
  return data
}
export async function deleteMajor(id: number) {
  await apiClient.delete(`/majors/${id}/`)
}

// Year Levels
export async function fetchYearLevels(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<YearLevel>>('/year-levels/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveYearLevel(payload: Partial<YearLevel>, id?: number) {
  const { data } = id
    ? await apiClient.patch<YearLevel>(`/year-levels/${id}/`, payload)
    : await apiClient.post<YearLevel>('/year-levels/', payload)
  return data
}
export async function deleteYearLevel(id: number) {
  await apiClient.delete(`/year-levels/${id}/`)
}

// Subjects
export async function fetchSubjects(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<Subject>>('/subjects/', {
    params: { page_size: 50, ...params },
  })
  return data
}
export async function saveSubject(payload: Partial<Subject>, id?: number) {
  const { data } = id
    ? await apiClient.patch<Subject>(`/subjects/${id}/`, payload)
    : await apiClient.post<Subject>('/subjects/', payload)
  return data
}
export async function deleteSubject(id: number) {
  await apiClient.delete(`/subjects/${id}/`)
}

// Curricula & Curriculum Subjects
export async function fetchCurricula(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<Curriculum>>('/curricula/', {
    params: { page_size: 100, ...params },
  })
  return data
}
export async function saveCurriculum(payload: Partial<Curriculum>, id?: number) {
  const { data } = id
    ? await apiClient.patch<Curriculum>(`/curricula/${id}/`, payload)
    : await apiClient.post<Curriculum>('/curricula/', payload)
  return data
}
export async function deleteCurriculum(id: number) {
  await apiClient.delete(`/curricula/${id}/`)
}

export async function fetchCurriculumSubjects(curriculumId: number) {
  const { data } = await apiClient.get<PaginatedResponse<CurriculumSubject>>(
    '/curriculum-subjects/',
    { params: { curriculum: curriculumId, page_size: 100 } }
  )
  return data
}
export async function addCurriculumSubject(payload: Partial<CurriculumSubject>) {
  const { data } = await apiClient.post<CurriculumSubject>('/curriculum-subjects/', payload)
  return data
}
export async function deleteCurriculumSubject(id: number) {
  await apiClient.delete(`/curriculum-subjects/${id}/`)
}
