import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ErrorStateProps {
  title: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    <div className="alert alert-danger border-0 d-flex align-items-start gap-3 mb-0" role="alert">
      <div className="vx-avatar vx-avatar-sm bg-label-danger">
        <AlertTriangle size={18} />
      </div>
      <div className="flex-grow-1">
        <h6 className="alert-heading mb-1 text-danger">{title}</h6>
        {message && <p className="mb-2 small">{message}</p>}
        {onRetry && (
          <button type="button" className="btn btn-sm btn-danger d-inline-flex align-items-center gap-1" onClick={onRetry}>
            <RefreshCw size={14} />
            {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  )
}
