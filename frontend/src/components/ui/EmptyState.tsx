import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-5 px-3">
      <div className="vx-avatar vx-avatar-lg bg-label-secondary mx-auto mb-3 rounded-circle">
        <Inbox size={22} />
      </div>
      <h6 className="mb-1">{title}</h6>
      {description && <p className="text-body-secondary small mb-3 mx-auto" style={{ maxWidth: 420 }}>{description}</p>}
      {action}
    </div>
  )
}
