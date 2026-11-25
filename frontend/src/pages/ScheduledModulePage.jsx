import { Link } from 'react-router-dom';
import { ArrowLeft, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
export function ScheduledModulePage({ titleKey, phase }) {
    const { t } = useTranslation();
    return (<div>
      <PageHeader title={t(titleKey)} breadcrumbs={[
            { label: t('foundation.breadcrumbHome'), to: '/' },
            { label: t(titleKey) },
        ]} actions={<StatusBadge label={`${t('common.phase')} ${phase}`} tone="info"/>}/>

      <div className="card">
        <div className="card-body text-center py-5">
          <div className="vx-avatar vx-avatar-lg bg-label-primary mx-auto mb-3 rounded-circle">
            <Layers size={24}/>
          </div>
          <h5 className="mb-2">{t('foundation.modulePendingTitle')}</h5>
          <p className="text-body-secondary mx-auto mb-4" style={{ maxWidth: 540 }}>
            {t('foundation.modulePendingDesc')}
          </p>
          <Link to="/" className="btn btn-primary d-inline-flex align-items-center gap-2">
            <ArrowLeft size={16}/>
            <span>{t('foundation.backToOverview')}</span>
          </Link>
        </div>
      </div>
    </div>);
}
