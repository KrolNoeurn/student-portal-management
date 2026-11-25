import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, Eye, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '@/api/client';
import { PermissionGuard } from '@/auth/PermissionGuard';
import { DataTable } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import { StudentFormModal } from '@/features/students/StudentFormModal';
import { archiveStudent, exportStudentsCsv, fetchStudents, } from '@/features/students/studentsApi';
export function studentStatusTone(status) {
    switch (status) {
        case 'active':
            return 'success';
        case 'applicant':
            return 'info';
        case 'graduated':
            return 'primary';
        case 'leave':
        case 'transferred':
            return 'warning';
        case 'suspended':
        case 'withdrawn':
            return 'danger';
        default:
            return 'secondary';
    }
}
export function StudentsListPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [genderFilter, setGenderFilter] = useState('');
    const [regFilter, setRegFilter] = useState('');
    const [page, setPage] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);
    const queryParams = {
        page,
        search,
        status: statusFilter,
        gender: genderFilter,
        registration_state: regFilter,
    };
    const studentsQuery = useQuery({
        queryKey: ['students', queryParams],
        queryFn: () => fetchStudents(queryParams),
    });
    const handleExport = async () => {
        try {
            await exportStudentsCsv(queryParams);
            showToast(t('students.exportStarted'), 'success');
        }
        catch (err) {
            showToast(extractApiErrorMessage(err), 'danger');
        }
    };
    const handleArchive = async (student) => {
        try {
            await archiveStudent(student.id);
            showToast(t('students.archivedSuccess'), 'warning');
            qc.invalidateQueries({ queryKey: ['students'] });
        }
        catch (err) {
            showToast(extractApiErrorMessage(err), 'danger');
        }
    };
    const columns = [
        {
            key: 'student',
            header: t('students.colStudent'),
            render: (row) => {
                const initials = row.full_name_en
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase() || '')
                    .join('');
                return (<div className="d-flex align-items-center gap-3">
            {row.profile_photo ? (<img src={row.profile_photo} alt={row.full_name_en} className="rounded-circle object-fit-cover" style={{ width: 38, height: 38 }}/>) : (<div className="vx-avatar vx-avatar-sm rounded-circle bg-label-primary">
                {initials || 'S'}
              </div>)}
            <div>
              <Link to={`/students/${row.id}`} className="fw-semibold text-decoration-none">
                {row.full_name_en}
              </Link>
              {row.full_name_km && (<div className="small text-body-secondary">{row.full_name_km}</div>)}
              <code className="small">{row.student_code}</code>
            </div>
          </div>);
            },
        },
        {
            key: 'genderDob',
            header: t('students.colPersonal'),
            render: (row) => (<div className="small">
          <div className="text-capitalize">{row.gender}</div>
          <div className="text-body-secondary">{row.date_of_birth}</div>
        </div>),
        },
        {
            key: 'contact',
            header: t('students.colContact'),
            render: (row) => (<div className="small">
          <div>{row.phone || '—'}</div>
          <div className="text-body-secondary">{row.email || '—'}</div>
        </div>),
        },
        {
            key: 'status',
            header: t('common.status'),
            render: (row) => (<div className="d-flex flex-column gap-1 align-items-start">
          <StatusBadge label={row.status} tone={studentStatusTone(row.status)}/>
          {row.registration_state === 'draft' && (<StatusBadge label={t('students.draft')} tone="secondary"/>)}
        </div>),
        },
        {
            key: 'actions',
            header: t('users.colActions'),
            className: 'text-end',
            render: (row) => (<div className="d-inline-flex gap-1">
          <Link to={`/students/${row.id}`} className="btn btn-icon btn-sm btn-label-primary" title={t('students.viewProfile')}>
            <Eye size={15}/>
          </Link>
          <PermissionGuard anyOf={['students.archive_student', 'students.delete_student']}>
            <button type="button" className="btn btn-icon btn-sm btn-label-secondary" title={t('students.archive')} onClick={() => handleArchive(row)}>
              <Archive size={15}/>
            </button>
          </PermissionGuard>
        </div>),
        },
    ];
    return (<div>
      <PageHeader title={t('students.pageTitle')} subtitle={t('students.pageSubtitle')} breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t('nav.students') },
        ]} actions={<>
            <PermissionGuard permission="students.export_student">
              <button type="button" className="btn btn-label-secondary d-inline-flex align-items-center gap-2" onClick={handleExport}>
                <Download size={16}/>
                <span>{t('students.exportCsv')}</span>
              </button>
            </PermissionGuard>
            <PermissionGuard permission="students.add_student">
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={() => setModalOpen(true)}>
                <Plus size={16}/>
                <span>{t('students.registerStudent')}</span>
              </button>
            </PermissionGuard>
          </>}/>

      <div className="card">
        <div className="card-header">
          <div className="row g-2">
            <div className="col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-transparent">
                  <Search size={16}/>
                </span>
                <input type="search" className="form-control" placeholder={t('students.searchPlaceholder')} value={search} onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
        }}/>
              </div>
            </div>
            <div className="col-sm-4 col-md-3">
              <select className="form-select" value={statusFilter} onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
        }}>
                <option value="">{t('users.allStatuses')}</option>
                <option value="applicant">Applicant</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="leave">On Leave</option>
                <option value="transferred">Transferred</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div className="col-sm-4 col-md-2">
              <select className="form-select" value={genderFilter} onChange={(e) => {
            setGenderFilter(e.target.value);
            setPage(1);
        }}>
                <option value="">{t('students.allGenders')}</option>
                <option value="male">{t('students.genderMale')}</option>
                <option value="female">{t('students.genderFemale')}</option>
                <option value="other">{t('students.genderOther')}</option>
              </select>
            </div>
            <div className="col-sm-4 col-md-3">
              <select className="form-select" value={regFilter} onChange={(e) => {
            setRegFilter(e.target.value);
            setPage(1);
        }}>
                <option value="">{t('students.allRegistrations')}</option>
                <option value="completed">{t('common.completed')}</option>
                <option value="draft">{t('students.draft')}</option>
              </select>
            </div>
          </div>
        </div>

        {studentsQuery.isError ? (<div className="card-body">
            <ErrorState title={t('students.loadError')} message={extractApiErrorMessage(studentsQuery.error)} onRetry={() => studentsQuery.refetch()}/>
          </div>) : (<DataTable columns={columns} data={studentsQuery.data?.results || []} rowKey={(r) => r.id} loading={studentsQuery.isLoading} page={studentsQuery.data?.page || page} totalPages={studentsQuery.data?.total_pages || 1} totalCount={studentsQuery.data?.count || 0} pageSize={studentsQuery.data?.page_size || 20} onPageChange={setPage}/>)}
      </div>

      <StudentFormModal open={modalOpen} student={null} onClose={() => setModalOpen(false)} onSaved={() => {
            setModalOpen(false);
            showToast(t('students.createdSuccess'), 'success');
            qc.invalidateQueries({ queryKey: ['students'] });
        }}/>
    </div>);
}
