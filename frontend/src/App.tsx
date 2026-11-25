import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/api/queryClient'
import { AuthProvider } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { ThemeLayoutProvider } from '@/contexts/ThemeLayoutContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { AcademicsPage } from '@/features/academics/AcademicsPage'
import { SubjectsCurriculumPage } from '@/features/academics/SubjectsCurriculumPage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { UsersRolesPage } from '@/features/users/UsersRolesPage'
import { PortalLayout } from '@/layouts/PortalLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { FoundationOverviewPage } from '@/pages/FoundationOverviewPage'
import { ScheduledModulePage } from '@/pages/ScheduledModulePage'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeLayoutProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
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
                  <Route path="/" element={<FoundationOverviewPage />} />
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
                  <Route path="/students" element={<ScheduledModulePage titleKey="nav.students" phase={4} />} />
                  <Route path="/enrollments" element={<ScheduledModulePage titleKey="nav.enrollments" phase={5} />} />
                  <Route path="/classes" element={<ScheduledModulePage titleKey="nav.classes" phase={6} />} />
                  <Route path="/teachers" element={<ScheduledModulePage titleKey="nav.teachers" phase={7} />} />
                  <Route path="/attendance" element={<ScheduledModulePage titleKey="nav.attendance" phase={8} />} />
                  <Route path="/examinations" element={<ScheduledModulePage titleKey="nav.examinations" phase={9} />} />
                  <Route path="/reports" element={<ScheduledModulePage titleKey="nav.reports" phase={10} />} />
                  <Route path="/settings" element={<ScheduledModulePage titleKey="nav.settings" phase={10} />} />
                </Route>

                <Route path="*" element={<ErrorPage code={404} />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeLayoutProvider>
    </QueryClientProvider>
  )
}

export default App
