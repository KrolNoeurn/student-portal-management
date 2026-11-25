import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Globe, GraduationCap, LogIn, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractApiErrorMessage } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useThemeLayout } from '@/contexts/ThemeLayoutContext';
import { useToast } from '@/contexts/ToastContext';
export function LoginPage() {
    const { t, i18n } = useTranslation();
    const { login, isAuthenticated, isInitializing } = useAuth();
    const { theme, toggleTheme } = useThemeLayout();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const [showPassword, setShowPassword] = useState(false);
    const [serverError, setServerError] = useState(null);
    const schema = useMemo(() => z.object({
        username: z.string().min(1, t('auth.validationUsername')),
        password: z.string().min(1, t('auth.validationPassword')),
    }), [t]);
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { username: '', password: '' },
    });
    if (!isInitializing && isAuthenticated) {
        const from = location.state?.from?.pathname || '/';
        return <Navigate to={from} replace/>;
    }
    const onSubmit = async (values) => {
        setServerError(null);
        try {
            const signedInUser = await login(values);
            showToast(t('auth.welcomeBack', { name: signedInUser.full_name }), 'success');
            if (signedInUser.must_change_password) {
                navigate('/change-password', { replace: true });
                return;
            }
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        }
        catch (err) {
            setServerError(extractApiErrorMessage(err, t('auth.loginFailed')));
        }
    };
    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'km' ? 'en' : 'km');
    };
    return (<div className="min-vh-100 d-flex align-items-center justify-content-center p-3 position-relative">
      {/* Quick Theme & Language Controls */}
      <div className="position-fixed top-0 end-0 p-3 d-flex gap-2">
        <button type="button" className="btn btn-sm btn-label-secondary d-inline-flex align-items-center gap-1" onClick={toggleLanguage}>
          <Globe size={15}/>
          <span>{i18n.language === 'km' ? 'EN' : 'ខ្មែរ'}</span>
        </button>
        <button type="button" className="btn btn-icon btn-sm btn-label-secondary" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-body p-4 p-sm-5">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-4">
            <span className="vx-brand-logo" style={{ width: 42, height: 42 }}>
              <GraduationCap size={24}/>
            </span>
            <div>
              <div className="fw-bold fs-4 lh-1" style={{ color: 'var(--vx-heading)' }}>
                {t('app.shortName')}
              </div>
              <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                {t('app.fullName')}
              </div>
            </div>
          </div>

          <h5 className="mb-1">{t('auth.signInTitle')}</h5>
          <p className="text-body-secondary small mb-4">{t('auth.signInSubtitle')}</p>

          {serverError && (<div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
              {serverError}
            </div>)}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <label htmlFor="login-username" className="form-label">
                {t('auth.usernameOrEmail')}
              </label>
              <input id="login-username" type="text" autoComplete="username" className={`form-control ${errors.username ? 'is-invalid' : ''}`} placeholder={t('auth.usernamePlaceholder')} {...register('username')}/>
              {errors.username && <div className="invalid-feedback">{errors.username.message}</div>}
            </div>

            <div className="mb-4">
              <label htmlFor="login-password" className="form-label">
                {t('auth.password')}
              </label>
              <div className="input-group">
                <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className={`form-control ${errors.password ? 'is-invalid' : ''}`} placeholder="••••••••" {...register('password')}/>
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
                {errors.password && (<div className="invalid-feedback">{errors.password.message}</div>)}
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-100 d-inline-flex align-items-center justify-content-center gap-2 py-2" disabled={isSubmitting}>
              {isSubmitting ? (<span className="spinner-border spinner-border-sm" role="status"/>) : (<LogIn size={16}/>)}
              <span>{t('auth.signInButton')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>);
}
