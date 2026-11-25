import { Link } from 'react-router-dom';
import { Home, Lock, ShieldAlert, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
export function ErrorPage({ code }) {
    const { t } = useTranslation();
    const config = {
        401: {
            title: t('errors.unauthorizedTitle'),
            desc: t('errors.unauthorizedDesc'),
            icon: Lock,
            tone: 'warning',
        },
        403: {
            title: t('errors.forbiddenTitle'),
            desc: t('errors.forbiddenDesc'),
            icon: ShieldAlert,
            tone: 'danger',
        },
        404: {
            title: t('errors.notFoundTitle'),
            desc: t('errors.notFoundDesc'),
            icon: SearchX,
            tone: 'primary',
        },
    }[code];
    const Icon = config.icon;
    return (<div className="min-vh-100 d-flex align-items-center justify-content-center p-4">
      <div className="card text-center" style={{ maxWidth: 460, width: '100%' }}>
        <div className="card-body p-5">
          <div className={`vx-avatar vx-avatar-lg bg-label-${config.tone} mx-auto mb-3 rounded-circle`}>
            <Icon size={24}/>
          </div>
          <h4 className="mb-2">{config.title}</h4>
          <p className="text-body-secondary small mb-4">{config.desc}</p>
          <Link to="/" className="btn btn-primary d-inline-flex align-items-center gap-2">
            <Home size={16}/>
            <span>{t('errors.goHome')}</span>
          </Link>
        </div>
      </div>
    </div>);
}
