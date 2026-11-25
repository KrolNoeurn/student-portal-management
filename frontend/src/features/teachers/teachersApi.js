import { apiClient } from '@/api/client';
export async function fetchTeachers(params) {
    const clean = { page_size: 50 };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/teachers/', {
        params: clean,
    });
    return data;
}
export async function saveTeacher(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/teachers/${id}/`, payload)
        : await apiClient.post('/teachers/', payload);
    return data;
}
export async function archiveTeacher(id) {
    await apiClient.delete(`/teachers/${id}/`);
}
export async function fetchTeachingAssignments(params) {
    const clean = { page_size: 100 };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/teaching-assignments/', { params: clean });
    return data;
}
export async function createTeachingAssignmentApi(payload) {
    const { data } = await apiClient.post('/teaching-assignments/', payload);
    return data;
}
export async function cancelTeachingAssignmentApi(id) {
    await apiClient.delete(`/teaching-assignments/${id}/`);
}
export async function fetchSchedules(params) {
    const clean = { page_size: 100, is_active: 'true' };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/schedules/', {
        params: clean,
    });
    return data;
}
export async function checkScheduleConflictsApi(payload) {
    const { data } = await apiClient.post('/schedules/check-conflicts/', payload);
    return data;
}
export async function createScheduleApi(payload) {
    const { data } = await apiClient.post('/schedules/', payload);
    return data;
}
export async function deleteScheduleApi(id) {
    await apiClient.delete(`/schedules/${id}/`);
}
