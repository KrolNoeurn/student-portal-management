import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  School,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  id: string
  path: string
  i18nKey: string
  icon: LucideIcon
  permission?: string
  anyOf?: string[]
  phase?: number
}

export interface NavSection {
  id: string
  i18nKey: string
  items: NavItem[]
}

/**
 * Single source of truth for both Vertical Sidebar and Horizontal Menu.
 * In Phase 2, `permission` filters items dynamically using GET /api/v1/auth/me/permissions/.
 */
export const PORTAL_NAVIGATION: NavSection[] = [
  {
    id: 'overview',
    i18nKey: 'nav.sections.overview',
    items: [
      {
        id: 'dashboard',
        path: '/',
        i18nKey: 'nav.dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'academic',
    i18nKey: 'nav.sections.academic',
    items: [
      {
        id: 'academics',
        path: '/academics',
        i18nKey: 'nav.academics',
        icon: CalendarRange,
        permission: 'academics.view_academicyear',
      },
      {
        id: 'subjects',
        path: '/subjects',
        i18nKey: 'nav.subjects',
        icon: BookOpen,
        permission: 'subjects.view_subject',
      },
      {
        id: 'students',
        path: '/students',
        i18nKey: 'nav.students',
        icon: GraduationCap,
        permission: 'students.view_student',
      },
      {
        id: 'enrollments',
        path: '/enrollments',
        i18nKey: 'nav.enrollments',
        icon: UserCheck,
        permission: 'enrollments.view_enrollment',
      },
      {
        id: 'classes',
        path: '/classes',
        i18nKey: 'nav.classes',
        icon: School,
        permission: 'classes.view_classsection',
      },
    ],
  },
  {
    id: 'operations',
    i18nKey: 'nav.sections.operations',
    items: [
      {
        id: 'teachers',
        path: '/teachers',
        i18nKey: 'nav.teachers',
        icon: Users,
        anyOf: ['teachers.view_teacher', 'teachers.view_classschedule'],
      },
      {
        id: 'attendance',
        path: '/attendance',
        i18nKey: 'nav.attendance',
        icon: ClipboardCheck,
        anyOf: [
          'attendance.view_attendancesession',
          'attendance.view_attendancerecord',
          'attendance.take_attendance',
        ],
      },
      {
        id: 'examinations',
        path: '/examinations',
        i18nKey: 'nav.examinations',
        icon: FileSpreadsheet,
        anyOf: ['examinations.view_assessment', 'examinations.view_subjectgrade'],
      },
      {
        id: 'reports',
        path: '/reports',
        i18nKey: 'nav.reports',
        icon: BarChart3,
        permission: 'reports.export_reports',
      },
    ],
  },
  {
    id: 'administration',
    i18nKey: 'nav.sections.administration',
    items: [
      {
        id: 'users',
        path: '/users',
        i18nKey: 'nav.users',
        icon: ShieldCheck,
        anyOf: ['accounts.view_user', 'auth.view_group'],
      },
      {
        id: 'settings',
        path: '/settings',
        i18nKey: 'nav.settings',
        icon: Settings,
        anyOf: [
          'system_settings.manage_system_settings',
          'system_settings.view_systemsetting',
          'system_settings.manage_backups',
          'auditlogs.view_audit_logs',
        ],
      },
    ],
  },
]
