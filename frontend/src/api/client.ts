import axios, { type AxiosError } from 'axios'

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

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token
}

apiClient.interceptors.request.use((config) => {
  if (inMemoryAccessToken) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`
  }
  return config
})

export function extractApiErrorMessage(err: unknown, fallback = 'Unexpected error occurred.'): string {
  const axiosErr = err as AxiosError<ApiErrorEnvelope>
  const envelopeMsg = axiosErr?.response?.data?.error?.message
  if (envelopeMsg) {
    return envelopeMsg
  }
  if (axiosErr?.message) {
    return axiosErr.message
  }
  return fallback
}
