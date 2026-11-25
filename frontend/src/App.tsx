import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/api/queryClient'
import { ThemeLayoutProvider } from '@/contexts/ThemeLayoutContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { PortalLayout } from '@/layouts/PortalLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { FoundationOverviewPage } from '@/pages/FoundationOverviewPage'
import { ScheduledModulePage } from '@/pages/ScheduledModulePage'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeLayoutProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<PortalLayout />}>
                <Route path="/" element={<FoundationOverviewPage />} />
                <Route path="/users" element={<ScheduledModulePage titleKey="nav.users" phase={2} />} />
                <Route path="/academics" element={<ScheduledModulePage titleKey="nav.academics" phase={3} />} />
                <Route path="/subjects" element={<ScheduledModulePage titleKey="nav.subjects" phase={3} />} />
                <Route path="/students" element={<ScheduledModulePage titleKey="nav.students" phase={4} />} />
                <Route path="/enrollments" element={<ScheduledModulePage titleKey="nav.enrollments" phase={5} />} />
                <Route path="/classes" element={<ScheduledModulePage titleKey="nav.classes" phase={6} />} />
                <Route path="/teachers" element={<ScheduledModulePage titleKey="nav.teachers" phase={7} />} />
                <Route path="/attendance" element={<ScheduledModulePage titleKey="nav.attendance" phase={8} />} />
                <Route path="/examinations" element={<ScheduledModulePage titleKey="nav.examinations" phase={9} />} />
                <Route path="/reports" element={<ScheduledModulePage titleKey="nav.reports" phase={10} />} />
                <Route path="/settings" element={<ScheduledModulePage titleKey="nav.settings" phase={10} />} />
              </Route>
              <Route path="/unauthorized" element={<ErrorPage code={401} />} />
              <Route path="/forbidden" element={<ErrorPage code={403} />} />
              <Route path="*" element={<ErrorPage code={404} />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeLayoutProvider>
    </QueryClientProvider>
  )
}

export default App
