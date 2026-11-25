import { apiClient } from '@/api/client';
export async function fetchAttendanceSessions(params) {
    const clean = { page_size: 50 };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/attendance/sessions/', { params: clean });
    return data;
}
export async function fetchAttendanceRecords(params) {
    const clean = { page_size: 100 };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/attendance/records/', { params: clean });
    return data;
}
export async function submitBulkAttendanceApi(payload) {
    const { data } = await apiClient.post('/attendance/bulk-mark/', payload);
    return data;
}
export async function correctAttendanceApi(recordId, payload) {
    const { data } = await apiClient.post(`/attendance/records/${recordId}/correct/`, payload);
    return data;
}
export async function fetchAttendanceSummary(params) {
    const clean = {};
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/attendance/summary/', {
        params: clean,
    });
    return data;
}
export async function exportAttendanceCsv(params) {
    const clean = {};
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const response = await apiClient.get('/attendance/export/', {
        params: clean,
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'attendance_report.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
