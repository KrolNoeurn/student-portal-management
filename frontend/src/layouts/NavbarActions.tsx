import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Columns2,
  Globe,
  KeyRound,
  LogOut,
  Moon,
  Rows2,
  Sun,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/auth/AuthContext'
import { useThemeLayout } from '@/contexts/ThemeLayoutContext'
import { useToast } from '@/contexts/ToastContext'

export function NavbarActions() {
  const { t, i18n } = useTranslation()
  const { user, logout, syncPreferences } = useAuth()
  const { layout, toggleLayout, theme, toggleTheme } = useThemeLayout()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [openMenu, setOpenMenu] = useState<'lang' | 'notif' | 'user' | null>(null)

  const currentLang = i18n.language === 'km' ? 'km' : 'en'

  const toggleMenu = (menu: 'lang' | 'notif' | 'user') => {
    setOpenMenu((prev) => (prev === menu ? null : menu))
  }

  const handleToggleLayout = () => {
    const next = layout === 'vertical' ? 'horizontal' : 'vertical'
    toggleLayout()
    syncPreferences({ preferred_layout: next })
  }

  const handleToggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    toggleTheme()
    syncPreferences({ preferred_theme: next })
  }

  const handleLanguageChange = (lang: 'en' | 'km') => {
    i18n.changeLanguage(lang)
    syncPreferences({ preferred_language: lang })
    setOpenMenu(null)
  }

  const handleLogout = async () => {
    setOpenMenu(null)
    await logout()
    showToast(t('auth.signedOut'), 'info')
    navigate('/login', { replace: true })
  }

  const initials = (user?.full_name || user?.username || 'U')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

  const primaryRole = user?.is_superuser
    ? 'Super Administrator'
    : user?.roles?.[0]?.name || t('toolbar.account')

  return (
    <div className="d-flex align-items-center gap-1 position-relative">
      {/* Layout Switcher (Vertical <-> Horizontal) */}
      <button
        type="button"
        className="btn btn-icon btn-label-secondary"
        onClick={handleToggleLayout}
        title={
          layout === 'vertical'
            ? t('toolbar.switchToHorizontal')
            : t('toolbar.switchToVertical')
        }
        aria-label={
          layout === 'vertical'
            ? t('toolbar.switchToHorizontal')
            : t('toolbar.switchToVertical')
        }
      >
        {layout === 'vertical' ? <Rows2 size={18} /> : <Columns2 size={18} />}
      </button>

      {/* Theme Switcher (Light <-> Dark) */}
      <button
        type="button"
        className="btn btn-icon btn-label-secondary"
        onClick={handleToggleTheme}
        title={theme === 'light' ? t('toolbar.switchToDark') : t('toolbar.switchToLight')}
        aria-label={theme === 'light' ? t('toolbar.switchToDark') : t('toolbar.switchToLight')}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Language Switcher (English <-> Khmer) */}
      <div className="dropdown">
        <button
          type="button"
          className="btn btn-icon btn-label-secondary"
          onClick={() => toggleMenu('lang')}
          title={t('toolbar.language')}
          aria-expanded={openMenu === 'lang'}
        >
          <Globe size={18} />
        </button>
        {openMenu === 'lang' && (
          <div className="dropdown-menu dropdown-menu-end show" style={{ right: 0 }}>
            <button
              type="button"
              className={`dropdown-item ${currentLang === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              <span>English (EN)</span>
            </button>
            <button
              type="button"
              className={`dropdown-item ${currentLang === 'km' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('km')}
            >
              <span>ភាសាខ្មែរ (KM)</span>
            </button>
          </div>
        )}
      </div>

      {/* Notifications Dropdown */}
      <div className="dropdown">
        <button
          type="button"
          className="btn btn-icon btn-label-secondary"
          onClick={() => toggleMenu('notif')}
          title={t('toolbar.notifications')}
          aria-expanded={openMenu === 'notif'}
        >
          <Bell size={18} />
        </button>
        {openMenu === 'notif' && (
          <div
            className="dropdown-menu dropdown-menu-end show p-3"
            style={{ right: 0, width: 280 }}
          >
            <div className="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
              <span className="fw-semibold small">{t('toolbar.notifications')}</span>
              <span className="badge bg-label-primary">0</span>
            </div>
            <p className="text-body-secondary small mb-0 text-center py-3">
              {t('toolbar.noNotifications')}
            </p>
          </div>
        )}
      </div>

      {/* Authenticated User Account Dropdown */}
      <div className="dropdown ms-1">
        <button
          type="button"
          className="btn p-0 border-0 d-flex align-items-center gap-2"
          onClick={() => toggleMenu('user')}
          aria-expanded={openMenu === 'user'}
        >
          <div className="vx-avatar vx-avatar-sm rounded-circle bg-label-primary">
            {initials || 'U'}
          </div>
        </button>
        {openMenu === 'user' && (
          <div
            className="dropdown-menu dropdown-menu-end show"
            style={{ right: 0, minWidth: 230 }}
          >
            <div className="px-3 py-2 border-bottom mb-1">
              <div className="fw-semibold small text-truncate">
                {user?.full_name || user?.username}
              </div>
              <div className="text-body-secondary text-truncate" style={{ fontSize: '0.78rem' }}>
                {primaryRole}
              </div>
            </div>
            <Link
              to="/change-password"
              className="dropdown-item"
              onClick={() => setOpenMenu(null)}
            >
              <KeyRound size={15} />
              <span>{t('toolbar.changePassword')}</span>
            </Link>
            <div className="dropdown-divider" />
            <button
              type="button"
              className="dropdown-item text-danger"
              onClick={handleLogout}
            >
              <LogOut size={15} />
              <span>{t('toolbar.logout')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
