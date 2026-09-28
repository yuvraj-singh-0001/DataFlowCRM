import React from 'react';
import { 
  FileSpreadsheet, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  Layers,
  HelpCircle
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isConnected, totalLeadsInDb = 0 }) {
  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Layers size={20} />
        </div>
        <div>
          <div className="sidebar-title">DataFlow CRM</div>
          <div className="sidebar-subtitle">Excel Filter Suite</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <button
          type="button"
          className={`nav-item ${activeTab === 'cleaner' ? 'active' : ''}`}
          onClick={() => setActiveTab('cleaner')}
        >
          <Sparkles size={18} />
          <span>Excel 10-Digit Cleaner</span>
          <span className="nav-badge">Primary</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'crm' ? 'active' : ''}`}
          onClick={() => setActiveTab('crm')}
        >
          <Database size={18} />
          <span>MongoDB CRM Leads</span>
          {totalLeadsInDb > 0 && <span className="nav-count">{totalLeadsInDb}</span>}
        </button>
      </nav>

      {/* Database Status Card at Bottom */}
      <div className="sidebar-footer">
        <div className="db-status-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
            <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`} />
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isConnected ? '#15803d' : '#b91c1c' }}>
              {isConnected ? 'MongoDB Connected' : 'DB Connecting...'}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Cluster0 • {totalLeadsInDb} Total Leads
          </div>
        </div>
      </div>
    </aside>
  );
}
