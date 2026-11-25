export function StatusBadge({ label, tone = 'primary' }) {
    return (<span className={`badge bg-label-${tone} fw-medium px-2 py-1 rounded-1`}>
      {label}
    </span>);
}
