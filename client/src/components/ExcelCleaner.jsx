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
  Layers
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
  const [captureMultipleNumbers, setCaptureMultipleNumbers] = useState(true);
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
    includeAllNumbers = captureMultipleNumbers
  ) => {
    if (!rows || rows.length === 0) {
      setProcessedData([]);
      return;
    }

    const seenPhones = new Set();
    const result = [];
    let recordCounter = 1;

    rows.forEach((row, rowIndex) => {
      // 1. If captureMultipleNumbers is enabled, collect all unique numbers in the entire row
      const rowPhoneCandidates = [];

      // Check all cells in the row for phone numbers
      for (const [key, val] of Object.entries(row)) {
        const phonesInCell = extractPhonesFromValue(val);
        phonesInCell.forEach((p) => {
          if (!rowPhoneCandidates.includes(p)) {
            rowPhoneCandidates.push({ phone: p, fromKey: key, rawVal: String(val) });
          }
        });
      }

      // If specific column was picked and has a valid phone, prioritize it first
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

      // 2. Determine Name for this row
      const contact = scanRowForContact(
        row, 
        nameCol === 'AUTO' ? '' : nameCol, 
        phoneCol === 'AUTO' ? '' : phoneCol
      );

      // If row has valid phone numbers found anywhere
      if (rowPhoneCandidates.length > 0) {
        // If user wants to capture all numbers found in row
        const phonesToEmit = includeAllNumbers ? rowPhoneCandidates : [rowPhoneCandidates[0]];

        phonesToEmit.forEach((phoneObj, subIdx) => {
          const isDuplicate = seenPhones.has(phoneObj.phone);
          if (!isDuplicate) {
            seenPhones.add(phoneObj.phone);
          }

          const suffix = phonesToEmit.length > 1 && subIdx > 0 ? ` (Alt ${subIdx})` : '';

          result.push({
            id: recordCounter++,
            rowNumber: rowIndex + 2,
            name: `${contact.name}${suffix}`,
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
        // No valid phone found in any cell of this row
        result.push({
          id: recordCounter++,
          rowNumber: rowIndex + 2,
          name: contact.name,
          phone: '',
          originalName: contact.originalName || '',
          originalPhone: contact.originalPhone || '(No number in row)',
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

        // Run deep row-level extraction
        processRows(
          json, 
          detected.nameCol || 'AUTO', 
          detected.phoneCol || 'AUTO', 
          removeDuplicates, 
          captureMultipleNumbers
        );

        notify(`Scanned ${json.length} rows across all columns! Ready to export.`, 'success');
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
    processRows(rawRows, newCol, selectedPhoneCol, removeDuplicates, captureMultipleNumbers);
  };

  const handlePhoneColChange = (newCol) => {
    setSelectedPhoneCol(newCol);
    processRows(rawRows, selectedNameCol, newCol, removeDuplicates, captureMultipleNumbers);
  };

  const handleDeduplicateToggle = () => {
    const newVal = !removeDuplicates;
    setRemoveDuplicates(newVal);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, newVal, captureMultipleNumbers);
  };

  const handleCaptureMultipleToggle = () => {
    const newVal = !captureMultipleNumbers;
    setCaptureMultipleNumbers(newVal);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, removeDuplicates, newVal);
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
      Name: item.name,
      'Phone No': item.phone, // Exactly 10 digits
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

      notify(`Saved ${inserted} cleaned leads directly into MongoDB Atlas!`, 'success');
      if (onRefreshDb) onRefreshDb();
    } catch (err) {
      console.error('Save to MongoDB error:', err);
      notify(`Database save failed: ${err.message}`, 'error');
    } finally {
      setIsSavingDb(false);
      setSaveProgress(0);
    }
  };

  // Generate Sample Messy Excel with Shuffled Columns and Different Header Names
  const handleGenerateSampleExcel = () => {
    const sampleMessyData = [
      // Row 1: Name in 1st col, Mobile in 3rd col with +91
      { 'Name CUTOURE': 'Aarav Sharma', City: 'Mumbai', 'Mobile Number': '+91 98765 43210', Notes: 'VIP Client' },
      
      // Row 2: Phone in 1st col, Name in 4th col with 0 prefix
      { 'Field A': '09812345678', City: 'Bengaluru', Age: 31, 'Contact Person': 'Priya Patel' },
      
      // Row 3: Name in 2nd col, Phone in 5th col with 91 prefix
      { Code: 'C103', 'Customer Name': 'Rahul Verma', Status: 'Active', City: 'Delhi', 'Phone No': '919822334455' },
      
      // Row 4: Multiple numbers in single cell (9876543210 / 9811223344)
      { 'Client Name': 'Sneha Rao', 'Primary & Alt Mobile': '9876543210 / 9811223344', City: 'Hyderabad' },
      
      // Row 5: Name and Phone in the middle with dashes
      { ID: 105, Dept: 'Sales', 'Full Name': 'Vikram Mehta', 'Contact': '+91-9988776655', City: 'Pune' },
      
      // Row 6: Duplicate phone check
      { 'Name CUTOURE': 'Aarav Sharma (Duplicate Check)', City: 'Mumbai', 'Mobile Number': '9876543210' },
      
      // Row 7: Clean 10-digit number
      { 'Buyer': 'Ananya Deshmukh', City: 'Nagpur', 'Mobile': '9765432190' },
      
      // Row 8: Invalid number (<10 digits)
      { 'Contact': 'Short Number User', 'Phone': '987654' },
      
      // Row 9: Scientific notation / Excel float number
      { 'Customer': 'Karan Singhania', 'Contact No': 9833411223 },
      
      // Row 10: Blank number
      { 'Customer': 'No Number User', 'Contact No': '' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleMessyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Messy Shuffled Columns');
    XLSX.writeFile(workbook, 'Sample_Messy_Shuffled_Excel.xlsx');
    notify('Downloaded Sample Excel with shuffled columns, +91, 0, and multi-numbers!', 'info');
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
              Upload any messy Excel sheet. Name and Phone can be at the <strong>beginning</strong>, in the <strong>middle</strong>, or <strong>end</strong> of the row. It auto-scans every cell, strips <code>+91</code>, <code>91</code>, <code>0</code>, and exports strictly <strong>Name</strong> and <strong>10-digit Phone No</strong>!
            </p>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateSampleExcel}
            title="Download test Excel with shuffled columns (+91, 0, 91, and multi-numbers)"
          >
            <Download size={14} />
            <span>Download Test Excel (Shuffled Columns)</span>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                <SearchCheck size={18} style={{ color: '#4f46e5' }} />
                <span>Deep Row Scanner Active (Auto-finds Name & Phone anywhere in each row)</span>
              </div>
            </div>

            <div className="mapping-selectors">
              <div className="selector-group">
                <label className="selector-label">Target Name Column:</label>
                <select
                  className="form-select-light"
                  value={selectedNameCol}
                  onChange={(e) => handleNameColChange(e.target.value)}
                >
                  <option value="AUTO">⚡ Auto-Detect in Row (Recommended)</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
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
                  <option value="AUTO">⚡ Auto-Detect in Row (Recommended)</option>
                  {availableColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={removeDuplicates}
                    onChange={handleDeduplicateToggle}
                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                  />
                  <span>Remove Duplicates</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={captureMultipleNumbers}
                    onChange={handleCaptureMultipleToggle}
                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                  />
                  <span>Capture All Numbers in Row</span>
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
            <span className="metric-text">❌ Invalid / No Number</span>
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
              Showing first 100 preview rows. When you click <strong>Download Filtered Excel</strong>, all <strong>{validCount}</strong> records will be exported into your Excel sheet!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
