import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from 'react';
import { useTranslation } from 'react-i18next';
import { registerAuthFailureHandler, setAccessToken } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { fetchCurrentUserApi, fetchMyPermissionsApi, loginApi, logoutApi, refreshAccessTokenApi, updateMyPreferencesApi, } from '@/auth/authApi';
import { useThemeLayout } from '@/contexts/ThemeLayoutContext';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const { i18n } = useTranslation();
    const { setLayout, setTheme } = useThemeLayout();
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState(() => new Set());
    const [isInitializing, setIsInitializing] = useState(true);
    const applyUserPreferences = useCallback((authUser) => {
        if (authUser.preferred_layout)
            setLayout(authUser.preferred_layout);
        if (authUser.preferred_theme)
            setTheme(authUser.preferred_theme);
        if (authUser.preferred_language && i18n.language !== authUser.preferred_language) {
            i18n.changeLanguage(authUser.preferred_language);
        }
    }, [i18n, setLayout, setTheme]);
    const clearAuthState = useCallback(() => {
        setAccessToken(null);
        setUser(null);
        setPermissions(new Set());
        queryClient.clear();
    }, []);
    useEffect(() => {
        registerAuthFailureHandler(clearAuthState);
    }, [clearAuthState]);
    // Attempt silent cookie-based session restoration on startup
    useEffect(() => {
        let active = true;
        async function bootstrapSession() {
            try {
                const { access } = await refreshAccessTokenApi();
                if (!active)
                    return;
                setAccessToken(access);
                const [me, perms] = await Promise.all([
                    fetchCurrentUserApi(),
                    fetchMyPermissionsApi(),
                ]);
                if (!active)
                    return;
                setUser(me);
                setPermissions(new Set(perms.permissions));
                applyUserPreferences(me);
            }
            catch {
                if (active) {
                    setAccessToken(null);
                    setUser(null);
                    setPermissions(new Set());
                }
            }
            finally {
                if (active) {
                    setIsInitializing(false);
                }
            }
        }
        bootstrapSession();
        return () => {
            active = false;
        };
    }, [applyUserPreferences]);
    const login = useCallback(async (payload) => {
        const data = await loginApi(payload);
        setAccessToken(data.access);
        setUser(data.user);
        setPermissions(new Set(data.permissions));
        applyUserPreferences(data.user);
        return data.user;
    }, [applyUserPreferences]);
    const logout = useCallback(async () => {
        try {
            await logoutApi();
        }
        finally {
            clearAuthState();
        }
    }, [clearAuthState]);
    const refreshSessionUser = useCallback(async () => {
        const [me, perms] = await Promise.all([
            fetchCurrentUserApi(),
            fetchMyPermissionsApi(),
        ]);
        setUser(me);
        setPermissions(new Set(perms.permissions));
    }, []);
    const syncPreferences = useCallback(async (payload) => {
        if (!user)
            return;
        try {
            const updated = await updateMyPreferencesApi(payload);
            setUser(updated);
        }
        catch {
            // Non-blocking UI preference sync
        }
    }, [user]);
    const hasPermission = useCallback((permission) => {
        if (!permission)
            return true;
        if (!user)
            return false;
        if (user.is_superuser)
            return true;
        return permissions.has(permission);
    }, [permissions, user]);
    const hasAnyPermission = useCallback((perms) => {
        if (perms.length === 0)
            return true;
        if (!user)
            return false;
        if (user.is_superuser)
            return true;
        return perms.some((p) => permissions.has(p));
    }, [permissions, user]);
    const value = useMemo(() => ({
        user,
        permissions,
        isAuthenticated: Boolean(user),
        isInitializing,
        login,
        logout,
        refreshSessionUser,
        syncPreferences,
        hasPermission,
        hasAnyPermission,
    }), [
        user,
        permissions,
        isInitializing,
        login,
        logout,
        refreshSessionUser,
        syncPreferences,
        hasPermission,
        hasAnyPermission,
    ]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return ctx;
}
