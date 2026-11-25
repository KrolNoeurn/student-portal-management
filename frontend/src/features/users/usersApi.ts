import { apiClient } from '@/api/client'
import type { PaginatedResponse } from '@/api/types'
import type { AuthUser, RoleSummary } from '@/auth/authApi'

export interface PermissionItem {
  id: number
  name: string
  codename: string
  app_label: string
  model: string
  code: string
}

export interface RoleDetail {
  id: number
  name: string
  permissions: PermissionItem[]
  permission_count: number
  user_count: number
}

export interface UserQueryParams {
  page?: number
  page_size?: number
  search?: string
  is_active?: string
  role?: string
}

export interface CreateUserPayload {
  username: string
  email: string
  password: string
  first_name?: string
  last_name?: string
  full_name_km?: string
  phone?: string
  is_active?: boolean
  must_change_password?: boolean
  role_ids: number[]
}

export interface UpdateUserPayload {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  full_name_km?: string
  phone?: string
  is_active?: boolean
  role_ids?: number[]
}

export interface SaveRolePayload {
  name: string
  permission_ids: number[]
}

export async function fetchUsers(params: UserQueryParams): Promise<PaginatedResponse<AuthUser>> {
  const cleanParams: Record<string, string | number> = {}
  if (params.page) cleanParams.page = params.page
  if (params.page_size) cleanParams.page_size = params.page_size
  if (params.search?.trim()) cleanParams.search = params.search.trim()
  if (params.is_active === 'true' || params.is_active === 'false') {
    cleanParams.is_active = params.is_active
  }
  if (params.role) cleanParams.role = params.role

  const { data } = await apiClient.get<PaginatedResponse<AuthUser>>('/users/', {
    params: cleanParams,
  })
  return data
}

export async function createUser(payload: CreateUserPayload): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>('/users/', payload)
  return data
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<AuthUser> {
  const { data } = await apiClient.patch<AuthUser>(`/users/${id}/`, payload)
  return data
}

export async function deactivateUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}/`)
}

export async function adminResetPassword(
  id: number,
  payload: { new_password: string; must_change_password: boolean }
): Promise<void> {
  await apiClient.post(`/users/${id}/reset-password/`, payload)
}

export async function fetchRoles(search?: string): Promise<PaginatedResponse<RoleDetail>> {
  const { data } = await apiClient.get<PaginatedResponse<RoleDetail>>('/roles/', {
    params: { page_size: 100, ...(search?.trim() ? { search: search.trim() } : {}) },
  })
  return data
}

export async function fetchRoleOptions(): Promise<RoleSummary[]> {
  const data = await fetchRoles()
  return data.results.map((r) => ({ id: r.id, name: r.name }))
}

export async function createRole(payload: SaveRolePayload): Promise<RoleDetail> {
  const { data } = await apiClient.post<RoleDetail>('/roles/', payload)
  return data
}

export async function updateRole(id: number, payload: SaveRolePayload): Promise<RoleDetail> {
  const { data } = await apiClient.patch<RoleDetail>(`/roles/${id}/`, payload)
  return data
}

export async function deleteRole(id: number): Promise<void> {
  await apiClient.delete(`/roles/${id}/`)
}

export async function fetchPermissions(): Promise<PermissionItem[]> {
  const { data } = await apiClient.get<PermissionItem[]>('/permissions/')
  return data
}
