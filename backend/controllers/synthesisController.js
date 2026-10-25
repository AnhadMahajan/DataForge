/**
 * DataForge — Synthesis Controller
 * Architecture: MVC Controller Layer (Assigned to: Person 1 / Lead Architect)
 */

import SynthesisJob from '../models/SynthesisJob.js';
import { executeSynthesis } from '../services/synthesisEngine.js';

/**
 * @desc    Trigger a synthesis run & record job in MongoDB
 * @route   POST /api/synthesis/run
 * @access  Public / Authenticated
 */
export async function runSynthesis(req, res, next) {
  try {
    const {
      name = 'Synthesis Job',
      datasetId = null,
      headers,
      data,
      algorithm = 'copula',
      rowCount = 100,
      params = {},
      seed = 42,
    } = req.body;

    if (!headers || !data || !Array.isArray(headers) || !Array.isArray(data)) {
      res.status(400);
      throw new Error('Please provide valid "headers" array and "data" 2D matrix.');
    }

    const startTime = Date.now();

    // Execute synthesis via mathematical engine
    const synthesisResult = await executeSynthesis({
      headers,
      data,
      algorithm,
      rowCount: Number(rowCount),
      params,
      seed: Number(seed),
    });

    const executionTimeMs = Date.now() - startTime;
    const preview = synthesisResult.syntheticData.slice(0, 20);

    // Save job record to MongoDB if database is connected
    let jobRecord = null;
    try {
      jobRecord = await SynthesisJob.create({
        name,
        datasetId,
        algorithm,
        rowCount: synthesisResult.rowCount,
        headers,
        params,
        seed,
        status: 'completed',
        metrics: {
          executionTimeMs,
          generatedRows: synthesisResult.rowCount,
          featureCount: headers.length,
        },
        resultPreview: preview,
        syntheticData: synthesisResult.syntheticData,
        createdBy: req.user?._id || null,
      });
    } catch (dbErr) {
      console.warn(`[SynthesisController] MongoDB write notice: ${dbErr.message}`);
    }

    res.status(201).json({
      success: true,
      data: {
        jobId: jobRecord?._id || 'ephemeral_job_' + Date.now(),
        name,
        algorithm,
        rowCount: synthesisResult.rowCount,
        headers,
        preview,
        syntheticData: synthesisResult.syntheticData,
        metrics: {
          executionTimeMs,
          generatedRows: synthesisResult.rowCount,
        },
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Get all synthesis jobs (with pagination)
 * @route   GET /api/synthesis/jobs
 * @access  Public / Authenticated
 */
export async function getSynthesisJobs(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.user?._id) query.createdBy = req.user._id;

    const jobs = await SynthesisJob.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SynthesisJob.countDocuments(query);

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Get single synthesis job by ID (includes syntheticData matrix)
 * @route   GET /api/synthesis/jobs/:id
 * @access  Public / Authenticated
 */
export async function getSynthesisJobById(req, res, next) {
  try {
    const job = await SynthesisJob.findById(req.params.id).select('+syntheticData');

    if (!job) {
      res.status(404);
      throw new Error(`Synthesis job with ID ${req.params.id} not found`);
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc    Delete a synthesis job
 * @route   DELETE /api/synthesis/jobs/:id
 * @access  Public / Authenticated
 */
export async function deleteSynthesisJob(req, res, next) {
  try {
    const job = await SynthesisJob.findById(req.params.id);

    if (!job) {
      res.status(404);
      throw new Error(`Synthesis job with ID ${req.params.id} not found`);
    }

    await job.deleteOne();

    res.status(200).json({
      success: true,
      message: `Synthesis job ${req.params.id} removed successfully`,
    });
  } catch (err) {
    next(err);
  }
}
