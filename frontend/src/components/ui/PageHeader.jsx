import { Link } from 'react-router-dom';
export function PageHeader({ title, subtitle, breadcrumbs, actions }) {
    return (<div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (<nav aria-label="breadcrumb" className="mb-1">
            <ol className="breadcrumb mb-0 small">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (<li key={`${crumb.label}-${idx}`} className={`breadcrumb-item ${isLast ? 'active' : ''}`} aria-current={isLast ? 'page' : undefined}>
                    {crumb.to && !isLast ? (<Link to={crumb.to} className="text-decoration-none">
                        {crumb.label}
                      </Link>) : (crumb.label)}
                  </li>);
            })}
            </ol>
          </nav>)}
        <h4 className="mb-1">{title}</h4>
        {subtitle && <p className="text-body-secondary mb-0 small">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex align-items-center gap-2 flex-wrap">{actions}</div>}
    </div>);
}
