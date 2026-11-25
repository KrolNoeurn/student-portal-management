import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, GraduationCap, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/AuthContext'
import { useThemeLayout } from '@/contexts/ThemeLayoutContext'
import { NavbarActions } from '@/layouts/NavbarActions'
import { PORTAL_NAVIGATION } from '@/navigation/menuConfig'

interface VerticalLayoutProps {
  brandShort: string
  brandFull: string
  children: ReactNode
}

export function VerticalLayout({ brandShort, brandFull, children }: VerticalLayoutProps) {
  const { t } = useTranslation()
  const { hasPermission, hasAnyPermission } = useAuth()
  const {
    sidebarCollapsed,
    toggleSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useThemeLayout()

  const visibleSections = PORTAL_NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.anyOf && item.anyOf.length > 0) return hasAnyPermission(item.anyOf)
      return hasPermission(item.permission)
    }),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="vx-shell-vertical">
      {mobileMenuOpen && (
        <div
          className="vx-backdrop d-lg-none"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible Vuexy-Styled Vertical Sidebar */}
      <aside
        className={`vx-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${
          mobileMenuOpen ? 'mobile-open' : ''
        }`}
      >
        <div className="vx-sidebar-brand">
          <NavLink
            to="/"
            className="d-flex align-items-center gap-2 text-decoration-none overflow-hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="vx-brand-logo">
              <GraduationCap size={20} />
            </span>
            <span className="vx-brand-text fw-bold fs-5 text-truncate" style={{ color: 'var(--vx-heading)' }}>
              {brandShort}
            </span>
          </NavLink>

          <button
            type="button"
            className="btn btn-icon btn-sm btn-label-secondary d-none d-lg-inline-flex vx-sidebar-pin"
            onClick={toggleSidebarCollapsed}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button
            type="button"
            className="btn btn-icon btn-sm btn-label-secondary d-lg-none"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="vx-sidebar-nav" aria-label="Primary navigation">
          {visibleSections.map((section) => (
            <div key={section.id}>
              <div className="vx-nav-section-title">{t(section.i18nKey)}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `vx-nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon size={18} className="vx-nav-icon" />
                    <span className="vx-nav-label flex-grow-1 text-truncate">
                      {t(item.i18nKey)}
                    </span>
                    {item.phase && (
                      <span className="vx-nav-badge badge bg-label-secondary" style={{ fontSize: '0.68rem' }}>
                        P{item.phase}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={`vx-main-vertical ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="vx-navbar-wrapper">
          <header className="vx-navbar">
            <div className="d-flex align-items-center gap-2 min-w-0">
              <button
                type="button"
                className="btn btn-icon btn-label-secondary d-lg-none"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>
              <span className="fw-medium text-truncate d-none d-sm-inline" style={{ color: 'var(--vx-heading)' }}>
                {brandFull}
              </span>
            </div>
            <NavbarActions />
          </header>
        </div>

        <main className="vx-content container-xxl">{children}</main>

        <footer className="vx-footer d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2">
          <span>
            &copy; {new Date().getFullYear()} {brandFull}
          </span>
          <span className="badge bg-label-primary">{t('app.phaseBadge')}</span>
        </footer>
      </div>
    </div>
  )
}
