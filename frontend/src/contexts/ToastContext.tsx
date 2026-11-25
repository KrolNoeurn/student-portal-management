import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'

export type ToastVariant = 'success' | 'info' | 'warning' | 'danger'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, variant }])
      window.setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const iconFor = (variant: ToastVariant) => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 size={18} className="text-success flex-shrink-0" />
      case 'warning':
        return <AlertTriangle size={18} className="text-warning flex-shrink-0" />
      case 'danger':
        return <XCircle size={18} className="text-danger flex-shrink-0" />
      default:
        return <Info size={18} className="text-primary flex-shrink-0" />
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="toast-container position-fixed top-0 end-0 p-3"
        style={{ zIndex: 1090 }}
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast show align-items-center border-0 shadow mb-2"
            role="status"
            style={{ backgroundColor: 'var(--vx-surface)', minWidth: 290 }}
          >
            <div className="d-flex align-items-center gap-2 px-3 py-2">
              {iconFor(toast.variant)}
              <div className="toast-body p-0 flex-grow-1 small">{toast.message}</div>
              <button
                type="button"
                className="btn btn-sm p-1 border-0 text-body-secondary"
                onClick={() => dismiss(toast.id)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return ctx
}
