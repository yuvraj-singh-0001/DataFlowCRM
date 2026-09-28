import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { importExcelFile, getSampleExcelUrl } from '../services/api';

export default function ImportExcelModal({ isOpen, onClose, onSuccess, notify }) {
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileProcess = (selectedFile) => {
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      notify('Please select an Excel (.xlsx, .xls) or CSV file', 'error');
      return;
    }

    setFile(selectedFile);

    // Read and preview first few rows client-side
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        setTotalRows(json.length);
        setPreviewRows(json.slice(0, 4));
      } catch (err) {
        console.error('Preview parse error:', err);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      notify('Please choose a file to import', 'error');
      return;
    }

    try {
      setIsUploading(true);
      const res = await importExcelFile(file);

      if (res.success) {
        notify(res.message || 'Leads imported successfully into MongoDB!', 'success');
        onSuccess();
        onClose();
      } else {
        notify(res.message || 'Failed to import file', 'error');
      }
    } catch (err) {
      notify(`Import failed: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <FileSpreadsheet size={20} style={{ color: '#10b981' }} />
            <span>Import Leads from Excel (.xlsx / .csv)</span>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileProcess(e.target.files[0])}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
            />
            <div className="dropzone-icon">
              <UploadCloud size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {file ? file.name : 'Click to upload or drag & drop Excel file here'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Supports .xlsx, .xls, and .csv spreadsheets up to 25MB
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Info size={15} style={{ color: '#6366f1' }} />
              <span>Need the standard Excel format?</span>
            </div>
            <a 
              href={getSampleExcelUrl()} 
              download="DataFlow_CRM_Sample_Template.xlsx"
              className="btn btn-outline btn-sm"
            >
              <Download size={13} />
              <span>Download Template</span>
            </a>
          </div>

          {/* Sheet Preview */}
          {previewRows.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Detected Preview ({totalRows} rows detected)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle size={12} /> Ready to store in MongoDB
                </span>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-main)' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}>
                      {Object.keys(previewRows[0]).slice(0, 5).map((col) => (
                        <th key={col} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {Object.keys(previewRows[0]).slice(0, 5).map((col) => (
                          <td key={col} style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary)' }}>
                            {String(row[col] || '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit} 
            disabled={!file || isUploading}
          >
            {isUploading && <span className="spinner" />}
            <span>{isUploading ? 'Importing to MongoDB...' : `Import ${totalRows ? `(${totalRows} rows)` : ''} into CRM`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
