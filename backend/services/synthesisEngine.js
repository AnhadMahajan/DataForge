/**
 * DataForge — Mathematical Synthesis Engine
 * Architecture: Service Layer (Assigned to: Person 1 / Lead Architect)
 * Algorithms: Gaussian Copula, KDE, SMOTE-NC interpolation, Gaussian Jitter
 */

// Seeded pseudorandom number generator for 100% reproducibility
function createPrng(seed = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Standard normal Box-Muller transform
function sampleStandardNormal(prng) {
  const u1 = Math.max(prng(), 1e-12);
  const u2 = prng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// Standard Normal Cumulative Distribution Function (CDF) approximation
function normalCdf(x) {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2.0);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1.0 - p : p;
}

// Quantile function (Inverse Normal CDF) via rational approximation
function normalInverseCdf(p) {
  if (p <= 0.0) return -8.0;
  if (p >= 1.0) return 8.0;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798529327e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const q = p - 0.5;
  if (Math.abs(q) <= 0.42) {
    const r = q * q;
    return (q * (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5])) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0);
  } else {
    const r = p < 0.5 ? p : 1.0 - p;
    const s = Math.sqrt(-Math.log(r));
    let x = (((((c[0] * s + c[1]) * s + c[2]) * s + c[3]) * s + c[4]) * s + c[5]) /
      ((((d[0] * s + d[1]) * s + d[2]) * s + d[3]) * s + 1.0);
    return p < 0.5 ? -x : x;
  }
}

// Cholesky decomposition of positive semi-definite matrix
function choleskyDecompose(matrix) {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = matrix[i][i] - sum;
        L[i][j] = val > 1e-8 ? Math.sqrt(val) : 1e-4;
      } else {
        L[i][j] = (matrix[i][j] - sum) / (L[j][j] || 1e-4);
      }
    }
  }
  return L;
}

/**
 * Synthesize tabular data using mathematical algorithms
 */
