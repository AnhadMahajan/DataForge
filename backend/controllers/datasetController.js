/**
 * DataForge — Dataset Controller
 * Architecture: MVC Controller Layer (Assigned to: Person 3 / Dataset Ingestion & Profiling)
 */

import path from 'path';
import mongoose from 'mongoose';
import Dataset from '../models/Dataset.js';
import { profileRawData, coerceRows } from '../services/profilingService.js';

const PREVIEW_ROWS = 20;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
// MongoDB hard limit is 16MB per document; keep headroom for metadata & profiles
const MAX_DOCUMENT_BYTES = 15.5 * 1024 * 1024;
const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fail fast with 503 instead of letting Mongoose buffer commands for 10s.
 */
function assertDbConnected(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503);
    throw new Error('Database unavailable. Please ensure MongoDB is running and try again.');
  }
}

/**
 * Parse a positive integer query param, clamped to [min, max].
 */
function parseIntParam(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pick the delimiter that occurs most often (outside quotes) in the header line.
 */
function detectDelimiter(text) {
  let headerLine = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    if (!inQuotes) headerLine += ch;
  }

  let best = ',';
  let bestCount = 0;
  for (const d of CANDIDATE_DELIMITERS) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * RFC 4180 CSV parser: quoted fields, escaped quotes (""), embedded newlines,
 * CRLF / LF / CR line endings. Blank lines are skipped.
 * @returns {string[][]}
 */
function parseCsvText(text, delimiter) {
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushRow = () => {
    row.push(field);
    field = '';
    // Skip fully blank lines
    if (!(row.length === 1 && row[0].trim() === '')) records.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
      i++;
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += ch;
    }
    i++;
  }

  if (inQuotes) {
    throw new Error('Malformed CSV: unterminated quoted field');
  }
  if (field !== '' || row.length > 0) pushRow();

  return records;
}

/**
 * Ensure header names are non-empty and unique (duplicates get a numeric suffix).
 */
function normalizeHeaders(rawHeaders) {
  const used = new Set();
  return rawHeaders.map((h, idx) => {
    const base = String(h ?? '').trim() || `column_${idx + 1}`;
    let name = base;
    let n = 1;
    while (used.has(name)) name = `${base}_${n++}`;
    used.add(name);
    return name;
  });
}

/**
 * Stringify nested JSON values so every cell is a scalar.
 */
function toCell(value) {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('Uploaded CSV file is empty');

  const records = parseCsvText(text, detectDelimiter(text));
  if (records.length < 1) throw new Error('CSV file contains no header row');

  return { headers: records[0], rows: records.slice(1) };
}

/**
 * Accepted JSON shapes:
 *  - [ { col: val, ... }, ... ]                 (array of records)
 *  - [ [h1, h2, ...], [v1, v2, ...], ... ]       (array of arrays, first row = headers)
 *  - { headers: [...], data | rows: [[...]] }    (DataForge synthesis format)
 *  - { data | rows | records: [ {...} ] }        (wrapped array of records)
 */
function parseJsonBuffer(buffer) {
  let payload;
  try {
    payload = JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new Error(`Invalid JSON file: ${err.message}`);
  }

  if (payload && !Array.isArray(payload) && typeof payload === 'object') {
    const body = payload.data ?? payload.rows ?? payload.records;
    if (Array.isArray(payload.headers) && Array.isArray(body)) {
      return { headers: payload.headers, rows: body };
    }
    if (Array.isArray(body)) payload = body;
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('JSON must be a non-empty array of records or a { headers, data } object');
  }

  if (Array.isArray(payload[0])) {
    return { headers: payload[0], rows: payload.slice(1) };
  }

  if (payload.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    // Union of keys in order of first appearance
    const headerSet = new Set();
    for (const record of payload) Object.keys(record).forEach((k) => headerSet.add(k));
    const headers = [...headerSet];
    const rows = payload.map((record) => headers.map((h) => record[h]));
    return { headers, rows };
  }

  throw new Error('JSON records must all be objects (or all be arrays)');
}

/**
 * Parse an uploaded Multer file into { headers, rows } with rectangular, scalar rows.
 */
function parseUploadedFile(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const parsed = ext === '.json' ? parseJsonBuffer(file.buffer) : parseCsvBuffer(file.buffer);

  const headers = normalizeHeaders(parsed.headers);
  const width = headers.length;
  let raggedRows = 0;

  const rows = parsed.rows.map((r) => {
    const row = Array.isArray(r) ? r : [r];
    if (row.length !== width) raggedRows++;
    const out = new Array(width);
    for (let i = 0; i < width; i++) out[i] = toCell(row[i]);
    return out;
  });

  const warnings = [];
  if (raggedRows > 0) {
    warnings.push(`${raggedRows} row(s) did not match the header width and were padded/truncated`);
  }

  return { headers, rows, warnings };
}

/* ------------------------------------------------------------------ */
/* Controllers                                                         */
/* ------------------------------------------------------------------ */

