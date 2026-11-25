import { useEffect } from 'react';
import { X } from 'lucide-react';
export function FormModal({ open, title, onClose, children, footer, size = 'md', }) {
    useEffect(() => {
        if (!open)
            return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);
    if (!open)
        return null;
    const sizeClass = size === 'md' ? '' : `modal-${size}`;
    return (<>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" onClick={(e) => {
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${sizeClass}`}>
          <div className="modal-content">
            <div className="modal-header border-bottom d-flex align-items-center justify-content-between gap-2">
              <h5 className="modal-title mb-0">{title}</h5>
              <button type="button" className="btn btn-icon btn-sm btn-label-secondary ms-auto flex-shrink-0" onClick={onClose} aria-label="Close">
                <X size={16}/>
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer border-top">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}/>
    </>);
}
