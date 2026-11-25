import { apiClient } from '@/api/client';
export async function fetchInstitutionalReport(reportType, params) {
    const { data } = await apiClient.get(`/reports/${reportType}/`, { params });
    return data;
}
export async function exportInstitutionalReportCsv(reportType, params) {
    const response = await apiClient.get(`/reports/${reportType}/`, {
        params: { ...params, export: 'csv' },
        responseType: 'blob',
    });
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${reportType}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
