/**
 * DataForge — Math Utilities
 * Statistical functions, PRNG, distance calculations
 */

// ---- Seeded PRNG (Mulberry32) ----
// Produces deterministic pseudo-random numbers from a seed
export function createRNG(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded Gaussian random (Box-Muller transform)
export function gaussianRandom(rng) {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---- Safe UUID Generator (works in all contexts including file:// and non-secure origins) ----
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }
  // Standard RFC4122 v4 UUID fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- Safe Fast String Hash (works in all browser environments) ----
export async function hashString(str) {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }
  // FNV-1a 64-bit hash fallback
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x01000193);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
}


// ---- Descriptive Statistics ----

export function sum(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

export function mean(arr) {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

export function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function variance(arr, sample = true) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const squaredDiffs = arr.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return squaredDiffs / (sample ? arr.length - 1 : arr.length);
}

export function std(arr, sample = true) {
  return Math.sqrt(variance(arr, sample));
}

export function min(arr) {
  if (arr.length === 0) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}

export function max(arr) {
  if (arr.length === 0) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

export function range(arr) {
  return max(arr) - min(arr);
}

// ---- Percentiles & Quartiles ----

export function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const frac = index - lower;
  return sorted[lower] * (1 - frac) + sorted[upper] * frac;
}

export function q1(arr) { return percentile(arr, 25); }
export function q3(arr) { return percentile(arr, 75); }

export function iqr(arr) {
  return q3(arr) - q1(arr);
}

// ---- Distribution Shape ----

export function skewness(arr) {
  if (arr.length < 3) return 0;
  const n = arr.length;
  const m = mean(arr);
  const s = std(arr, true);
  if (s === 0) return 0;
  const cubedDiffs = arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * cubedDiffs;
}

export function kurtosis(arr) {
  if (arr.length < 4) return 0;
  const n = arr.length;
  const m = mean(arr);
  const s = std(arr, true);
  if (s === 0) return 0;
  const fourthDiffs = arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  const k = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * fourthDiffs;
  // Excess kurtosis (0 for normal distribution)
  return k - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

// ---- Correlation ----

export function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

// ---- Distance ----

export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// ---- Outlier Detection ----

export function detectOutliers(arr, multiplier = 1.5) {
  const q1Val = q1(arr);
  const q3Val = q3(arr);
  const iqrVal = q3Val - q1Val;
  const lower = q1Val - multiplier * iqrVal;
  const upper = q3Val + multiplier * iqrVal;
  const outliers = [];
  const indices = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < lower || arr[i] > upper) {
      outliers.push(arr[i]);
      indices.push(i);
    }
  }
  return { outliers, indices, lower, upper, count: outliers.length };
}

// ---- Normalization ----

export function normalize(arr) {
  const minVal = min(arr);
  const maxVal = max(arr);
  const r = maxVal - minVal;
  if (r === 0) return arr.map(() => 0);
  return arr.map(v => (v - minVal) / r);
}

export function standardize(arr) {
  const m = mean(arr);
  const s = std(arr);
  if (s === 0) return arr.map(() => 0);
  return arr.map(v => (v - m) / s);
}

// ---- Distribution Detection ----

export function detectDistribution(arr) {
  if (arr.length < 10) return 'unknown';
  const sk = Math.abs(skewness(arr));
  const kt = kurtosis(arr);

  // Check for uniform: low kurtosis, low skew
  const r = range(arr);
  if (r === 0) return 'unknown';
  const s = std(arr);
  const cv = s / Math.abs(mean(arr) || 1);

  if (sk < 0.5 && Math.abs(kt) < 0.5) {
    // Could be normal or uniform — check coefficient of variation
    const expectedUniformStd = r / Math.sqrt(12);
    if (Math.abs(s - expectedUniformStd) / expectedUniformStd < 0.3) {
      return 'uniform';
    }
    return 'normal';
  }

  if (sk > 1.0) return 'skewed';

  // Simple bimodal check: is there a dip in the middle of the histogram?
  const sorted = [...arr].sort((a, b) => a - b);
  const bins = 10;
  const binWidth = r / bins;
  const counts = new Array(bins).fill(0);
  for (const v of sorted) {
    const idx = Math.min(Math.floor((v - min(arr)) / binWidth), bins - 1);
    counts[idx]++;
  }
  let dips = 0;
  for (let i = 1; i < counts.length - 1; i++) {
    if (counts[i] < counts[i - 1] && counts[i] < counts[i + 1]) dips++;
  }
  if (dips >= 1 && kt < -0.5) return 'bimodal';

  return 'normal';
}

