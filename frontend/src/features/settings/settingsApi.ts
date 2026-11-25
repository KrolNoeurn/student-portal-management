import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export interface SystemSettingItem {
  id: number
  key: string
  category: string
  value: unknown
  description: string
  is_public: boolean
  updated_at: string
}

export interface BackupRecordItem {
  id: number
  filename: string
  file_size_bytes: number
  sha256_checksum: string
  backup_type: string
  status: string
  error_message: string
  triggered_by_name: string
  created_at: string
}

export interface AuditLogItem {
  id: number
  actor: number | null
  actor_name: string
  action: string
  module: string
  object_type: string
  object_id: string
  object_repr: string
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export async function fetchSystemSettings(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<SystemSettingItem>>('/settings/', {
    params: { page_size: 100, ...params },
  })
  return data
}

export async function updateSystemSetting(
  id: number,
  payload: { value: unknown; description?: string },
) {
  const { data } = await apiClient.patch<SystemSettingItem>(`/settings/${id}/`, payload)
  return data
}

export async function fetchBackups(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<BackupRecordItem>>('/backups/', {
    params,
  })
  return data
}

export async function createDatabaseBackup() {
  const { data } = await apiClient.post<BackupRecordItem>('/backups/create-backup/')
  return data
}

export async function fetchAuditLogs(params?: Record<string, string | number>) {
  const { data } = await apiClient.get<PaginatedResponse<AuditLogItem>>('/audit-logs/', {
    params,
  })
  return data
}
