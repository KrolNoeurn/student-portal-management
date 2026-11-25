export interface PaginatedResponse<T> {
  count: number
  page: number
  page_size: number
  total_pages: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    details: Record<string, string[] | string>
  }
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  service: string
  api_version: string
  database: {
    connected: boolean
    vendor: string
  }
  timestamp: string
}

export interface BootstrapConfigResponse {
  institution: {
    name_en: string
    name_km: string
    short_name: string
  }
  appearance: {
    default_language: 'en' | 'km'
    default_layout: 'vertical' | 'horizontal'
    default_theme: 'light' | 'dark'
    page_size: number
  }
}
