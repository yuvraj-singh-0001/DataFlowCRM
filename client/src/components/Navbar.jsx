import React from 'react';
import { 
  Database, 
  FileSpreadsheet, 
  PlusCircle, 
  Download, 
  RefreshCw,
  Layers
} from 'lucide-react';
import { getSampleExcelUrl } from '../services/api';

export default function Navbar({ 
  isConnected, 
  onOpenImport, 
  onOpenAddLead, 
  onRefresh, 
  isRefreshing, 
  onSeedData 
}) {
  return (
    <header className="navbar">
      <div className="brand-section">
        <div className="brand-logo-icon">
          <Layers size={22} />
        </div>
        <div>
          <div className="brand-title">
            DataFlow CRM
            <div className={`nav-status-badge ${isConnected ? 'badge-won' : 'badge-lost'}`}>
              <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
              {isConnected ? 'MongoDB Connected' : 'Connecting DB...'}
            </div>
          </div>
          <div className="brand-subtitle">
            Smart Excel Import, Advanced Filtering & Pipeline Management
          </div>
        </div>
      </div>

      <div className="nav-actions">
        <button 
          className="btn btn-outline btn-sm" 
          onClick={onRefresh} 
          title="Refresh CRM Data"
          disabled={isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spinner' : ''} />
          <span>Refresh</span>
        </button>

        <a 
          href={getSampleExcelUrl()} 
          download="DataFlow_CRM_Sample_Template.xlsx"
          className="btn btn-secondary btn-sm"
          title="Download pre-filled Excel template"
        >
          <Download size={15} />
          <span>Sample Excel</span>
        </a>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={onSeedData}
          title="Seed realistic demo data into MongoDB"
        >
          <Database size={15} />
          <span>Seed Demo Data</span>
        </button>

        <button 
          className="btn btn-success btn-sm" 
          onClick={onOpenImport}
        >
          <FileSpreadsheet size={16} />
          <span>Import Excel</span>
        </button>

        <button 
          className="btn btn-primary btn-sm" 
          onClick={onOpenAddLead}
        >
          <PlusCircle size={16} />
          <span>+ Add Lead</span>
        </button>
      </div>
    </header>
  );
}
