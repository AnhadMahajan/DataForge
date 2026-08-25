/**
 * DataForge — Statistical Fidelity & Privacy Audit Engine
 * Pure mathematical algorithms for evaluating synthetic data without model training:
 * 1. Two-Sample Kolmogorov-Smirnov (KS) Test per numeric column
 * 2. Wasserstein-1 Distance (Earth Mover's Distance)
 * 3. Pairwise Covariance Matrix Frobenius Norm Divergence
 * 4. Categorical Total Variation Distance (TVD)
 * 5. Distance to Closest Record (DCR) Privacy / Memorization Risk
 */

import { mean, std, min, max, computeKolmogorovSmirnov, computeWassersteinDistance } from '../utils/math.js';
import { correlationMatrix } from '../utils/linalg.js';

/**
 * Run a full statistical fidelity and privacy audit between real and synthetic data.
 *
 * @param {Array} realData - Original data rows
 * @param {Array} syntheticData - Generated data rows
 * @param {Array} headers - Column names
 * @param {Array} numericIndices - Column indices for continuous features
 * @param {Array} categoricalIndices - Column indices for nominal features
 * @returns {Object} Comprehensive audit report
 */
export function auditSyntheticFidelity(realData, syntheticData, headers, numericIndices, categoricalIndices) {
  if (!realData || realData.length === 0 || !syntheticData || syntheticData.length === 0) {
    return {
      overallScore: 0,
      numericFidelity: 0,
      categoricalFidelity: 0,
      correlationFidelity: 0,
      privacyScore: 100,
      featureAudits: [],
      dcrStats: { medianDCR: 0, minDCR: 0, memorizationRiskPercent: 0 },
    };
  }

  // Pre-calculate column min/max for normalization
  const colRanges = {};
  numericIndices.forEach(idx => {
    const vals = realData.map(r => Number(r[idx])).filter(v => !isNaN(v));
    const mn = vals.length > 0 ? min(vals) : 0;
    const mx = vals.length > 0 ? max(vals) : 1;
    colRanges[idx] = { min: mn, max: mx, range: (mx - mn) || 1 };
  });

  const featureAudits = [];
  let totalKSScore = 0;
  let totalCatScore = 0;

  // 1. Audit Numeric Features (KS-Test & Wasserstein-1)
  numericIndices.forEach(idx => {
    const colName = headers[idx] || `Feature_${idx}`;
    const realVals = realData.map(r => Number(r[idx])).filter(v => !isNaN(v));
    const synthVals = syntheticData.map(r => Number(r[idx])).filter(v => !isNaN(v));

    const ks = computeKolmogorovSmirnov(realVals, synthVals);
    const w1 = computeWassersteinDistance(realVals, synthVals);
    const rangeVal = colRanges[idx].range;
    const normalizedW1 = Number((w1 / rangeVal).toFixed(4));

    // KS Score: 1 - KS statistic (1 = identical distributions, 0 = completely disjoint)
    const ksFidelity = Number(Math.max(0, 1 - ks.statistic).toFixed(4));
    totalKSScore += ksFidelity;

    const realMean = realVals.length > 0 ? mean(realVals) : 0;
    const synthMean = synthVals.length > 0 ? mean(synthVals) : 0;
    const realStd = realVals.length > 1 ? std(realVals) : 1;
    const synthStd = synthVals.length > 1 ? std(synthVals) : 1;

    featureAudits.push({
      columnIndex: idx,
      name: colName,
      type: 'numeric',
      ksStatistic: ks.statistic,
      ksFidelity,
      wassersteinDistance: Number(w1.toFixed(4)),
      normalizedWasserstein: normalizedW1,
      realMean: Number(realMean.toFixed(2)),
      synthMean: Number(synthMean.toFixed(2)),
      realStd: Number(realStd.toFixed(2)),
      synthStd: Number(synthStd.toFixed(2)),
      meanDiffPct: realMean !== 0 ? Number((Math.abs(synthMean - realMean) / Math.abs(realMean) * 100).toFixed(1)) : 0,
      driftSeverity: ks.driftSeverity,
    });
  });

  // 2. Audit Categorical Features (Total Variation Distance)
  categoricalIndices.forEach(idx => {
    const colName = headers[idx] || `Feature_${idx}`;
    const realFreq = {};
    realData.forEach(r => { const v = String(r[idx] ?? ''); realFreq[v] = (realFreq[v] || 0) + 1; });
    const realTotal = Object.values(realFreq).reduce((a, b) => a + b, 0) || 1;

    const synthFreq = {};
    syntheticData.forEach(r => { const v = String(r[idx] ?? ''); synthFreq[v] = (synthFreq[v] || 0) + 1; });
    const synthTotal = Object.values(synthFreq).reduce((a, b) => a + b, 0) || 1;

    const allCategories = Array.from(new Set([...Object.keys(realFreq), ...Object.keys(synthFreq)]));
    
    // Total Variation Distance: 0.5 * sum |P(x) - Q(x)|
    let tvd = 0;
    const categoryBreakdown = allCategories.map(cat => {
      const pReal = (realFreq[cat] || 0) / realTotal;
      const pSynth = (synthFreq[cat] || 0) / synthTotal;
      tvd += Math.abs(pReal - pSynth) * 0.5;
      return {
        category: cat,
        realProb: Number(pReal.toFixed(4)),
        synthProb: Number(pSynth.toFixed(4)),
      };
    });

    const catFidelity = Number(Math.max(0, 1 - tvd).toFixed(4));
    totalCatScore += catFidelity;

    featureAudits.push({
      columnIndex: idx,
      name: colName,
      type: 'categorical',
      totalVariationDistance: Number(tvd.toFixed(4)),
      categoricalFidelity: catFidelity,
      categoryBreakdown,
    });
  });

  const numericFidelity = numericIndices.length > 0 ? totalKSScore / numericIndices.length : 1.0;
  const categoricalFidelity = categoricalIndices.length > 0 ? totalCatScore / categoricalIndices.length : 1.0;

  // 3. Correlation Matrix Preservation (Frobenius Norm Difference)
  let correlationFidelity = 1.0;
  let correlationMatrixReal = null;
  let correlationMatrixSynth = null;

  if (numericIndices.length >= 2) {
    const realCorr = correlationMatrix(realData, numericIndices, headers);
    const synthCorr = correlationMatrix(syntheticData, numericIndices, headers);
    correlationMatrixReal = realCorr;
    correlationMatrixSynth = synthCorr;

    const n = numericIndices.length;
    let frobeniusDiffSq = 0;
    let frobeniusRealSq = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const diff = (synthCorr.matrix[i][j] || 0) - (realCorr.matrix[i][j] || 0);
        frobeniusDiffSq += diff * diff;
        frobeniusRealSq += (realCorr.matrix[i][j] || 0) ** 2;
      }
    }

    const frobeniusDiff = Math.sqrt(frobeniusDiffSq);
    const frobeniusReal = Math.sqrt(frobeniusRealSq) || 1;
    correlationFidelity = Number(Math.max(0, 1 - (frobeniusDiff / frobeniusReal)).toFixed(4));
  }

  // 4. Privacy Audit: Distance to Closest Record (DCR)
  // Quantifies nearest-neighbor proximity to detect exact memorization / leakage
  const dcrList = [];
  const checkSampleCount = Math.min(250, syntheticData.length);
  const realSampleCount = Math.min(500, realData.length);

  for (let i = 0; i < checkSampleCount; i++) {
    const synthRow = syntheticData[i];
    let minDist = Infinity;

    for (let j = 0; j < realSampleCount; j++) {
      const realRow = realData[j];
      let distSq = 0;
      let validDim = 0;

      numericIndices.forEach(colIdx => {
        const sVal = Number(synthRow[colIdx]);
        const rVal = Number(realRow[colIdx]);
        if (!isNaN(sVal) && !isNaN(rVal)) {
          const rng = colRanges[colIdx].range;
          distSq += ((sVal - rVal) / rng) ** 2;
          validDim++;
        }
      });

      categoricalIndices.forEach(colIdx => {
        const sVal = String(synthRow[colIdx] ?? '');
        const rVal = String(realRow[colIdx] ?? '');
        if (sVal !== rVal) distSq += 1.0;
        validDim++;
      });

      const dist = validDim > 0 ? Math.sqrt(distSq / validDim) : 0;
      if (dist < minDist) minDist = dist;
    }

    dcrList.push(minDist);
  }

  const sortedDCR = [...dcrList].sort((a, b) => a - b);
  const medianDCR = sortedDCR.length > 0 ? sortedDCR[Math.floor(sortedDCR.length / 2)] : 0;
  const minDCR = sortedDCR.length > 0 ? sortedDCR[0] : 0;
  
  // Memorization risk: percentage of synthetic points closer than 0.03 normalized distance
  const memorizedPoints = sortedDCR.filter(d => d < 0.03).length;
  const memorizationRiskPercent = Number(((memorizedPoints / (sortedDCR.length || 1)) * 100).toFixed(1));

  // Privacy Score: 100% - risk penalty
  const privacyScore = Math.max(0, Math.min(100, Math.round(100 - memorizationRiskPercent * 2)));

  // Composite Quality Score (0 - 100)
  const overallScore = Math.round(
    (numericFidelity * 0.4 + categoricalFidelity * 0.3 + correlationFidelity * 0.3) * 100
  );

  return {
    overallScore,
    numericFidelity: Number(numericFidelity.toFixed(4)),
    categoricalFidelity: Number(categoricalFidelity.toFixed(4)),
    correlationFidelity: Number(correlationFidelity.toFixed(4)),
    privacyScore,
    dcrStats: {
      medianDCR: Number(medianDCR.toFixed(4)),
      minDCR: Number(minDCR.toFixed(4)),
      memorizationRiskPercent,
      dcrDistribution: sortedDCR,
    },
    featureAudits,
    correlationMatrixReal,
    correlationMatrixSynth,
  };
}
