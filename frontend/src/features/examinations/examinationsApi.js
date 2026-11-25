import { apiClient } from '@/api/client';
export async function fetchAssessmentTypes() {
    const { data } = await apiClient.get('/assessment-types/', { params: { page_size: 100 } });
    return data;
}
export async function fetchGradingScales() {
    const { data } = await apiClient.get('/grading-scales/', {
        params: { page_size: 100 },
    });
    return data;
}
export async function fetchAssessments(params) {
    const clean = { page_size: 100 };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/assessments/', {
        params: clean,
    });
    return data;
}
export async function createAssessmentApi(payload) {
    const { data } = await apiClient.post('/assessments/', payload);
    return data;
}
export async function fetchAssessmentScores(assessmentId) {
    const { data } = await apiClient.get(`/assessments/${assessmentId}/scores/`);
    return data;
}
export async function bulkSaveScoresApi(assessmentId, scores) {
    const { data } = await apiClient.post(`/assessments/${assessmentId}/bulk-scores/`, { scores });
    return data;
}
export async function fetchGrades(params) {
    const clean = { page_size: 100 };
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== '' && v !== undefined && v !== null)
                clean[k] = v;
        }
    }
    const { data } = await apiClient.get('/grades/', {
        params: clean,
    });
    return data;
}
export async function calculateGradesApi(payload) {
    const { data } = await apiClient.post('/grades/calculate/', payload);
    return data;
}
export async function fetchStudentTranscript(studentId) {
    const { data } = await apiClient.get('/grades/transcript/', {
        params: studentId ? { student: studentId } : undefined,
    });
    return data;
}
