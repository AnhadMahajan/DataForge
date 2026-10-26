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

/**
 * Infers an appropriate SQL column type by inspecting sample values.
 *
 * @param {Array<*>} values
 * @returns {string}
 */
export function inferSqlType(values = []) {
  const nonNulls = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNulls.length === 0) return 'VARCHAR(255)';

  let isBoolean = true;
  let isInteger = true;
  let isNumeric = true;
  let isTimestamp = true;
  let maxLength = 0;

  for (const v of nonNulls) {
    const str = String(v).trim();
    if (str.length > maxLength) maxLength = str.length;

    // Check Boolean
    if (v !== true && v !== false && str !== '1' && str !== '0' && str.toLowerCase() !== 'true' && str.toLowerCase() !== 'false') {
      isBoolean = false;
    }

    // Check Number
    const num = Number(str);
    if (str === '' || isNaN(num)) {
      isNumeric = false;
      isInteger = false;
    } else {
      if (!Number.isInteger(num)) {
        isInteger = false;
      }
    }

    // Check Timestamp / ISO Date
    if (isNaN(Date.parse(str)) || str.length < 8 || !/^\d{4}[-/.]/.test(str)) {
      isTimestamp = false;
    }
  }

  if (isBoolean) return 'BOOLEAN';
  if (isInteger) return 'BIGINT';
  if (isNumeric) return 'NUMERIC(14, 4)';
  if (isTimestamp) return 'TIMESTAMP';
  if (maxLength > 255) return 'TEXT';
  return 'VARCHAR(255)';
}

/**
 * Escapes an arbitrary value as a safe SQL literal.
 *
 * @param {*} val
 * @returns {string}
 */
export function escapeSqlLiteral(val) {
  if (val === null || val === undefined || val === '') {
    return 'NULL';
  }

  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }

  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : 'NULL';
  }

  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }

  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }

  const str = String(val);
  // If string is pure numeric
  if (!isNaN(Number(str)) && str.trim() !== '') {
    return str.trim();
  }

  // Escape single quotes for SQL: ' -> ''
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Builds complete SQL DDL and DML statements with batch INSERTs.
 *
 * @param {string[]} headers
 * @param {Array<Array<*>>} data
 * @param {Object} options
 * @returns {string}
 */
export function buildSqlDump(headers, data, options = {}) {
  const {
    tableName = 'synthetic_data',
    batchSize = 100,
    includeDropTable = true,
  } = options;

  // Clean identifier: alphanumeric + underscore, max 63 chars
  const cleanTableName = (tableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'synthetic_data')
    .replace(/^_+/, '')
    .slice(0, 63) || 'synthetic_data';

  // Sanitize column names
  const cleanCols = headers.map((h, i) => {
    let clean = String(h || `col_${i + 1}`)
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .replace(/^_+/, '');
    if (!clean || /^[0-9]/.test(clean)) clean = `col_${clean}`;
    return clean;
  });

  // Infer SQL types per column from data samples
  const columnTypes = cleanCols.map((colName, colIdx) => {
    const colSamples = data.slice(0, 500).map((row) => (Array.isArray(row) ? row[colIdx] : row[headers[colIdx]]));
    const inferredType = inferSqlType(colSamples);
    return { name: colName, type: inferredType };
  });

  const lines = [
    `-- =====================================================================`,
    `-- DataForge Synthetic Intelligence Engine v2.0 — Relational SQL Export`,
    `-- Exported At: ${new Date().toISOString()}`,
    `-- Target Table: "${cleanTableName}" | Rows: ${data.length} | Columns: ${headers.length}`,
    `-- =====================================================================\n`,
  ];

  if (includeDropTable) {
    lines.push(`DROP TABLE IF EXISTS "${cleanTableName}";\n`);
  }

  // CREATE TABLE statement
  lines.push(`CREATE TABLE "${cleanTableName}" (`);
  lines.push(`  "df_row_id" SERIAL PRIMARY KEY,`);
  columnTypes.forEach((col, idx) => {
    const isLast = idx === columnTypes.length - 1;
    lines.push(`  "${col.name}" ${col.type}${isLast ? '' : ','}`);
  });
  lines.push(`);\n`);

  // Batch INSERT INTO statements
  const colNamesList = cleanCols.map((c) => `"${c}"`).join(', ');

  for (let i = 0; i < data.length; i += batchSize) {
    const chunk = data.slice(i, i + batchSize);
    lines.push(`INSERT INTO "${cleanTableName}" (${colNamesList}) VALUES`);

    const valueRows = chunk.map((row) => {
      let rowValues = [];
      if (Array.isArray(row)) {
        rowValues = cleanCols.map((_, colIdx) => escapeSqlLiteral(row[colIdx]));
      } else if (typeof row === 'object' && row !== null) {
        rowValues = headers.map((h) => escapeSqlLiteral(row[h]));
      } else {
        rowValues = [escapeSqlLiteral(row)];
      }
      return `  (${rowValues.join(', ')})`;
    });

    lines.push(valueRows.join(',\n') + ';\n');
  }

  return lines.join('\n');
}

/**
 * @desc    Export dataset to relational SQL DDL & batch INSERT script
 * @route   POST /api/export/sql
 * @access  Public / Authenticated
 */
export async function exportSql(req, res, next) {
  try {
    const { headers, data, filename: rawFilename } = normalizeExportPayload(req.body);

    if (headers.length === 0 || data.length === 0) {
      res.status(400);
      throw new Error('Please provide non-empty "headers" array and "data" rows matrix.');
    }

    const rawTableName = req.body.tableName || rawFilename?.replace(/\.[^/.]+$/, '') || 'synthetic_dataset';
    const safeTableName = rawTableName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const safeFilename = (rawFilename || `${safeTableName}_${Date.now()}.sql`)
      .replace(/[^a-zA-Z0-9_.-]/g, '_')
      .replace(/\.sql$/i, '') + '.sql';

    const batchSize = Math.max(1, Math.min(parseInt(req.body.batchSize, 10) || 100, 1000));
    const includeDropTable = req.body.includeDropTable !== false;

    const sqlContent = buildSqlDump(headers, data, {
      tableName: safeTableName,
      batchSize,
      includeDropTable,
    });

    // Record compliance audit log
    await AuditLog.record({
      req,
      action: 'EXPORT_SQL',
      resourceId: safeFilename,
      details: {
        format: 'sql',
        tableName: safeTableName,
        filename: safeFilename,
        rowCount: data.length,
        columnCount: headers.length,
        batchSize,
        headers,
      },
    });

    // If client requested JSON body directly without attachment disposition
    if (req.body.download === false || req.query.download === 'false') {
      return res.status(200).json({
        success: true,
        format: 'sql',
        filename: safeFilename,
        tableName: safeTableName,
        rowCount: data.length,
        columnCount: headers.length,
        sql: sqlContent,
      });
    }

    // Download headers
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Total-Rows', String(data.length));
    res.setHeader('X-Total-Columns', String(headers.length));

    return res.status(200).send(sqlContent);
  } catch (err) {
    next(err);
  }
}

export default {
  exportCsv,
  exportJson,
  exportSql,
  escapeCsvField,
  buildCsvString,
  buildJsonPayload,
  inferSqlType,
  escapeSqlLiteral,
  buildSqlDump,
  normalizeExportPayload,
};


