import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
export function DataTable({ columns, data, rowKey, loading = false, emptyTitle, page = 1, totalPages = 1, totalCount, pageSize = 20, onPageChange, }) {
    const { t } = useTranslation();
    if (loading) {
        return (<div className="p-4">
        <LoadingSkeleton rows={5} height={24}/>
      </div>);
    }
    if (data.length === 0) {
        return <EmptyState title={emptyTitle || t('common.noData')}/>;
    }
    const count = totalCount ?? data.length;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, count);
    return (<div>
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              {columns.map((col) => (<th key={col.key} className={col.className}>
                  {col.header}
                </th>))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (<tr key={rowKey(row)}>
                {columns.map((col) => (<td key={col.key} className={col.className}>
                    {col.render(row)}
                  </td>))}
              </tr>))}
          </tbody>
        </table>
      </div>
      {onPageChange && totalPages > 1 && (<div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 px-4 py-3 border-top">
          <div className="small text-body-secondary">
            {t('common.showing', { from, to, total: count })}
          </div>
          <nav aria-label="Table pagination">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                <button type="button" className="page-link" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                  {t('common.previous')}
                </button>
              </li>
              <li className="page-item active">
                <span className="page-link">{page}</span>
              </li>
              <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                <button type="button" className="page-link" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
                  {t('common.next')}
                </button>
              </li>
            </ul>
          </nav>
        </div>)}
    </div>);
}
