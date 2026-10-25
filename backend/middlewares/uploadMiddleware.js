/**
 * DataForge — File Upload Middleware (Multer)
 * Architecture: MVC Middleware Layer (Assigned to: Person 3 / Dataset Ingestion & Profiling)
 */

import path from 'path';
import multer from 'multer';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = ['.csv', '.json'];

// Browsers / OSes report CSV & JSON under several MIME types
// (e.g. Windows + Excel sends CSV as application/vnd.ms-excel, curl sends application/octet-stream).
const ALLOWED_MIME_TYPES = {
  '.csv': [
    'text/csv',
    'application/csv',
    'text/x-csv',
    'application/x-csv',
    'text/comma-separated-values',
    'text/x-comma-separated-values',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
  ],
  '.json': [
    'application/json',
    'text/json',
    'application/x-json',
    'text/plain',
    'application/octet-stream',
  ],
};

/**
 * Accept only .csv / .json files whose reported MIME type is consistent with the extension.
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME_TYPES[ext].includes(mime)) {
    const err = new Error(
      `Unsupported file "${file.originalname}" (${mime || 'unknown type'}). Only .csv and .json uploads are allowed.`
    );
    err.statusCode = 400;
    return cb(err, false);
  }

  cb(null, true);
}

// Memory storage: file buffer is parsed & profiled in-process, never written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter,
});

/**
 * Translate Multer / filter errors into proper 4xx responses before they
 * reach the generic error handler (which would otherwise default to 500).
 */
export function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = `File too large. Maximum upload size is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`;
    }
    return next(err);
  }

  if (err && err.statusCode) {
    res.status(err.statusCode);
  }
  next(err);
}

export default upload;
