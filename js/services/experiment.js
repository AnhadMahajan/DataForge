/**
 * DataForge — Experiment Orchestration Service
 * Executes real Scikit-Learn evaluation pipelines via Native Python or Pyodide.
 */

import * as storage from './storage.js';
import { runExperimentPipeline } from './pipeline.js';
import { generateUUID } from '../utils/math.js';

const EXPERIMENTS_PREFIX = 'experiments_';

/**
 * Get all experiments for a user.
 */
export function getExperiments(userId) {
  const storageKey = `${EXPERIMENTS_PREFIX}${userId}`;
  return storage.getCollection(storageKey);
}

/**
 * Get a single experiment by ID.
 */
export function getExperimentById(userId, experimentId) {
  const storageKey = `${EXPERIMENTS_PREFIX}${userId}`;
  return storage.findInCollection(storageKey, experimentId);
}

/**
 * Delete an experiment by ID.
 */
export function deleteExperiment(userId, experimentId) {
  const storageKey = `${EXPERIMENTS_PREFIX}${userId}`;
  return storage.removeFromCollection(storageKey, experimentId);
}

/**
 * Run a full controlled experiment pipeline using real Python Scikit-Learn.
 */
export async function runExperiment({
  userId,
  dataset,
  name,
  strategies = ['smote', 'adasyn', 'oversampling', 'noise_injection'],
  strategyParams = {},
  runs = 3,
  trainTestSplit = 0.8,
  modelType = 'random_forest',
  baseSeed = 42,
  onProgress = () => {},
}) {
  const expId = generateUUID();
  const experimentRecord = {
    id: expId,
    userId,
    name: name || `Experiment_${dataset.name}_${new Date().toLocaleDateString()}`,
    datasetId: dataset.id,
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: 'running',
    config: {
      strategies,
      strategyParams,
      runs,
      trainTestSplit,
      modelType,
      baseSeed,
    },
    baseline: null,
    strategyResults: [],
    recommendation: null,
  };

  const { headers, fullData, targetColumn } = dataset;

  try {
    onProgress('Dispatching Scikit-Learn experiment pipeline to Python runtime...', 15);

    const pipelineResult = await runExperimentPipeline({
      headers,
      data: fullData,
      targetCol: targetColumn,
      strategies,
      strategyParams,
      runs,
      trainTestSplit,
      modelType,
      baseSeed,
      onProgress: (stage, pct) => {
        onProgress(stage, pct);
      },
    });

    experimentRecord.baseline = pipelineResult.baseline;
    experimentRecord.strategyResults = pipelineResult.strategyResults || [];
    experimentRecord.recommendation = pipelineResult.recommendation;
    experimentRecord.status = 'completed';
    experimentRecord.completedAt = new Date().toISOString();

    // Persist to user's experiments collection
    const storageKey = `${EXPERIMENTS_PREFIX}${userId}`;
    storage.addToCollection(storageKey, experimentRecord);

    onProgress('Experiment completed successfully.', 100);
    return { success: true, data: experimentRecord };
  } catch (err) {
    console.error('[ExperimentService] Execution failed:', err);
    experimentRecord.status = 'failed';
    return { success: false, error: { message: err.message || 'Experiment execution failed.' } };
  }
}
