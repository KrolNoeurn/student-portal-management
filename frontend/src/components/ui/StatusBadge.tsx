export type BadgeTone = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'danger'

interface StatusBadgeProps {
  label: string
  tone?: BadgeTone
}

export function StatusBadge({ label, tone = 'primary' }: StatusBadgeProps) {
  return (
    <span className={`badge bg-label-${tone} fw-medium px-2 py-1 rounded-1`}>
      {label}
    </span>
  )
}
