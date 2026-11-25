import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
const LAYOUT_KEY = 'sams_layout';
const THEME_KEY = 'sams_theme';
const WIDTH_KEY = 'sams_content_width';
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
    const [contentWidth, setContentWidthState] = useState(() => {
        const saved = localStorage.getItem(WIDTH_KEY);
        return saved === 'full' ? 'full' : 'boxed';
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
        document.documentElement.setAttribute('data-vx-width', contentWidth);
        localStorage.setItem(WIDTH_KEY, contentWidth);
    }, [contentWidth]);
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
    const setContentWidth = useCallback((mode) => {
        setContentWidthState(mode === 'full' ? 'full' : 'boxed');
    }, []);
    const toggleContentWidth = useCallback(() => {
        setContentWidthState((prev) => (prev === 'boxed' ? 'full' : 'boxed'));
    }, []);
    const toggleSidebarCollapsed = useCallback(() => {
        setSidebarCollapsed((prev) => !prev);
    }, []);
    const containerClass = contentWidth === 'full' ? 'container-fluid' : 'container-xxl';
    const value = useMemo(() => ({
        layout,
        theme,
        contentWidth,
        containerClass,
        sidebarCollapsed,
        mobileMenuOpen,
        setLayout,
        toggleLayout,
        setTheme,
        toggleTheme,
        setContentWidth,
        toggleContentWidth,
        toggleSidebarCollapsed,
        setMobileMenuOpen,
    }), [
        layout,
        theme,
        contentWidth,
        containerClass,
        sidebarCollapsed,
        mobileMenuOpen,
        setLayout,
        toggleLayout,
        setTheme,
        toggleTheme,
        setContentWidth,
        toggleContentWidth,
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
