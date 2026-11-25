import { apiClient } from '@/api/client';
// Classrooms
export async function fetchClassrooms(params) {
    const { data } = await apiClient.get('/classrooms/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveClassroom(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/classrooms/${id}/`, payload)
        : await apiClient.post('/classrooms/', payload);
    return data;
}
export async function deleteClassroom(id) {
    await apiClient.delete(`/classrooms/${id}/`);
}
// Class Sections
export async function fetchClasses(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== undefined && v !== null)
            clean[k] = v;
    }
    const { data } = await apiClient.get('/classes/', {
        params: clean,
    });
    return data;
}
export async function fetchClassDetail(id) {
    const { data } = await apiClient.get(`/classes/${id}/`);
    return data;
}
export async function saveClassSection(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/classes/${id}/`, payload)
        : await apiClient.post('/classes/', payload);
    return data;
}
export async function archiveClassSection(id) {
    await apiClient.delete(`/classes/${id}/`);
}
// Class Roster & Transfers
export async function fetchClassRoster(classId, statusFilter) {
    const { data } = await apiClient.get(`/classes/${classId}/students/`, {
        params: statusFilter ? { status: statusFilter } : undefined,
    });
    return data;
}
export async function fetchEligibleEnrollments(classId) {
    const { data } = await apiClient.get(`/classes/${classId}/eligible-enrollments/`);
    return data;
}
export async function assignStudentToClassApi(classId, enrollmentId) {
    const { data } = await apiClient.post(`/classes/${classId}/assign-student/`, { enrollment: enrollmentId });
    return data;
}
export async function transferStudentClassApi(classId, payload) {
    const { data } = await apiClient.post(`/classes/${classId}/transfer-student/`, payload);
    return data;
}
export async function fetchClassTransfers(classId) {
    const { data } = await apiClient.get(`/classes/${classId}/transfers/`);
    return data;
}
export async function dropClassMembership(membershipId) {
    await apiClient.delete(`/class-memberships/${membershipId}/`);
}
// Class Subjects
export async function fetchClassSubjects(classId) {
    const { data } = await apiClient.get('/class-subjects/', {
        params: { class_section: classId, page_size: 100 },
    });
    return data;
}
export async function addClassSubjectApi(payload) {
    const { data } = await apiClient.post('/class-subjects/', payload);
    return data;
}
export async function removeClassSubjectApi(id) {
    await apiClient.delete(`/class-subjects/${id}/`);
}
