export function StatCard({ title, value, subtitle, icon: Icon, tone = 'primary', loading = false, }) {
    return (<div className="card h-100">
      <div className="card-body d-flex align-items-center justify-content-between gap-3">
        <div className="min-w-0">
          <p className="text-body-secondary small mb-1 text-truncate">{title}</p>
          {loading ? (<div className="vx-skeleton my-1" style={{ height: 26, width: 110 }}/>) : (<h5 className="mb-1 text-truncate">{value}</h5>)}
          {subtitle && <div className="small text-body-secondary text-truncate">{subtitle}</div>}
        </div>
        <div className={`vx-avatar bg-label-${tone}`}>
          <Icon size={20}/>
        </div>
      </div>
    </div>);
}
