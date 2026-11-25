import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
const LAYOUT_KEY = 'sams_layout';
const THEME_KEY = 'sams_theme';
const COLLAPSED_KEY = 'sams_sidebar_collapsed';
const ThemeLayoutContext = createContext(null);
export function ThemeLayoutProvider({ children }) {
    const [layout, setLayoutState] = useState(() => {
        const saved = localStorage.getItem(LAYOUT_KEY);
        return saved === 'horizontal' ? 'horizontal' : 'vertical';
    });
    const [theme, setThemeState] = useState(() => {
        const saved = localStorage.getItem(THEME_KEY);
        return saved === 'dark' ? 'dark' : 'light';
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        return localStorage.getItem(COLLAPSED_KEY) === 'true';
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);
    useEffect(() => {
        localStorage.setItem(LAYOUT_KEY, layout);
    }, [layout]);
    useEffect(() => {
        localStorage.setItem(COLLAPSED_KEY, String(sidebarCollapsed));
    }, [sidebarCollapsed]);
    const setLayout = useCallback((mode) => {
        setLayoutState(mode);
        setMobileMenuOpen(false);
    }, []);
    const toggleLayout = useCallback(() => {
        setLayoutState((prev) => (prev === 'vertical' ? 'horizontal' : 'vertical'));
        setMobileMenuOpen(false);
    }, []);
    const setTheme = useCallback((mode) => setThemeState(mode), []);
    const toggleTheme = useCallback(() => {
        setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
    }, []);
    const toggleSidebarCollapsed = useCallback(() => {
        setSidebarCollapsed((prev) => !prev);
    }, []);
    const value = useMemo(() => ({
        layout,
        theme,
        sidebarCollapsed,
        mobileMenuOpen,
        setLayout,
        toggleLayout,
        setTheme,
        toggleTheme,
        toggleSidebarCollapsed,
        setMobileMenuOpen,
    }), [
        layout,
        theme,
        sidebarCollapsed,
        mobileMenuOpen,
        setLayout,
        toggleLayout,
        setTheme,
        toggleTheme,
        toggleSidebarCollapsed,
    ]);
    return <ThemeLayoutContext.Provider value={value}>{children}</ThemeLayoutContext.Provider>;
}
export function useThemeLayout() {
    const ctx = useContext(ThemeLayoutContext);
    if (!ctx) {
        throw new Error('useThemeLayout must be used inside ThemeLayoutProvider');
    }
    return ctx;
}
