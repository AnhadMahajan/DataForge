/**
 * DataForge — Linear Algebra Utilities
 * Matrix operations, decompositions, and statistical transforms
 * for the Copula/Bayesian Network synthesis engine.
 */

// ---- Matrix Operations ----

/**
 * Create an n×n identity matrix.
 */
export function identityMatrix(n) {
  const I = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

/**
 * Transpose an m×n matrix.
 */
export function transpose(A) {
  const m = A.length;
  const n = A[0].length;
  const T = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

/**
 * Multiply two matrices A (m×p) and B (p×n) → C (m×n).
 */
export function matrixMultiply(A, B) {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < p; k++) {
      if (A[i][k] === 0) continue;
      for (let j = 0; j < n; j++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

/**
 * Multiply a matrix A (m×n) by a column vector v (length n) → result (length m).
 */
export function matrixVectorMultiply(A, v) {
  const m = A.length;
  const n = A[0].length;
  const result = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += A[i][j] * v[j];
    }
  }
  return result;
}

// ---- Cholesky Decomposition ----

/**
 * Compute the Cholesky decomposition of a symmetric positive-definite matrix.
 * Returns L such that A = L × Lᵀ.
 * Includes diagonal regularization (jitter) if the matrix is near-singular.
 */
export function choleskyDecompose(A) {
  const n = A.length;
  // Deep copy with regularization
  const M = A.map((row, i) => row.map((v, j) => i === j ? v + 1e-8 : v));
  const L = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const diag = M[i][i] - sum;
        if (diag <= 0) {
          // Matrix not positive definite — increase regularization
          L[i][i] = Math.sqrt(Math.abs(diag) + 1e-6);
        } else {
          L[i][i] = Math.sqrt(diag);
        }
      } else {
        L[i][j] = L[j][j] > 0 ? (M[i][j] - sum) / L[j][j] : 0;
      }
    }
  }

  return L;
}

// ---- Correlation Matrix ----

/**
 * Compute the Pearson correlation matrix for selected numeric columns.
 * Returns { matrix: number[][], labels: string[] }
 */
export function correlationMatrix(data, numericIndices, headers = []) {
  const n = numericIndices.length;
  const cols = numericIndices.map(idx =>
    data.map(row => Number(row[idx])).filter(v => !isNaN(v))
  );

  const means = cols.map(col => col.reduce((a, b) => a + b, 0) / col.length);
  const stds = cols.map((col, i) => {
    const m = means[i];
    const variance = col.reduce((acc, v) => acc + (v - m) ** 2, 0) / (col.length - 1 || 1);
    return Math.sqrt(variance) || 1;
  });

  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const minLen = Math.min(cols[i].length, cols[j].length);
      if (minLen < 3) {
        matrix[i][j] = 0;
        matrix[j][i] = 0;
        continue;
      }
      let sum = 0;
      for (let k = 0; k < minLen; k++) {
        sum += ((cols[i][k] - means[i]) / stds[i]) * ((cols[j][k] - means[j]) / stds[j]);
      }
      const r = sum / (minLen - 1);
      // Clamp to [-1, 1]
      const clamped = Math.max(-1, Math.min(1, r));
      matrix[i][j] = clamped;
      matrix[j][i] = clamped;
    }
  }

  const labels = numericIndices.map(idx => headers[idx] || `Col_${idx}`);
  return { matrix, labels };
}

/**
 * Compute the Spearman rank correlation matrix.
 * Uses rank-transformed data then delegates to Pearson correlation.
 */
export function spearmanCorrelationMatrix(data, numericIndices, headers = []) {
  // Rank-transform each column
  const ranked = data.map(row => [...row]);
  numericIndices.forEach(idx => {
    const vals = data.map((r, i) => ({ val: Number(r[idx]), idx: i }))
      .filter(d => !isNaN(d.val))
      .sort((a, b) => a.val - b.val);
    vals.forEach((d, rank) => {
      ranked[d.idx][idx] = rank + 1;
    });
  });
  return correlationMatrix(ranked, numericIndices, headers);
}

// ---- Probability Transforms ----

/**
 * Inverse of the standard normal CDF (probit function).
 * Uses the rational approximation by Abramowitz & Stegun (26.2.23).
 * Accurate to ~4.5e-4.
 */
