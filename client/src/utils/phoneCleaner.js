/**
 * Advanced Intelligent Phone & Name Extractor for Messy Excel Data.
 * Scans entire rows, detects shifted columns, extracts 10-digit mobile numbers
 * even when surrounded by text, prefixes (+91, 91, 0), dashes, slashes, or scientific notation.
 */

// 1. Extract all valid 10-digit phone numbers from any cell or string
export function extractPhonesFromValue(raw) {
  if (raw === undefined || raw === null) return [];

  let str = String(raw).trim();
  if (!str) return [];

  // Handle scientific notation e.g., 9.87654E+09 or 9.87654E+11
  if (/[eE]\+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = num.toLocaleString('fullwide', { useGrouping: false });
    }
  }

  // Handle decimal from Excel float storage like 9876543210.0
  str = str.replace(/\.0+$/, '');

  const results = [];

  // Pattern A: Look for 10-13 digit blocks with optional +91, 91, 0 and separators
  // Matches: +91 9876543210, +91-98765-43210, 09876543210, 919876543210, 9876543210
  const phonePatterns = [
    /(?:(?:\+?91[\s-]*)|\b0)?([6-9]\d{9})\b/g, // Standard Indian 10-digit starting with 6,7,8,9
    /(?:(?:\+?91[\s-]*)|\b0)?([6-9]\d{4}[\s-]?\d{5})\b/g, // 98765 43210 or 98765-43210
    /(?:(?:\+?91[\s-]*)|\b0)?([6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/g, // 987 654 3210
    /\b([6-9]\d{9})\b/g, // Exact 10 digits
    /\b(\d{10})\b/g, // Any 10 digits fallback
  ];

  // Try standard regex match
  for (const pattern of phonePatterns) {
    let match;
    while ((match = pattern.exec(str)) !== null) {
      const cleanDigits = match[1].replace(/\D/g, '');
      if (cleanDigits.length === 10 && !results.includes(cleanDigits)) {
        results.push(cleanDigits);
      }
    }
  }

  // Fallback: If no regex matched, try stripping all non-digits and inspect
  if (results.length === 0) {
    const allDigits = str.replace(/\D/g, '');

    // 12 digits starting with 91
    if (allDigits.length === 12 && allDigits.startsWith('91')) {
      results.push(allDigits.slice(2));
    }
    // 11 digits starting with 0
    else if (allDigits.length === 11 && allDigits.startsWith('0')) {
      results.push(allDigits.slice(1));
    }
    // Exact 10 digits
    else if (allDigits.length === 10) {
      results.push(allDigits);
    }
    // More than 10 digits: check if last 10 form a valid mobile starting with 6,7,8,9
    else if (allDigits.length > 10) {
      const last10 = allDigits.slice(-10);
      if (/^[6-9]\d{9}$/.test(last10)) {
        results.push(last10);
      }
    }
  }

  return results;
}

// 2. Validate single phone
export function cleanPhoneNumber(raw) {
  const extracted = extractPhonesFromValue(raw);
  if (extracted.length > 0) {
    return {
      phone: extracted[0],
      allPhones: extracted,
      isValid: true,
      original: String(raw || ''),
      reason: 'Valid 10-digit number',
    };
  }

  // Inspect why it failed
  const digitsOnly = String(raw || '').replace(/\D/g, '');
  if (!digitsOnly) {
    return { phone: '', isValid: false, original: String(raw || ''), reason: 'Blank cell / No digits' };
  }
  if (digitsOnly.length < 10) {
    return { phone: digitsOnly, isValid: false, original: String(raw || ''), reason: `Only ${digitsOnly.length} digits` };
  }
  return { phone: digitsOnly, isValid: false, original: String(raw || ''), reason: `Invalid format (${digitsOnly})` };
}

// 3. Name Cleaner & Validator
export function cleanName(raw) {
  if (raw === undefined || raw === null) return 'Customer';
  let str = String(raw).trim();

  // If string contains phone digits or junk, clean it
  str = str.replace(/(?:(?:\+?91[\s-]*)|\b0)?[6-9]\d{9}\b/g, ''); // Remove embedded phone
  str = str.replace(/[,;:/()_#-]+/g, ' ').trim();

  if (!str || str.length < 2) return 'Customer';

  // Capitalize properly
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// 4. Check if cell looks like a Person / Customer Name
export function isLikelyName(val) {
  if (!val) return false;
  const str = String(val).trim();
  if (str.length < 2 || str.length > 60) return false;

  // Not an email
  if (str.includes('@')) return false;

  // Not a URL
  if (/^https?:\/\//i.test(str) || /\.com|\.in|\.org/i.test(str)) return false;

  // Not a pure number or date
  if (/^\d+$/.test(str.replace(/[\s.,-]/g, ''))) return false;
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(str)) return false;

  // Must have at least 2 letters
  const letterCount = (str.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 2) return false;

  // Not a standard generic status keyword
  const blacklist = ['new', 'won', 'lost', 'qualified', 'proposal', 'true', 'false', 'active', 'inactive', 'yes', 'no'];
  if (blacklist.includes(str.toLowerCase())) return false;

  return true;
}

// 5. Intelligent Row Scanner: Finds Name and Phone anywhere in the row!
export function scanRowForContact(row, preferredNameCol, preferredPhoneCol) {
  let detectedPhone = '';
  let originalPhoneStr = '';
  let detectedName = '';
  let originalNameStr = '';

  // 1. Try preferred phone column first
  if (preferredPhoneCol && row[preferredPhoneCol] !== undefined) {
    const phones = extractPhonesFromValue(row[preferredPhoneCol]);
    if (phones.length > 0) {
      detectedPhone = phones[0];
      originalPhoneStr = String(row[preferredPhoneCol]);
    }
  }

  // 2. Try preferred name column first
  if (preferredNameCol && row[preferredNameCol] !== undefined) {
    const val = row[preferredNameCol];
    if (isLikelyName(val)) {
      detectedName = cleanName(val);
      originalNameStr = String(val);
    }
  }

  // 3. Fallback scan across all cells in the row if phone wasn't found in preferred column
  if (!detectedPhone) {
    for (const [key, val] of Object.entries(row)) {
      if (key === preferredNameCol) continue;
      const phones = extractPhonesFromValue(val);
      if (phones.length > 0) {
        detectedPhone = phones[0];
        originalPhoneStr = String(val);
        break;
      }
    }
  }

  // 4. Fallback scan across all cells in the row if name wasn't found in preferred column
  if (!detectedName) {
    for (const [key, val] of Object.entries(row)) {
      if (key === preferredPhoneCol) continue;
      // Skip the cell that provided the phone
      if (String(val) === originalPhoneStr) continue;

      if (isLikelyName(val)) {
        detectedName = cleanName(val);
        originalNameStr = String(val);
        break;
      }
    }
  }

  // If still no name, default to "Customer"
  if (!detectedName) {
    detectedName = 'Customer';
  }

  const isValid = Boolean(detectedPhone && detectedPhone.length === 10);

  return {
    name: detectedName,
    phone: detectedPhone,
    originalName: originalNameStr,
    originalPhone: originalPhoneStr,
    isValid,
    reason: isValid ? 'Valid 10-digit number' : 'No 10-digit phone found in row',
  };
}

// 6. Header Detector
export function autoDetectColumns(headers = [], sampleRows = []) {
  let detectedNameCol = '';
  let detectedPhoneCol = '';

  const nameKeywords = [
    'name',
    'customer name',
    'customer',
    'client name',
    'client',
    'full name',
    'contact person',
    'contact name',
    'person',
    'buyer name',
    'buyer',
    'naam',
    'cust name',
    'user',
    'cutoure',
  ];

  const phoneKeywords = [
    'phone',
    'phone no',
    'phoneno',
    'phone number',
    'mobile',
    'mobile no',
    'mobileno',
    'mobile number',
    'contact',
    'contact no',
    'contact number',
    'whatsapp',
    'whatsapp no',
    'cell',
    'cell no',
    'tel',
    'telephone',
    'mob',
  ];

  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Match by header keywords
  for (const h of headers) {
    const norm = normalize(h);
    if (!detectedNameCol && nameKeywords.some((k) => norm.includes(normalize(k)))) {
      detectedNameCol = h;
    }
    if (!detectedPhoneCol && phoneKeywords.some((k) => norm.includes(normalize(k)))) {
      detectedPhoneCol = h;
    }
  }

  // Sample data inspect if not found by keywords
  if (!detectedPhoneCol && sampleRows.length > 0) {
    let bestPhoneScore = -1;
    for (const h of headers) {
      let count = 0;
      sampleRows.forEach((r) => {
        const extracted = extractPhonesFromValue(r[h]);
        if (extracted.length > 0) count++;
      });
      if (count > bestPhoneScore && count > 0) {
        bestPhoneScore = count;
        detectedPhoneCol = h;
      }
    }
  }

  if (!detectedNameCol && sampleRows.length > 0) {
    let bestNameScore = -1;
    for (const h of headers) {
      if (h === detectedPhoneCol) continue;
      let count = 0;
      sampleRows.forEach((r) => {
        if (isLikelyName(r[h])) count++;
      });
      if (count > bestNameScore && count > 0) {
        bestNameScore = count;
        detectedNameCol = h;
      }
    }
  }

  return {
    nameCol: detectedNameCol || (headers[0] || ''),
    phoneCol: detectedPhoneCol || (headers[1] || headers[0] || ''),
  };
}
