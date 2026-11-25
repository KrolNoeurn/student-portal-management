import { useState } from 'react'
import {
  Bell,
  Columns2,
  Globe,
  Moon,
  Rows2,
  Shield,
  Sun,
  User,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useThemeLayout } from '@/contexts/ThemeLayoutContext'

export function NavbarActions() {
  const { t, i18n } = useTranslation()
  const { layout, toggleLayout, theme, toggleTheme } = useThemeLayout()
  const [openMenu, setOpenMenu] = useState<'lang' | 'notif' | 'user' | null>(null)

  const currentLang = i18n.language === 'km' ? 'km' : 'en'

  const toggleMenu = (menu: 'lang' | 'notif' | 'user') => {
    setOpenMenu((prev) => (prev === menu ? null : menu))
  }

  return (
    <div className="d-flex align-items-center gap-1 position-relative">
      {/* Layout Switcher (Vertical <-> Horizontal) */}
      <button
        type="button"
        className="btn btn-icon btn-label-secondary"
        onClick={toggleLayout}
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
        onClick={toggleTheme}
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
              onClick={() => {
                i18n.changeLanguage('en')
                setOpenMenu(null)
              }}
            >
              <span>English (EN)</span>
            </button>
            <button
              type="button"
              className={`dropdown-item ${currentLang === 'km' ? 'active' : ''}`}
              onClick={() => {
                i18n.changeLanguage('km')
                setOpenMenu(null)
              }}
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

      {/* User Account Dropdown */}
      <div className="dropdown ms-1">
        <button
          type="button"
          className="btn p-0 border-0 d-flex align-items-center gap-2"
          onClick={() => toggleMenu('user')}
          aria-expanded={openMenu === 'user'}
        >
          <div className="vx-avatar vx-avatar-sm rounded-circle bg-label-primary">
            <User size={16} />
          </div>
        </button>
        {openMenu === 'user' && (
          <div
            className="dropdown-menu dropdown-menu-end show"
            style={{ right: 0, minWidth: 220 }}
          >
            <div className="px-3 py-2 border-bottom mb-1">
              <div className="fw-semibold small">{t('toolbar.account')}</div>
              <div className="text-body-secondary" style={{ fontSize: '0.78rem' }}>
                {t('toolbar.signInReady')}
              </div>
            </div>
            <button
              type="button"
              className="dropdown-item"
              onClick={() => setOpenMenu(null)}
            >
              <Shield size={15} />
              <span>{t('app.phaseBadge')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
