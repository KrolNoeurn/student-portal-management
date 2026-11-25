import { apiClient } from '@/api/client'

export interface RoleSummary {
  id: number
  name: string
}

export interface AuthUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  full_name_km: string
  phone: string
  avatar: string | null
  is_active: boolean
  is_superuser: boolean
  must_change_password: boolean
  preferred_language: 'en' | 'km'
  preferred_layout: 'vertical' | 'horizontal'
  preferred_theme: 'light' | 'dark'
  roles: RoleSummary[]
  last_login: string | null
  date_joined: string
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  access: string
  user: AuthUser
  permissions: string[]
}

export interface PermissionsResponse {
  is_superuser: boolean
  roles: RoleSummary[]
  permissions: string[]
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface UpdatePreferencesPayload {
  first_name?: string
  last_name?: string
  full_name_km?: string
  phone?: string
  preferred_language?: 'en' | 'km'
  preferred_layout?: 'vertical' | 'horizontal'
  preferred_theme?: 'light' | 'dark'
}

export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login/', payload)
  return data
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout/')
}

export async function refreshAccessTokenApi(): Promise<{ access: string }> {
  const { data } = await apiClient.post<{ access: string }>('/auth/token/refresh/')
  return data
}

export async function fetchCurrentUserApi(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me/')
  return data
}

export async function fetchMyPermissionsApi(): Promise<PermissionsResponse> {
  const { data } = await apiClient.get<PermissionsResponse>('/auth/me/permissions/')
  return data
}

export async function updateMyPreferencesApi(
  payload: UpdatePreferencesPayload
): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>('/auth/me/preferences/', payload)
  return data
}

export async function changePasswordApi(
  payload: ChangePasswordPayload
): Promise<{ detail: string; access: string }> {
  const { data } = await apiClient.post<{ detail: string; access: string }>(
    '/auth/password/change/',
    payload
  )
  return data
}
