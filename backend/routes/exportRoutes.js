/**
 * DataForge — Data Export Routes
 * Architecture: MVC Route Layer (Assigned to: Person 4 / Export, Audit & Telemetry)
 */

import express from 'express';
import {
  exportCsv,
  exportJson,
  exportSql,
} from '../controllers/exportController.js';

const router = express.Router();

/**
 * @route   GET /api/export
 * @desc    Get export capabilities and endpoint specifications
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    service: 'DataForge Multi-Format Export Engine',
    version: '2.0.0',
    formats: [
      {
        format: 'csv',
        endpoint: '/api/export/csv',
        method: 'POST',
        specification: 'RFC-4180',
        contentType: 'text/csv; charset=utf-8',
        description: 'Converts headers and 2D data matrix into standard CSV with strict quote and delimiter escaping.',
      },
      {
        format: 'json',
        endpoint: '/api/export/json',
        method: 'POST',
        specification: 'ECMA-404 JSON (Structured / Records)',
        contentType: 'application/json; charset=utf-8',
        description: 'Formats synthetic records into structured JSON with embedded metadata or flat record arrays.',
      },
      {
        format: 'sql',
        endpoint: '/api/export/sql',
        method: 'POST',
        specification: 'ANSI/ISO SQL DDL + Batch DML',
        contentType: 'application/sql; charset=utf-8',
        description: 'Generates CREATE TABLE schema inference and multi-row INSERT INTO relational database import scripts.',
      },
    ],
  });
});

/**
 * @route   POST /api/export/csv
 * @desc    Export dataset to RFC-4180 compliant CSV
 * @access  Public / Authenticated
 */
router.post('/csv', exportCsv);

/**
 * @route   POST /api/export/json
 * @desc    Export dataset to structured JSON download
 * @access  Public / Authenticated
 */
router.post('/json', exportJson);

/**
 * @route   POST /api/export/sql
 * @desc    Export dataset to relational SQL DDL & batch INSERT script
 * @access  Public / Authenticated
 */
router.post('/sql', exportSql);

export default router;
