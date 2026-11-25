import { apiClient } from '@/api/client';
export async function fetchApiHealth() {
    const { data } = await apiClient.get('/health/');
    return data;
}
export async function fetchBootstrapConfig() {
    const { data } = await apiClient.get('/system/bootstrap/');
    return data;
}
