import React, { useState, useEffect } from 'react';
import { Database, Search, Download, Trash2, RefreshCw, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchLeads, deleteLead, bulkDeleteLeads } from '../services/api';

export default function CrmDatabaseView({ notify, onRefreshCount }) {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await fetchLeads({ search, limit: 100 });
      if (res.success) {
        setLeads(res.data || []);
        if (onRefreshCount) onRefreshCount();
      }
    } catch (err) {
      notify(`Failed to fetch database leads: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete lead "${name}" from MongoDB?`)) return;
    try {
      const res = await deleteLead(id);
      if (res.success) {
        notify('Deleted lead from database', 'info');
        loadData();
      }
    } catch (err) {
      notify(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleExportDbToExcel = () => {
    if (leads.length === 0) return;
    const exportData = leads.map((l) => ({
      Name: l.name,
      'Phone No': l.phone,
      Source: l.source,
      'Added On': new Date(l.createdAt).toLocaleDateString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 25 }, { wch: 15 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MongoDB Leads');
    XLSX.writeFile(workbook, 'MongoDB_Stored_Leads.xlsx');
    notify(`Exported ${leads.length} stored leads to Excel!`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <Database size={22} style={{ color: '#4f46e5' }} />
              <span>MongoDB Cloud Database (Atlas)</span>
            </h1>
            <p className="page-description">
              Browse, search, or export leads that have been saved into your MongoDB database.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? 'spinner' : ''} />
              <span>Refresh</span>
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleExportDbToExcel}
              disabled={leads.length === 0}
            >
              <Download size={14} />
              <span>Export Database to Excel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card table-card-light">
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
            <input
              type="text"
              placeholder="Search leads by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem 0.5rem 2rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Total <strong>{leads.length}</strong> leads found
          </div>
        </div>

        <div className="table-responsive">
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Name</th>
                <th>Phone No (10-Digit)</th>
                <th>Source</th>
                <th>Saved At</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    No leads saved in MongoDB yet. Use the <strong>Excel 10-Digit Cleaner</strong> tab to upload and save leads!
                  </td>
                </tr>
              ) : (
                leads.map((lead, idx) => (
                  <tr key={lead._id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{lead.name}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#16a34a' }}>
                        {lead.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {lead.source || 'Excel Import'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', color: '#dc2626', borderColor: '#fca5a5' }}
                        title="Delete from MongoDB"
                        onClick={() => handleDelete(lead._id, lead.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
