import { apiClient } from '@/api/client';
export async function fetchSystemSettings(params) {
    const { data } = await apiClient.get('/settings/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function updateSystemSetting(id, payload) {
    const { data } = await apiClient.patch(`/settings/${id}/`, payload);
    return data;
}
export async function fetchBackups(params) {
    const { data } = await apiClient.get('/backups/', {
        params,
    });
    return data;
}
export async function createDatabaseBackup() {
    const { data } = await apiClient.post('/backups/create-backup/');
    return data;
}
export async function fetchAuditLogs(params) {
    const { data } = await apiClient.get('/audit-logs/', {
        params,
    });
    return data;
}
