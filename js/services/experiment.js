/**
 * DataForge — Experiment Orchestration Service
 * Runs baseline training, applies candidate augmentation strategies,
 * evaluates held-out test performance, and computes recommendations.
 */

import * as storage from './storage.js';
import { applySMOTE, applyRandomOversampling, applyNoiseInjection, computeSyntheticQuality } from './augmentation.js';
import { runControlledEvaluation, compareEvaluations } from './evaluation.js';
import { generateRecommendation } from './recommendations.js';
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
 * Run a full controlled experiment pipeline.
 * Calls onProgress(stageText, percent) to update UI smoothly.
 */
export async function runExperiment({
  userId,
  dataset,
  name,
  strategies = ['smote', 'oversampling', 'noise_injection'],
  strategyParams = {},
  runs = 5,
  trainTestSplit = 0.8,
  modelType = 'knn',
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

  const { headers, columns, fullData, targetColumn } = dataset;
  const targetIndex = headers.indexOf(targetColumn);

  // Extract raw rows & labels
  const dataRows = fullData.map(r => r.filter((_, idx) => idx !== targetIndex));
  const labels = fullData.map(r => String(r[targetIndex]));

  // Identify numeric feature indices
  const numericIndices = [];
  let colCounter = 0;
  headers.forEach((_, idx) => {
    if (idx !== targetIndex) {
      if (columns[idx].type === 'numeric') {
        numericIndices.push(colCounter);
      }
      colCounter++;
    }
  });

  try {
    // Stage 1: Run Baseline Evaluation
    onProgress('Training baseline model on unaugmented data...', 15);
    const baseline = await runControlledEvaluation({
      data: dataRows,
      labels,
      numericIndices,
      augmentFn: null,
      runs,
      trainTestSplit,
      modelType,
      baseSeed,
    });
    experimentRecord.baseline = baseline;

    // Stage 2: Evaluate Augmentation Strategies
    const strategyResults = [];
    const stepSize = 65 / (strategies.length || 1);
    let currentProgress = 20;

    for (let i = 0; i < strategies.length; i++) {
      const stratType = strategies[i];
      onProgress(`Evaluating strategy: ${stratType.toUpperCase()}...`, Math.round(currentProgress));

      let augmentFn = null;
      let params = strategyParams[stratType] || {};

      if (stratType === 'smote') {
        augmentFn = (d, l, numIdx, opt) => applySMOTE(d, l, numIdx, { ...params, ...opt });
      } else if (stratType === 'oversampling') {
        augmentFn = (d, l, numIdx, opt) => applyRandomOversampling(d, l, numIdx, { ...params, ...opt });
      } else if (stratType === 'noise_injection') {
        augmentFn = (d, l, numIdx, opt) => applyNoiseInjection(d, l, numIdx, { ...params, ...opt });
      }

      // Generate synthetic samples on full data to measure quality metrics
      const sampleAug = augmentFn ? augmentFn(dataRows, labels, numericIndices, { seed: baseSeed }) : { syntheticData: [] };
      const qualityMetrics = computeSyntheticQuality(dataRows, sampleAug.syntheticData, numericIndices);

      // Run controlled evaluation on training splits
      const evalResult = await runControlledEvaluation({
        data: dataRows,
        labels,
        numericIndices,
        augmentFn,
        runs,
        trainTestSplit,
        modelType,
        baseSeed,
      });

      const comparison = compareEvaluations(baseline, evalResult);

      strategyResults.push({
        strategyType: stratType,
        strategyParams: params,
        evaluation: evalResult,
        comparison,
        qualityMetrics,
        syntheticCount: sampleAug.syntheticCount || 0,
      });

      currentProgress += stepSize;
    }

    // Stage 3: Recommendation Engine
    onProgress('Synthesizing statistical recommendations...', 90);
    const recommendation = generateRecommendation(dataset, baseline, strategyResults);

    experimentRecord.strategyResults = strategyResults;
    experimentRecord.recommendation = recommendation;
    experimentRecord.status = 'completed';
    experimentRecord.completedAt = new Date().toISOString();

    // Persist to user's experiments
    const storageKey = `${EXPERIMENTS_PREFIX}${userId}`;
    storage.addToCollection(storageKey, experimentRecord);

    onProgress('Experiment completed.', 100);
    return { success: true, data: experimentRecord };
  } catch (err) {
    console.error('[Experiment] Failed:', err);
    experimentRecord.status = 'failed';
    return { success: false, error: { message: err.message || 'Experiment execution failed.' } };
  }
}