export async function executeSynthesis({ headers, data, algorithm = 'copula', rowCount = 100, params = {}, seed = 42 }) {
  const prng = createPrng(seed);
  const nRows = data.length;
  const nCols = headers.length;

  if (nRows === 0 || nCols === 0) {
    throw new Error('Input dataset is empty');
  }

  // Detect column types
  const colTypes = headers.map((_, colIdx) => {
    let numCount = 0;
    let nonNullCount = 0;
    for (let r = 0; r < Math.min(nRows, 100); r++) {
      const v = data[r][colIdx];
      if (v !== null && v !== undefined && v !== '') {
        nonNullCount++;
        if (!isNaN(Number(v))) numCount++;
      }
    }
    return nonNullCount > 0 && numCount / nonNullCount > 0.8 ? 'numeric' : 'categorical';
  });

  const numericColIndices = [];
  const categoricalColIndices = [];
  colTypes.forEach((t, i) => {
    if (t === 'numeric') numericColIndices.push(i);
    else categoricalColIndices.push(i);
  });

  let generatedRows = [];

  // ==========================================
  // Strategy 1: Gaussian Copula Synthesizer
  // ==========================================
  if (algorithm === 'copula' && numericColIndices.length > 0) {
    // 1. Compute empirical column distributions
    const colStats = numericColIndices.map((colIdx) => {
      const vals = [];
      for (let r = 0; r < nRows; r++) {
        const v = Number(data[r][colIdx]);
        if (!isNaN(v)) vals.push(v);
      }
      vals.sort((a, b) => a - b);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(vals.length - 1, 1)) || 1.0;
      return { colIdx, vals, mean, std, n: vals.length };
    });

    // 2. Transform into standard normal space
    const normalMatrix = Array.from({ length: nRows }, () => Array(numericColIndices.length).fill(0));
    for (let r = 0; r < nRows; r++) {
      for (let k = 0; k < numericColIndices.length; k++) {
        const stats = colStats[k];
        const val = Number(data[r][stats.colIdx]);
        // Empirical rank percentile
        let rank = stats.vals.findIndex((x) => x >= val);
        if (rank === -1) rank = stats.n - 1;
        const u = Math.min(Math.max((rank + 0.5) / stats.n, 1e-4), 0.9999);
        normalMatrix[r][k] = normalInverseCdf(u);
      }
    }

    // 3. Compute Pearson correlation matrix in normal space
    const K = numericColIndices.length;
    const corrMatrix = Array.from({ length: K }, () => Array(K).fill(0));
    for (let i = 0; i < K; i++) {
      corrMatrix[i][i] = 1.0;
      for (let j = 0; j < i; j++) {
        let sum = 0;
        for (let r = 0; r < nRows; r++) {
          sum += normalMatrix[r][i] * normalMatrix[r][j];
        }
        const rho = Math.min(Math.max(sum / (nRows - 1 || 1), -0.99), 0.99);
        corrMatrix[i][j] = rho;
        corrMatrix[j][i] = rho;
      }
    }

    // 4. Cholesky decomposition of correlation matrix
    const L = choleskyDecompose(corrMatrix);

    // 5. Generate correlated normal vectors & map back via empirical quantiles
    for (let s = 0; s < rowCount; s++) {
      const z = Array.from({ length: K }, () => sampleStandardNormal(prng));
      const w = Array(K).fill(0);
      for (let i = 0; i < K; i++) {
        for (let j = 0; j <= i; j++) {
          w[i] += L[i][j] * z[j];
        }
      }

      const row = Array(nCols).fill(null);
      // Map numeric columns
      for (let k = 0; k < K; k++) {
        const stats = colStats[k];
        const u = normalCdf(w[k]);
        const qIdx = Math.min(Math.max(Math.floor(u * stats.n), 0), stats.n - 1);
        row[stats.colIdx] = Number(stats.vals[qIdx].toFixed(4));
      }

      // Sample categorical columns by empirical frequency
      categoricalColIndices.forEach((colIdx) => {
        const randomOriginalRow = data[Math.floor(prng() * nRows)];
        row[colIdx] = randomOriginalRow[colIdx];
      });

      generatedRows.push(row);
    }
  }

  // ==========================================
  // Strategy 2: SMOTE-NC / ADASYN Interpolation
  // ==========================================
  else if (algorithm === 'smote' || algorithm === 'adasyn') {
    const kNeighbors = params.kNeighbors || 5;

    for (let s = 0; s < rowCount; s++) {
      const anchorIdx = Math.floor(prng() * nRows);
      const anchorRow = data[anchorIdx];

      // Find nearest neighbors in numeric dimensions
      const distances = data.map((otherRow, idx) => {
        if (idx === anchorIdx) return { idx, dist: Infinity };
        let distSq = 0;
        numericColIndices.forEach((colIdx) => {
          const diff = Number(anchorRow[colIdx] || 0) - Number(otherRow[colIdx] || 0);
          distSq += diff * diff;
        });
        return { idx, dist: Math.sqrt(distSq) };
      });

      distances.sort((a, b) => a.dist - b.dist);
      const neighborPool = distances.slice(0, Math.min(kNeighbors, distances.length));
      const selectedNeighbor = neighborPool[Math.floor(prng() * neighborPool.length)];
      const neighborRow = data[selectedNeighbor.idx];

      const lambda = prng(); // Interpolation weight in [0, 1]
      const newRow = Array(nCols).fill(null);

      numericColIndices.forEach((colIdx) => {
        const vAnchor = Number(anchorRow[colIdx]) || 0;
        const vNeighbor = Number(neighborRow[colIdx]) || 0;
        newRow[colIdx] = Number((vAnchor + lambda * (vNeighbor - vAnchor)).toFixed(4));
      });

      categoricalColIndices.forEach((colIdx) => {
        newRow[colIdx] = prng() < 0.5 ? anchorRow[colIdx] : neighborRow[colIdx];
      });

      generatedRows.push(newRow);
    }
  }

  // ==========================================
  // Strategy 3: Random Oversampling + Gaussian Jitter / KDE
  // ==========================================
  else {
    const jitterStd = params.jitterStd || 0.05;

    // Standard deviation per numeric column
    const colStd = numericColIndices.map((colIdx) => {
      const vals = data.map((r) => Number(r[colIdx])).filter((v) => !isNaN(v));
      const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(vals.length - 1, 1)) || 1.0;
      return { colIdx, std };
    });

    for (let s = 0; s < rowCount; s++) {
      const baseRow = data[Math.floor(prng() * nRows)];
      const newRow = [...baseRow];

      colStd.forEach(({ colIdx, std }) => {
        const origVal = Number(baseRow[colIdx]) || 0;
        const noise = sampleStandardNormal(prng) * std * jitterStd;
        newRow[colIdx] = Number((origVal + noise).toFixed(4));
      });

      generatedRows.push(newRow);
    }
  }

  return {
    headers,
    syntheticData: generatedRows,
    rowCount: generatedRows.length,
    algorithm,
    seed,
  };
}
