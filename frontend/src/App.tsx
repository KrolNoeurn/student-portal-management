import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/api/queryClient'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { ThemeLayoutProvider } from '@/contexts/ThemeLayoutContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { PortalLayout } from '@/layouts/PortalLayout'
import { ErrorPage } from '@/pages/ErrorPage'

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const ChangePasswordPage = lazy(() =>
  import('@/features/auth/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const UsersRolesPage = lazy(() =>
  import('@/features/users/UsersRolesPage').then((m) => ({ default: m.UsersRolesPage })),
)
const AcademicsPage = lazy(() =>
  import('@/features/academics/AcademicsPage').then((m) => ({ default: m.AcademicsPage })),
)
const SubjectsCurriculumPage = lazy(() =>
  import('@/features/academics/SubjectsCurriculumPage').then((m) => ({
    default: m.SubjectsCurriculumPage,
  })),
)
const StudentsListPage = lazy(() =>
  import('@/features/students/StudentsListPage').then((m) => ({ default: m.StudentsListPage })),
)
const StudentDetailPage = lazy(() =>
  import('@/features/students/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })),
)
const EnrollmentsPage = lazy(() =>
  import('@/features/enrollments/EnrollmentsPage').then((m) => ({ default: m.EnrollmentsPage })),
)
const ClassesPage = lazy(() =>
  import('@/features/classes/ClassesPage').then((m) => ({ default: m.ClassesPage })),
)
const ClassDetailPage = lazy(() =>
  import('@/features/classes/ClassDetailPage').then((m) => ({ default: m.ClassDetailPage })),
)
const TeachersSchedulesPage = lazy(() =>
  import('@/features/teachers/TeachersSchedulesPage').then((m) => ({
    default: m.TeachersSchedulesPage,
  })),
)
const AttendancePage = lazy(() =>
  import('@/features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })),
)
const ExaminationsPage = lazy(() =>
  import('@/features/examinations/ExaminationsPage').then((m) => ({
    default: m.ExaminationsPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function RouteFallback() {
  return (
    <div className="container-fluid py-4">
      <div className="card">
        <div className="card-body">
          <LoadingSkeleton rows={5} height={24} />
        </div>
      </div>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeLayoutProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/unauthorized" element={<ErrorPage code={401} />} />
                  <Route path="/forbidden" element={<ErrorPage code={403} />} />

                  <Route
                    element={
                      <ProtectedRoute>
                        <PortalLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/change-password" element={<ChangePasswordPage />} />
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute anyOf={['accounts.view_user', 'auth.view_group']}>
                          <UsersRolesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/academics"
                      element={
                        <ProtectedRoute permission="academics.view_academicyear">
                          <AcademicsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/subjects"
                      element={
                        <ProtectedRoute permission="subjects.view_subject">
                          <SubjectsCurriculumPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/students"
                      element={
                        <ProtectedRoute permission="students.view_student">
                          <StudentsListPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/students/:id"
                      element={
                        <ProtectedRoute permission="students.view_student">
                          <StudentDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/enrollments"
                      element={
                        <ProtectedRoute permission="enrollments.view_enrollment">
                          <EnrollmentsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/classes"
                      element={
                        <ProtectedRoute permission="classes.view_classsection">
                          <ClassesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/classes/:id"
                      element={
                        <ProtectedRoute permission="classes.view_classsection">
                          <ClassDetailPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/teachers"
                      element={
                        <ProtectedRoute
                          anyOf={['teachers.view_teacher', 'teachers.view_classschedule']}
                        >
                          <TeachersSchedulesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/attendance"
                      element={
                        <ProtectedRoute
                          anyOf={[
                            'attendance.view_attendancesession',
                            'attendance.view_attendancerecord',
                            'attendance.take_attendance',
                          ]}
                        >
                          <AttendancePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/examinations"
                      element={
                        <ProtectedRoute
                          anyOf={['examinations.view_assessment', 'examinations.view_subjectgrade']}
                        >
                          <ExaminationsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        <ProtectedRoute permission="reports.export_reports">
                          <ReportsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute
                          anyOf={[
                            'system_settings.manage_system_settings',
                            'system_settings.view_systemsetting',
                            'system_settings.manage_backups',
                            'auditlogs.view_audit_logs',
                          ]}
                        >
                          <SettingsPage />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  <Route path="*" element={<ErrorPage code={404} />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeLayoutProvider>
    </QueryClientProvider>
  )
}

export default App
