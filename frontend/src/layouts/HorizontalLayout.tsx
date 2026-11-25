import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, GraduationCap, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NavbarActions } from '@/layouts/NavbarActions'
import { PORTAL_NAVIGATION } from '@/navigation/menuConfig'

interface HorizontalLayoutProps {
  brandShort: string
  brandFull: string
  children: ReactNode
}

export function HorizontalLayout({ brandShort, brandFull, children }: HorizontalLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="vx-shell-horizontal">
      <header className="vx-horizontal-header">
        <div className="container-xxl vx-horizontal-top">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-icon btn-label-secondary d-lg-none"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <NavLink to="/" className="d-flex align-items-center gap-2 text-decoration-none">
              <span className="vx-brand-logo">
                <GraduationCap size={20} />
              </span>
              <span className="fw-bold fs-5" style={{ color: 'var(--vx-heading)' }}>
                {brandShort}
              </span>
              <span className="text-body-secondary small d-none d-md-inline ms-1">
                — {brandFull}
              </span>
            </NavLink>
          </div>
          <NavbarActions />
        </div>

        {/* Horizontal Navigation Bar (uses same PORTAL_NAVIGATION source of truth) */}
        <div className={`border-top ${mobileOpen ? 'd-block' : 'd-none d-lg-block'}`}>
          <nav className="container-xxl vx-horizontal-menu" aria-label="Horizontal navigation">
            {PORTAL_NAVIGATION.map((section) => {
              if (section.items.length === 1) {
                const item = section.items[0]
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `vx-hnav-link ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setOpenDropdown(null)
                      setMobileOpen(false)
                    }}
                  >
                    <Icon size={17} />
                    <span>{t(item.i18nKey)}</span>
                  </NavLink>
                )
              }

              const sectionActive = section.items.some((item) =>
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              )

              return (
                <div key={section.id} className="dropdown">
                  <button
                    type="button"
                    className={`vx-hnav-link ${sectionActive ? 'active' : ''}`}
                    onClick={() =>
                      setOpenDropdown((prev) => (prev === section.id ? null : section.id))
                    }
                    aria-expanded={openDropdown === section.id}
                  >
                    <span>{t(section.i18nKey)}</span>
                    <ChevronDown size={15} />
                  </button>
                  {openDropdown === section.id && (
                    <div className="dropdown-menu show" style={{ minWidth: 230 }}>
                      {section.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <NavLink
                            key={item.id}
                            to={item.path}
                            className={({ isActive }) =>
                              `dropdown-item ${isActive ? 'active' : ''}`
                            }
                            onClick={() => {
                              setOpenDropdown(null)
                              setMobileOpen(false)
                            }}
                          >
                            <Icon size={16} />
                            <span className="flex-grow-1">{t(item.i18nKey)}</span>
                            {item.phase && (
                              <span className="badge bg-label-secondary" style={{ fontSize: '0.68rem' }}>
                                P{item.phase}
                              </span>
                            )}
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="vx-content container-xxl">{children}</main>

      <footer className="vx-footer">
        <div className="container-xxl d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2">
          <span>
            &copy; {new Date().getFullYear()} {brandFull}
          </span>
          <span className="badge bg-label-primary">{t('app.phaseBadge')}</span>
        </div>
      </footer>
    </div>
  )
}