// ---- k-Nearest Neighbors (helper) ----

export function kNearestNeighbors(point, dataset, k) {
  const distances = dataset.map((row, idx) => ({
    index: idx,
    distance: euclideanDistance(point, row),
  }));
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, k);
}

// ---- Confusion Matrix Metrics ----

export function computeConfusionMetrics(actual, predicted, classes) {
  const metrics = {};
  for (const cls of classes) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] === cls && predicted[i] === cls) tp++;
      else if (actual[i] !== cls && predicted[i] === cls) fp++;
      else if (actual[i] === cls && predicted[i] !== cls) fn++;
      else tn++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    metrics[cls] = { tp, fp, fn, tn, precision, recall, f1, support: tp + fn };
  }
  return metrics;
}

export function accuracy(actual, predicted) {
  if (actual.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === predicted[i]) correct++;
  }
  return correct / actual.length;
}

export function macroAverage(classMetrics, metric) {
  const values = Object.values(classMetrics).map(m => m[metric]);
  return mean(values);
}

// ---- Simple Paired T-Test ----

export function pairedTTest(a, b) {
  if (a.length !== b.length || a.length < 2) {
    return { significant: false, tStatistic: 0, pEstimate: 1 };
  }
  const diffs = a.map((v, i) => v - b[i]);
  const n = diffs.length;
  const m = mean(diffs);
  const s = std(diffs);
  if (s === 0) {
    return { significant: m !== 0, tStatistic: m === 0 ? 0 : Infinity, pEstimate: m === 0 ? 1 : 0 };
  }
  const t = m / (s / Math.sqrt(n));
  // Rough p-value estimation using degrees of freedom
  const df = n - 1;
  const pEstimate = 2 * (1 - approximateNormalCDF(Math.abs(t)));
  return { significant: pEstimate < 0.05, tStatistic: t, pEstimate };
}

// Approximate standard normal CDF using Abramowitz and Stegun
function approximateNormalCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ---- Stratified Train/Test Split ----

export function stratifiedSplit(data, labels, testRatio, rng) {
  const classIndices = {};
  for (let i = 0; i < labels.length; i++) {
    const cls = labels[i];
    if (!classIndices[cls]) classIndices[cls] = [];
    classIndices[cls].push(i);
  }

  const trainIndices = [];
  const testIndices = [];

  for (const cls of Object.keys(classIndices)) {
    const indices = [...classIndices[cls]];
    // Shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const testCount = Math.max(1, Math.round(indices.length * testRatio));
    testIndices.push(...indices.slice(0, testCount));
    trainIndices.push(...indices.slice(testCount));
  }

  return {
    trainData: trainIndices.map(i => data[i]),
    trainLabels: trainIndices.map(i => labels[i]),
    testData: testIndices.map(i => data[i]),
    testLabels: testIndices.map(i => labels[i]),
    trainIndices,
    testIndices,
  };
}

// ---- Mode (Most Frequent Value) ----
export function mode(arr) {
  if (!arr || arr.length === 0) return null;
  const counts = {};
  let maxCount = 0;
  let bestVal = arr[0];
  for (const v of arr) {
    if (v === null || v === undefined || v === '') continue;
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxCount) {
      maxCount = counts[v];
      bestVal = v;
    }
  }
  return bestVal;
}

// ---- Linear Algebra & Activation Functions ----
export function sigmoid(z) {
  if (z > 40) return 1;
  if (z < -40) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function dotProduct(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] || 0) * (b[i] || 0);
  return s;
}

export function softmax(arr) {
  const maxVal = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - maxVal));
  const expSum = sum(exps);
  return exps.map(e => e / (expSum || 1));
}

// ---- Statistical Distribution Drift (Kolmogorov-Smirnov & Wasserstein) ----

/**
 * Compute 2-Sample Kolmogorov-Smirnov (KS) Statistic between two continuous 1D distributions.
 * Returns supremum |F1(x) - F2(x)| measuring maximum discrepancy in cumulative distributions.
 */
