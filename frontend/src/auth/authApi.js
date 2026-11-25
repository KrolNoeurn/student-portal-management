import { apiClient } from '@/api/client';
export async function loginApi(payload) {
    const { data } = await apiClient.post('/auth/login/', payload);
    return data;
}
export async function logoutApi() {
    await apiClient.post('/auth/logout/');
}
export async function refreshAccessTokenApi() {
    const { data } = await apiClient.post('/auth/token/refresh/');
    return data;
}
export async function fetchCurrentUserApi() {
    const { data } = await apiClient.get('/auth/me/');
    return data;
}
export async function fetchMyPermissionsApi() {
    const { data } = await apiClient.get('/auth/me/permissions/');
    return data;
}
export async function updateMyPreferencesApi(payload) {
    const { data } = await apiClient.patch('/auth/me/preferences/', payload);
    return data;
}
export async function changePasswordApi(payload) {
    const { data } = await apiClient.post('/auth/password/change/', payload);
    return data;
}