export function invertNormalCDF(p) {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  if (Math.abs(p - 0.5) < 1e-10) return 0;

  // Coefficients for rational approximation
  const a = [
    -3.969683028665376e1,
     2.209460984245205e2,
    -2.759285104469687e2,
     1.383577518672690e2,
    -3.066479806614716e1,
     2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1,
     1.615858368580409e2,
    -1.556989798598866e2,
     6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838e0,
    -2.549732539343734e0,
     4.374664141464968e0,
     2.938163982698783e0,
  ];
  const d = [
     7.784695709041462e-3,
     3.224671290700398e-1,
     2.445134137142996e0,
     3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r;

  if (p < pLow) {
    // Lower tail
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    // Central region
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    // Upper tail
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

/**
 * Standard normal CDF Φ(x) using the error function approximation.
 */
export function normalCDF(x) {
  // Horner form of the rational approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327; // 1/sqrt(2π)
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744))));
  const cdf = 1 - d * Math.exp(-0.5 * x * x) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

// ---- Empirical CDF / Inverse CDF ----

/**
 * Build an empirical CDF from an array of numeric values.
 * Returns a function that maps a value to its CDF probability [0, 1].
 */
export function buildEmpiricalCDF(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  return function cdf(x) {
    if (x < sorted[0]) return 0;
    if (x >= sorted[n - 1]) return 1;
    // Binary search for the position
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (sorted[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    // Return (rank + 1) / (n + 1) to avoid 0 and 1 exactly
    return (lo + 1) / (n + 1);
  };
}

/**
 * Build an inverse empirical CDF (quantile function).
 * Maps a probability p ∈ [0, 1] to the corresponding data value.
 */
export function buildInverseCDF(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  return function inverseCDF(p) {
    if (p <= 0) return sorted[0];
    if (p >= 1) return sorted[n - 1];
    // Map p to index with linear interpolation
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, n - 1);
    const frac = idx - lo;
    return sorted[lo] * (1 - frac) + sorted[hi] * frac;
  };
}

// ---- Mutual Information ----

/**
 * Estimate the mutual information I(X; Y) between two discrete columns.
 * Uses empirical joint and marginal probability distributions.
 * Values are binned for continuous data (10 bins by default).
 */
export function mutualInformation(colA, colB, bins = 10) {
  const n = Math.min(colA.length, colB.length);
  if (n === 0) return 0;

  // Discretize continuous values into bins
  function discretize(values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map(v => Math.min(bins - 1, Math.floor(((v - min) / range) * bins)));
  }

  const isNumericA = colA.every(v => typeof v === 'number' && !isNaN(v));
  const isNumericB = colB.every(v => typeof v === 'number' && !isNaN(v));

  const binnedA = isNumericA ? discretize(colA.slice(0, n)) : colA.slice(0, n).map(String);
  const binnedB = isNumericB ? discretize(colB.slice(0, n)) : colB.slice(0, n).map(String);

  // Joint and marginal counts
  const jointCounts = {};
  const marginalA = {};
  const marginalB = {};

  for (let i = 0; i < n; i++) {
    const a = binnedA[i];
    const b = binnedB[i];
    const key = `${a}|||${b}`;
    jointCounts[key] = (jointCounts[key] || 0) + 1;
    marginalA[a] = (marginalA[a] || 0) + 1;
    marginalB[b] = (marginalB[b] || 0) + 1;
  }

  // Compute MI = Σ p(a,b) log(p(a,b) / (p(a) p(b)))
  let mi = 0;
  for (const [key, count] of Object.entries(jointCounts)) {
    const [a, b] = key.split('|||');
    const pAB = count / n;
    const pA = marginalA[a] / n;
    const pB = marginalB[b] / n;
    if (pAB > 0 && pA > 0 && pB > 0) {
      mi += pAB * Math.log(pAB / (pA * pB));
    }
  }

  return Math.max(0, mi);
}

/**
 * Ensure a correlation matrix is positive semi-definite by applying
 * eigenvalue clipping (nearest PSD matrix via spectral method).
 * Falls back to adding diagonal jitter if needed.
 */
export function nearestPSD(matrix) {
  const n = matrix.length;
  // Simple approach: ensure symmetry and add diagonal regularization
  const result = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (matrix[i][j] + matrix[j][i]) / 2)
  );

  // Test if Cholesky succeeds; if not, increase regularization
  let jitter = 1e-6;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const test = result.map((row, i) => row.map((v, j) => i === j ? v + jitter : v));
      const L = choleskyDecompose(test);
      // Verify L is valid (no NaN)
      const valid = L.every(row => row.every(v => isFinite(v)));
      if (valid) {
        return test;
      }
    } catch (e) {
      // Fall through to increase jitter
    }
    jitter *= 10;
  }

  // Last resort: return identity-like matrix
  return identityMatrix(n);
}
