import { apiClient } from '@/api/client';
export async function fetchUsers(params) {
    const cleanParams = {};
    if (params.page)
        cleanParams.page = params.page;
    if (params.page_size)
        cleanParams.page_size = params.page_size;
    if (params.search?.trim())
        cleanParams.search = params.search.trim();
    if (params.is_active === 'true' || params.is_active === 'false') {
        cleanParams.is_active = params.is_active;
    }
    if (params.role)
        cleanParams.role = params.role;
    const { data } = await apiClient.get('/users/', {
        params: cleanParams,
    });
    return data;
}
export async function createUser(payload) {
    const { data } = await apiClient.post('/users/', payload);
    return data;
}
export async function updateUser(id, payload) {
    const { data } = await apiClient.patch(`/users/${id}/`, payload);
    return data;
}
export async function deactivateUser(id) {
    await apiClient.delete(`/users/${id}/`);
}
export async function adminResetPassword(id, payload) {
    await apiClient.post(`/users/${id}/reset-password/`, payload);
}
export async function fetchRoles(search) {
    const { data } = await apiClient.get('/roles/', {
        params: { page_size: 100, ...(search?.trim() ? { search: search.trim() } : {}) },
    });
    return data;
}
export async function fetchRoleOptions() {
    const data = await fetchRoles();
    return data.results.map((r) => ({ id: r.id, name: r.name }));
}
export async function createRole(payload) {
    const { data } = await apiClient.post('/roles/', payload);
    return data;
}
export async function updateRole(id, payload) {
    const { data } = await apiClient.patch(`/roles/${id}/`, payload);
    return data;
}
export async function deleteRole(id) {
    await apiClient.delete(`/roles/${id}/`);
}
export async function fetchPermissions() {
    const { data } = await apiClient.get('/permissions/');
    return data;
}
