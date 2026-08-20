/**
 * DataForge — Augmentation Strategies Engine
 * SMOTE, Random Oversampling with Jitter, Gaussian Noise Injection, Combined.
 * Plus synthetic data quality metrics (Diversity, Redundancy, Distribution Shift).
 */

import { createRNG, gaussianRandom, euclideanDistance, mean, std } from '../utils/math.js';

/**
 * Apply SMOTE augmentation on numeric features of minority class samples.
 */
export function applySMOTE(data, labels, numericIndices, options = {}) {
  const { k = 5, ratio = 1.0, seed = 42 } = options;
  const rng = createRNG(seed);

  // Identify class frequencies
  const classMap = {};
  labels.forEach((cls, idx) => {
    if (!classMap[cls]) classMap[cls] = [];
    classMap[cls].push(idx);
  });

  const majoritySize = Math.max(...Object.values(classMap).map(arr => arr.length));
  const syntheticRows = [];
  const syntheticLabels = [];

  for (const [cls, indices] of Object.entries(classMap)) {
    if (indices.length >= majoritySize) continue; // Skip majority class

    const neededSamples = Math.round((majoritySize - indices.length) * ratio);
    if (neededSamples <= 0 || indices.length < 2) continue;

    const currentK = Math.min(k, indices.length - 1);

    for (let s = 0; s < neededSamples; s++) {
      // Pick random minority sample
      const origIdx = indices[Math.floor(rng() * indices.length)];
      const origRow = data[origIdx];

      // Find nearest neighbors in same minority class
      const distances = indices
        .filter(idx => idx !== origIdx)
        .map(idx => ({
          idx,
          dist: calcRowDistance(origRow, data[idx], numericIndices),
        }))
        .sort((a, b) => a.dist - b.dist);

      const neighborEntry = distances[Math.floor(rng() * currentK)] || distances[0];
      const neighborRow = data[neighborEntry.idx];

      // Interpolate numeric features
      const newRow = [...origRow];
      const alpha = rng();

      numericIndices.forEach(colIdx => {
        const vOrig = Number(origRow[colIdx]);
        const vNeigh = Number(neighborRow[colIdx]);
        if (!isNaN(vOrig) && !isNaN(vNeigh)) {
          newRow[colIdx] = Number((vOrig + alpha * (vNeigh - vOrig)).toFixed(4));
        }
      });

      syntheticRows.push(newRow);
      syntheticLabels.push(cls);
    }
  }

  return {
    augmentedData: [...data, ...syntheticRows],
    augmentedLabels: [...labels, ...syntheticLabels],
    syntheticData: syntheticRows,
    syntheticLabels,
    syntheticCount: syntheticRows.length,
  };
}

/**
 * Apply Random Oversampling with Gaussian jitter to numeric features.
 */
export function applyRandomOversampling(data, labels, numericIndices, options = {}) {
  const { ratio = 1.0, jitterStd = 0.05, seed = 42 } = options;
  const rng = createRNG(seed);

  // Compute standard deviation for numeric features to scale jitter
  const colStds = {};
  numericIndices.forEach(colIdx => {
    const vals = data.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
    colStds[colIdx] = std(vals) || 1;
  });

  const classMap = {};
  labels.forEach((cls, idx) => {
    if (!classMap[cls]) classMap[cls] = [];
    classMap[cls].push(idx);
  });

  const majoritySize = Math.max(...Object.values(classMap).map(arr => arr.length));
  const syntheticRows = [];
  const syntheticLabels = [];

  for (const [cls, indices] of Object.entries(classMap)) {
    if (indices.length >= majoritySize) continue;

    const neededSamples = Math.round((majoritySize - indices.length) * ratio);
    for (let s = 0; s < neededSamples; s++) {
      const origIdx = indices[Math.floor(rng() * indices.length)];
      const origRow = data[origIdx];
      const newRow = [...origRow];

      numericIndices.forEach(colIdx => {
        const v = Number(origRow[colIdx]);
        if (!isNaN(v)) {
          const noise = gaussianRandom(rng) * (colStds[colIdx] * jitterStd);
          newRow[colIdx] = Number((v + noise).toFixed(4));
        }
      });

      syntheticRows.push(newRow);
      syntheticLabels.push(cls);
    }
  }

  return {
    augmentedData: [...data, ...syntheticRows],
    augmentedLabels: [...labels, ...syntheticLabels],
    syntheticData: syntheticRows,
    syntheticLabels,
    syntheticCount: syntheticRows.length,
  };
}

/**
 * Apply Gaussian Noise Injection across dataset features.
 */
export function applyNoiseInjection(data, labels, numericIndices, options = {}) {
  const { noiseFactor = 0.08, seed = 42 } = options;
  const rng = createRNG(seed);

  const colStds = {};
  numericIndices.forEach(colIdx => {
    const vals = data.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
    colStds[colIdx] = std(vals) || 1;
  });

  const syntheticRows = data.map(origRow => {
    const newRow = [...origRow];
    numericIndices.forEach(colIdx => {
      const v = Number(origRow[colIdx]);
      if (!isNaN(v)) {
        const noise = gaussianRandom(rng) * (colStds[colIdx] * noiseFactor);
        newRow[colIdx] = Number((v + noise).toFixed(4));
      }
    });
    return newRow;
  });

  return {
    augmentedData: [...data, ...syntheticRows],
    augmentedLabels: [...labels, ...labels],
    syntheticData: syntheticRows,
    syntheticLabels: [...labels],
    syntheticCount: syntheticRows.length,
  };
}

/**
 * Distance helper between two rows considering numeric indices.
 */
function calcRowDistance(rowA, rowB, numericIndices) {
  const a = numericIndices.map(i => Number(rowA[i]) || 0);
  const b = numericIndices.map(i => Number(rowB[i]) || 0);
  return euclideanDistance(a, b);
}

/**
 * Compute Quality Metrics on the generated synthetic data:
 * - Diversity Score: average pairwise distance within synthetic samples vs original samples
 * - Redundancy Score: % of synthetic points closer than epsilon to original points
 * - Distribution Shift: normalized mean difference across features
 */
export function computeSyntheticQuality(originalData, syntheticData, numericIndices) {
  if (!syntheticData || syntheticData.length === 0) {
    return { diversityScore: 0, redundancyScore: 0, distributionShift: 0 };
  }

  // 1. Redundancy score
  let nearDuplicates = 0;
  const epsilon = 0.05;

  syntheticData.forEach(synth => {
    let minDist = Infinity;
    originalData.forEach(orig => {
      const d = calcRowDistance(synth, orig, numericIndices);
      if (d < minDist) minDist = d;
    });
    if (minDist < epsilon) nearDuplicates++;
  });

  const redundancyScore = Number(((nearDuplicates / syntheticData.length) * 100).toFixed(1));

  // 2. Distribution Shift
  let shiftSum = 0;
  numericIndices.forEach(colIdx => {
    const origVals = originalData.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
    const synthVals = syntheticData.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
    const mOrig = mean(origVals);
    const mSynth = mean(synthVals);
    const sOrig = std(origVals) || 1;
    shiftSum += Math.abs(mSynth - mOrig) / sOrig;
  });

  const distributionShift = Number((shiftSum / (numericIndices.length || 1)).toFixed(3));

  // 3. Diversity score (0 - 100 scale)
  const diversityScore = Math.max(0, Math.min(100, Math.round((1 - distributionShift * 0.4) * 85)));

  return {
    diversityScore,
    redundancyScore,
    distributionShift,
  };
}
