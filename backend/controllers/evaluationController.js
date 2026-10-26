/**
 * DataForge — Evaluation & Benchmark Controller
 * Architecture: MVC Controller Layer (Assigned to: Person 1 / Lead Architect)
 */

import EvaluationReport from '../models/EvaluationReport.js';
import { auditDatasetFidelity } from '../services/fidelityEngine.js';
import { executeTstrBenchmark } from '../services/tstrEngine.js';

/**
 * @desc    Run Fidelity & Privacy Audit
 * @route   POST /api/evaluation/audit
 * @access  Public / Authenticated
 */
export async function runFidelityAudit(req, res, next) {
  try {
    const { headers, realData, syntheticData } = req.body;

    if (!headers || !realData || !syntheticData) {
      res.status(400);
      throw new Error('Please provide "headers", "realData", and "syntheticData" arrays.');
    }

    const auditMetrics = await auditDatasetFidelity({
      headers,
      realData,
      syntheticData,
    });

    res.status(200).json({
      success: true,
      data: auditMetrics,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Run Train-on-Synthetic, Test-on-Real (TSTR) Benchmark
 * @route   POST /api/evaluation/tstr
 * @access  Public / Authenticated
 */
export async function runTstrBenchmark(req, res, next) {
  try {
    const {
      title = 'TSTR Evaluation Benchmark',
      datasetId = null,
      synthesisJobId = null,
      headers,
      realData,
      syntheticData,
      targetCol,
      modelType = 'decision_tree',
      testSize = 0.25,
      seed = 42,
    } = req.body;

    if (!headers || !realData || !syntheticData || !targetCol) {
      res.status(400);
      throw new Error('Please provide "headers", "realData", "syntheticData", and "targetCol".');
    }

    // 1. Run TSTR Machine Learning Benchmark
    const tstrResult = await executeTstrBenchmark({
      headers,
      realData,
      syntheticData,
      targetCol,
      testSize: Number(testSize),
      seed: Number(seed),
    });

    // 2. Run Fidelity Audit alongside
    const fidelityMetrics = await auditDatasetFidelity({
      headers,
      realData,
      syntheticData,
    });

    // 3. Save Evaluation Report in MongoDB
    let reportDoc = null;
    try {
      reportDoc = await EvaluationReport.create({
        title,
        datasetId,
        synthesisJobId,
        targetColumn: targetCol,
        modelType,
        fidelity: fidelityMetrics,
        tstrBenchmark: tstrResult,
        runs: 1,
        trainTestSplit: 1.0 - Number(testSize),
        createdBy: req.user?._id || null,
      });
    } catch (dbErr) {
      console.warn(`[EvaluationController] MongoDB write notice: ${dbErr.message}`);
    }

    res.status(200).json({
      success: true,
      data: {
        reportId: reportDoc?._id || 'ephemeral_report_' + Date.now(),
        title,
        targetColumn: targetCol,
        modelType,
        tstrBenchmark: tstrResult,
        fidelity: fidelityMetrics,
        ...tstrResult,
        createdAt: new Date().toISOString(),
      },
      ...tstrResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Get all evaluation reports
 * @route   GET /api/evaluation/reports
 * @access  Public / Authenticated
 */
export async function getEvaluationReports(req, res, next) {
  try {
    const reports = await EvaluationReport.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Get single evaluation report by ID
 * @route   GET /api/evaluation/reports/:id
 * @access  Public / Authenticated
 */
export async function getEvaluationReportById(req, res, next) {
  try {
    const report = await EvaluationReport.findById(req.params.id);

    if (!report) {
      res.status(404);
      throw new Error(`Evaluation report with ID ${req.params.id} not found`);
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
}
