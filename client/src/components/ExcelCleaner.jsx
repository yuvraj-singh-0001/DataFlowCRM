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
  Sparkles,
  SearchCheck,
  PhoneCall,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  scanRowForContact, 
  extractPhonesFromValue, 
  cleanName, 
  autoDetectColumns 
} from '../utils/phoneCleaner';
import { createLead } from '../services/api';

export default function ExcelCleaner({ notify, onRefreshDb }) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedNameCol, setSelectedNameCol] = useState('AUTO');
  const [selectedPhoneCol, setSelectedPhoneCol] = useState('AUTO');
  const [rawRows, setRawRows] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [filterMode, setFilterMode] = useState('valid'); // 'all' | 'valid' | 'invalid' | 'duplicates'
  const [removeDuplicates, setRemoveDuplicates] = useState(true);

  // Number selection mode: 'single' (1 number per row) or 'all' (capture both mother & father)
  // Default is 'single' as requested: exactly 1 phone number per row!
  const [numberMode, setNumberMode] = useState('single'); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Process rows using deep row scanner
  const processRows = (
    rows, 
    nameCol = selectedNameCol, 
    phoneCol = selectedPhoneCol, 
    deduplicate = removeDuplicates,
    mode = numberMode
  ) => {
    if (!rows || rows.length === 0) {
      setProcessedData([]);
      return;
    }

    const seenPhones = new Set();
    const result = [];
    let recordCounter = 1;

    rows.forEach((row, rowIndex) => {
      // 1. Collect all unique phone numbers in this row
      const rowPhoneCandidates = [];

      for (const [key, val] of Object.entries(row)) {
        const phonesInCell = extractPhonesFromValue(val);
        phonesInCell.forEach((p) => {
          if (!rowPhoneCandidates.some((c) => c.phone === p)) {
            rowPhoneCandidates.push({ phone: p, fromKey: key, rawVal: String(val) });
          }
        });
      }

      // If a specific target phone column is selected, prioritize it
      if (phoneCol !== 'AUTO' && row[phoneCol] !== undefined) {
        const preferredPhones = extractPhonesFromValue(row[phoneCol]);
        if (preferredPhones.length > 0) {
          const matchIdx = rowPhoneCandidates.findIndex((c) => c.phone === preferredPhones[0]);
          if (matchIdx > -1) {
            const [matched] = rowPhoneCandidates.splice(matchIdx, 1);
            rowPhoneCandidates.unshift(matched);
          }
        }
      }

      // 2. Determine Clean Pure Name for this row (NO extra brackets or Alt suffixes)
      const contact = scanRowForContact(
        row, 
        nameCol === 'AUTO' ? '' : nameCol, 
        phoneCol === 'AUTO' ? '' : phoneCol
      );
      const cleanPureName = contact.name || 'Customer';

      // 3. Emit records based on numberMode:
      // If 'single' -> take ONLY the 1st primary number (1 row per contact)
      // If 'all' -> take all numbers found in row
      if (rowPhoneCandidates.length > 0) {
        const phonesToEmit = mode === 'all' ? rowPhoneCandidates : [rowPhoneCandidates[0]];

        phonesToEmit.forEach((phoneObj) => {
          const isDuplicate = seenPhones.has(phoneObj.phone);
          if (!isDuplicate) {
            seenPhones.add(phoneObj.phone);
          }

          result.push({
            id: recordCounter++,
            rowNumber: rowIndex + 2,
            name: cleanPureName, // Strictly clean name, NO (Alt 1) or extra suffixes
            phone: phoneObj.phone,
            originalName: contact.originalName || row[nameCol] || '',
            originalPhone: phoneObj.rawVal,
            foundInColumn: phoneObj.fromKey,
            isValid: true,
            isDuplicate,
            reason: 'Valid 10-digit number',
          });
        });
      } else {
        // No valid 10-digit number found anywhere in this row
        result.push({
          id: recordCounter++,
          rowNumber: rowIndex + 2,
          name: cleanPureName,
          phone: '',
          originalName: contact.originalName || '',
          originalPhone: '(No phone in row)',
          foundInColumn: 'None',
          isValid: false,
          isDuplicate: false,
          reason: 'No 10-digit phone found anywhere in row',
        });
      }
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

        const headers = Object.keys(json[0]);
        setAvailableColumns(headers);
        setRawRows(json);

        // Auto-detect columns
        const detected = autoDetectColumns(headers, json.slice(0, 15));
        setSelectedNameCol(detected.nameCol || 'AUTO');
        setSelectedPhoneCol(detected.phoneCol || 'AUTO');

        // Process data with current mode (Default: 'single' -> 1 number per row)
        processRows(
          json, 
          detected.nameCol || 'AUTO', 
          detected.phoneCol || 'AUTO', 
          removeDuplicates, 
          numberMode
        );

        notify(`Scanned ${json.length} rows! 1 Number per row active.`, 'success');
      } catch (err) {
        console.error('Error reading Excel:', err);
        notify(`Failed to read file: ${err.message}`, 'error');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Re-process when options change
  const handleNameColChange = (newCol) => {
    setSelectedNameCol(newCol);
    processRows(rawRows, newCol, selectedPhoneCol, removeDuplicates, numberMode);
  };

  const handlePhoneColChange = (newCol) => {
    setSelectedPhoneCol(newCol);
    processRows(rawRows, selectedNameCol, newCol, removeDuplicates, numberMode);
  };

  const handleDeduplicateToggle = () => {
    const newVal = !removeDuplicates;
    setRemoveDuplicates(newVal);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, newVal, numberMode);
  };

  const handleNumberModeChange = (newMode) => {
    setNumberMode(newMode);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, removeDuplicates, newMode);
    if (newMode === 'single') {
      notify('Single Number Mode: Exactly 1 phone number per row will be exported.', 'info');
    } else {
      notify('Multi-Number Mode: All numbers in the row (Mother, Father, etc.) will be exported.', 'info');
    }
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

  // Download Cleaned Excel with strictly 2 columns: Name, Phone No
  const handleDownloadCleanExcel = () => {
    if (validNumbersList.length === 0) {
      notify('No valid 10-digit phone records available to export', 'error');
      return;
    }

    // Format strictly as Name and Phone No (10 digits)
    const exportData = validNumbersList.map((item) => ({
      Name: item.name,        // Pure Clean Name (No suffixes)
      'Phone No': item.phone, // Strictly 10 digits
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    worksheet['!cols'] = [
      { wch: 26 }, // Name
      { wch: 18 }, // Phone No
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cleaned Contacts');

    const cleanBaseName = fileName.replace(/\.[^/.]+$/, '');
    const finalFileName = `${cleanBaseName || 'DataFlow'}_10Digit_Filtered.xlsx`;

    XLSX.writeFile(workbook, finalFileName);
    notify(`Downloaded ${exportData.length} clean leads with strictly Name & Phone No!`, 'success');
  };

  // Save cleaned records into MongoDB Atlas database
  const handleSaveToMongoDB = async () => {
    if (validNumbersList.length === 0) {
      notify('No valid records to save into MongoDB', 'error');
      return;
    }

    try {
      setIsSavingDb(true);
      setSaveProgress(0);

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
              notes: `Auto-cleaned 10-digit number. Found in column: ${item.foundInColumn}`,
            })
          )
        );
        inserted += batch.length;
        setSaveProgress(Math.round((inserted / total) * 100));
      }

      notify(`Saved ${inserted} cleaned leads directly into MongoDB Atlas database!`, 'success');
      if (onRefreshDb) onRefreshDb();
    } catch (err) {
      console.error('Save to MongoDB error:', err);
      notify(`Database save failed: ${err.message}`, 'error');
    } finally {
      setIsSavingDb(false);
      setSaveProgress(0);
    }
  };

  // Generate Sample Messy Excel with Shuffled Columns and clean names
  const handleGenerateSampleExcel = () => {
    const sampleMessyData = [
      { 'Name CUTOURE': 'Aarav Sharma', City: 'Mumbai', 'Mother Contact': '+91 98765 43210', 'Father Contact': '9812345678' },
      { 'Field A': '09811223344', City: 'Bengaluru', Age: 31, 'Contact Person': 'Priya Patel' },
      { Code: 'C103', 'Customer Name': 'Rahul Verma', Status: 'Active', City: 'Delhi', 'Phone No': '919822334455' },
      { 'Client Name': 'Sneha Rao', 'Primary Mobile': '98765-43210', City: 'Hyderabad' },
      { ID: 105, Dept: 'Sales', 'Full Name': 'Vikram Mehta', 'Contact': '+91-9988776655', City: 'Pune' },
      { 'Name CUTOURE': 'Aarav Sharma', City: 'Mumbai', 'Mother Contact': '9876543210' }, // Duplicate check
      { 'Buyer': 'Ananya Deshmukh', City: 'Nagpur', 'Mobile': '9765432190' },
      { 'Contact': 'Short Number User', 'Phone': '987654' }, // Invalid (<10 digits)
      { 'Customer': 'Karan Singhania', 'Contact No': 9833411223 },
      { 'Customer': 'Blank Number User', 'Contact No': '' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleMessyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Messy Sample');
    XLSX.writeFile(workbook, 'Sample_Messy_Shuffled_Excel.xlsx');
    notify('Downloaded Sample Excel with Mother & Father contact columns for testing!', 'info');
  };

  return (
    <div className="cleaner-container">
      {/* Top Header Card */}
      <div className="page-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">
              <Sparkles size={24} style={{ color: '#4f46e5' }} />
              <span>Smart Excel Filter & 10-Digit Phone Cleaner</span>
            </h1>
            <p className="page-description">
              Upload any messy Excel sheet. Output Excel me hamesha strictly <strong>Name</strong> aur <strong>Phone No</strong> (10 digits) aayega.
            </p>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateSampleExcel}
            title="Download test Excel with Mother and Father contacts"
          >
            <Download size={14} />
            <span>Download Sample Excel</span>
          </button>
        </div>
      </div>

      {/* Upload Dropzone */}
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

        {/* PROMINENT Number Mode Selection (1 Number vs All Numbers) */}
        {availableColumns.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PhoneCall size={16} style={{ color: '#4f46e5' }} />
                <span>Agar Ek Row Me 2 Number Ho (Jaise Mother & Father Contact) Toh Kya Karein?</span>
              </div>
            </div>

            {/* Clear Radio Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
              <div 
                onClick={() => handleNumberModeChange('single')}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${numberMode === 'single' ? '#4f46e5' : 'var(--border)'}`,
                  background: numberMode === 'single' ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="numberMode"
                  checked={numberMode === 'single'}
                  onChange={() => handleNumberModeChange('single')}
                  style={{ marginTop: '0.2rem', cursor: 'pointer', transform: 'scale(1.15)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: numberMode === 'single' ? '#4f46e5' : 'var(--text-main)' }}>
                    ✅ 1 Number Per Row (Recommended)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Ek person ka sirf 1 primary number aayega. Row kabhi duplicate nahi hogi.
                  </div>
                </div>
              </div>

              <div 
                onClick={() => handleNumberModeChange('all')}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${numberMode === 'all' ? '#4f46e5' : 'var(--border)'}`,
                  background: numberMode === 'all' ? '#eef2ff' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="numberMode"
                  checked={numberMode === 'all'}
                  onChange={() => handleNumberModeChange('all')}
                  style={{ marginTop: '0.2rem', cursor: 'pointer', transform: 'scale(1.15)' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: numberMode === 'all' ? '#4f46e5' : 'var(--text-main)' }}>
                    📋 Extract Both Numbers
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Agar Mother aur Father dono ka number alag hai, toh dono capture honge.
                  </div>
                </div>
              </div>
            </div>

            {/* Column Target Selectors */}
            <div className="mapping-selectors" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
              <div className="selector-group">
                <label className="selector-label">Target Name Column:</label>
                <select
                  className="form-select-light"
                  value={selectedNameCol}
                  onChange={(e) => handleNameColChange(e.target.value)}
                >
                  <option value="AUTO">⚡ Auto-Detect in Row</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="selector-group">
                <label className="selector-label">Target Phone Column:</label>
                <select
                  className="form-select-light"
                  value={selectedPhoneCol}
                  onChange={(e) => handlePhoneColChange(e.target.value)}
                >
                  <option value="AUTO">⚡ Auto-Detect in Row</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>{col}</option>
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
                  <span>Remove Duplicates</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Counters */}
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
            <span className="metric-text">❌ Invalid / No Number</span>
          </div>
        </div>
      )}

      {/* Preview Table & Download Actions */}
      {processedData.length > 0 && (
        <div className="card table-card-light">
          <div className="table-top-actions">
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Cleaned Data Preview ({displayRows.length} {filterMode} records showing)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Output Excel Format: Strictly 2 columns <code>Name</code> and <code>Phone No</code> (clean pure name, no extra suffixes)
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
                <span>Download Filtered Excel ({validCount} Leads)</span>
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
                  <th style={{ width: '50px' }}>#</th>
                  <th>Output: Name</th>
                  <th>Output: Phone No (10-Digit)</th>
                  <th>Found In Column</th>
                  <th>Original Value</th>
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
                      <span style={{ fontSize: '0.74rem', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {row.foundInColumn}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {row.originalPhone}
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
              Showing first 100 preview rows. When you click <strong>Download Filtered Excel</strong>, all <strong>{validCount}</strong> records will be exported!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
