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

  columns.forEach((col, colIdx) => {
    if (colIdx === targetIndex) return;

    if (col.type === 'numeric') {
      numericIndices.push(colIdx);
      const values = fullData
        .map(r => r[colIdx])
        .filter(v => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v));

      const distribution = detectDistribution(values);
      const outlierRes = detectOutliers(values);
      const missingCount = rowCount - values.length;
      const missingPercentage = Number(((missingCount / (rowCount || 1)) * 100).toFixed(1));
      const outlierPercentage = Number(((outlierRes.count / (values.length || 1)) * 100).toFixed(1));

      // Noise estimate: ratio of standard deviation to range normalized
      const r = max(values) - min(values);
      const s = std(values);
      const noiseEstimate = r > 0 ? Number(Math.min(1, (s / r) * 1.5).toFixed(2)) : 0;

      featureAnalysis.push({
        columnName: col.name,
        columnIndex: colIdx,
        type: 'numeric',
        distribution,
        outlierCount: outlierRes.count,
        outlierPercentage,
        missingCount,
        missingPercentage,
        noiseEstimate,
      });
    } else {
      featureAnalysis.push({
        columnName: col.name,
        columnIndex: colIdx,
        type: 'categorical',
        distribution: 'categorical',
        outlierCount: 0,
        outlierPercentage: 0,
        missingCount: col.stats.nullCount || 0,
        missingPercentage: Number((((col.stats.nullCount || 0) / (rowCount || 1)) * 100).toFixed(1)),
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
        const v1 = r[idx1];
        const v2 = r[idx2];
        if (typeof v1 === 'number' && typeof v2 === 'number' && !isNaN(v1) && !isNaN(v2)) {
          vals1.push(v1);
          vals2.push(v2);
        }
      });

      if (vals1.length > 2) {
        const rCoeff = Number(pearsonCorrelation(vals1, vals2).toFixed(3));
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

  // Outlier / Noise warnings
  const highOutlierFeatures = featureAnalysis.filter(f => f.outlierPercentage > 5);
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
    featureAnalysis,
    correlations,
    augmentationNeedScore,
    augmentationReasons: reasons,
    warnings,
  };
}
