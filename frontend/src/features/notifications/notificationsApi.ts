import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'

export interface NotificationItem {
  id: number
  category: string
  title_en: string
  title_km: string
  message_en: string
  message_km: string
  link_url: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export async function fetchNotifications(params?: Record<string, string | number | boolean>) {
  const { data } = await apiClient.get<PaginatedResponse<NotificationItem>>('/notifications/', {
    params: { page_size: 15, ...params },
  })
  return data
}

export async function fetchUnreadNotificationCount() {
  const { data } = await apiClient.get<{ unread_count: number }>('/notifications/unread-count/')
  return data
}

export async function markNotificationRead(id: number) {
  const { data } = await apiClient.post<NotificationItem>(`/notifications/${id}/mark-read/`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await apiClient.post<{ marked_read: number }>('/notifications/mark-all-read/')
  return data
}
