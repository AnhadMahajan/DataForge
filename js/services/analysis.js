/**
 * DataForge — Dataset Analysis Engine
 * Calculates class imbalance ratios, feature distributions, outlier counts,
 * correlation pairs, noise estimates, and the composite Augmentation Need Score.
 */

import {
  mean,
  std,
  min,
  max,
  detectDistribution,
  detectOutliers,
  pearsonCorrelation,
} from '../utils/math.js';

export function analyzeDataset(dataset) {
  const { headers, columns, fullData, targetColumn, classDistribution, rowCount } = dataset;
  const targetIndex = headers.indexOf(targetColumn);

  // 1. Class Imbalance Analysis
  let imbalanceRatio = 1;
  let imbalanceSeverity = 'none';
  let minClass = null;
  let maxClass = null;
  let minCount = Infinity;
  let maxCount = -Infinity;

  if (classDistribution && Object.keys(classDistribution).length > 1) {
    const counts = Object.values(classDistribution);
    minCount = Math.min(...counts);
    maxCount = Math.max(...counts);
    imbalanceRatio = Number((maxCount / (minCount || 1)).toFixed(2));

    for (const [cls, count] of Object.entries(classDistribution)) {
      if (count === minCount) minClass = cls;
      if (count === maxCount) maxClass = cls;
    }

    if (imbalanceRatio > 10) imbalanceSeverity = 'severe';
    else if (imbalanceRatio >= 3) imbalanceSeverity = 'moderate';
    else if (imbalanceRatio >= 1.5) imbalanceSeverity = 'mild';
    else imbalanceSeverity = 'none';
  }

  // 2. Feature-level Analysis & Noise Estimation
  const featureAnalysis = [];
  const numericIndices = [];
  const categoricalIndices = [];
  const idIndices = [];
  const missingColumns = [];

  const idPattern = /^(id|_id|uuid|guid|pk|ssn|email|index|key|identifier|client_id|customer_id|user_id|order_id|patient_id)$/i;

  columns.forEach((col, colIdx) => {
    if (colIdx === targetIndex) return;

    const rawVals = fullData.map(r => r[colIdx]);
    const nonNullVals = rawVals.filter(v => v !== null && v !== undefined && v !== '' && String(v).toLowerCase() !== 'nan');
    const missingCount = rowCount - nonNullVals.length;
    const missingPercentage = Number(((missingCount / (rowCount || 1)) * 100).toFixed(1));

    if (missingCount > 0) {
      missingColumns.push({
        columnName: col.name,
        columnIndex: colIdx,
        missingCount,
        missingPercentage,
      });
    }

    // Check for ID column characteristics
    const uniqueVals = new Set(nonNullVals);
    const uniqueRatio = uniqueVals.size / (nonNullVals.length || 1);
    const isIdByName = idPattern.test(col.name.trim().toLowerCase());
    const isIdByCardinality = uniqueRatio > 0.95 && rowCount >= 20 && col.type !== 'numeric';
    
    // Check if numeric column is integer-sequential (1,2,3... or 0,1,2...)
    let isIdBySequence = false;
    if (col.type === 'numeric' && uniqueRatio > 0.98 && nonNullVals.length >= 20) {
      const nums = nonNullVals.map(Number).filter(v => !isNaN(v));
      if (nums.length === nonNullVals.length && nums.every(v => Number.isInteger(v))) {
        const sorted = [...nums].sort((a, b) => a - b);
        const isSeq = sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
        if (isSeq || isIdByName) isIdBySequence = true;
      }
    }
    const isIdColumn = isIdByName || isIdByCardinality || isIdBySequence;

    if (isIdColumn) {
      idIndices.push(colIdx);
    }

    if (col.type === 'numeric') {
      numericIndices.push(colIdx);
      const values = nonNullVals.map(Number).filter(v => !isNaN(v));

      const distribution = values.length > 0 ? detectDistribution(values) : 'unknown';
      const outlierRes = values.length > 0 ? detectOutliers(values) : { count: 0, outliers: [] };
      const outlierPercentage = Number(((outlierRes.count / (values.length || 1)) * 100).toFixed(1));

      // Noise estimate: ratio of standard deviation to range normalized
      const r = values.length > 0 ? (max(values) - min(values)) : 0;
      const s = values.length > 1 ? std(values) : 0;
      const noiseEstimate = r > 0 ? Number(Math.min(1, (s / r) * 1.5).toFixed(2)) : 0;

      featureAnalysis.push({
        columnName: col.name,
        columnIndex: colIdx,
        type: 'numeric',
        isIdColumn,
        distribution,
        outlierCount: outlierRes.count,
        outlierPercentage,
        missingCount,
        missingPercentage,
        noiseEstimate,
      });
    } else {
      categoricalIndices.push(colIdx);
      featureAnalysis.push({
        columnName: col.name,
        columnIndex: colIdx,
        type: 'categorical',
        isIdColumn,
        distribution: 'categorical',
        outlierCount: 0,
        outlierPercentage: 0,
        missingCount,
        missingPercentage,
        uniqueCount: uniqueVals.size,
        noiseEstimate: 0,
      });
    }
  });

  // 3. Feature Correlations
  const correlations = [];
  for (let i = 0; i < numericIndices.length; i++) {
    for (let j = i + 1; j < numericIndices.length; j++) {
      const idx1 = numericIndices[i];
      const idx2 = numericIndices[j];
      const vals1 = [];
      const vals2 = [];

      fullData.forEach(r => {
        const v1 = Number(r[idx1]);
        const v2 = Number(r[idx2]);
        if (!isNaN(v1) && !isNaN(v2) && r[idx1] !== null && r[idx2] !== null) {
          vals1.push(v1);
          vals2.push(v2);
        }
      });

      if (vals1.length > 2) {
        const rawCoeff = pearsonCorrelation(vals1, vals2);
        const rCoeff = Number((isNaN(rawCoeff) ? 0 : rawCoeff).toFixed(3));
        correlations.push({
          feature1: headers[idx1],
          feature2: headers[idx2],
          coefficient: rCoeff,
          isHigh: Math.abs(rCoeff) > 0.85,
        });
      }
    }
  }

  // 4. Augmentation Need Score (0 - 100)
  // Weighted: Imbalance severity (50%), Dataset scarcity (25%), Noise/outliers (25%)
  let score = 0;
  const reasons = [];
  const warnings = [];

  // Imbalance component
  if (imbalanceSeverity === 'severe') {
    score += 50;
    reasons.push(`Severe class imbalance detected (${imbalanceRatio}:1 ratio between "${maxClass}" and "${minClass}"). Synthetic oversampling or SMOTE strongly recommended.`);
  } else if (imbalanceSeverity === 'moderate') {
    score += 35;
    reasons.push(`Moderate class imbalance detected (${imbalanceRatio}:1 ratio). Minority class "${minClass}" represents only ${minCount} samples.`);
  } else if (imbalanceSeverity === 'mild') {
    score += 15;
    reasons.push(`Mild imbalance ratio (${imbalanceRatio}:1). Augmentation may offer marginal gains.`);
  } else {
    reasons.push('Dataset classes are approximately balanced.');
  }

  // Sample size scarcity component
  if (rowCount < 150) {
    score += 25;
    reasons.push(`Small sample size (${rowCount} rows). Data augmentation can expand decision boundary support.`);
  } else if (rowCount < 500) {
    score += 15;
    reasons.push(`Moderate sample size (${rowCount} rows).`);
  } else {
    score += 5;
  }

  // ID column warnings
  if (idIndices.length > 0) {
    const idNames = idIndices.map(idx => headers[idx]).join(', ');
    reasons.push(`Identifier column(s) detected (${idNames}) — automatically excluded from ML distance metrics to prevent trivial overfitting.`);
  }

  // Missing data warnings
  if (missingColumns.length > 0) {
    const missingNames = missingColumns.map(m => `${m.columnName} (${m.missingPercentage}%)`).join(', ');
    warnings.push(`Missing values detected in: ${missingNames}. Engine automatically performs median/mode imputation during feature synthesis.`);
  }

  // Outlier / Noise warnings
  const highOutlierFeatures = featureAnalysis.filter(f => f.outlierPercentage > 5 && !f.isIdColumn);
  if (highOutlierFeatures.length > 0) {
    score += 10;
    const names = highOutlierFeatures.map(f => f.columnName).join(', ');
    warnings.push(`High outlier density in ${names}. Interpolative techniques (SMOTE) may synthesize samples near outliers.`);
  }

  const highCorrelations = correlations.filter(c => c.isHigh);
  if (highCorrelations.length > 0) {
    const pairNames = highCorrelations.map(c => `${c.feature1} & ${c.feature2} (r=${c.coefficient})`).join('; ');
    warnings.push(`Strong collinearity detected in: ${pairNames}. Perturbation strategies should preserve feature covariance.`);
  }

  const augmentationNeedScore = Math.min(100, Math.max(0, Math.round(score)));

  return {
    datasetId: dataset.id,
    analyzedAt: new Date().toISOString(),
    imbalanceRatio,
    imbalanceSeverity,
    minClass,
    maxClass,
    minCount,
    maxCount,
    numericIndices,
    categoricalIndices,
    idIndices,
    missingColumns,
    featureAnalysis,
    correlations,
    augmentationNeedScore,
    augmentationReasons: reasons,
    warnings,
  };
}
