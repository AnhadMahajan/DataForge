/**
 * DataForge — Evaluation & Benchmark Routes
 * Architecture: MVC Route Layer (Assigned to: Person 1 / Lead Architect)
 */

import express from 'express';
import {
  runFidelityAudit,
  runTstrBenchmark,
  getEvaluationReports,
  getEvaluationReportById,
} from '../controllers/evaluationController.js';

const router = express.Router();

router.route('/audit').post(runFidelityAudit);
router.route('/tstr').post(runTstrBenchmark);
router.route('/reports').get(getEvaluationReports);
router.route('/reports/:id').get(getEvaluationReportById);

export default router;
