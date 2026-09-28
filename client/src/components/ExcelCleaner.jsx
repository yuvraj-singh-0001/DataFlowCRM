import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sliders, 
  Trash2, 
  Database,
  ArrowRight,
  Filter,
  FileCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cleanPhoneNumber, cleanName, autoDetectColumns } from '../utils/phoneCleaner';
import { createLead } from '../services/api';

export default function ExcelCleaner({ notify, onRefreshDb }) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedNameCol, setSelectedNameCol] = useState('');
  const [selectedPhoneCol, setSelectedPhoneCol] = useState('');
  const [rawRows, setRawRows] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [filterMode, setFilterMode] = useState('valid'); // 'all' | 'valid' | 'invalid' | 'duplicates'
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Process raw Excel data given chosen name & phone columns
  const processRows = (rows, nameCol, phoneCol, deduplicate = removeDuplicates) => {
    if (!rows || rows.length === 0 || !nameCol || !phoneCol) {
      setProcessedData([]);
      return;
    }

    const seenPhones = new Set();
    const result = [];

    rows.forEach((row, index) => {
      const rawName = row[nameCol];
      const rawPhone = row[phoneCol];

      const cleanedNameResult = cleanName(rawName);
      const phoneResult = cleanPhoneNumber(rawPhone);

      let isDuplicate = false;
      if (phoneResult.isValid) {
        if (seenPhones.has(phoneResult.phone)) {
          isDuplicate = true;
        } else {
          seenPhones.add(phoneResult.phone);
        }
      }

      result.push({
        id: index + 1,
        originalName: rawName !== undefined ? String(rawName) : '',
        originalPhone: rawPhone !== undefined ? String(rawPhone) : '',
        name: cleanedNameResult,
        phone: phoneResult.phone,
        isValid: phoneResult.isValid,
        isDuplicate,
        reason: phoneResult.reason,
      });
    });

    setProcessedData(result);
  };

  // Handle uploaded file
  const handleFileUpload = (file) => {
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          notify('The uploaded Excel sheet contains no data rows', 'error');
          setIsProcessing(false);
          return;
        }

        // Collect all column headers from first row
        const headers = Object.keys(json[0]);
        setAvailableColumns(headers);
        setRawRows(json);

        // Auto-detect which columns are Name and Phone No
        const detected = autoDetectColumns(headers, json.slice(0, 10));
        setSelectedNameCol(detected.nameCol);
        setSelectedPhoneCol(detected.phoneCol);

        // Process data
        processRows(json, detected.nameCol, detected.phoneCol, removeDuplicates);
        notify(`Loaded ${json.length} rows from Excel! Auto-detected Name & Phone columns.`, 'success');
      } catch (err) {
        console.error('Error reading Excel:', err);
        notify(`Failed to read file: ${err.message}`, 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-process when column selection changes
  const handleNameColChange = (newCol) => {
    setSelectedNameCol(newCol);
    processRows(rawRows, newCol, selectedPhoneCol, removeDuplicates);
  };

  const handlePhoneColChange = (newCol) => {
    setSelectedPhoneCol(newCol);
    processRows(rawRows, selectedNameCol, newCol, removeDuplicates);
  };

  const handleDeduplicateToggle = () => {
    const newVal = !removeDuplicates;
    setRemoveDuplicates(newVal);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, newVal);
  };

  // Stats calculation
  const totalRowsCount = processedData.length;
  const validNumbersList = processedData.filter((r) => r.isValid && (!removeDuplicates || !r.isDuplicate));
  const validCount = validNumbersList.length;
  const duplicateCount = processedData.filter((r) => r.isValid && r.isDuplicate).length;
  const invalidCount = processedData.filter((r) => !r.isValid).length;

  // Filtered rows for table preview
  const displayRows = processedData.filter((row) => {
    if (filterMode === 'valid') {
      return row.isValid && (!removeDuplicates || !row.isDuplicate);
    }
    if (filterMode === 'duplicates') {
      return row.isDuplicate;
    }
    if (filterMode === 'invalid') {
      return !row.isValid;
    }
    return true; // 'all'
  });

  // Download Cleaned Excel with only 2 columns: Name, Phone No
  const handleDownloadCleanExcel = () => {
    if (validNumbersList.length === 0) {
      notify('No valid 10-digit phone records available to export', 'error');
      return;
    }

    // Format strictly as Name and Phone No (10 digits)
    const exportData = validNumbersList.map((item) => ({
      Name: item.name,
      'Phone No': item.phone, // Exactly 10 digits
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Style column widths for clean readability
    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 18 }, // Phone No
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cleaned Contacts');

    const cleanBaseName = fileName.replace(/\.[^/.]+$/, '');
    const finalFileName = `${cleanBaseName || 'DataFlow'}_10Digit_Filtered.xlsx`;

    XLSX.writeFile(workbook, finalFileName);
    notify(`Downloaded ${exportData.length} cleaned leads into "${finalFileName}"!`, 'success');
  };

  // Save cleaned records into MongoDB database
  const handleSaveToMongoDB = async () => {
    if (validNumbersList.length === 0) {
      notify('No valid records to save into MongoDB', 'error');
      return;
    }

    try {
      setIsSavingDb(true);
      setSaveProgress(0);

      // Save in batches of 50 to avoid network limits
      const total = validNumbersList.length;
      let inserted = 0;

      for (let i = 0; i < total; i += 50) {
        const batch = validNumbersList.slice(i, i + 50);
        await Promise.all(
          batch.map((item) =>
            createLead({
              name: item.name,
              phone: item.phone,
              source: `Excel: ${fileName || 'Uploaded Sheet'}`,
              status: 'New',
              notes: `Auto-cleaned 10-digit number. Original: ${item.originalPhone}`,
            })
          )
        );
        inserted += batch.length;
        setSaveProgress(Math.round((inserted / total) * 100));
      }

      notify(`Successfully saved ${inserted} cleaned leads directly into MongoDB!`, 'success');
      if (onRefreshDb) onRefreshDb();
    } catch (err) {
      console.error('Save to MongoDB error:', err);
      notify(`Database save failed: ${err.message}`, 'error');
    } finally {
      setIsSavingDb(false);
      setSaveProgress(0);
    }
  };

  // Generate Sample Messy Excel for quick test
  const handleGenerateSampleExcel = () => {
    const sampleMessyData = [
      { 'Customer Full Name': 'Aarav Sharma', 'Mobile Number': '+91 9876543210', City: 'Mumbai', Age: 29 },
      { 'Customer Full Name': 'Priya Patel', 'Mobile Number': '09812345678', City: 'Bengaluru', Age: 31 },
      { 'Customer Full Name': 'Rahul Verma', 'Mobile Number': '919822334455', City: 'Delhi', Age: 35 },
      { 'Customer Full Name': 'Sneha Rao', 'Mobile Number': '98765-43210', City: 'Hyderabad', Age: 26 },
      { 'Customer Full Name': 'Vikram Mehta', 'Mobile Number': '+91-9988776655', City: 'Pune', Age: 42 },
      { 'Customer Full Name': 'Aarav Sharma (Duplicate)', 'Mobile Number': '9876543210', City: 'Mumbai', Age: 29 },
      { 'Customer Full Name': 'Ananya Deshmukh', 'Mobile Number': '9765432190', City: 'Nagpur', Age: 28 },
      { 'Customer Full Name': 'Incomplete Contact', 'Mobile Number': '987654', City: 'Kolkata', Age: 24 }, // Invalid (6 digits)
      { 'Customer Full Name': 'Karan Singhania', 'Mobile Number': '+91 9833411223', City: 'Ahmedabad', Age: 38 },
      { 'Customer Full Name': 'Blank Number User', 'Mobile Number': '', City: 'Jaipur', Age: 45 }, // Invalid (blank)
      { 'Customer Full Name': 'Deepak Verma', 'Mobile Number': '09811223344', City: 'Indore', Age: 33 },
      { 'Customer Full Name': 'Neha Gupta', 'Mobile Number': '91-9877001122', City: 'Chandigarh', Age: 27 },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleMessyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Messy Sample');
    XLSX.writeFile(workbook, 'Sample_Messy_Numbers_Sheet.xlsx');
    notify('Downloaded Sample Messy Excel with +91, 0, 91 and dashes for testing!', 'info');
  };

  return (
    <div className="cleaner-container">
      {/* Top Banner / Explainer */}
      <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <Sparkles size={24} style={{ color: '#4f46e5' }} />
              <span>Smart Excel Filter & 10-Digit Phone Cleaner</span>
            </h1>
            <p className="page-description">
              Upload any messy Excel file (8, 15, or 10,000+ rows). It auto-detects columns, strips <code>+91</code>, <code>91</code>, <code>0</code>, spaces & hyphens, and exports only <strong>Name</strong> and clean <strong>10-digit Phone No</strong>!
            </p>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateSampleExcel}
            title="Download sample Excel with +91, 0, 91 and messy numbers"
          >
            <Download size={14} />
            <span>Download Sample Messy Excel</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="card upload-card">
        <div 
          className="dropzone-light"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files[0])}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
          />
          <div className="upload-icon-circle">
            <UploadCloud size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              {fileName ? fileName : 'Choose or Drag & Drop Excel Sheet Here (.xlsx, .xls, .csv)'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {fileSize ? `File size: ${fileSize} • Click to change file` : 'Works with any column order, custom column names, and large files up to 100,000+ rows'}
            </p>
          </div>
        </div>

        {/* Column Mapping Controls (when file loaded) */}
        {availableColumns.length > 0 && (
          <div className="mapping-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <Sliders size={16} style={{ color: '#4f46e5' }} />
              <span>Detected Columns Mapping:</span>
            </div>

            <div className="mapping-selectors">
              <div className="selector-group">
                <label className="selector-label">Name Column:</label>
                <select
                  className="form-select-light"
                  value={selectedNameCol}
                  onChange={(e) => handleNameColChange(e.target.value)}
                >
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div className="selector-group">
                <label className="selector-label">Phone / Mobile Column:</label>
                <select
                  className="form-select-light"
                  value={selectedPhoneCol}
                  onChange={(e) => handlePhoneColChange(e.target.value)}
                >
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={removeDuplicates}
                    onChange={handleDeduplicateToggle}
                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                  />
                  <span>Exclude Duplicate Numbers</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI / Metric Counters */}
      {processedData.length > 0 && (
        <div className="metrics-row">
          <div 
            className={`metric-pill ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            <span className="metric-num">{totalRowsCount}</span>
            <span className="metric-text">Total Input Rows</span>
          </div>

          <div 
            className={`metric-pill success ${filterMode === 'valid' ? 'active' : ''}`}
            onClick={() => setFilterMode('valid')}
          >
            <span className="metric-num">{validCount}</span>
            <span className="metric-text">✅ Clean 10-Digit Numbers</span>
          </div>

          <div 
            className={`metric-pill warning ${filterMode === 'duplicates' ? 'active' : ''}`}
            onClick={() => setFilterMode('duplicates')}
          >
            <span className="metric-num">{duplicateCount}</span>
            <span className="metric-text">⚠️ Duplicates</span>
          </div>

          <div 
            className={`metric-pill danger ${filterMode === 'invalid' ? 'active' : ''}`}
            onClick={() => setFilterMode('invalid')}
          >
            <span className="metric-num">{invalidCount}</span>
            <span className="metric-text">❌ Invalid (&lt;10 Digits / Blank)</span>
          </div>
        </div>
      )}

      {/* Main Results Table & Actions */}
      {processedData.length > 0 && (
        <div className="card table-card-light">
          <div className="table-top-actions">
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Cleaned Data Preview ({displayRows.length} {filterMode} records showing)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Output format: Strictly 2 columns <code>Name</code> and <code>Phone No</code> (10 digits)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadCleanExcel}
                disabled={validCount === 0}
                title="Download 2-column filtered Excel (Name, Phone No)"
              >
                <Download size={16} />
                <span>Download Filtered Excel ({validCount} Clean Leads)</span>
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleSaveToMongoDB}
                disabled={validCount === 0 || isSavingDb}
                title="Save these clean leads directly into your MongoDB Atlas database"
              >
                <Database size={15} />
                <span>{isSavingDb ? `Saving ${saveProgress}%...` : 'Save to MongoDB'}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="clean-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Output: Name</th>
                  <th>Output: Phone No (10-Digit)</th>
                  <th>Original in Excel</th>
                  <th>Validation Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.slice(0, 100).map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.name}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.92rem', color: row.isValid ? '#059669' : '#dc2626' }}>
                        {row.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Raw:</span> {row.originalPhone || '(blank)'}
                      </div>
                    </td>
                    <td>
                      {row.isValid && !row.isDuplicate && (
                        <span className="badge-light badge-success">
                          <CheckCircle2 size={12} /> 10-Digit Valid
                        </span>
                      )}
                      {row.isValid && row.isDuplicate && (
                        <span className="badge-light badge-warning">
                          <AlertTriangle size={12} /> Duplicate Number
                        </span>
                      )}
                      {!row.isValid && (
                        <span className="badge-light badge-danger">
                          <XCircle size={12} /> {row.reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayRows.length > 100 && (
            <div style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Showing first 100 preview rows. When you click <strong>Download Filtered Excel</strong>, all <strong>{validCount}</strong> records will be exported into your Excel sheet!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
