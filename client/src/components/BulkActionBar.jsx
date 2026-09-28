import React, { useState } from 'react';
import { Download, Trash2, CheckCircle2, X } from 'lucide-react';

const STATUS_LIST = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];

export default function BulkActionBar({
  selectedCount,
  onClearSelection,
  onExportSelected,
  onBulkDelete,
  onBulkUpdateStatus,
}) {
  const [selectedStatus, setSelectedStatus] = useState('Qualified');

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <span className="bulk-count">
          {selectedCount} {selectedCount === 1 ? 'record' : 'records'} selected
        </span>
        <button 
          className="btn btn-outline btn-sm" 
          onClick={onClearSelection}
          title="Deselect all"
        >
          <X size={13} />
          <span>Deselect</span>
        </button>
      </div>

      <div className="bulk-actions">
        <button 
          className="btn btn-success btn-sm" 
          onClick={onExportSelected}
          title="Download only selected rows to Excel"
        >
          <Download size={14} />
          <span>Export Selected ({selectedCount}) to Excel</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onBulkUpdateStatus(selectedStatus)}
            title="Set selected status"
          >
            <CheckCircle2 size={13} />
            <span>Apply Status</span>
          </button>
        </div>

        <button 
          className="btn btn-danger btn-sm" 
          onClick={onBulkDelete}
          title="Delete selected leads"
        >
          <Trash2 size={14} />
          <span>Delete ({selectedCount})</span>
        </button>
      </div>
    </div>
  );
}
