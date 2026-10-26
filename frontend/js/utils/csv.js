/**
 * DataForge — CSV Utilities
 * Parsing, type inference, and CSV generation
 */

/**
 * Parse a CSV string into structured data.
 * Handles quoted fields, newlines within quotes, and different delimiters.
 */
export function parseCSV(text, options = {}) {
  const { delimiter = null, hasHeader = true } = options;

  // Strip BOM (Byte Order Mark) from UTF-8 files
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  // Normalize line endings to \n
  cleanText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Auto-detect delimiter if not provided
  const detectedDelimiter = delimiter || detectDelimiter(cleanText);
  const lines = splitCSVLines(cleanText);

  if (lines.length === 0) {
    return { success: false, error: { code: 'EMPTY_CSV', message: 'The CSV file is empty.' } };
  }

  const parsedRows = lines.map(line => parseLine(line, detectedDelimiter));

  if (parsedRows.length === 0) {
    return { success: false, error: { code: 'NO_DATA', message: 'No data rows found in the CSV.' } };
  }

  const headers = hasHeader
    ? parsedRows[0].map((h, i) => h.trim() || `Column_${i + 1}`)
    : parsedRows[0].map((_, i) => `Column_${i + 1}`);

  const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;

  // Filter out empty rows
  const filteredRows = dataRows.filter(row => row.some(cell => cell.trim() !== ''));

  if (filteredRows.length === 0) {
    return { success: false, error: { code: 'NO_DATA_ROWS', message: 'CSV contains headers but no data rows.' } };
  }

  // Normalize row lengths to match header count
  const columnCount = headers.length;
  const normalizedRows = filteredRows.map(row => {
    if (row.length < columnCount) {
      return [...row, ...new Array(columnCount - row.length).fill('')];
    }
    return row.slice(0, columnCount);
  });

  // Helper to clean numeric string representations like $1,234.50 or 45%
  const cleanNumericCandidate = (str) => {
    if (typeof str === 'number') return isNaN(str) ? null : str;
    if (typeof str !== 'string') return null;
    const s = str.trim();
    if (s === '') return null;
    // Detect null/nan/na/missing/none variants
    const lower = s.toLowerCase();
    if (lower === 'nan' || lower === 'null' || lower === 'na' || lower === 'n/a' ||
        lower === 'none' || lower === 'missing' || lower === '-' || lower === '?') return null;
    // Strip currency symbols, commas, spaces, leading/trailing whitespace
    const stripped = s
      .replace(/^[\$€£₹¥₩₫]\s*/g, '')
      .replace(/\s*%$/, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .trim();
    if (stripped === '' || stripped === '-') return null;
    // Handle parenthesized negatives: (123.45) → -123.45
    const parenMatch = stripped.match(/^\(([\d.]+)\)$/);
    if (parenMatch) {
      const num = Number(parenMatch[1]);
      return isNaN(num) ? null : -num;
    }
    const num = Number(stripped);
    return isNaN(num) ? null : num;
  };

  // Infer column types
  const columnTypes = inferColumnTypes(normalizedRows, headers);

  // Convert numeric values
  const typedRows = normalizedRows.map(row =>
    row.map((cell, colIdx) => {
      if (columnTypes[colIdx] === 'numeric') {
        const cleaned = cleanNumericCandidate(cell);
        return cleaned !== null ? cleaned : null;
      }
      return typeof cell === 'string' ? cell.trim() : cell;
    })
  );

  return {
    success: true,
    data: {
      headers,
      rows: typedRows,
      columnTypes,
      rowCount: typedRows.length,
      columnCount: headers.length,
      delimiter: detectedDelimiter,
    },
  };
}

/**
 * Detect the most likely delimiter in a CSV string.
 */
function detectDelimiter(text) {
  const candidates = [',', ';', '\t', '|'];
  const firstLines = text.split('\n').slice(0, 5).join('\n');

  let bestDelimiter = ',';
  let bestScore = 0;

  for (const d of candidates) {
    const counts = firstLines.split('\n').map(line => {
      // Count occurrences outside quotes
      let count = 0;
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === d && !inQuotes) count++;
      }
      return count;
    });

    // Good delimiter: consistent count across lines, count > 0
    const nonZero = counts.filter(c => c > 0);
    if (nonZero.length === 0) continue;

    const consistent = new Set(nonZero).size === 1;
    const avgCount = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const score = consistent ? avgCount * 2 : avgCount;

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = d;
    }
  }

  return bestDelimiter;
}

/**
 * Split CSV text into lines, respecting quoted fields with newlines.
 */
function splitCSVLines(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // Skip \r\n
      if (current.trim() !== '') lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') lines.push(current);
  return lines;
}

/**
 * Parse a single CSV line into an array of field values.
 */
function parseLine(line, delimiter) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Infer whether each column is 'numeric', 'categorical', or 'text'.
 */
function inferColumnTypes(rows, headers) {
  const nullPatterns = /^(|nan|null|na|n\/a|none|missing|\?|-)$/i;

  return headers.map((_, colIdx) => {
    const rawValues = rows.map(row => {
      const v = row[colIdx];
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return nullPatterns.test(s) ? null : s;
    });

    const values = rawValues.filter(v => v !== null);

    if (values.length === 0) return 'text';

    // Count how many values can be parsed as numbers (with currency/percent stripping)
    const numericCount = values.filter(v => {
      const stripped = v
        .replace(/^[\$€£₹¥₩₫]\s*/g, '')
        .replace(/\s*%$/, '')
        .replace(/,/g, '')
        .replace(/\s+/g, '')
        .trim();
      if (stripped === '' || stripped === '-') return false;
      // Handle parenthesized negatives
      if (/^\([\d.]+\)$/.test(stripped)) return true;
      return !isNaN(Number(stripped));
    }).length;
    const numericRatio = numericCount / values.length;

    // Higher threshold for numeric: >80% of non-null values must be parseable as numbers
    if (numericRatio > 0.80) return 'numeric';

    // Boolean-like columns (true/false, yes/no, 0/1) → categorical
    const uniqueValues = new Set(values.map(v => v.toLowerCase()));
    if (uniqueValues.size <= 2) {
      const boolPatterns = new Set(['true', 'false', 'yes', 'no', '0', '1', 't', 'f', 'y', 'n']);
      const allBool = [...uniqueValues].every(v => boolPatterns.has(v));
      if (allBool) return 'categorical';
    }

    // Categorical: fewer unique values relative to total
    const uniqueRatio = uniqueValues.size / values.length;
    if (uniqueRatio < 0.5 || uniqueValues.size <= 30) return 'categorical';

    return 'text';
  });
}

/**
 * Generate a CSV string from headers and rows.
 */
export function generateCSV(headers, rows, delimiter = ',') {
  const escapeField = (field) => {
    const str = String(field ?? '');
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeField).join(delimiter);
  const dataLines = rows.map(row => row.map(escapeField).join(delimiter));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger client-side browser file download of CSV content.
 */
export function downloadCSV(filename, csvContent) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get column values as a flat array.
 */
export function getColumn(rows, colIndex) {
  return rows.map(row => row[colIndex]);
}

/**
 * Get numeric column values, filtering out nulls.
 */
export function getNumericColumn(rows, colIndex) {
  return rows
    .map(row => row[colIndex])
    .filter(v => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v));
}
