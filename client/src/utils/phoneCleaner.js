/**
 * Utility for parsing and sanitizing phone numbers and names from Excel rows.
 */

export function cleanPhoneNumber(raw) {
  if (raw === undefined || raw === null) {
    return { phone: '', isValid: false, reason: 'Empty phone number' };
  }

  let str = String(raw).trim();

  // Handle scientific notation e.g., 9.87654E+11 from Excel numeric columns
  if (/[eE]\+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) {
      str = num.toLocaleString('fullwide', { useGrouping: false });
    }
  }

  // Remove all non-numeric characters (spaces, dashes, parentheses, +, etc.)
  let digits = str.replace(/\D/g, '');

  if (!digits) {
    return { phone: '', isValid: false, reason: 'No digits found' };
  }

  // 1. If 12 digits starting with '91' (e.g., 919876543210 -> 9876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }

  // 2. If 11 digits starting with '0' (e.g., 09876543210 -> 9876543210)
  else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // 3. If longer than 10 digits, check if the last 10 digits form a standard Indian mobile number
  else if (digits.length > 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      digits = last10;
    }
  }

  // Check if we have an exact 10-digit number
  const is10Digits = digits.length === 10;
  const isStandardMobile = /^[6-9]\d{9}$/.test(digits); // Standard Indian mobile check

  if (is10Digits) {
    return {
      phone: digits,
      isValid: true,
      isStandardMobile,
      original: str,
      reason: 'Valid 10-digit number',
    };
  }

  return {
    phone: digits,
    isValid: false,
    isStandardMobile: false,
    original: str,
    reason: digits.length < 10 ? `Only ${digits.length} digits (less than 10)` : `Too long (${digits.length} digits)`,
  };
}

export function cleanName(raw) {
  if (raw === undefined || raw === null) return 'Customer';
  let str = String(raw).trim();
  if (!str) return 'Customer';

  // Capitalize each word nicely: "aarav sharma" -> "Aarav Sharma"
  str = str
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return str;
}

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
  ];

  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Try matching by header name
  for (const h of headers) {
    const norm = normalize(h);
    if (!detectedNameCol && nameKeywords.some((k) => norm.includes(normalize(k)))) {
      detectedNameCol = h;
    }
    if (!detectedPhoneCol && phoneKeywords.some((k) => norm.includes(normalize(k)))) {
      detectedPhoneCol = h;
    }
  }

  // 2. If phone not found by header, inspect sample data
  if (!detectedPhoneCol && sampleRows.length > 0) {
    let bestPhoneScore = -1;
    for (const h of headers) {
      let numericCount = 0;
      sampleRows.forEach((row) => {
        const val = String(row[h] || '').replace(/\D/g, '');
        if (val.length >= 10 && val.length <= 13) {
          numericCount++;
        }
      });
      if (numericCount > bestPhoneScore && numericCount > 0) {
        bestPhoneScore = numericCount;
        detectedPhoneCol = h;
      }
    }
  }

  // Fallbacks if still not detected
  if (!detectedNameCol && headers.length > 0) {
    detectedNameCol = headers[0];
  }
  if (!detectedPhoneCol && headers.length > 1) {
    detectedPhoneCol = headers.find((h) => h !== detectedNameCol) || headers[1];
  }

  return {
    nameCol: detectedNameCol || '',
    phoneCol: detectedPhoneCol || '',
  };
}
