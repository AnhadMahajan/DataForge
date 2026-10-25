/**
 * DataForge — Dataset Management Routes
 * Architecture: MVC Route Layer (Assigned to: Person 3 / Dataset Ingestion & Profiling)
 */

import express from 'express';
import upload, { handleUploadErrors } from '../middlewares/uploadMiddleware.js';
import {
  uploadDataset,
  getDatasets,
  getDatasetById,
  deleteDataset,
} from '../controllers/datasetController.js';

const router = express.Router();

// Upload CSV / JSON dataset and perform automated schema profiling
router.post('/upload', upload.single('file'), handleUploadErrors, uploadDataset);

// Paginated dataset listing (metadata & profile summaries)
router.route('/')
  .get(getDatasets);

// Single dataset inspection (metadata + sample row preview) and deletion
router.route('/:id')
  .get(getDatasetById)
  .delete(deleteDataset);

export default router;
