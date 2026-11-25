import { apiClient } from '@/api/client';
export async function fetchNotifications(params) {
    const { data } = await apiClient.get('/notifications/', {
        params: { page_size: 15, ...params },
    });
    return data;
}
export async function fetchUnreadNotificationCount() {
    const { data } = await apiClient.get('/notifications/unread-count/');
    return data;
}
export async function markNotificationRead(id) {
    const { data } = await apiClient.post(`/notifications/${id}/mark-read/`);
    return data;
}
export async function markAllNotificationsRead() {
    const { data } = await apiClient.post('/notifications/mark-all-read/');
    return data;
}
