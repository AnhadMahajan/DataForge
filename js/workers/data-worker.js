/**
 * DataForge — Data Processing Web Worker
 * Handles all heavy computation off the main thread:
 * - CSV validation & type inference
 * - Data cleaning & imputation
 * - Dataset analysis & profiling
 * - Experiment execution (augmentation + evaluation)
 * - Synthetic data generation
 *
 * Communication protocol:
 *   IN:  { taskId, task, payload }
 *   OUT: { taskId, type: 'progress'|'result'|'error', ... }
 */

import { parseCSV, generateCSV } from '../utils/csv.js';
import {
  mean, std, min, max, median, skewness, mode,
  detectOutliers, detectDistribution, pearsonCorrelation,
  generateUUID, createRNG,
} from '../utils/math.js';
import { analyzeDataset } from '../services/analysis.js';
import {
  applySMOTE,
  applyADASYN,
  applySMOTETomek,
  applyRandomOversampling,
  applyNoiseInjection,
  computeSyntheticQuality,
} from '../services/augmentation.js';
import { runControlledEvaluation, compareEvaluations } from '../services/evaluation.js';
import { generateRecommendation } from '../services/recommendations.js';
import { synthesizeDataset } from '../services/synthesizer.js';
import { computeKolmogorovSmirnov, computeWassersteinDistance } from '../utils/math.js';

// ---- Progress Helper ----
function sendProgress(taskId, stage, percent) {
  self.postMessage({ taskId, type: 'progress', stage, percent });
}

function sendResult(taskId, data) {
  self.postMessage({ taskId, type: 'result', data });
}

function sendError(taskId, message) {
  self.postMessage({ taskId, type: 'error', message });
}

// ---- Task Router ----
self.onmessage = async function (e) {
  const { taskId, task, payload } = e.data;

  try {
    switch (task) {
      case 'parse_csv':
        handleParseCSV(taskId, payload);
        break;

      case 'analyze':
        handleAnalyze(taskId, payload);
        break;

      case 'run_experiment':
        await handleRunExperiment(taskId, payload);
        break;

      case 'synthesize':
        await handleSynthesize(taskId, payload);
        break;

      case 'validate':
        handleValidate(taskId, payload);
        break;

      case 'clean':
        handleClean(taskId, payload);
        break;

      default:
        sendError(taskId, `Unknown task: ${task}`);
    }
  } catch (err) {
    console.error(`[Worker] Task "${task}" failed:`, err);
    sendError(taskId, err.message || 'Worker task failed');
  }
};

// ---- Task Handlers ----

/**
 * Parse a CSV string and return structured data with type inference.
 */
function handleParseCSV(taskId, { csvText, options }) {
  sendProgress(taskId, 'Parsing CSV...', 10);
  const result = parseCSV(csvText, options);
  if (!result.success) {
    sendError(taskId, result.error.message || 'CSV parsing failed');
    return;
  }
  sendProgress(taskId, 'CSV parsed successfully', 100);
  sendResult(taskId, result.data);
}

/**
 * Run full dataset analysis (correlations, imbalance, outliers, etc.)
 */
function handleAnalyze(taskId, { dataset }) {
  sendProgress(taskId, 'Analyzing dataset...', 20);
  const analysis = analyzeDataset(dataset);
  sendProgress(taskId, 'Analysis complete', 100);
  sendResult(taskId, analysis);
}

/**
 * Validate dataset for pipeline readiness.
 */
