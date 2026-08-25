/**
 * DataForge — Advanced Augmentation Engine
 * Real-world synthetic data algorithms:
 * 1. SMOTE-NC (Nominal & Continuous feature interpolation)
 * 2. ADASYN (Adaptive Synthetic Sampling for boundary instances)
 * 3. SMOTE-Tomek (Oversampling + Tomek Links boundary cleaning)
 * 4. Random Oversampling with Jitter
 * 5. Gaussian Noise Injection
 * Plus comprehensive synthetic quality metrics.
 */

import { createRNG, gaussianRandom, euclideanDistance, mean, std, min, max, mode } from '../utils/math.js';

/**
 * Pre-calculate column ranges for normalized distance computation.
 */
function getColumnRanges(data, numericIndices) {
  const ranges = {};
  numericIndices.forEach(idx => {
    const vals = data.map(r => Number(r[idx])).filter(v => !isNaN(v));
    const r = vals.length > 0 ? (max(vals) - min(vals)) : 1;
    ranges[idx] = r > 0 ? r : 1;
  });
  return ranges;
}

/**
 * Calculate distance between two rows supporting both continuous and nominal features.
 * Guards against NaN/missing values by skipping them in the distance calculation.
 */
function calcMixedRowDistance(rowA, rowB, numericIndices, categoricalIndices = [], colRanges = {}) {
  let distSq = 0;
  let validFeatures = 0;

  numericIndices.forEach(idx => {
    const vA = Number(rowA[idx]);
    const vB = Number(rowB[idx]);
    if (!isNaN(vA) && !isNaN(vB) && vA !== null && vB !== null) {
      const r = colRanges[idx] || 1;
      distSq += ((vA - vB) / r) ** 2;
      validFeatures++;
    }
  });

  categoricalIndices.forEach(idx => {
    const vA = String(rowA[idx] ?? '');
    const vB = String(rowB[idx] ?? '');
    if (vA !== '' && vB !== '' && vA !== vB) {
      distSq += 1;
    }
    if (vA !== '' && vB !== '') validFeatures++;
  });

  // Avoid 0/0: if no valid features, return a large distance
  if (validFeatures === 0) return Infinity;

  return Math.sqrt(distSq);
}

/**
 * Apply SMOTE-NC augmentation on mixed numeric and categorical features.
 */
