/**
 * DataForge — Data Export Controller
 * Architecture: MVC Controller Layer (Assigned to: Person 4 / Export, Audit & Telemetry)
 */

import AuditLog from '../models/AuditLog.js';

/**
 * Escapes a single CSV field value strictly according to RFC-4180 specifications.
 * - Fields containing quotes ("), commas (,), carriage returns (\r), or newlines (\n) must be enclosed in double quotes.
 * - Any double quote character inside a field must be escaped by preceding it with another double quote ("").
 * - Null and undefined are formatted as empty strings.
 *
 * @param {*} val
 * @returns {string}
 */
export function escapeCsvField(val) {
  if (val === null || val === undefined) {
    return '';
  }

  // Handle Date objects
  if (val instanceof Date) {
    return `"${val.toISOString()}"`;
  }

  // Handle Arrays or Objects
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/"/g, '""');
    return `"${jsonStr}"`;
  }

  const str = String(val);

  // RFC-4180 condition: If value contains comma, double quote, CR, or LF, quote it
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts headers and 2D data matrix into an RFC-4180 compliant CSV string.
 * Uses CRLF (\r\n) line breaks per RFC-4180 section 2.1.
 *
 * @param {string[]} headers
 * @param {Array<Array<*>>} data
 * @returns {string}
 */
export function buildCsvString(headers, data) {
  const headerLine = headers.map(escapeCsvField).join(',');
  const rowLines = data.map((row) => {
    // If row is an array, map each item; if row is an object, map via headers
    if (Array.isArray(row)) {
      return row.map(escapeCsvField).join(',');
    } else if (typeof row === 'object' && row !== null) {
      return headers.map((h) => escapeCsvField(row[h])).join(',');
    }
    return escapeCsvField(row);
  });

  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Helper to normalize dataset input from req.body
 */
export function normalizeExportPayload(body = {}) {
  let { headers, data, filename } = body;

  // Support array-of-objects input: [{ a: 1, b: 2 }, ...]
  if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0]) && typeof data[0] === 'object' && data[0] !== null) {
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      headers = Object.keys(data[0]);
    }
    data = data.map((obj) => headers.map((h) => obj[h]));
  }

  headers = Array.isArray(headers) ? headers : [];
  data = Array.isArray(data) ? data : [];

  return { headers, data, filename };
}

/**
 * @desc    Export dataset to RFC-4180 compliant CSV download
 * @route   POST /api/export/csv
 * @access  Public / Authenticated
 */
export async function exportCsv(req, res, next) {
  try {
    const { headers, data, filename: rawFilename } = normalizeExportPayload(req.body);

    if (headers.length === 0 || data.length === 0) {
      res.status(400);
      throw new Error('Please provide non-empty "headers" array and "data" rows matrix.');
    }

    const safeFilename = (rawFilename || `dataforge_export_${Date.now()}.csv`)
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(/\.csv$/i, '') + '.csv';

    // Generate RFC-4180 compliant CSV
    const csvContent = buildCsvString(headers, data);

    // Record non-blocking compliance audit log
    await AuditLog.record({
      req,
      action: 'EXPORT_CSV',
      resourceId: safeFilename,
      details: {
        format: 'csv',
        filename: safeFilename,
        rowCount: data.length,
        columnCount: headers.length,
        headers,
      },
    });

    // Support JSON response wrapper if requested (e.g. format=json in query)
    if (req.query.format === 'json' || req.body.download === false) {
      return res.status(200).json({
        success: true,
        format: 'csv',
        filename: safeFilename,
        rowCount: data.length,
        columnCount: headers.length,
        csv: csvContent,
      });
    }

    // Set download headers for CSV attachment
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Total-Rows', String(data.length));
    res.setHeader('X-Total-Columns', String(headers.length));

    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}

/**
 * Converts headers and data matrix into structured JSON payload.
 * Supports structured mode with metadata or pure records array.
 *
 * @param {string[]} headers
 * @param {Array<Array<*>>} data
 * @param {Object} options
 * @returns {Object|Array}
 */
export function buildJsonPayload(headers, data, options = {}) {
  const { structure = 'structured', filename = 'dataforge_export.json' } = options;

  const records = data.map((row) => {
    if (Array.isArray(row)) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx] : null;
      });
      return obj;
    } else if (typeof row === 'object' && row !== null) {
      return row;
    }
    return { value: row };
  });

  if (structure === 'records' || structure === 'array') {
    return records;
  }

  return {
    metadata: {
      filename,
      exportedAt: new Date().toISOString(),
      rowCount: data.length,
      columnCount: headers.length,
      headers,
      generator: 'DataForge Synthetic Intelligence Engine v2.0',
    },
    records,
  };
}

/**
 * @desc    Export dataset to structured JSON download
 * @route   POST /api/export/json
 * @access  Public / Authenticated
 */
export async function exportJson(req, res, next) {
  try {
    const { headers, data, filename: rawFilename } = normalizeExportPayload(req.body);

    if (headers.length === 0 || data.length === 0) {
      res.status(400);
      throw new Error('Please provide non-empty "headers" array and "data" rows matrix.');
    }

    const safeFilename = (rawFilename || `dataforge_export_${Date.now()}.json`)
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(/\.json$/i, '') + '.json';

    const structure = req.query.structure || req.body.structure || 'structured';
    const jsonPayload = buildJsonPayload(headers, data, {
      structure,
      filename: safeFilename,
    });

    const jsonString = JSON.stringify(jsonPayload, null, 2);

    // Record compliance audit log
    await AuditLog.record({
      req,
      action: 'EXPORT_JSON',
      resourceId: safeFilename,
      details: {
        format: 'json',
        structure,
        filename: safeFilename,
        rowCount: data.length,
        columnCount: headers.length,
        headers,
      },
    });

    // If client requested JSON body directly without attachment disposition
    if (req.body.download === false || req.query.download === 'false') {
      return res.status(200).json({
        success: true,
        format: 'json',
        filename: safeFilename,
        rowCount: data.length,
        columnCount: headers.length,
        payload: jsonPayload,
      });
    }

    // Download headers
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Total-Rows', String(data.length));
    res.setHeader('X-Total-Columns', String(headers.length));

    return res.status(200).send(jsonString);
  } catch (err) {
    next(err);
  }
}

export default {
  exportCsv,
  exportJson,
  escapeCsvField,
  buildCsvString,
  buildJsonPayload,
  normalizeExportPayload,
};