function handleValidate(taskId, { dataset }) {
  sendProgress(taskId, 'Validating dataset...', 10);
  const issues = [];
  const { headers, fullData, columns, targetColumn, analysisResult } = dataset;

  // Check minimum rows
  if (!fullData || fullData.length < 10) {
    issues.push({ severity: 'error', message: `Dataset has only ${fullData?.length || 0} rows. Minimum 10 required.` });
  }

  // Check target column exists
  const targetIndex = headers.indexOf(targetColumn);
  if (targetIndex === -1) {
    issues.push({ severity: 'error', message: `Target column "${targetColumn}" not found in dataset headers.` });
  }

  // Check at least 2 classes in target
  if (targetIndex !== -1 && fullData) {
    const uniqueClasses = new Set(fullData.map(r => String(r[targetIndex] ?? '')).filter(v => v !== ''));
    if (uniqueClasses.size < 2) {
      issues.push({ severity: 'error', message: `Target column "${targetColumn}" has only ${uniqueClasses.size} unique class(es). Need at least 2 for classification.` });
    }
  }

  // Check for at least 1 non-ID numeric feature
  const idIndices = analysisResult?.idIndices || [];
  const numericFeatures = columns
    .map((c, idx) => ({ ...c, idx }))
    .filter(c => c.type === 'numeric' && c.idx !== targetIndex && !idIndices.includes(c.idx));
  
  if (numericFeatures.length === 0) {
    issues.push({ severity: 'error', message: 'No numeric features found (excluding ID columns and target). Need at least 1 numeric feature for ML evaluation.' });
  }

  // Check for columns that are 100% missing
  const emptyColumns = columns.filter(c => (c.stats.nullCount || 0) >= (fullData?.length || 1));
  if (emptyColumns.length > 0) {
    const names = emptyColumns.map(c => c.name).join(', ');
    issues.push({ severity: 'warning', message: `Columns with 100% missing values: ${names}. These will be excluded from processing.` });
  }

  // Check for zero-variance numeric columns
  const zeroVarCols = numericFeatures.filter(c => (c.stats.std === 0 || c.stats.std === undefined));
  if (zeroVarCols.length > 0) {
    const names = zeroVarCols.map(c => c.name).join(', ');
    issues.push({ severity: 'warning', message: `Zero-variance numeric columns detected: ${names}. These will be excluded from distance calculations.` });
  }

  // Check for very high cardinality categorical columns (>50 unique values)
  const highCardCols = columns
    .filter(c => c.type !== 'numeric' && c.stats.uniqueCount > 50)
    .map(c => c.name);
  if (highCardCols.length > 0) {
    issues.push({ severity: 'warning', message: `High cardinality categorical columns: ${highCardCols.join(', ')}. These may slow encoding and reduce model quality.` });
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  sendProgress(taskId, 'Validation complete', 100);
  sendResult(taskId, { valid: !hasErrors, issues });
}

/**
 * Clean dataset: impute missing, handle zero-variance, drop empty columns.
 */
function handleClean(taskId, { dataset }) {
  sendProgress(taskId, 'Cleaning dataset...', 10);
  
  const { headers, fullData, columns, targetColumn } = dataset;
  const targetIndex = headers.indexOf(targetColumn);
  const cleanLog = [];
  
  // Deep clone the data
  const cleanedData = fullData.map(row => [...row]);
  
  // 1. Impute missing values
  sendProgress(taskId, 'Imputing missing values...', 30);
  columns.forEach((col, colIdx) => {
    if (colIdx === targetIndex) return;
    
    const missingIndices = [];
    cleanedData.forEach((row, rowIdx) => {
      const val = row[colIdx];
      if (val === null || val === undefined || val === '' || 
          (typeof val === 'string' && (val.toLowerCase() === 'nan' || val.toLowerCase() === 'null'))) {
        missingIndices.push(rowIdx);
      }
    });
    
    if (missingIndices.length === 0) return;
    
    if (col.type === 'numeric') {
      // Impute with median
      const numericVals = cleanedData
        .map(r => r[colIdx])
        .filter(v => v !== null && v !== undefined && v !== '' && typeof v === 'number' && !isNaN(v));
      const medianVal = numericVals.length > 0 ? median(numericVals) : 0;
      
      missingIndices.forEach(rowIdx => {
        cleanedData[rowIdx][colIdx] = medianVal;
      });
      cleanLog.push(`Imputed ${missingIndices.length} missing values in "${col.name}" with median (${medianVal})`);
    } else {
      // Impute with mode
      const catVals = cleanedData
        .map(r => r[colIdx])
        .filter(v => v !== null && v !== undefined && v !== '' && String(v).toLowerCase() !== 'nan');
      const modeVal = catVals.length > 0 ? mode(catVals.map(String)) : 'UNKNOWN';
      
      missingIndices.forEach(rowIdx => {
        cleanedData[rowIdx][colIdx] = modeVal;
      });
      cleanLog.push(`Imputed ${missingIndices.length} missing values in "${col.name}" with mode ("${modeVal}")`);
    }
  });
  
  // 2. Drop rows where target is missing
  sendProgress(taskId, 'Cleaning target column...', 60);
  const validRows = [];
  let droppedTargetRows = 0;
  cleanedData.forEach(row => {
    const targetVal = row[targetIndex];
    if (targetVal === null || targetVal === undefined || targetVal === '' ||
        (typeof targetVal === 'string' && (targetVal.toLowerCase() === 'nan' || targetVal.toLowerCase() === 'null'))) {
      droppedTargetRows++;
    } else {
      validRows.push(row);
    }
  });
  if (droppedTargetRows > 0) {
    cleanLog.push(`Dropped ${droppedTargetRows} rows with missing target values`);
  }
  
  sendProgress(taskId, 'Cleaning complete', 100);
  sendResult(taskId, {
    cleanedData: validRows,
    cleanLog,
    originalRowCount: fullData.length,
    cleanedRowCount: validRows.length,
  });
}

/**
 * Run a full controlled experiment pipeline off the main thread.
 */
async function handleRunExperiment(taskId, {
  dataset, strategies, strategyParams, runs, trainTestSplit, modelType, baseSeed
}) {
  const { headers, columns, fullData, targetColumn, analysisResult } = dataset;
  const targetIndex = headers.indexOf(targetColumn);

  // Extract raw rows & labels
  const dataRows = fullData.map(r => r.filter((_, idx) => idx !== targetIndex));
  const labels = fullData.map(r => String(r[targetIndex] ?? 'UNKNOWN'));

  const featureHeaders = headers.filter((_, idx) => idx !== targetIndex);
  const numericIndices = [];
  const categoricalIndices = [];
  const idIndices = [];

  let colCounter = 0;
  headers.forEach((_, idx) => {
    if (idx !== targetIndex) {
      const col = columns[idx];
      const isId = analysisResult?.idIndices?.includes(idx);
      if (isId) idIndices.push(colCounter);
      if (col.type === 'numeric') numericIndices.push(colCounter);
      else categoricalIndices.push(colCounter);
      colCounter++;
    }
  });

  // Stage 1: Baseline
  sendProgress(taskId, 'Training baseline model on unaugmented data...', 15);
  const baseline = await runControlledEvaluation({
    data: dataRows, labels, numericIndices, categoricalIndices, idIndices,
    augmentFn: null, runs, trainTestSplit, modelType, baseSeed,
  });

  // Stage 2: Strategy evaluation
  const strategyResults = [];
  const stepSize = 65 / (strategies.length || 1);
  let currentProgress = 20;

  for (let i = 0; i < strategies.length; i++) {
    const stratType = strategies[i];
    sendProgress(taskId, `Evaluating strategy: ${stratType.toUpperCase()}...`, Math.round(currentProgress));

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

    // Generate synthetic samples
    const sampleAug = augmentFn
      ? augmentFn(dataRows, labels, numericIndices, { seed: baseSeed, categoricalIndices })
      : { syntheticData: [], syntheticLabels: [], augmentedData: dataRows, augmentedLabels: labels };

    const qualityMetrics = computeSyntheticQuality(dataRows, sampleAug.syntheticData, numericIndices, categoricalIndices);

    // Reconstruct full rows with target column
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

    // Run controlled evaluation
    const evalResult = await runControlledEvaluation({
      data: dataRows, labels, numericIndices, categoricalIndices, idIndices,
      augmentFn, runs, trainTestSplit, modelType, baseSeed,
    });

    const comparison = compareEvaluations(baseline, evalResult);

    // Feature drift metrics
    const featureDrift = [];
    numericIndices.forEach(fIdx => {
      const featName = featureHeaders[fIdx] || `Feature_${fIdx}`;
      const origVals = dataRows.map(r => Number(r[fIdx])).filter(v => !isNaN(v));
      const synthVals = (sampleAug.syntheticData || []).map(r => Number(r[fIdx])).filter(v => !isNaN(v));

      const origM = origVals.length > 0 ? mean(origVals) : 0;
      const origS = origVals.length > 1 ? std(origVals) : 1;
      const synthM = synthVals.length > 0 ? mean(synthVals) : origM;
      const synthS = synthVals.length > 1 ? std(synthVals) : origS;

      const ks = computeKolmogorovSmirnov(origVals, synthVals);
      const w1 = computeWassersteinDistance(origVals, synthVals);

      featureDrift.push({
        featureName: featName, featureIndex: fIdx,
        originalMean: Number(origM.toFixed(2)), originalStd: Number(origS.toFixed(2)),
        syntheticMean: Number(synthM.toFixed(2)), syntheticStd: Number(synthS.toFixed(2)),
        ksStatistic: ks.statistic, driftSeverity: ks.driftSeverity,
        wassersteinDistance: w1,
      });
    });

    strategyResults.push({
      strategyType: stratType, strategyParams: params,
      evaluation: evalResult, comparison, qualityMetrics, featureDrift,
      syntheticData: sampleAug.syntheticData || [],
      syntheticCount: sampleAug.syntheticCount || 0,
      augmentedRowCount: augmentedFullRows.length,
      augmentedCSV, syntheticCSV,
    });

    currentProgress += stepSize;
  }

  // Stage 3: Recommendation
  sendProgress(taskId, 'Synthesizing statistical recommendations...', 90);
  const recommendation = generateRecommendation(dataset, baseline, strategyResults);

  sendProgress(taskId, 'Experiment completed.', 100);
  sendResult(taskId, { baseline, strategyResults, recommendation });
}

/**
 * Run synthetic data generation off the main thread.
 */
async function handleSynthesize(taskId, params) {
  const result = await synthesizeDataset({
    ...params,
    onProgress: (stage, pct) => sendProgress(taskId, stage, pct),
  });
  sendResult(taskId, result);
}
