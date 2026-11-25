import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, GraduationCap, Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useThemeLayout } from '@/contexts/ThemeLayoutContext';
import { NavbarActions } from '@/layouts/NavbarActions';
import { PORTAL_NAVIGATION } from '@/navigation/menuConfig';
export function HorizontalLayout({ brandShort, brandFull, children }) {
    const { t } = useTranslation();
    const { hasPermission, hasAnyPermission } = useAuth();
    const { containerClass } = useThemeLayout();
    const location = useLocation();
    const [openDropdown, setOpenDropdown] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const visibleSections = PORTAL_NAVIGATION.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
            if (item.anyOf && item.anyOf.length > 0)
                return hasAnyPermission(item.anyOf);
            return hasPermission(item.permission);
        }),
    })).filter((section) => section.items.length > 0);
    return (<div className="vx-shell-horizontal">
      <header className="vx-horizontal-header">
        <div className={`${containerClass} vx-horizontal-top`}>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-icon btn-label-secondary d-lg-none" onClick={() => setMobileOpen((prev) => !prev)} aria-label="Toggle menu">
              {mobileOpen ? <X size={18}/> : <Menu size={18}/>}
            </button>
            <NavLink to="/" className="d-flex align-items-center gap-2 text-decoration-none">
              <span className="vx-brand-logo">
                <GraduationCap size={20}/>
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
          <nav className={`${containerClass} vx-horizontal-menu`} aria-label="Horizontal navigation">
            {visibleSections.map((section) => {
            if (section.items.length === 1) {
                const item = section.items[0];
                const Icon = item.icon;
                return (<NavLink key={item.id} to={item.path} end={item.path === '/'} className={({ isActive }) => `vx-hnav-link ${isActive ? 'active' : ''}`} onClick={() => {
                        setOpenDropdown(null);
                        setMobileOpen(false);
                    }}>
                    <Icon size={17}/>
                    <span>{t(item.i18nKey)}</span>
                  </NavLink>);
            }
            const sectionActive = section.items.some((item) => item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path));
            return (<div key={section.id} className="dropdown">
                  <button type="button" className={`vx-hnav-link ${sectionActive ? 'active' : ''}`} onClick={() => setOpenDropdown((prev) => (prev === section.id ? null : section.id))} aria-expanded={openDropdown === section.id}>
                    <span>{t(section.i18nKey)}</span>
                    <ChevronDown size={15}/>
                  </button>
                  {openDropdown === section.id && (<div className="dropdown-menu show" style={{ minWidth: 230 }}>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (<NavLink key={item.id} to={item.path} className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`} onClick={() => {
                                setOpenDropdown(null);
                                setMobileOpen(false);
                            }}>
                            <Icon size={16}/>
                            <span className="flex-grow-1">{t(item.i18nKey)}</span>
                            {item.phase && (<span className="badge bg-label-secondary" style={{ fontSize: '0.68rem' }}>
                                P{item.phase}
                              </span>)}
                          </NavLink>);
                    })}
                    </div>)}
                </div>);
        })}
          </nav>
        </div>
      </header>

      <main className={`vx-content ${containerClass}`}>{children}</main>

      <footer className="vx-footer">
        <div className={`${containerClass} d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2`}>
          <span>
            &copy; {new Date().getFullYear()} {brandFull}
          </span>
          <span className="badge bg-label-primary">{t('app.phaseBadge')}</span>
        </div>
      </footer>
    </div>);
}
