import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '@/api/client';
import { AcademicFilterBar } from '@/components/AcademicFilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/contexts/ToastContext';
import { fetchClasses } from '@/features/classes/classesApi';
import { exportInstitutionalReportCsv, fetchInstitutionalReport, } from '@/features/reports/reportsApi';
const REPORT_OPTIONS = [
    {
        id: 'students',
        labelKey: 'reports.type_students',
        descKey: 'reports.desc_students',
        filters: { status: true },
    },
    {
        id: 'enrollments-by-year',
        labelKey: 'reports.type_enrollments_by_year',
        descKey: 'reports.desc_enrollments_by_year',
        filters: { year: true, degree: true, major: true, yearLevel: true },
    },
    {
        id: 'students-by-degree',
        labelKey: 'reports.type_students_by_degree',
        descKey: 'reports.desc_students_by_degree',
        filters: { year: true },
    },
    {
        id: 'students-by-major',
        labelKey: 'reports.type_students_by_major',
        descKey: 'reports.desc_students_by_major',
        filters: { year: true, degree: true },
    },
    {
        id: 'students-by-class',
        labelKey: 'reports.type_students_by_class',
        descKey: 'reports.desc_students_by_class',
        filters: { year: true, degree: true, major: true, yearLevel: true },
    },
    {
        id: 'students-by-status',
        labelKey: 'reports.type_students_by_status',
        descKey: 'reports.desc_students_by_status',
        filters: {},
    },
    {
        id: 'attendance-monthly',
        labelKey: 'reports.type_attendance_monthly',
        descKey: 'reports.desc_attendance_monthly',
        filters: { year: true, classSection: true, month: true },
    },
    {
        id: 'academic-progress',
        labelKey: 'reports.type_academic_progress',
        descKey: 'reports.desc_academic_progress',
        filters: { year: true, classSection: true },
    },
];
function formatColumnHeader(col) {
    return col
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
export function ReportsPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [selectedReport, setSelectedReport] = useState('enrollments-by-year');
    const [academicFilters, setAcademicFilters] = useState({});
    const [classSection, setClassSection] = useState('');
    const [month, setMonth] = useState('');
    const [studentStatus, setStudentStatus] = useState('');
    const [exporting, setExporting] = useState(false);
    const currentOption = REPORT_OPTIONS.find((opt) => opt.id === selectedReport) || REPORT_OPTIONS[0];
    const queryParams = {
        ...(currentOption.filters.year && academicFilters.academicYear
            ? { academic_year: academicFilters.academicYear }
            : {}),
        ...(currentOption.filters.degree && academicFilters.degree
            ? { degree: academicFilters.degree }
            : {}),
        ...(currentOption.filters.major && academicFilters.major
            ? { major: academicFilters.major }
            : {}),
        ...(currentOption.filters.yearLevel && academicFilters.yearLevel
            ? { year_level: academicFilters.yearLevel }
            : {}),
        ...(currentOption.filters.classSection && classSection
            ? { class_section: classSection }
            : {}),
        ...(currentOption.filters.month && month ? { month } : {}),
        ...(currentOption.filters.status && studentStatus ? { status: studentStatus } : {}),
    };
    const classesQuery = useQuery({
        queryKey: ['report-classes-options', academicFilters.academicYear],
        queryFn: () => fetchClasses({
            page_size: 100,
            ...(academicFilters.academicYear
                ? { academic_year: academicFilters.academicYear }
                : {}),
        }),
        enabled: Boolean(currentOption.filters.classSection),
    });
    const reportQuery = useQuery({
        queryKey: ['institutional-report', selectedReport, queryParams],
        queryFn: () => fetchInstitutionalReport(selectedReport, queryParams),
    });
    const handleExport = async () => {
        setExporting(true);
        try {
            await exportInstitutionalReportCsv(selectedReport, queryParams);
            showToast(t('reports.exportStarted'), 'success');
        }
        catch (err) {
            showToast(extractApiErrorMessage(err), 'danger');
        }
        finally {
            setExporting(false);
        }
    };
    const hasAcademicBar = Boolean(currentOption.filters.year ||
        currentOption.filters.degree ||
        currentOption.filters.major ||
        currentOption.filters.yearLevel);
    return (<div>
      <PageHeader title={t('reports.pageTitle')} subtitle={t('reports.pageSubtitle')} breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t('nav.reports') },
        ]} actions={<div className="d-flex flex-wrap gap-2 d-print-none">
            <button type="button" className="btn btn-label-secondary d-inline-flex align-items-center gap-2" onClick={() => window.print()}>
              <Printer size={15}/>
              <span>{t('reports.printReport')}</span>
            </button>
            <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleExport} disabled={exporting}>
              <Download size={15}/>
              <span>{exporting ? t('common.loading') : t('reports.exportCsv')}</span>
            </button>
          </div>}/>

      {/* Report Type Selector */}
      <div className="row g-2 mb-4 d-print-none">
        {REPORT_OPTIONS.map((opt) => {
            const isSelected = opt.id === selectedReport;
            return (<div key={opt.id} className="col-sm-6 col-lg-3">
              <button type="button" className={`card w-100 h-100 text-start border ${isSelected ? 'border-primary bg-label-primary' : ''}`} onClick={() => setSelectedReport(opt.id)}>
                <div className="card-body p-3">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <BarChart3 size={16} className={isSelected ? 'text-primary' : 'text-body-secondary'}/>
                    <span className="fw-semibold small">{t(opt.labelKey)}</span>
                  </div>
                  <div className="text-body-secondary" style={{ fontSize: '0.78rem' }}>
                    {t(opt.descKey)}
                  </div>
                </div>
              </button>
            </div>);
        })}
      </div>

      {/* Filters Card */}
      {(hasAcademicBar ||
            currentOption.filters.classSection ||
            currentOption.filters.month ||
            currentOption.filters.status) && (<div className="card mb-4 d-print-none">
          <div className="card-body d-flex flex-column gap-3">
            {hasAcademicBar && (<AcademicFilterBar values={academicFilters} onChange={setAcademicFilters} showYear={Boolean(currentOption.filters.year)} showDegree={Boolean(currentOption.filters.degree)} showMajor={Boolean(currentOption.filters.major)} showYearLevel={Boolean(currentOption.filters.yearLevel)}/>)}
            {(currentOption.filters.classSection ||
                currentOption.filters.month ||
                currentOption.filters.status) && (<div className="row g-2">
                {currentOption.filters.classSection && (<div className="col-sm-6 col-md-4">
                    <select className="form-select" value={classSection} onChange={(e) => setClassSection(e.target.value)}>
                      <option value="">{t('teachers.allClasses')}</option>
                      {(classesQuery.data?.results || []).map((cls) => (<option key={cls.id} value={String(cls.id)}>
                          {cls.code} — {cls.name}
                        </option>))}
                    </select>
                  </div>)}
                {currentOption.filters.month && (<div className="col-sm-6 col-md-3">
                    <input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)}/>
                  </div>)}
                {currentOption.filters.status && (<div className="col-sm-6 col-md-3">
                    <select className="form-select" value={studentStatus} onChange={(e) => setStudentStatus(e.target.value)}>
                      <option value="">{t('users.allStatuses')}</option>
                      <option value="active">active</option>
                      <option value="deferred">deferred</option>
                      <option value="suspended">suspended</option>
                      <option value="dropped">dropped</option>
                      <option value="transferred">transferred</option>
                      <option value="graduated">graduated</option>
                      <option value="alumni">alumni</option>
                    </select>
                  </div>)}
              </div>)}
          </div>
        </div>)}

      {/* Report Preview Table */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <FileSpreadsheet size={18} className="text-primary"/>
            <h6 className="card-title mb-0">{t(currentOption.labelKey)}</h6>
          </div>
          <span className="badge bg-label-primary">
            {t('reports.rowCount', { count: reportQuery.data?.count ?? 0 })}
          </span>
        </div>

        {reportQuery.isLoading ? (<div className="p-4">
            <LoadingSkeleton rows={6} height={24}/>
          </div>) : reportQuery.isError ? (<div className="p-4">
            <ErrorState title={t('reports.loadError')} onRetry={() => reportQuery.refetch()}/>
          </div>) : !reportQuery.data || reportQuery.data.results.length === 0 ? (<div className="p-4">
            <EmptyState title={t('common.noData')}/>
          </div>) : (<div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  {reportQuery.data.columns.map((col) => (<th key={col} className="text-nowrap">
                      {formatColumnHeader(col)}
                    </th>))}
                </tr>
              </thead>
              <tbody>
                {reportQuery.data.results.map((row, idx) => (<tr key={idx}>
                    {reportQuery.data.columns.map((col) => (<td key={col} className="small">
                        {row[col] !== null && row[col] !== undefined && row[col] !== ''
                        ? String(row[col])
                        : '—'}
                      </td>))}
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>
    </div>);
}
