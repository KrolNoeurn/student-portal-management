import { apiClient } from '@/api/client';
export async function fetchEnrollments(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== undefined && v !== null)
            clean[k] = v;
    }
    const { data } = await apiClient.get('/enrollments/', {
        params: clean,
    });
    return data;
}
export async function createEnrollmentApi(payload) {
    const { data } = await apiClient.post('/enrollments/', payload);
    return data;
}
export async function promoteEnrollmentApi(id, payload) {
    const { data } = await apiClient.post(`/enrollments/${id}/promote/`, payload);
    return data;
}
export async function changeProgramApi(id, payload) {
    const { data } = await apiClient.post(`/enrollments/${id}/change-program/`, payload);
    return data;
}