export function computeKolmogorovSmirnov(sample1, sample2) {
  const s1 = (sample1 || []).filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
  const s2 = (sample2 || []).filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);

  const n1 = s1.length;
  const n2 = s2.length;

  if (n1 === 0 || n2 === 0) {
    return { statistic: 0, driftSeverity: 'safe', interpretation: 'Insufficient samples' };
  }

  let i1 = 0;
  let i2 = 0;
  let maxD = 0;

  while (i1 < n1 && i2 < n2) {
    const val1 = s1[i1];
    const val2 = s2[i2];

    if (val1 <= val2) {
      i1++;
    }
    if (val2 <= val1) {
      i2++;
    }

    const cdf1 = i1 / n1;
    const cdf2 = i2 / n2;
    const diff = Math.abs(cdf1 - cdf2);
    if (diff > maxD) {
      maxD = diff;
    }
  }

  // Determine drift risk severity
  let driftSeverity = 'safe';
  if (maxD >= 0.35) {
    driftSeverity = 'severe';
  } else if (maxD >= 0.18) {
    driftSeverity = 'moderate';
  }

  return {
    statistic: Number(maxD.toFixed(4)),
    driftSeverity,
    n1,
    n2,
  };
}

/**
 * Compute 1D Wasserstein-1 Distance (Earth Mover's Distance) between two continuous distributions.
 */
export function computeWassersteinDistance(sample1, sample2) {
  const s1 = (sample1 || []).filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);
  const s2 = (sample2 || []).filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b);

  if (s1.length === 0 || s2.length === 0) return 0;

  const quantiles = 100;
  let totalDist = 0;

  for (let q = 1; q <= quantiles; q++) {
    const p = q / (quantiles + 1);
    const idx1 = Math.min(s1.length - 1, Math.floor(p * s1.length));
    const idx2 = Math.min(s2.length - 1, Math.floor(p * s2.length));
    totalDist += Math.abs(s1[idx1] - s2[idx2]);
  }

  return Number((totalDist / quantiles).toFixed(4));
}

// ---- Confusion Matrix & Diagnostic Error Metrics ----

/**
 * Compute multi-class / binary Confusion Matrix and per-class diagnostic rates.
 */
export function computeConfusionMatrix(actualLabels, predictedLabels, classList) {
  const classes = classList || Array.from(new Set([...actualLabels, ...predictedLabels])).sort();
  const n = classes.length;
  const classMap = new Map();
  classes.forEach((c, idx) => classMap.set(c, idx));

  // Initialize raw matrix (rows = actual, cols = predicted)
  const rawMatrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < actualLabels.length; i++) {
    const act = actualLabels[i];
    const pred = predictedLabels[i];
    const r = classMap.get(act);
    const c = classMap.get(pred);
    if (r !== undefined && c !== undefined) {
      rawMatrix[r][c]++;
    }
  }

  // Row-normalized percentage matrix (recall/sensitivity by true class row)
  const normalizedMatrix = Array.from({ length: n }, () => Array(n).fill(0));
  const totalSamples = actualLabels.length || 1;

  for (let r = 0; r < n; r++) {
    const rowSum = rawMatrix[r].reduce((a, b) => a + b, 0) || 1;
    for (let c = 0; c < n; c++) {
      normalizedMatrix[r][c] = rawMatrix[r][c] / rowSum;
    }
  }

  // Per-class metrics (TP, FP, TN, FN, Sensitivity, Specificity, FPR)
  const perClassMetrics = {};
  classes.forEach((cls, idx) => {
    const tp = rawMatrix[idx][idx];
    let fn = 0;
    let fp = 0;

    for (let c = 0; c < n; c++) {
      if (c !== idx) fn += rawMatrix[idx][c];
    }
    for (let r = 0; r < n; r++) {
      if (r !== idx) fp += rawMatrix[r][idx];
    }

    const tn = totalSamples - tp - fn - fp;
    const sensitivity = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 1;
    const fpr = (fp + tn) > 0 ? fp / (fp + tn) : 0;

    perClassMetrics[cls] = {
      className: cls,
      tp,
      fn,
      fp,
      tn,
      sensitivity: Number(sensitivity.toFixed(4)),
      specificity: Number(specificity.toFixed(4)),
      fpr: Number(fpr.toFixed(4)),
    };
  });

  return {
    classes,
    rawMatrix,
    normalizedMatrix,
    perClassMetrics,
    totalSamples,
  };
}

