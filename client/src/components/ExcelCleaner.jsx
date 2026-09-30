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
  UserCheck,
  CopyCheck,
  Info
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
  const [numberMode, setNumberMode] = useState('single');

  // Duplicate Check Basis: 'phone' (standard) | 'both' (name + phone) | 'name'
  const [duplicateBasis, setDuplicateBasis] = useState('phone');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Process rows using deep row scanner and exact row-matching duplicate tracker
  const processRows = (
    rows, 
    nameCol = selectedNameCol, 
    phoneCol = selectedPhoneCol, 
    deduplicate = removeDuplicates,
    mode = numberMode,
    basis = duplicateBasis
  ) => {
    if (!rows || rows.length === 0) {
      setProcessedData([]);
      return;
    }

    // Map key -> { firstRowNumber, firstName, firstPhone, count, duplicateRows: [] }
    const trackerMap = new Map();
    const result = [];
    let recordCounter = 1;

    rows.forEach((row, rowIndex) => {
      const currentExcelRowNumber = rowIndex + 2; // 1-based row in Excel (Row 1 is header)

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

      // 3. Emit records based on numberMode
      if (rowPhoneCandidates.length > 0) {
        const phonesToEmit = mode === 'all' ? rowPhoneCandidates : [rowPhoneCandidates[0]];

        phonesToEmit.forEach((phoneObj) => {
          // Generate unique key based on selected duplicate basis
          let trackKey = '';
          let basisDescription = '';

          if (basis === 'both') {
            trackKey = `${cleanPureName.toLowerCase()}_${phoneObj.phone}`;
            basisDescription = `Same Name ("${cleanPureName}") & Phone (${phoneObj.phone})`;
          } else if (basis === 'name') {
            trackKey = cleanPureName.toLowerCase();
            basisDescription = `Same Name ("${cleanPureName}")`;
          } else {
            // Default: 'phone'
            trackKey = phoneObj.phone;
            basisDescription = `Same Phone Number (${phoneObj.phone})`;
          }

          let isDuplicate = false;
          let duplicateOfRow = null;
          let duplicateOfName = '';

          if (trackerMap.has(trackKey)) {
            isDuplicate = true;
            const originalEntry = trackerMap.get(trackKey);
            duplicateOfRow = originalEntry.firstRowNumber;
            duplicateOfName = originalEntry.firstName;
            originalEntry.duplicateRows.push(currentExcelRowNumber);
          } else {
            trackerMap.set(trackKey, {
              firstRowNumber: currentExcelRowNumber,
              firstName: cleanPureName,
              firstPhone: phoneObj.phone,
              duplicateRows: [],
            });
          }

          result.push({
            id: recordCounter++,
            rowNumber: currentExcelRowNumber,
            name: cleanPureName,
            phone: phoneObj.phone,
            originalName: contact.originalName || row[nameCol] || '',
            originalPhone: phoneObj.rawVal,
            foundInColumn: phoneObj.fromKey,
            isValid: true,
            isDuplicate,
            duplicateOfRow,
            duplicateOfName,
            basisDescription,
            trackKey,
            reason: isDuplicate 
              ? `Duplicate of Row #${duplicateOfRow}` 
              : 'Valid 10-digit number',
          });
        });
      } else {
        // No valid 10-digit number found anywhere in this row
        result.push({
          id: recordCounter++,
          rowNumber: currentExcelRowNumber,
          name: cleanPureName,
          phone: '',
          originalName: contact.originalName || '',
          originalPhone: '(No phone in row)',
          foundInColumn: 'None',
          isValid: false,
          isDuplicate: false,
          duplicateOfRow: null,
          duplicateOfName: '',
          basisDescription: '',
          reason: 'No 10-digit phone found anywhere in row',
        });
      }
    });

    // Back-fill the first occurrence items with the row numbers that duplicated them
    result.forEach((item) => {
      if (!item.isDuplicate && item.trackKey && trackerMap.has(item.trackKey)) {
        item.repeatedInRows = trackerMap.get(item.trackKey).duplicateRows;
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

        processRows(
          json, 
          detected.nameCol || 'AUTO', 
          detected.phoneCol || 'AUTO', 
          removeDuplicates, 
          numberMode,
          duplicateBasis
        );

        notify(`Scanned ${json.length} rows! Duplicate row-tracking active.`, 'success');
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
    processRows(rawRows, newCol, selectedPhoneCol, removeDuplicates, numberMode, duplicateBasis);
  };

  const handlePhoneColChange = (newCol) => {
    setSelectedPhoneCol(newCol);
    processRows(rawRows, selectedNameCol, newCol, removeDuplicates, numberMode, duplicateBasis);
  };

  const handleDeduplicateToggle = () => {
    const newVal = !removeDuplicates;
    setRemoveDuplicates(newVal);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, newVal, numberMode, duplicateBasis);
  };

  const handleNumberModeChange = (newMode) => {
    setNumberMode(newMode);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, removeDuplicates, newMode, duplicateBasis);
    if (newMode === 'single') {
      notify('Single Number Mode: Exactly 1 phone number per row.', 'info');
    } else {
      notify('Multi-Number Mode: All numbers in row (Mother, Father, etc.) will be captured.', 'info');
    }
  };

  const handleDuplicateBasisChange = (newBasis) => {
    setDuplicateBasis(newBasis);
    processRows(rawRows, selectedNameCol, selectedPhoneCol, removeDuplicates, numberMode, newBasis);
    const labels = {
      phone: 'Phone Number Only',
      both: 'Both Same Name & Phone',
      name: 'Name Only'
    };
    notify(`Duplicate detection now checking: ${labels[newBasis]}`, 'info');
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

    const exportData = validNumbersList.map((item) => ({
      Name: item.name,
      'Phone No': item.phone,
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
              source: `Excel: ${fileName || 'Uploaded Sheet'} (Row ${item.rowNumber})`,
              status: 'New',
              notes: `Auto-cleaned 10-digit number. Excel Row #${item.rowNumber}`,
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

  // Generate Sample Messy Excel with Shuffled Columns & Duplicates
  const handleGenerateSampleExcel = () => {
    const sampleMessyData = [
      // Row 2 in Excel: First occurrence of Aarav Sharma (Phone: 9876543210)
      { 'Name CUTOURE': 'Aarav Sharma', City: 'Mumbai', 'Mother Contact': '+91 98765 43210', 'Father Contact': '9812345678' },
      
      // Row 3 in Excel: Priya Patel
      { 'Field A': '09811223344', City: 'Bengaluru', Age: 31, 'Contact Person': 'Priya Patel' },
      
      // Row 4 in Excel: Rahul Verma
      { Code: 'C103', 'Customer Name': 'Rahul Verma', Status: 'Active', City: 'Delhi', 'Phone No': '919822334455' },
      
      // Row 5 in Excel: Sneha Rao
      { 'Client Name': 'Sneha Rao', 'Primary Mobile': '98765-43210', City: 'Hyderabad' },
      
      // Row 6 in Excel: Vikram Mehta
      { ID: 105, Dept: 'Sales', 'Full Name': 'Vikram Mehta', 'Contact': '+91-9988776655', City: 'Pune' },
      
      // Row 7 in Excel: DUPLICATE OF ROW 2! (Same Phone: 9876543210)
      { 'Name CUTOURE': 'Aarav Sharma', City: 'Mumbai', 'Mother Contact': '9876543210' },
      
      // Row 8 in Excel: Ananya Deshmukh
      { 'Buyer': 'Ananya Deshmukh', City: 'Nagpur', 'Mobile': '9765432190' },
      
      // Row 9 in Excel: Invalid (<10 digits)
      { 'Contact': 'Short Number User', 'Phone': '987654' },
      
      // Row 10 in Excel: DUPLICATE OF ROW 3! (Same Phone: 9811223344)
      { 'Contact Person': 'Priya Patel (Repeat Entry)', City: 'Bengaluru', 'Phone': '9811223344' },
      
      // Row 11 in Excel: Karan Singhania
      { 'Customer': 'Karan Singhania', 'Contact No': 9833411223 },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleMessyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample with Duplicates');
    XLSX.writeFile(workbook, 'Sample_Excel_With_Duplicates.xlsx');
    notify('Downloaded Sample Excel! Row 7 is duplicate of Row 2, Row 10 is duplicate of Row 3.', 'info');
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
              Upload any Excel sheet. Duplicate detection accurately tracks <strong>which Excel row number matched with which earlier row</strong>.
            </p>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateSampleExcel}
            title="Download test Excel with duplicate rows in Row 2, Row 7, Row 10"
          >
            <Download size={14} />
            <span>Download Sample with Duplicates</span>
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

        {/* Configuration Bar */}
        {availableColumns.length > 0 && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* 1 Number vs All Numbers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PhoneCall size={16} style={{ color: '#4f46e5' }} />
                <span>Ek Row Me Multiple Numbers (Mother / Father Contact) Hone Par:</span>
              </div>

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
                    gap: '0.65rem'
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
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: numberMode === 'single' ? '#4f46e5' : 'var(--text-main)' }}>
                      ✅ 1 Number Per Row (Recommended)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ek row se sirf 1 primary number aayega. Row kabhi duplicate nahi hogi.
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
                    gap: '0.65rem'
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
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: numberMode === 'all' ? '#4f46e5' : 'var(--text-main)' }}>
                      📋 Extract Both Numbers
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Mother aur Father dono ka number alag-alag capture hoga.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* DUPLICATE DETECTION BASIS SELECTOR */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CopyCheck size={16} style={{ color: '#d97706' }} />
                  <span>Duplicate Check Kis Base Par Karein?</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={removeDuplicates}
                    onChange={handleDeduplicateToggle}
                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                  />
                  <span>Exclude Duplicates from Download</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="duplicateBasis"
                    value="phone"
                    checked={duplicateBasis === 'phone'}
                    onChange={() => handleDuplicateBasisChange('phone')}
                  />
                  <span style={{ fontWeight: duplicateBasis === 'phone' ? 700 : 500 }}>
                    📱 Phone Number Base (Recommended - Same phone = Duplicate)
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="duplicateBasis"
                    value="both"
                    checked={duplicateBasis === 'both'}
                    onChange={() => handleDuplicateBasisChange('both')}
                  />
                  <span style={{ fontWeight: duplicateBasis === 'both' ? 700 : 500 }}>
                    👤+📱 Both Same Name AND Phone
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="duplicateBasis"
                    value="name"
                    checked={duplicateBasis === 'name'}
                    onChange={() => handleDuplicateBasisChange('name')}
                  />
                  <span style={{ fontWeight: duplicateBasis === 'name' ? 700 : 500 }}>
                    👤 Name Base Only
                  </span>
                </label>
              </div>
            </div>

            {/* Target Column Mapping */}
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
            title="Show all rows from Excel"
          >
            <span className="metric-num">{totalRowsCount}</span>
            <span className="metric-text">Total Input Rows</span>
          </div>

          <div 
            className={`metric-pill success ${filterMode === 'valid' ? 'active' : ''}`}
            onClick={() => setFilterMode('valid')}
            title="Show only valid clean 10-digit leads (ready for download)"
          >
            <span className="metric-num">{validCount}</span>
            <span className="metric-text">✅ Clean 10-Digit (Ready)</span>
          </div>

          <div 
            className={`metric-pill warning ${filterMode === 'duplicates' ? 'active' : ''}`}
            onClick={() => setFilterMode('duplicates')}
            title="Click to inspect all duplicate rows and which rows they matched with!"
          >
            <span className="metric-num">{duplicateCount}</span>
            <span className="metric-text">⚠️ Duplicates (Click to View)</span>
          </div>

          <div 
            className={`metric-pill danger ${filterMode === 'invalid' ? 'active' : ''}`}
            onClick={() => setFilterMode('invalid')}
            title="Show invalid or missing numbers"
          >
            <span className="metric-num">{invalidCount}</span>
            <span className="metric-text">❌ Invalid (&lt;10 Digits / Blank)</span>
          </div>
        </div>
      )}

      {/* Info Banner when viewing Duplicates */}
      {processedData.length > 0 && filterMode === 'duplicates' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#92400e', fontSize: '0.84rem' }}>
          <Info size={18} style={{ color: '#d97706', flexShrink: 0 }} />
          <div>
            <strong>Duplicates Inspector Active:</strong> Neeche di gayi table me saaf-saaf dikhega ki <strong>kaun sa row number</strong> pehle kis <strong>row number</strong> me aa chuka tha (Basis: {duplicateBasis === 'phone' ? 'Phone Number' : duplicateBasis === 'both' ? 'Name & Phone' : 'Name'}).
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
                  <th style={{ width: '85px' }}>Excel Row #</th>
                  <th>Output: Name</th>
                  <th>Output: Phone No (10-Digit)</th>
                  <th>Found In Column</th>
                  <th>Duplicate Match Details</th>
                  <th>Validation Status</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.slice(0, 100).map((row) => (
                  <tr key={row.id} style={{ background: row.isDuplicate ? '#fffdf5' : 'inherit' }}>
                    {/* Excel Row Number */}
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        Row #{row.rowNumber}
                      </span>
                    </td>

                    {/* Clean Name */}
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.name}</div>
                    </td>

                    {/* Clean Phone */}
                    <td>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.92rem', color: row.isValid ? '#059669' : '#dc2626' }}>
                        {row.phone || '—'}
                      </div>
                    </td>

                    {/* Column Source */}
                    <td>
                      <span style={{ fontSize: '0.74rem', background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {row.foundInColumn}
                      </span>
                    </td>

                    {/* EXACT MATCH DETAILS (Shows which row number it duplicated!) */}
                    <td>
                      {row.isDuplicate && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#b45309' }}>
                            ⚠️ Duplicate of Excel Row #{row.duplicateOfRow}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            First seen on Row #{row.duplicateOfRow} ({row.duplicateOfName})
                          </span>
                        </div>
                      )}

                      {!row.isDuplicate && row.repeatedInRows && row.repeatedInRows.length > 0 && (
                        <div style={{ fontSize: '0.74rem', color: '#0369a1' }}>
                          <strong>⭐ First Occurrence:</strong> Also repeated in Row {row.repeatedInRows.map((r) => `#${r}`).join(', ')}
                        </div>
                      )}

                      {!row.isDuplicate && (!row.repeatedInRows || row.repeatedInRows.length === 0) && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Unique (No duplicate found)
                        </span>
                      )}
                    </td>

                    {/* Validation Status */}
                    <td>
                      {row.isValid && !row.isDuplicate && (
                        <span className="badge-light badge-success">
                          <CheckCircle2 size={12} /> 10-Digit Valid
                        </span>
                      )}
                      {row.isValid && row.isDuplicate && (
                        <span className="badge-light badge-warning">
                          <AlertTriangle size={12} /> Duplicate
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
