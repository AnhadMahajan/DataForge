/**
 * DataForge — Multi-Axis Fidelity & Privacy Auditing Engine
 * Architecture: Service Layer (Assigned to: Person 1 / Lead Architect)
 * Metrics: 2-Sample Kolmogorov-Smirnov, Wasserstein-1 (EMD), Frobenius Covariance, DCR Privacy Score
 */

// Kolmogorov-Smirnov 2-sample test calculation
function computeTwoSampleKS(sample1, sample2) {
  const n1 = sample1.length;
  const n2 = sample2.length;
  if (n1 === 0 || n2 === 0) return { dStat: 0, pVal: 1, passed: true };

  const s1 = [...sample1].sort((a, b) => a - b);
  const s2 = [...sample2].sort((a, b) => a - b);

  let i = 0;
  let j = 0;
  let maxD = 0;

  while (i < n1 && j < n2) {
    const v1 = s1[i];
    const v2 = s2[j];
    if (v1 <= v2) i++;
    if (v2 <= v1) j++;

    const cdf1 = i / n1;
    const cdf2 = j / n2;
    const diff = Math.abs(cdf1 - cdf2);
    if (diff > maxD) maxD = diff;
  }

  // Asymptotic p-value approximation for 2-sample KS
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * maxD;

  let pVal = 0;
  if (lambda > 0.05) {
    let sum = 0;
    for (let k = 1; k <= 20; k++) {
      const term = Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
      sum += term;
      if (Math.abs(term) < 1e-6) break;
    }
    pVal = Math.min(Math.max(2.0 * sum, 0.0), 1.0);
  } else {
    pVal = 1.0;
  }

  return {
    dStat: Number(maxD.toFixed(4)),
    pVal: Number(pVal.toFixed(4)),
    passed: pVal >= 0.05,
  };
}

// 1-Wasserstein Distance (Earth Mover's Distance)
function computeWasserstein1D(sample1, sample2) {
  const n1 = sample1.length;
  const n2 = sample2.length;
  if (n1 === 0 || n2 === 0) return 0;

  const s1 = [...sample1].sort((a, b) => a - b);
  const s2 = [...sample2].sort((a, b) => a - b);

  const numQuantiles = 100;
  let totalDist = 0;
  for (let q = 1; q <= numQuantiles; q++) {
    const p = q / numQuantiles;
    const idx1 = Math.min(Math.floor(p * n1), n1 - 1);
    const idx2 = Math.min(Math.floor(p * n2), n2 - 1);
    totalDist += Math.abs(s1[idx1] - s2[idx2]);
  }

  return Number((totalDist / numQuantiles).toFixed(4));
}

// Frobenius norm of covariance matrix difference
function computeCovarianceFrobenius(realMatrix, synthMatrix) {
  const K = realMatrix[0]?.length || 0;
  if (K === 0) return 0;

  function calcCov(matrix) {
    const N = matrix.length;
    const means = Array(K).fill(0);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < K; c++) {
        means[c] += matrix[r][c];
      }
    }
    for (let c = 0; c < K; c++) means[c] /= N || 1;

    const cov = Array.from({ length: K }, () => Array(K).fill(0));
    for (let r = 0; r < N; r++) {
      for (let i = 0; i < K; i++) {
        for (let j = 0; j <= i; j++) {
          const prod = (matrix[r][i] - means[i]) * (matrix[r][j] - means[j]);
          cov[i][j] += prod;
          if (i !== j) cov[j][i] += prod;
        }
      }
    }
    for (let i = 0; i < K; i++) {
      for (let j = 0; j < K; j++) {
        cov[i][j] /= Math.max(N - 1, 1);
      }
    }
    return cov;
  }

  const covReal = calcCov(realMatrix);
  const covSynth = calcCov(synthMatrix);

  let frobSq = 0;
  for (let i = 0; i < K; i++) {
    for (let j = 0; j < K; j++) {
      const diff = covReal[i][j] - covSynth[i][j];
      frobSq += diff * diff;
    }
  }

  return Number(Math.sqrt(frobSq).toFixed(4));
}