/**
 * @desc    Upload a CSV/JSON dataset, parse & auto-profile it, persist to MongoDB
 * @route   POST /api/datasets/upload
 * @access  Public / Authenticated
 */
export async function uploadDataset(req, res, next) {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded. Send a .csv or .json file in the "file" form field.');
    }

    let parsed;
    try {
      parsed = parseUploadedFile(req.file);
    } catch (parseErr) {
      res.status(400);
      throw parseErr;
    }

    const { headers, rows, warnings } = parsed;

    if (headers.length === 0) {
      res.status(400);
      throw new Error('Dataset has no columns');
    }
    if (rows.length === 0) {
      res.status(400);
      throw new Error('Dataset has a header row but no data rows');
    }

    // Automated schema profiling: type inference + quality & distribution stats
    const profileStart = Date.now();
    const profile = profileRawData(headers, rows);
    // Store typed values (numbers, ISO datetimes, null for missing) for downstream synthesis
    const typedRows = coerceRows(rows, profile.columns);
    const profilingTimeMs = Date.now() - profileStart;

    const docSize = mongoose.mongo.BSON.calculateObjectSize({ dataMatrix: typedRows });
    if (docSize > MAX_DOCUMENT_BYTES) {
      res.status(413);
      throw new Error(
        `Parsed dataset is too large to store (${(docSize / 1048576).toFixed(1)}MB; limit ~15MB). Please upload a smaller sample.`
      );
    }

    assertDbConnected(res);

    const originalName = req.file.originalname;
    const requestedName = String(req.body?.name ?? '').trim();
    const name = (requestedName || path.parse(originalName).name.trim() || 'Untitled Dataset').slice(0, 120);

    const dataset = await Dataset.create({
      name,
      filename: originalName,
      sizeBytes: req.file.size,
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      headers,
      columns: profile.columns,
      dataMatrix: typedRows,
      createdBy: req.user?._id || null,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: dataset._id,
        name: dataset.name,
        filename: dataset.filename,
        sizeBytes: dataset.sizeBytes,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        headers: dataset.headers,
        columns: dataset.columns,
        summary: profile.summary,
        preview: typedRows.slice(0, PREVIEW_ROWS),
        warnings,
        profilingTimeMs,
        createdBy: dataset.createdBy,
        createdAt: dataset.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    List datasets (metadata + column profiles, raw matrix excluded) with pagination
 * @route   GET /api/datasets?page=1&limit=20&search=sales
 * @access  Public / Authenticated
 */
export async function getDatasets(req, res, next) {
  try {
    assertDbConnected(res);

    const page = parseIntParam(req.query.page, 1, 1, 1e6);
    const limit = parseIntParam(req.query.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    const query = {};
    if (req.user?._id) query.createdBy = req.user._id;
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      query.name = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };
    }

    // dataMatrix is select:false on the schema, so it is never loaded here
    const [datasets, total] = await Promise.all([
      Dataset.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Dataset.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: datasets.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: datasets,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Get single dataset by ID with sample rows preview slice
 * @route   GET /api/datasets/:id?rows=20&offset=0
 * @access  Public / Authenticated
 */
export async function getDatasetById(req, res, next) {
  try {
    assertDbConnected(res);

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error(`Dataset with ID ${id} not found`);
    }

    const dataset = await Dataset.findById(id).select('+dataMatrix');

    if (!dataset) {
      res.status(404);
      throw new Error(`Dataset with ID ${id} not found`);
    }

    // Configurable preview slice (default 20, max 100)
    const limit = parseIntParam(req.query.rows, PREVIEW_ROWS, 1, 100);
    const offset = parseIntParam(req.query.offset, 0, 0, dataset.rowCount);

    const rawMatrix = dataset.dataMatrix || [];
    const preview = rawMatrix.slice(offset, offset + limit);

    // Convert Mongoose doc to plain object and replace large dataMatrix with preview slice
    const datasetObj = dataset.toObject();
    delete datasetObj.dataMatrix;
    datasetObj.preview = preview;
    datasetObj.previewMeta = {
      offset,
      limit,
      returnedRows: preview.length,
      totalRows: dataset.rowCount,
    };

    res.status(200).json({
      success: true,
      data: datasetObj,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Delete a dataset by ID with existence check
 * @route   DELETE /api/datasets/:id
 * @access  Public / Authenticated
 */
export async function deleteDataset(req, res, next) {
  try {
    assertDbConnected(res);

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error(`Dataset with ID ${id} not found`);
    }

    const dataset = await Dataset.findById(id);

    if (!dataset) {
      res.status(404);
      throw new Error(`Dataset with ID ${id} not found`);
    }

    await dataset.deleteOne();

    res.status(200).json({
      success: true,
      message: `Dataset ${id} removed successfully`,
    });
  } catch (err) {
    next(err);
  }
}

export default {
  uploadDataset,
  getDatasets,
  getDatasetById,
  deleteDataset,
};
