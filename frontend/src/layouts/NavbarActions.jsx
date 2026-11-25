import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Columns2, Globe, KeyRound, LogOut, Maximize2, Minimize2, Moon, Rows2, Sun, } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useThemeLayout } from '@/contexts/ThemeLayoutContext';
import { useToast } from '@/contexts/ToastContext';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, } from '@/features/notifications/notificationsApi';
export function NavbarActions() {
    const { t, i18n } = useTranslation();
    const { user, logout, syncPreferences } = useAuth();
    const { layout, toggleLayout, theme, toggleTheme, contentWidth, toggleContentWidth } = useThemeLayout();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [openMenu, setOpenMenu] = useState(null);
    const currentLang = i18n.language === 'km' ? 'km' : 'en';
    const isKm = currentLang === 'km';
    const unreadQuery = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: fetchUnreadNotificationCount,
        enabled: Boolean(user),
        refetchInterval: 30000,
    });
    const notificationsQuery = useQuery({
        queryKey: ['notifications-list'],
        queryFn: () => fetchNotifications({ page_size: 10 }),
        enabled: openMenu === 'notif' && Boolean(user),
    });
    const unreadCount = unreadQuery.data?.unread_count ?? 0;
    const toggleMenu = (menu) => {
        setOpenMenu((prev) => (prev === menu ? null : menu));
    };
    const handleToggleLayout = () => {
        const next = layout === 'vertical' ? 'horizontal' : 'vertical';
        toggleLayout();
        syncPreferences({ preferred_layout: next });
    };
    const handleToggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        toggleTheme();
        syncPreferences({ preferred_theme: next });
    };
    const handleLanguageChange = (lang) => {
        i18n.changeLanguage(lang);
        syncPreferences({ preferred_language: lang });
        setOpenMenu(null);
    };
    const handleLogout = async () => {
        setOpenMenu(null);
        await logout();
        showToast(t('auth.signedOut'), 'info');
        navigate('/login', { replace: true });
    };
    const handleNotificationClick = async (item) => {
        if (!item.is_read) {
            await markNotificationRead(item.id);
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
        }
        if (item.link_url) {
            setOpenMenu(null);
            navigate(item.link_url);
        }
    };
    const handleMarkAllRead = async () => {
        await markAllNotificationsRead();
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
        showToast(t('notifications.allMarkedRead'), 'info');
    };
    const initials = (user?.full_name || user?.username || 'U')
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('');
    const primaryRole = user?.is_superuser
        ? 'Super Administrator'
        : user?.roles?.[0]?.name || t('toolbar.account');
    return (<div className="d-flex align-items-center gap-1 position-relative">
      {/* Layout Switcher (Vertical <-> Horizontal) */}
      <button type="button" className="btn btn-icon btn-label-secondary" onClick={handleToggleLayout} title={layout === 'vertical'
            ? t('toolbar.switchToHorizontal')
            : t('toolbar.switchToVertical')} aria-label={layout === 'vertical'
            ? t('toolbar.switchToHorizontal')
            : t('toolbar.switchToVertical')}>
        {layout === 'vertical' ? <Rows2 size={18}/> : <Columns2 size={18}/>}
      </button>

      {/* Content Width Switcher (Boxed / Current <-> Full Width) */}
      <button type="button" className="btn btn-icon btn-label-secondary" onClick={toggleContentWidth} title={contentWidth === 'boxed'
            ? t('toolbar.switchToFullWidth')
            : t('toolbar.switchToBoxed')} aria-label={contentWidth === 'boxed'
            ? t('toolbar.switchToFullWidth')
            : t('toolbar.switchToBoxed')}>
        {contentWidth === 'boxed' ? <Maximize2 size={17}/> : <Minimize2 size={17}/>}
      </button>

      {/* Theme Switcher (Light <-> Dark) */}
      <button type="button" className="btn btn-icon btn-label-secondary" onClick={handleToggleTheme} title={theme === 'light' ? t('toolbar.switchToDark') : t('toolbar.switchToLight')} aria-label={theme === 'light' ? t('toolbar.switchToDark') : t('toolbar.switchToLight')}>
        {theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}
      </button>

      {/* Language Switcher (English <-> Khmer) */}
      <div className="dropdown">
        <button type="button" className="btn btn-icon btn-label-secondary" onClick={() => toggleMenu('lang')} title={t('toolbar.language')} aria-expanded={openMenu === 'lang'}>
          <Globe size={18}/>
        </button>
        {openMenu === 'lang' && (<div className="dropdown-menu dropdown-menu-end show" style={{ right: 0 }}>
            <button type="button" className={`dropdown-item ${currentLang === 'en' ? 'active' : ''}`} onClick={() => handleLanguageChange('en')}>
              <span>English (EN)</span>
            </button>
            <button type="button" className={`dropdown-item ${currentLang === 'km' ? 'active' : ''}`} onClick={() => handleLanguageChange('km')}>
              <span>ភាសាខ្មែរ (KM)</span>
            </button>
          </div>)}
      </div>

      {/* Live Notifications Dropdown */}
      <div className="dropdown">
        <button type="button" className="btn btn-icon btn-label-secondary position-relative" onClick={() => toggleMenu('notif')} title={t('toolbar.notifications')} aria-expanded={openMenu === 'notif'}>
          <Bell size={18}/>
          {unreadCount > 0 && (<span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>)}
        </button>
        {openMenu === 'notif' && (<div className="dropdown-menu dropdown-menu-end show p-0" style={{ right: 0, width: 340, maxWidth: '90vw' }}>
            <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-semibold small">{t('toolbar.notifications')}</span>
                <span className="badge bg-label-primary">{unreadCount}</span>
              </div>
              {unreadCount > 0 && (<button type="button" className="btn btn-sm btn-link text-decoration-none p-0 d-inline-flex align-items-center gap-1" onClick={handleMarkAllRead}>
                  <CheckCheck size={14}/>
                  <span style={{ fontSize: '0.78rem' }}>{t('notifications.markAllRead')}</span>
                </button>)}
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {notificationsQuery.isLoading ? (<p className="text-body-secondary small mb-0 text-center py-4">
                  {t('common.loading')}
                </p>) : (notificationsQuery.data?.results || []).length === 0 ? (<p className="text-body-secondary small mb-0 text-center py-4">
                  {t('toolbar.noNotifications')}
                </p>) : ((notificationsQuery.data?.results || []).map((item) => (<button key={item.id} type="button" className={`dropdown-item border-bottom py-2 px-3 text-wrap ${!item.is_read ? 'bg-label-primary' : ''}`} onClick={() => handleNotificationClick(item)}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <span className="fw-semibold small">
                        {isKm && item.title_km ? item.title_km : item.title_en}
                      </span>
                      {!item.is_read && (<span className="rounded-circle bg-primary flex-shrink-0 mt-1" style={{ width: 8, height: 8 }}/>)}
                    </div>
                    <div className="small text-body-secondary mt-1">
                      {isKm && item.message_km ? item.message_km : item.message_en}
                    </div>
                    <div className="text-body-secondary mt-1" style={{ fontSize: '0.72rem' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </button>)))}
            </div>
          </div>)}
      </div>

      {/* Authenticated User Account Dropdown */}
      <div className="dropdown ms-1">
        <button type="button" className="btn p-0 border-0 d-flex align-items-center gap-2" onClick={() => toggleMenu('user')} aria-expanded={openMenu === 'user'}>
          <div className="vx-avatar vx-avatar-sm rounded-circle bg-label-primary">
            {initials || 'U'}
          </div>
        </button>
        {openMenu === 'user' && (<div className="dropdown-menu dropdown-menu-end show" style={{ right: 0, minWidth: 230 }}>
            <div className="px-3 py-2 border-bottom mb-1">
              <div className="fw-semibold small text-truncate">
                {user?.full_name || user?.username}
              </div>
              <div className="text-body-secondary text-truncate" style={{ fontSize: '0.78rem' }}>
                {primaryRole}
              </div>
            </div>
            <Link to="/change-password" className="dropdown-item" onClick={() => setOpenMenu(null)}>
              <KeyRound size={15}/>
              <span>{t('toolbar.changePassword')}</span>
            </Link>
            <div className="dropdown-divider"/>
            <button type="button" className="dropdown-item text-danger" onClick={handleLogout}>
              <LogOut size={15}/>
              <span>{t('toolbar.logout')}</span>
            </button>
          </div>)}
      </div>
    </div>);
}
