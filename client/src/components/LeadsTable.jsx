import React from 'react';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Edit2, 
  Trash2, 
  FileSpreadsheet, 
  Inbox,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'won': return 'badge-status badge-won';
    case 'proposal': return 'badge-status badge-proposal';
    case 'qualified': return 'badge-status badge-qualified';
    case 'contacted': return 'badge-status badge-contacted';
    case 'lost': return 'badge-status badge-lost';
    default: return 'badge-status badge-new';
  }
}

export default function LeadsTable({
  leads = [],
  total = 0,
  page = 1,
  limit = 20,
  totalPages = 1,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onLimitChange,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onViewLead,
  onEditLead,
  onDeleteLead,
  onOpenImport,
}) {
  const allCurrentPageSelected =
    leads.length > 0 && leads.every((lead) => selectedIds.includes(lead._id));

  const renderSortIcon = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.4, marginLeft: '4px' }} />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={12} style={{ color: '#6366f1', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={12} style={{ color: '#6366f1', marginLeft: '4px' }} />
    );
  };

  return (
    <div className="table-card">
      <div className="table-header-meta">
        <div>
          Showing <strong>{leads.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
          <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> CRM leads
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <label style={{ fontSize: '0.78rem' }}>Rows per page:</label>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  onChange={onToggleSelectAll}
                  style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                />
              </th>
              <th className="sortable" onClick={() => onSort('name')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>Contact Name</span>
                  {renderSortIcon('name')}
                </div>
              </th>
              <th className="sortable" onClick={() => onSort('company')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>Company & Location</span>
                  {renderSortIcon('company')}
                </div>
              </th>
              <th className="sortable" onClick={() => onSort('status')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>Pipeline Stage</span>
                  {renderSortIcon('status')}
                </div>
              </th>
              <th className="sortable" onClick={() => onSort('value')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>Deal Value</span>
                  {renderSortIcon('value')}
                </div>
              </th>
              <th>Source</th>
              <th className="sortable" onClick={() => onSort('createdAt')}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span>Created Date</span>
                  {renderSortIcon('createdAt')}
                </div>
              </th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan="8">
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Inbox size={32} />
                    </div>
                    <div>
                      <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        No CRM leads found
                      </h4>
                      <p style={{ fontSize: '0.84rem' }}>
                        No records match the current filters, or database is currently empty.
                      </p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={onOpenImport}>
                      <FileSpreadsheet size={15} />
                      <span>Upload Excel File</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedIds.includes(lead._id);
                return (
                  <tr key={lead._id} className={isSelected ? 'selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(lead._id)}
                        style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {lead.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {lead.email || 'No email provided'}
                      </div>
                      {lead.phone && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          📞 {lead.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{lead.company || '—'}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {[lead.city, lead.country].filter(Boolean).join(', ') || 'Global'}
                      </div>
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(lead.status)}>
                        {lead.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.9rem' }}>
                        ${(lead.value || 0).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="badge-source">{lead.source || 'Excel Import'}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          className="btn-icon"
                          title="View Details"
                          onClick={() => onViewLead(lead)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Edit Lead"
                          onClick={() => onEditLead(lead)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Delete Lead"
                          style={{ color: '#f87171' }}
                          onClick={() => onDeleteLead(lead._id, lead.name)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>

          <div className="page-numbers">
            <button
              className="page-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1))
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <React.Fragment key={p}>
                    {prev && p - prev > 1 && <span style={{ padding: '0 4px', color: 'var(--text-muted)' }}>...</span>}
                    <button
                      className={`page-btn ${page === p ? 'active' : ''}`}
                      onClick={() => onPageChange(p)}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