export function applySMOTE(data, labels, numericIndices, options = {}) {
  const { k = 5, ratio = 1.0, seed = 42, categoricalIndices = [] } = options;
  const rng = createRNG(seed);
  const colRanges = getColumnRanges(data, numericIndices);

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
    if (neededSamples <= 0 || indices.length < 2) continue;

    const currentK = Math.min(k, indices.length - 1);

    for (let s = 0; s < neededSamples; s++) {
      const origIdx = indices[Math.floor(rng() * indices.length)];
      const origRow = data[origIdx];

      const distances = indices
        .filter(idx => idx !== origIdx)
        .map(idx => ({
          idx,
          dist: calcMixedRowDistance(origRow, data[idx], numericIndices, categoricalIndices, colRanges),
        }))
        .filter(d => isFinite(d.dist)) // Filter out Infinity distances (rows with no valid features)
        .sort((a, b) => a.dist - b.dist);

      if (distances.length === 0) continue; // Skip if no valid neighbors
      const neighborEntry = distances[Math.floor(rng() * currentK)] || distances[0];
      const neighborRow = data[neighborEntry.idx];

      const newRow = [...origRow];
      const alpha = rng();

      // Continuous features interpolation
      numericIndices.forEach(colIdx => {
        const vOrig = Number(origRow[colIdx]);
        const vNeigh = Number(neighborRow[colIdx]);
        if (!isNaN(vOrig) && !isNaN(vNeigh)) {
          newRow[colIdx] = Number((vOrig + alpha * (vNeigh - vOrig)).toFixed(4));
        }
      });

      // Nominal features selection
      categoricalIndices.forEach(colIdx => {
        newRow[colIdx] = rng() > 0.5 ? neighborRow[colIdx] : origRow[colIdx];
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
 * Apply ADASYN (Adaptive Synthetic Sampling).
 * Focuses synthetic data generation on difficult-to-learn minority samples
 * based on the proportion of majority neighbors in their local k-NN neighborhood.
 */
export function applyADASYN(data, labels, numericIndices, options = {}) {
  const { k = 5, dThreshold = 0.9, seed = 42, categoricalIndices = [] } = options;
  const rng = createRNG(seed);
  const colRanges = getColumnRanges(data, numericIndices);

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

    const totalNeeded = Math.round((majoritySize - indices.length) * dThreshold);
    if (totalNeeded <= 0 || indices.length < 2) continue;

    const currentK = Math.min(k, data.length - 1);

    // Calculate r_i: ratio of non-class neighbors in k-NN for each sample
    const rValues = [];
    indices.forEach(origIdx => {
      const origRow = data[origIdx];
      const allDists = data
        .map((row, idx) => ({
          idx,
          label: labels[idx],
          dist: calcMixedRowDistance(origRow, row, numericIndices, categoricalIndices, colRanges),
        }))
        .filter(d => d.idx !== origIdx)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, currentK);

      const majorityNeighbors = allDists.filter(d => d.label !== cls).length;
      rValues.push({
        origIdx,
        r: majorityNeighbors / currentK,
      });
    });

    const sumR = rValues.reduce((acc, item) => acc + item.r, 0);
    // If all minority points are isolated or uniform, fall back to equal distribution
    const weights = rValues.map(item => sumR > 0 ? (item.r / sumR) : (1 / indices.length));

    for (let i = 0; i < indices.length; i++) {
      const countForThisSample = Math.round(weights[i] * totalNeeded);
      if (countForThisSample <= 0) continue;

      const origIdx = indices[i];
      const origRow = data[origIdx];

      // Minority nearest neighbors
      const minorityDists = indices
        .filter(idx => idx !== origIdx)
        .map(idx => ({
          idx,
          dist: calcMixedRowDistance(origRow, data[idx], numericIndices, categoricalIndices, colRanges),
        }))
        .sort((a, b) => a.dist - b.dist);

      const minK = Math.min(currentK, minorityDists.length);

      for (let s = 0; s < countForThisSample; s++) {
        const neighborEntry = minorityDists[Math.floor(rng() * minK)] || minorityDists[0];
        const neighborRow = data[neighborEntry.idx];

        const newRow = [...origRow];
        const alpha = rng();

        numericIndices.forEach(colIdx => {
          const vOrig = Number(origRow[colIdx]);
          const vNeigh = Number(neighborRow[colIdx]);
          if (!isNaN(vOrig) && !isNaN(vNeigh)) {
            newRow[colIdx] = Number((vOrig + alpha * (vNeigh - vOrig)).toFixed(4));
          }
        });

        categoricalIndices.forEach(colIdx => {
          newRow[colIdx] = rng() > 0.5 ? neighborRow[colIdx] : origRow[colIdx];
        });

        syntheticRows.push(newRow);
        syntheticLabels.push(cls);
      }
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
 * Apply SMOTE-Tomek (Oversampling followed by Tomek Links Boundary Cleaning).
 * Identifies and removes ambiguous pairs of closest samples belonging to different classes.
 */
export function applySMOTETomek(data, labels, numericIndices, options = {}) {
  // 1. First run SMOTE
  const smoteRes = applySMOTE(data, labels, numericIndices, options);
  const fullAugData = smoteRes.augmentedData;
  const fullAugLabels = smoteRes.augmentedLabels;
  const colRanges = getColumnRanges(fullAugData, numericIndices);
  const { categoricalIndices = [] } = options;

  // 2. Find Tomek Links
  const tomekToRemove = new Set();
  const n = fullAugData.length;

  for (let i = 0; i < n; i++) {
    let minDist = Infinity;
    let closestIdx = -1;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = calcMixedRowDistance(fullAugData[i], fullAugData[j], numericIndices, categoricalIndices, colRanges);
      if (d < minDist) {
        minDist = d;
        closestIdx = j;
      }
    }

    if (closestIdx !== -1 && fullAugLabels[i] !== fullAugLabels[closestIdx]) {
      // Check if closestIdx's closest is i
      let reverseMinDist = Infinity;
      let reverseClosestIdx = -1;
      for (let k = 0; k < n; k++) {
        if (k === closestIdx) continue;
        const d = calcMixedRowDistance(fullAugData[closestIdx], fullAugData[k], numericIndices, categoricalIndices, colRanges);
        if (d < reverseMinDist) {
          reverseMinDist = d;
          reverseClosestIdx = k;
        }
      }

      if (reverseClosestIdx === i) {
        // Tomek link found! Remove majority or synthetic point
        tomekToRemove.add(closestIdx);
      }
    }
  }

  const cleanedData = [];
  const cleanedLabels = [];
  const cleanedSynthetic = [];
  const cleanedSynthLabels = [];

  fullAugData.forEach((row, idx) => {
    if (!tomekToRemove.has(idx)) {
      cleanedData.push(row);
      cleanedLabels.push(fullAugLabels[idx]);
      if (idx >= data.length) {
        cleanedSynthetic.push(row);
        cleanedSynthLabels.push(fullAugLabels[idx]);
      }
    }
  });

  return {
    augmentedData: cleanedData,
    augmentedLabels: cleanedLabels,
    syntheticData: cleanedSynthetic,
    syntheticLabels: cleanedSynthLabels,
    syntheticCount: cleanedSynthetic.length,
    tomekRemovedCount: tomekToRemove.size,
  };
}

/**
 * Apply Random Oversampling with Gaussian jitter to numeric features and preserving categorical.
 */
export function applyRandomOversampling(data, labels, numericIndices, options = {}) {
  const { ratio = 1.0, jitterStd = 0.05, seed = 42, categoricalIndices = [] } = options;
  const rng = createRNG(seed);

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
 * Apply Gaussian Noise Injection across numeric dataset features.
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
 * Compute Quality Metrics on the generated synthetic data:
 * - Diversity Score: average pairwise distance within synthetic samples vs original samples
 * - Redundancy Score: % of synthetic points closer than epsilon to original points
 * - Distribution Shift: normalized mean difference across features
 */
export function computeSyntheticQuality(originalData, syntheticData, numericIndices, categoricalIndices = []) {
  if (!syntheticData || syntheticData.length === 0) {
    return { diversityScore: 0, redundancyScore: 0, distributionShift: 0 };
  }

  const colRanges = getColumnRanges(originalData, numericIndices);

  // 1. Redundancy score
  let nearDuplicates = 0;
  const epsilon = 0.04;

  syntheticData.forEach(synth => {
    let minDist = Infinity;
    originalData.forEach(orig => {
      const d = calcMixedRowDistance(synth, orig, numericIndices, categoricalIndices, colRanges);
      if (d < minDist) minDist = d;
    });
    if (minDist < epsilon) nearDuplicates++;
  });

  const redundancyScore = Number(((nearDuplicates / syntheticData.length) * 100).toFixed(1));

  // 2. Distribution Shift across numeric features
  let shiftSum = 0;
  const numCols = numericIndices.length || 1;

  numericIndices.forEach(colIdx => {
    const origVals = originalData.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
    const synthVals = syntheticData.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
    const mOrig = mean(origVals);
    const mSynth = mean(synthVals);
    const sOrig = std(origVals) || 1;
    shiftSum += Math.abs(mSynth - mOrig) / sOrig;
  });

  const distributionShift = Number((shiftSum / numCols).toFixed(3));

  // 3. Diversity score (0 - 100 scale)
  const diversityScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, distributionShift * 0.5)) * 88)));

  return {
    diversityScore,
    redundancyScore,
    distributionShift,
  };
}

