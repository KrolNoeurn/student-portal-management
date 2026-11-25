import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import type { ApiErrorEnvelope } from '@/api/types'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

let inMemoryAccessToken: string | null = null
let onAuthFailureHandler: (() => void) | null = null
let refreshPromise: Promise<string | null> | null = null

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken
}

export function registerAuthFailureHandler(handler: () => void) {
  onAuthFailureHandler = handler
}

async function requestNewAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ access: string }>(`${baseURL}/auth/token/refresh/`, {}, { withCredentials: true })
      .then((res) => {
        const nextToken = res.data.access
        setAccessToken(nextToken)
        return nextToken
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

apiClient.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`
  }
  return config
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const requestUrl = original?.url || ''

    const isAuthEndpoint =
      requestUrl.includes('/auth/login/') ||
      requestUrl.includes('/auth/token/refresh/') ||
      requestUrl.includes('/auth/logout/')

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true
      const newToken = await requestNewAccessToken()
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return apiClient(original)
      }
      if (onAuthFailureHandler) {
        onAuthFailureHandler()
      }
    }

    return Promise.reject(error)
  }
)

export function extractApiErrorMessage(err: unknown, fallback = 'Unexpected error occurred.'): string {
  const axiosErr = err as AxiosError<ApiErrorEnvelope>
  const envelope = axiosErr?.response?.data?.error
  if (envelope) {
    // Surface first field error if details has specific messages
    if (envelope.details && typeof envelope.details === 'object') {
      const firstVal = Object.values(envelope.details)[0]
      if (Array.isArray(firstVal) && firstVal.length > 0) {
        return String(firstVal[0])
      }
      if (typeof firstVal === 'string' && firstVal.length > 0) {
        return firstVal
      }
    }
    if (envelope.message) {
      return envelope.message
    }
  }
  if (axiosErr?.message) {
    return axiosErr.message
  }
  return fallback
}
