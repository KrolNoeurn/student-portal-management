import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, CalendarClock, Pencil, Plus, Search, Trash2, UserCheck, Users, } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '@/api/client';
import { PermissionGuard } from '@/auth/PermissionGuard';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormModal } from '@/components/ui/FormModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import { fetchSubjects } from '@/features/academics/academicsApi';
import { fetchClasses, fetchClassrooms } from '@/features/classes/classesApi';
import { archiveTeacher, cancelTeachingAssignmentApi, checkScheduleConflictsApi, createScheduleApi, createTeachingAssignmentApi, deleteScheduleApi, fetchSchedules, fetchTeachers, fetchTeachingAssignments, saveTeacher, } from '@/features/teachers/teachersApi';
const DAYS = [
    { value: 1, key: 'teachers.dayMon' },
    { value: 2, key: 'teachers.dayTue' },
    { value: 3, key: 'teachers.dayWed' },
    { value: 4, key: 'teachers.dayThu' },
    { value: 5, key: 'teachers.dayFri' },
    { value: 6, key: 'teachers.daySat' },
    { value: 7, key: 'teachers.daySun' },
];
export function TeachersSchedulesPage() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const qc = useQueryClient();
    const [tab, setTab] = useState('teachers');
    const [search, setSearch] = useState('');
    const [filterTeacher, setFilterTeacher] = useState('');
    const [filterClass, setFilterClass] = useState('');
    // Teacher modal
    const [teacherModalOpen, setTeacherModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [teacherForm, setTeacherForm] = useState({
        teacher_code: '',
        full_name_en: '',
        full_name_km: '',
        gender: 'male',
        email: '',
        phone: '',
        specialization: '',
        qualification: '',
        employment_type: 'full_time',
        status: 'active',
    });
    // Assignment modal
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignForm, setAssignForm] = useState({
        teacher: '',
        class_section: '',
        subject: '',
        role: 'primary',
    });
    // Schedule modal + live conflict preview
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({
        teaching_assignment: '',
        classroom: '',
        day_of_week: 1,
        start_time: '08:00',
        end_time: '10:00',
        notes: '',
    });
    const [conflicts, setConflicts] = useState([]);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const teachersQuery = useQuery({
        queryKey: ['teachers', search],
        queryFn: () => fetchTeachers(search ? { search } : undefined),
    });
    const assignmentsQuery = useQuery({
        queryKey: ['teaching-assignments', filterTeacher, filterClass],
        queryFn: () => fetchTeachingAssignments({
            teacher: filterTeacher,
            class_section: filterClass,
            status: 'active',
        }),
    });
    const schedulesQuery = useQuery({
        queryKey: ['schedules', filterTeacher, filterClass],
        queryFn: () => fetchSchedules({ teacher: filterTeacher, class_section: filterClass }),
    });
    const classesOptQuery = useQuery({
        queryKey: ['classes-opt-tch'],
        queryFn: () => fetchClasses({ page_size: 100 }),
    });
    const subjectsOptQuery = useQuery({
        queryKey: ['subjects-all'],
        queryFn: () => fetchSubjects({ page_size: 100 }),
        enabled: assignModalOpen,
    });
    const roomsOptQuery = useQuery({
        queryKey: ['classrooms'],
        queryFn: () => fetchClassrooms({ status: 'active' }),
        enabled: scheduleModalOpen,
    });
    const schedulesByDay = useMemo(() => {
        const map = new Map();
        for (const d of DAYS)
            map.set(d.value, []);
        for (const item of schedulesQuery.data?.results || []) {
            map.get(item.day_of_week)?.push(item);
        }
        return map;
    }, [schedulesQuery.data]);
    const openTeacherModal = (tch) => {
        setFormError(null);
        setEditingTeacher(tch);
        if (tch) {
            setTeacherForm({
                teacher_code: tch.teacher_code,
                full_name_en: tch.full_name_en,
                full_name_km: tch.full_name_km,
                gender: tch.gender,
                email: tch.email,
                phone: tch.phone,
                specialization: tch.specialization,
                qualification: tch.qualification,
                employment_type: tch.employment_type,
                status: tch.status,
            });
        }
        else {
            setTeacherForm({
                teacher_code: '',
                full_name_en: '',
                full_name_km: '',
                gender: 'male',
                email: '',
                phone: '',
                specialization: '',
                qualification: '',
                employment_type: 'full_time',
                status: 'active',
            });
        }
        setTeacherModalOpen(true);
    };
    const handleSaveTeacher = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError(null);
        try {
            await saveTeacher(teacherForm, editingTeacher?.id);
            setTeacherModalOpen(false);
            qc.invalidateQueries({ queryKey: ['teachers'] });
            showToast(t('academics.savedSuccess'), 'success');
        }
        catch (err) {
            setFormError(extractApiErrorMessage(err));
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleSaveAssignment = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError(null);
        try {
            await createTeachingAssignmentApi({
                teacher: Number(assignForm.teacher),
                class_section: Number(assignForm.class_section),
                subject: Number(assignForm.subject),
                role: assignForm.role,
            });
            setAssignModalOpen(false);
            qc.invalidateQueries({ queryKey: ['teaching-assignments'] });
            qc.invalidateQueries({ queryKey: ['teachers'] });
            showToast(t('academics.savedSuccess'), 'success');
        }
        catch (err) {
            setFormError(extractApiErrorMessage(err));
        }
        finally {
            setSubmitting(false);
        }
    };
    const runConflictPreview = async (nextForm = scheduleForm) => {
        if (!nextForm.teaching_assignment || !nextForm.classroom || !nextForm.start_time || !nextForm.end_time) {
            setConflicts([]);
            return;
        }
        try {
            const res = await checkScheduleConflictsApi({
                teaching_assignment: Number(nextForm.teaching_assignment),
                classroom: Number(nextForm.classroom),
                day_of_week: Number(nextForm.day_of_week),
                start_time: nextForm.start_time,
                end_time: nextForm.end_time,
            });
            setConflicts(res.conflicts);
        }
        catch {
            setConflicts([]);
        }
    };
    const handleSaveSchedule = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError(null);
        try {
            await createScheduleApi({
                teaching_assignment: Number(scheduleForm.teaching_assignment),
                classroom: Number(scheduleForm.classroom),
                day_of_week: Number(scheduleForm.day_of_week),
                start_time: scheduleForm.start_time,
                end_time: scheduleForm.end_time,
                notes: scheduleForm.notes,
            });
            setScheduleModalOpen(false);
            setConflicts([]);
            qc.invalidateQueries({ queryKey: ['schedules'] });
            showToast(t('teachers.scheduleSaved'), 'success');
        }
        catch (err) {
            setFormError(extractApiErrorMessage(err));
        }
        finally {
            setSubmitting(false);
        }
    };
    const teacherColumns = [
        {
            key: 'teacher',
            header: t('teachers.colTeacher'),
            render: (row) => (<div>
          <div className="fw-semibold">{row.full_name_en}</div>
          {row.full_name_km && <div className="small text-body-secondary">{row.full_name_km}</div>}
          <code className="small">{row.teacher_code}</code>
        </div>),
        },
        {
            key: 'spec',
            header: t('teachers.specialization'),
            render: (row) => (<div className="small">
          <div>{row.specialization || '—'}</div>
          <div className="text-body-secondary">{row.qualification || ''}</div>
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
            key: 'type',
            header: t('teachers.employmentType'),
            render: (row) => <StatusBadge label={row.employment_type.replace('_', ' ')} tone="info"/>,
        },
        {
            key: 'assignments',
            header: t('teachers.tabAssignments'),
            render: (row) => <StatusBadge label={String(row.assignment_count)} tone="primary"/>,
        },
        {
            key: 'status',
            header: t('common.status'),
            render: (row) => (<StatusBadge label={row.status} tone={row.status === 'active' ? 'success' : 'secondary'}/>),
        },
        {
            key: 'actions',
            header: t('users.colActions'),
            className: 'text-end',
            render: (row) => (<div className="d-inline-flex gap-1">
          <PermissionGuard permission="teachers.change_teacher">
            <button type="button" className="btn btn-icon btn-sm btn-label-primary" onClick={() => openTeacherModal(row)}>
              <Pencil size={15}/>
            </button>
          </PermissionGuard>
          <PermissionGuard permission="teachers.delete_teacher">
            <button type="button" className="btn btn-icon btn-sm btn-label-secondary" onClick={async () => {
                    await archiveTeacher(row.id);
                    qc.invalidateQueries({ queryKey: ['teachers'] });
                    showToast(t('academics.deletedSuccess'), 'warning');
                }}>
              <Archive size={15}/>
            </button>
          </PermissionGuard>
        </div>),
        },
    ];
    const assignmentColumns = [
        {
            key: 'teacher',
            header: t('teachers.colTeacher'),
            render: (row) => (<div>
          <div className="fw-semibold">{row.teacher_name_en}</div>
          <code className="small">{row.teacher_code}</code>
        </div>),
        },
        {
            key: 'class',
            header: t('classes.colClass'),
            render: (row) => (<div>
          <div className="fw-medium">{row.class_code} — {row.class_name}</div>
          <div className="small text-body-secondary">{row.academic_year_name}</div>
        </div>),
        },
        {
            key: 'subject',
            header: t('subjects.subject'),
            render: (row) => (<span>
          <code className="me-2">{row.subject_code}</code>
          {row.subject_name_en}
        </span>),
        },
        {
            key: 'role',
            header: t('teachers.role'),
            render: (row) => <StatusBadge label={row.role} tone="primary"/>,
        },
        {
            key: 'actions',
            header: '',
            className: 'text-end',
            render: (row) => (<PermissionGuard permission="teachers.delete_teachingassignment">
          <button type="button" className="btn btn-icon btn-sm btn-label-secondary" onClick={async () => {
                    await cancelTeachingAssignmentApi(row.id);
                    qc.invalidateQueries({ queryKey: ['teaching-assignments'] });
                    qc.invalidateQueries({ queryKey: ['teachers'] });
                    showToast(t('academics.deletedSuccess'), 'warning');
                }}>
            <Trash2 size={15}/>
          </button>
        </PermissionGuard>),
        },
    ];
    return (<div>
      <PageHeader title={t('teachers.pageTitle')} subtitle={t('teachers.pageSubtitle')} breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t('nav.teachers') },
        ]} actions={tab === 'teachers' ? (<PermissionGuard permission="teachers.add_teacher">
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={() => openTeacherModal(null)}>
                <Plus size={16}/>
                <span>{t('teachers.addTeacher')}</span>
              </button>
            </PermissionGuard>) : tab === 'assignments' ? (<PermissionGuard permission="teachers.add_teachingassignment">
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={() => {
                setFormError(null);
                setAssignModalOpen(true);
            }}>
                <Plus size={16}/>
                <span>{t('teachers.addAssignment')}</span>
              </button>
            </PermissionGuard>) : (<PermissionGuard permission="teachers.add_classschedule">
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={() => {
                setFormError(null);
                setConflicts([]);
                setScheduleModalOpen(true);
            }}>
                <Plus size={16}/>
                <span>{t('teachers.addSchedule')}</span>
              </button>
            </PermissionGuard>)}/>

      <ul className="nav nav-pills mb-4 gap-2 flex-wrap">
        <li className="nav-item">
          <button type="button" className={`nav-link d-inline-flex align-items-center gap-2 ${tab === 'teachers' ? 'active' : ''}`} onClick={() => setTab('teachers')}>
            <Users size={16}/>
            <span>{t('teachers.tabTeachers')}</span>
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link d-inline-flex align-items-center gap-2 ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>
            <UserCheck size={16}/>
            <span>{t('teachers.tabAssignments')}</span>
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link d-inline-flex align-items-center gap-2 ${tab === 'schedule' ? 'active' : ''}`} onClick={() => setTab('schedule')}>
            <CalendarClock size={16}/>
            <span>{t('teachers.tabSchedule')}</span>
          </button>
        </li>
      </ul>

      {tab === 'teachers' && (<div className="card">
          <div className="card-header">
            <div className="input-group" style={{ maxWidth: 380 }}>
              <span className="input-group-text bg-transparent">
                <Search size={16}/>
              </span>
              <input type="search" className="form-control" placeholder={t('teachers.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)}/>
            </div>
          </div>
          <DataTable columns={teacherColumns} data={teachersQuery.data?.results || []} rowKey={(r) => r.id} loading={teachersQuery.isLoading}/>
        </div>)}

      {tab === 'assignments' && (<div className="card">
          <div className="card-header">
            <div className="row g-2">
              <div className="col-md-4">
                <select className="form-select" value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
                  <option value="">{t('teachers.allTeachers')}</option>
                  {(teachersQuery.data?.results || []).map((tch) => (<option key={tch.id} value={String(tch.id)}>
                      {tch.teacher_code} — {tch.full_name_en}
                    </option>))}
                </select>
              </div>
              <div className="col-md-4">
                <select className="form-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                  <option value="">{t('teachers.allClasses')}</option>
                  {(classesOptQuery.data?.results || []).map((c) => (<option key={c.id} value={String(c.id)}>
                      {c.code} — {c.name}
                    </option>))}
                </select>
              </div>
            </div>
          </div>
          <DataTable columns={assignmentColumns} data={assignmentsQuery.data?.results || []} rowKey={(r) => r.id} loading={assignmentsQuery.isLoading}/>
        </div>)}

      {tab === 'schedule' && (<div>
          <div className="card mb-4">
            <div className="card-body py-3">
              <div className="row g-2">
                <div className="col-md-4">
                  <select className="form-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                    <option value="">{t('teachers.allClasses')}</option>
                    {(classesOptQuery.data?.results || []).map((c) => (<option key={c.id} value={String(c.id)}>
                        {c.code} — {c.name}
                      </option>))}
                  </select>
                </div>
                <div className="col-md-4">
                  <select className="form-select" value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)}>
                    <option value="">{t('teachers.allTeachers')}</option>
                    {(teachersQuery.data?.results || []).map((tch) => (<option key={tch.id} value={String(tch.id)}>
                        {tch.teacher_code} — {tch.full_name_en}
                      </option>))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            {DAYS.map((day) => {
                const slots = schedulesByDay.get(day.value) || [];
                return (<div key={day.value} className="col-md-6 col-xl-4">
                  <div className="card h-100">
                    <div className="card-header d-flex align-items-center justify-content-between py-2">
                      <span className="fw-semibold">{t(day.key)}</span>
                      <StatusBadge label={String(slots.length)} tone="primary"/>
                    </div>
                    <div className="card-body p-3">
                      {slots.length === 0 ? (<p className="text-body-secondary small mb-0 text-center py-3">
                          {t('common.noData')}
                        </p>) : (<div className="d-flex flex-column gap-2">
                          {slots.map((slot) => (<div key={slot.id} className="p-2 rounded border d-flex justify-content-between align-items-start gap-2" style={{ borderColor: 'var(--vx-border)' }}>
                              <div className="small">
                                <div className="fw-semibold text-primary">
                                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                                </div>
                                <div className="fw-medium">
                                  {slot.subject_code} · {slot.subject_name_en}
                                </div>
                                <div className="text-body-secondary">
                                  {slot.class_code} · {slot.classroom_code} · {slot.teacher_name_en}
                                </div>
                              </div>
                              <PermissionGuard permission="teachers.delete_classschedule">
                                <button type="button" className="btn btn-icon btn-sm btn-label-secondary" onClick={async () => {
                                await deleteScheduleApi(slot.id);
                                qc.invalidateQueries({ queryKey: ['schedules'] });
                                showToast(t('academics.deletedSuccess'), 'warning');
                            }}>
                                  <Trash2 size={14}/>
                                </button>
                              </PermissionGuard>
                            </div>))}
                        </div>)}
                    </div>
                  </div>
                </div>);
            })}
          </div>
          {(schedulesQuery.data?.results || []).length === 0 && !schedulesQuery.isLoading && (<div className="mt-3">
              <EmptyState title={t('common.noData')}/>
            </div>)}
        </div>)}

      {/* Teacher Modal */}
      <FormModal open={teacherModalOpen} size="lg" title={editingTeacher ? t('teachers.editTeacher') : t('teachers.addTeacher')} onClose={() => setTeacherModalOpen(false)} footer={<>
            <button type="button" className="btn btn-label-secondary" onClick={() => setTeacherModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="teacher-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>}>
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="teacher-form" onSubmit={handleSaveTeacher} className="row g-3">
          <div className="col-md-4">
            <label className="form-label">{t('academics.code')}</label>
            <input className="form-control" placeholder={t('students.autoGeneratedPlaceholder')} value={teacherForm.teacher_code} onChange={(e) => setTeacherForm({ ...teacherForm, teacher_code: e.target.value })}/>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.fullNameEn')} *</label>
            <input required className="form-control" value={teacherForm.full_name_en} onChange={(e) => setTeacherForm({ ...teacherForm, full_name_en: e.target.value })}/>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('students.fullNameKm')}</label>
            <input className="form-control" value={teacherForm.full_name_km} onChange={(e) => setTeacherForm({ ...teacherForm, full_name_km: e.target.value })}/>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('users.email')}</label>
            <input type="email" className="form-control" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}/>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('users.phone')}</label>
            <input className="form-control" value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}/>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('teachers.employmentType')}</label>
            <select className="form-select" value={teacherForm.employment_type} onChange={(e) => setTeacherForm({
            ...teacherForm,
            employment_type: e.target.value,
        })}>
              <option value="full_time">Full-Time</option>
              <option value="part_time">Part-Time</option>
              <option value="visiting">Visiting</option>
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('teachers.specialization')}</label>
            <input className="form-control" value={teacherForm.specialization} onChange={(e) => setTeacherForm({ ...teacherForm, specialization: e.target.value })}/>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('students.qualification')}</label>
            <input className="form-control" value={teacherForm.qualification} onChange={(e) => setTeacherForm({ ...teacherForm, qualification: e.target.value })}/>
          </div>
        </form>
      </FormModal>

      {/* Teaching Assignment Modal */}
      <FormModal open={assignModalOpen} title={t('teachers.addAssignment')} onClose={() => setAssignModalOpen(false)} footer={<>
            <button type="button" className="btn btn-label-secondary" onClick={() => setAssignModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="assign-teacher-form" className="btn btn-primary" disabled={submitting}>
              {t('common.save')}
            </button>
          </>}>
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        <form id="assign-teacher-form" onSubmit={handleSaveAssignment} className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('teachers.colTeacher')} *</label>
            <select required className="form-select" value={assignForm.teacher} onChange={(e) => setAssignForm({ ...assignForm, teacher: e.target.value })}>
              <option value="">--</option>
              {(teachersQuery.data?.results || []).map((tch) => (<option key={tch.id} value={String(tch.id)}>
                  {tch.teacher_code} — {tch.full_name_en}
                </option>))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">{t('classes.colClass')} *</label>
            <select required className="form-select" value={assignForm.class_section} onChange={(e) => setAssignForm({ ...assignForm, class_section: e.target.value })}>
              <option value="">--</option>
              {(classesOptQuery.data?.results || []).map((c) => (<option key={c.id} value={String(c.id)}>
                  {c.code} — {c.name} ({c.academic_year_name})
                </option>))}
            </select>
          </div>
          <div className="col-md-8">
            <label className="form-label">{t('subjects.subject')} *</label>
            <select required className="form-select" value={assignForm.subject} onChange={(e) => setAssignForm({ ...assignForm, subject: e.target.value })}>
              <option value="">--</option>
              {(subjectsOptQuery.data?.results || []).map((s) => (<option key={s.id} value={String(s.id)}>
                  {s.code} — {s.name_en}
                </option>))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('teachers.role')}</label>
            <select className="form-select" value={assignForm.role} onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}>
              <option value="primary">Primary</option>
              <option value="assistant">Assistant</option>
            </select>
          </div>
        </form>
      </FormModal>

      {/* Schedule Slot Modal with Live Conflict Detection */}
      <FormModal open={scheduleModalOpen} size="lg" title={t('teachers.addSchedule')} onClose={() => setScheduleModalOpen(false)} footer={<>
            <button type="button" className="btn btn-label-secondary" onClick={() => setScheduleModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" form="schedule-slot-form" className="btn btn-primary" disabled={submitting || conflicts.length > 0}>
              {t('common.save')}
            </button>
          </>}>
        {formError && <div className="alert alert-danger py-2 px-3 small mb-3">{formError}</div>}
        {conflicts.length > 0 && (<div className="alert alert-danger d-flex gap-2 align-items-start py-2 px-3 small mb-3">
            <AlertTriangle size={18} className="flex-shrink-0 mt-1"/>
            <div>
              <div className="fw-semibold">{t('teachers.conflictDetected')}</div>
              <ul className="mb-0 ps-3">
                {conflicts.map((c, idx) => (<li key={idx}>{c.message}</li>))}
              </ul>
            </div>
          </div>)}

        <form id="schedule-slot-form" onSubmit={handleSaveSchedule} className="row g-3">
          <div className="col-12">
            <label className="form-label">{t('teachers.tabAssignments')} *</label>
            <select required className="form-select" value={scheduleForm.teaching_assignment} onChange={(e) => {
            const next = { ...scheduleForm, teaching_assignment: e.target.value };
            setScheduleForm(next);
            runConflictPreview(next);
        }}>
              <option value="">--</option>
              {(assignmentsQuery.data?.results || []).map((a) => (<option key={a.id} value={String(a.id)}>
                  {a.class_code} · {a.subject_code} — {a.teacher_name_en} ({a.academic_year_name})
                </option>))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('classes.classroom')} *</label>
            <select required className="form-select" value={scheduleForm.classroom} onChange={(e) => {
            const next = { ...scheduleForm, classroom: e.target.value };
            setScheduleForm(next);
            runConflictPreview(next);
        }}>
              <option value="">--</option>
              {(roomsOptQuery.data?.results || []).map((r) => (<option key={r.id} value={String(r.id)}>
                  {r.code} — {r.name}
                </option>))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('teachers.dayOfWeek')} *</label>
            <select className="form-select" value={scheduleForm.day_of_week} onChange={(e) => {
            const next = { ...scheduleForm, day_of_week: Number(e.target.value) };
            setScheduleForm(next);
            runConflictPreview(next);
        }}>
              {DAYS.map((d) => (<option key={d.value} value={d.value}>
                  {t(d.key)}
                </option>))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('teachers.startTime')} *</label>
            <input required type="time" className="form-control" value={scheduleForm.start_time} onChange={(e) => {
            const next = { ...scheduleForm, start_time: e.target.value };
            setScheduleForm(next);
            runConflictPreview(next);
        }}/>
          </div>
          <div className="col-md-6">
            <label className="form-label">{t('teachers.endTime')} *</label>
            <input required type="time" className="form-control" value={scheduleForm.end_time} onChange={(e) => {
            const next = { ...scheduleForm, end_time: e.target.value };
            setScheduleForm(next);
            runConflictPreview(next);
        }}/>
          </div>
        </form>
      </FormModal>
    </div>);
}
