import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface FormModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function FormModal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: FormModalProps) {
  if (!open) return null

  const sizeClass = size === 'md' ? '' : `modal-${size}`

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered ${sizeClass}`}>
          <div className="modal-content">
            <div className="modal-header border-bottom">
              <h5 className="modal-title">{title}</h5>
              <button
                type="button"
                className="btn btn-icon btn-sm btn-label-secondary"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer border-top">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  )
}
