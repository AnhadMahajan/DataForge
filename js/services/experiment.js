/**
 * DataForge — Experiment Orchestration Service
 * Runs baseline training, applies candidate augmentation strategies,
 * evaluates held-out test performance, and computes recommendations.
 */

import * as storage from './storage.js';
import {
  applySMOTE,
  applyADASYN,
  applySMOTETomek,
  applyRandomOversampling,
  applyNoiseInjection,
  computeSyntheticQuality,
} from './augmentation.js';
import { runControlledEvaluation, compareEvaluations } from './evaluation.js';
import { generateRecommendation } from './recommendations.js';
import { generateUUID } from '../utils/math.js';
import { generateCSV } from '../utils/csv.js';

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
  strategies = ['smote', 'adasyn', 'smote_tomek', 'oversampling', 'noise_injection'],
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

  const { headers, columns, fullData, targetColumn, analysisResult } = dataset;
  const targetIndex = headers.indexOf(targetColumn);

  // Extract raw rows & labels (preserving original feature indices)
  const dataRows = fullData.map(r => r.filter((_, idx) => idx !== targetIndex));
  const labels = fullData.map(r => String(r[targetIndex] ?? 'UNKNOWN'));

  // Separate feature columns (excluding target)
  const featureHeaders = headers.filter((_, idx) => idx !== targetIndex);
  const numericIndices = [];
  const categoricalIndices = [];
  const idIndices = [];

  let colCounter = 0;
  headers.forEach((_, idx) => {
    if (idx !== targetIndex) {
      const col = columns[idx];
      const isId = analysisResult?.idIndices?.includes(idx);
      if (isId) {
        idIndices.push(colCounter);
      }
      if (col.type === 'numeric') {
        numericIndices.push(colCounter);
      } else {
        categoricalIndices.push(colCounter);
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
      categoricalIndices,
      idIndices,
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
        augmentFn = (d, l, numIdx, opt) => applySMOTE(d, l, numIdx, { ...params, ...opt, categoricalIndices });
      } else if (stratType === 'adasyn') {
        augmentFn = (d, l, numIdx, opt) => applyADASYN(d, l, numIdx, { ...params, ...opt, categoricalIndices });
      } else if (stratType === 'smote_tomek') {
        augmentFn = (d, l, numIdx, opt) => applySMOTETomek(d, l, numIdx, { ...params, ...opt, categoricalIndices });
      } else if (stratType === 'oversampling') {
        augmentFn = (d, l, numIdx, opt) => applyRandomOversampling(d, l, numIdx, { ...params, ...opt, categoricalIndices });
      } else if (stratType === 'noise_injection') {
        augmentFn = (d, l, numIdx, opt) => applyNoiseInjection(d, l, numIdx, { ...params, ...opt });
      }

      // Generate synthetic samples on full data to produce downloadable CSVs & quality metrics
      const sampleAug = augmentFn
        ? augmentFn(dataRows, labels, numericIndices, { seed: baseSeed, categoricalIndices })
        : { syntheticData: [], syntheticLabels: [], augmentedData: dataRows, augmentedLabels: labels };

      const qualityMetrics = computeSyntheticQuality(dataRows, sampleAug.syntheticData, numericIndices, categoricalIndices);

      // Reconstruct full rows with Target column for downloadable CSVs
      const augmentedFullRows = sampleAug.augmentedData.map((row, rIdx) => {
        const fullRow = [...row];
        fullRow.splice(targetIndex, 0, sampleAug.augmentedLabels[rIdx]);
        return fullRow;
      });

      const syntheticFullRows = (sampleAug.syntheticData || []).map((row, rIdx) => {
        const fullRow = [...row];
        fullRow.splice(targetIndex, 0, sampleAug.syntheticLabels[rIdx]);
        return fullRow;
      });

      const augmentedCSV = generateCSV(headers, augmentedFullRows);
      const syntheticCSV = generateCSV(headers, syntheticFullRows);

      // Run controlled evaluation on training splits
      const evalResult = await runControlledEvaluation({
        data: dataRows,
        labels,
        numericIndices,
        categoricalIndices,
        idIndices,
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
        augmentedRowCount: augmentedFullRows.length,
        augmentedCSV,
        syntheticCSV,
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

