import { apiClient } from '@/api/client';
export async function fetchStudents(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== undefined && v !== null)
            clean[k] = v;
    }
    const { data } = await apiClient.get('/students/', {
        params: clean,
    });
    return data;
}
export async function fetchStudentDetail(id) {
    const { data } = await apiClient.get(`/students/${id}/`);
    return data;
}
export async function saveStudent(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/students/${id}/`, payload)
        : await apiClient.post('/students/', payload);
    return data;
}
export async function archiveStudent(id) {
    await apiClient.delete(`/students/${id}/`);
}
export async function checkDuplicateStudent(payload) {
    const { data } = await apiClient.post('/students/check-duplicate/', payload);
    return data;
}
export async function changeStudentStatus(id, payload) {
    const { data } = await apiClient.post(`/students/${id}/change-status/`, payload);
    return data;
}
export async function uploadStudentPhoto(id, file) {
    const formData = new FormData();
    formData.append('profile_photo', file);
    const { data } = await apiClient.post(`/students/${id}/upload-photo/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}
export async function exportStudentsCsv(params) {
    const clean = {};
    for (const [k, v] of Object.entries(params)) {
        if (v !== '' && v !== undefined && v !== null)
            clean[k] = v;
    }
    const response = await apiClient.get('/students/export/', {
        params: clean,
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students_export.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
// Guardians
export async function addStudentGuardian(payload) {
    const { data } = await apiClient.post('/student-guardians/', payload);
    return data;
}
export async function deleteStudentGuardian(id) {
    await apiClient.delete(`/student-guardians/${id}/`);
}
// Education
export async function addStudentEducation(payload) {
    const { data } = await apiClient.post('/student-education/', payload);
    return data;
}
export async function deleteStudentEducation(id) {
    await apiClient.delete(`/student-education/${id}/`);
}
// Documents
export async function uploadStudentDocument(payload) {
    const formData = new FormData();
    formData.append('student', String(payload.student));
    formData.append('document_type', payload.document_type);
    formData.append('title', payload.title);
    formData.append('file', payload.file);
    const { data } = await apiClient.post('/student-documents/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}
export async function downloadStudentDocument(id, title) {
    const response = await apiClient.get(`/student-documents/${id}/download/`, {
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
export async function deleteStudentDocument(id) {
    await apiClient.delete(`/student-documents/${id}/`);
}
