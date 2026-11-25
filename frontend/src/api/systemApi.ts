import { apiClient } from '@/api/client'
import type { BootstrapConfigResponse, HealthResponse } from '@/api/types'

export async function fetchApiHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health/')
  return data
}

export async function fetchBootstrapConfig(): Promise<BootstrapConfigResponse> {
  const { data } = await apiClient.get<BootstrapConfigResponse>('/system/bootstrap/')
  return data
}
