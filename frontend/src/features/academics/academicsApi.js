import { apiClient } from '@/api/client';
// Academic Years
export async function fetchAcademicYears(params) {
    const { data } = await apiClient.get('/academic-years/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveAcademicYear(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/academic-years/${id}/`, payload)
        : await apiClient.post('/academic-years/', payload);
    return data;
}
export async function deleteAcademicYear(id) {
    await apiClient.delete(`/academic-years/${id}/`);
}
export async function setCurrentAcademicYear(id) {
    const { data } = await apiClient.post(`/academic-years/${id}/set-current/`);
    return data;
}
// Semesters
export async function fetchSemesters(params) {
    const { data } = await apiClient.get('/semesters/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveSemester(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/semesters/${id}/`, payload)
        : await apiClient.post('/semesters/', payload);
    return data;
}
export async function deleteSemester(id) {
    await apiClient.delete(`/semesters/${id}/`);
}
export async function setCurrentSemester(id) {
    const { data } = await apiClient.post(`/semesters/${id}/set-current/`);
    return data;
}
// Degrees
export async function fetchDegrees(params) {
    const { data } = await apiClient.get('/degrees/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveDegree(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/degrees/${id}/`, payload)
        : await apiClient.post('/degrees/', payload);
    return data;
}
export async function deleteDegree(id) {
    await apiClient.delete(`/degrees/${id}/`);
}
// Majors
export async function fetchMajors(params) {
    const { data } = await apiClient.get('/majors/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveMajor(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/majors/${id}/`, payload)
        : await apiClient.post('/majors/', payload);
    return data;
}
export async function deleteMajor(id) {
    await apiClient.delete(`/majors/${id}/`);
}
// Year Levels
export async function fetchYearLevels(params) {
    const { data } = await apiClient.get('/year-levels/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveYearLevel(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/year-levels/${id}/`, payload)
        : await apiClient.post('/year-levels/', payload);
    return data;
}
export async function deleteYearLevel(id) {
    await apiClient.delete(`/year-levels/${id}/`);
}
// Subjects
export async function fetchSubjects(params) {
    const { data } = await apiClient.get('/subjects/', {
        params: { page_size: 50, ...params },
    });
    return data;
}
export async function saveSubject(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/subjects/${id}/`, payload)
        : await apiClient.post('/subjects/', payload);
    return data;
}
export async function deleteSubject(id) {
    await apiClient.delete(`/subjects/${id}/`);
}
// Curricula & Curriculum Subjects
export async function fetchCurricula(params) {
    const { data } = await apiClient.get('/curricula/', {
        params: { page_size: 100, ...params },
    });
    return data;
}
export async function saveCurriculum(payload, id) {
    const { data } = id
        ? await apiClient.patch(`/curricula/${id}/`, payload)
        : await apiClient.post('/curricula/', payload);
    return data;
}
export async function deleteCurriculum(id) {
    await apiClient.delete(`/curricula/${id}/`);
}
export async function fetchCurriculumSubjects(curriculumId) {
    const { data } = await apiClient.get('/curriculum-subjects/', { params: { curriculum: curriculumId, page_size: 100 } });
    return data;
}
export async function addCurriculumSubject(payload) {
    const { data } = await apiClient.post('/curriculum-subjects/', payload);
    return data;
}
export async function deleteCurriculumSubject(id) {
    await apiClient.delete(`/curriculum-subjects/${id}/`);
}
