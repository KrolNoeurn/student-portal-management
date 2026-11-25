import { apiClient } from '@/api/client'

export type ReportType =
  | 'students'
  | 'enrollments-by-year'
  | 'students-by-degree'
  | 'students-by-major'
  | 'students-by-class'
  | 'students-by-status'
  | 'attendance-monthly'
  | 'academic-progress'

export interface ReportResponse {
  report_type: ReportType
  columns: string[]
  count: number
  results: Array<Record<string, string | number | null>>
}

export interface ReportQueryParams {
  academic_year?: string
  degree?: string
  major?: string
  year_level?: string
  class_section?: string
  month?: string
  status?: string
}

export async function fetchInstitutionalReport(
  reportType: ReportType,
  params?: ReportQueryParams,
): Promise<ReportResponse> {
  const { data } = await apiClient.get<ReportResponse>(`/reports/${reportType}/`, { params })
  return data
}

export async function exportInstitutionalReportCsv(
  reportType: ReportType,
  params?: ReportQueryParams,
): Promise<void> {
  const response = await apiClient.get<Blob>(`/reports/${reportType}/`, {
    params: { ...params, export: 'csv' },
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `report_${reportType}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