// Distance to Closest Record (DCR) Privacy Score
function computeDcrPrivacy(realData, synthData, numericIndices) {
  const K = numericIndices.length;
  if (K === 0 || realData.length === 0 || synthData.length === 0) {
    return { dcrScore: 1.0, zeroMemorizationRate: 100 };
  }

  // Calculate feature standard deviations for normalized Euclidean distance
  const stds = numericIndices.map((colIdx) => {
    const vals = realData.map((r) => Number(r[colIdx])).filter((v) => !isNaN(v));
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(vals.length - 1, 1);
    return Math.sqrt(variance) || 1.0;
  });

  let minDcrTotal = 0;
  let exactDuplicates = 0;

  for (let s = 0; s < synthData.length; s++) {
    const sRow = synthData[s];
    let minDistance = Infinity;

    for (let r = 0; r < realData.length; r++) {
      const rRow = realData[r];
      let distSq = 0;
      for (let k = 0; k < K; k++) {
        const colIdx = numericIndices[k];
        const diff = (Number(sRow[colIdx] || 0) - Number(rRow[colIdx] || 0)) / stds[k];
        distSq += diff * diff;
      }
      const dist = Math.sqrt(distSq);
      if (dist < minDistance) minDistance = dist;
    }

    if (minDistance < 1e-4) exactDuplicates++;
    minDcrTotal += minDistance;
  }

  const avgDcr = minDcrTotal / synthData.length;
  const zeroMemorizationRate = Number((((synthData.length - exactDuplicates) / synthData.length) * 100).toFixed(1));

  return {
    dcrScore: Number(avgDcr.toFixed(4)),
    zeroMemorizationRate,
  };
}

/**
 * Audit comprehensive synthetic dataset fidelity & privacy
 */
export async function auditDatasetFidelity({ headers, realData, syntheticData }) {
  if (!realData.length || !syntheticData.length) {
    throw new Error('Real or synthetic dataset is empty');
  }

  // Determine numeric columns
  const numericIndices = [];
  headers.forEach((h, colIdx) => {
    const realVal = Number(realData[0][colIdx]);
    const synthVal = Number(syntheticData[0][colIdx]);
    if (!isNaN(realVal) && !isNaN(synthVal)) {
      numericIndices.push(colIdx);
    }
  });

  const columnMetrics = [];
  let totalPVal = 0;
  let passedCount = 0;
  let totalWasserstein = 0;

  // Real & Synth normalized matrices for Frobenius norm
  const realNumericMatrix = [];
  const synthNumericMatrix = [];

  for (let r = 0; r < realData.length; r++) {
    realNumericMatrix.push(numericIndices.map((c) => Number(realData[r][c]) || 0));
  }
  for (let s = 0; s < syntheticData.length; s++) {
    synthNumericMatrix.push(numericIndices.map((c) => Number(syntheticData[s][c]) || 0));
  }

  numericIndices.forEach((colIdx) => {
    const colName = headers[colIdx];
    const realColVals = realData.map((r) => Number(r[colIdx])).filter((v) => !isNaN(v));
    const synthColVals = syntheticData.map((s) => Number(s[colIdx])).filter((v) => !isNaN(v));

    const ks = computeTwoSampleKS(realColVals, synthColVals);
    const w1 = computeWasserstein1D(realColVals, synthColVals);

    totalPVal += ks.pVal;
    if (ks.passed) passedCount++;
    totalWasserstein += w1;

    columnMetrics.push({
      column: colName,
      ksStat: ks.dStat,
      ksPVal: ks.pVal,
      wasserstein: w1,
      passed: ks.passed,
    });
  });

  const ksPValueMean = numericIndices.length > 0 ? Number((totalPVal / numericIndices.length).toFixed(4)) : 1.0;
  const ksPassedFraction = numericIndices.length > 0 ? Number((passedCount / numericIndices.length).toFixed(2)) : 1.0;
  const wassersteinMean = numericIndices.length > 0 ? Number((totalWasserstein / numericIndices.length).toFixed(4)) : 0.0;
  const covarianceFrobeniusNorm = computeCovarianceFrobenius(realNumericMatrix, synthNumericMatrix);
  const { dcrScore, zeroMemorizationRate } = computeDcrPrivacy(realData, syntheticData, numericIndices);

  return {
    ksPValueMean,
    ksPassedFraction,
    wassersteinMean,
    covarianceFrobeniusNorm,
    dcrPrivacyScore: dcrScore,
    zeroMemorizationRate,
    columnMetrics,
  };
}
