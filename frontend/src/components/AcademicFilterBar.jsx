import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchAcademicYears, fetchDegrees, fetchMajors, fetchSemesters, fetchYearLevels, } from '@/features/academics/academicsApi';
export function AcademicFilterBar({ values, onChange, showYear = true, showSemester = false, showDegree = true, showMajor = true, showYearLevel = false, }) {
    const { t, i18n } = useTranslation();
    const isKm = i18n.language === 'km';
    const yearsQuery = useQuery({
        queryKey: ['academic-years-options'],
        queryFn: () => fetchAcademicYears(),
        enabled: showYear,
    });
    const semestersQuery = useQuery({
        queryKey: ['semesters-options', values.academicYear],
        queryFn: () => fetchSemesters(values.academicYear ? { academic_year: values.academicYear } : undefined),
        enabled: showSemester,
    });
    const degreesQuery = useQuery({
        queryKey: ['degrees-options'],
        queryFn: () => fetchDegrees({ status: 'active' }),
        enabled: showDegree,
    });
    const majorsQuery = useQuery({
        queryKey: ['majors-options', values.degree],
        queryFn: () => fetchMajors({
            status: 'active',
            ...(values.degree ? { degree: values.degree } : {}),
        }),
        enabled: showMajor,
    });
    const yearLevelsQuery = useQuery({
        queryKey: ['year-levels-options'],
        queryFn: () => fetchYearLevels({ status: 'active' }),
        enabled: showYearLevel,
    });
    return (<div className="row g-2">
      {showYear && (<div className="col-sm-6 col-md-3">
          <select className="form-select" value={values.academicYear || ''} onChange={(e) => onChange({ ...values, academicYear: e.target.value, semester: '' })}>
            <option value="">{t('academics.allAcademicYears')}</option>
            {(yearsQuery.data?.results || []).map((y) => (<option key={y.id} value={String(y.id)}>
                {y.name} {y.is_current ? `(${t('academics.current')})` : ''}
              </option>))}
          </select>
        </div>)}

      {showSemester && (<div className="col-sm-6 col-md-3">
          <select className="form-select" value={values.semester || ''} onChange={(e) => onChange({ ...values, semester: e.target.value })}>
            <option value="">{t('academics.allSemesters')}</option>
            {(semestersQuery.data?.results || []).map((s) => (<option key={s.id} value={String(s.id)}>
                {s.academic_year_name} — {s.name}
              </option>))}
          </select>
        </div>)}

      {showDegree && (<div className="col-sm-6 col-md-3">
          <select className="form-select" value={values.degree || ''} onChange={(e) => onChange({ ...values, degree: e.target.value, major: '' })}>
            <option value="">{t('academics.allDegrees')}</option>
            {(degreesQuery.data?.results || []).map((d) => (<option key={d.id} value={String(d.id)}>
                {d.code} — {isKm && d.name_km ? d.name_km : d.name_en}
              </option>))}
          </select>
        </div>)}

      {showMajor && (<div className="col-sm-6 col-md-3">
          <select className="form-select" value={values.major || ''} onChange={(e) => onChange({ ...values, major: e.target.value })}>
            <option value="">{t('academics.allMajors')}</option>
            {(majorsQuery.data?.results || []).map((m) => (<option key={m.id} value={String(m.id)}>
                {m.code} — {isKm && m.name_km ? m.name_km : m.name_en}
              </option>))}
          </select>
        </div>)}

      {showYearLevel && (<div className="col-sm-6 col-md-3">
          <select className="form-select" value={values.yearLevel || ''} onChange={(e) => onChange({ ...values, yearLevel: e.target.value })}>
            <option value="">{t('academics.allYearLevels')}</option>
            {(yearLevelsQuery.data?.results || []).map((yl) => (<option key={yl.id} value={String(yl.id)}>
                {isKm && yl.name_km ? yl.name_km : yl.name_en}
              </option>))}
          </select>
        </div>)}
    </div>);
}
