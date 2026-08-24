/**
 * DataForge — Synthesizer Engine
 * Generate entirely new synthetic datasets that preserve the statistical
 * properties of real data using four generation algorithms:
 *
 * 1. Gaussian Copula  — correlation-preserving, interpretable (flagship)
 * 2. Bayesian Network — learns conditional dependencies between columns
 * 3. Kernel Density Estimation (KDE) — non-parametric, captures arbitrary shapes
 * 4. Variational Autoencoder (VAE) — deep generative model via Pyodide (experimental)
 */

import { createRNG, gaussianRandom, mean, std, mode, silvermanBandwidth } from '../utils/math.js';
import {
  choleskyDecompose,
  correlationMatrix,
  spearmanCorrelationMatrix,
  invertNormalCDF,
  normalCDF,
  buildEmpiricalCDF,
  buildInverseCDF,
  matrixVectorMultiply,
  mutualInformation,
  nearestPSD,
} from '../utils/linalg.js';

// ============================================================
// 1. GAUSSIAN COPULA SYNTHESIZER
// ============================================================

/**
 * Learn the copula model from training data.
 * Returns a model object containing marginals, correlation matrix, and Cholesky factor.
 */
function fitGaussianCopula(data, numericIndices, categoricalIndices, headers, options = {}) {
  const { correlationMethod = 'pearson' } = options;

  // --- Numeric marginals: build empirical CDF and inverse CDF ---
  const numericMarginals = {};
  numericIndices.forEach(idx => {
    const values = data.map(r => Number(r[idx])).filter(v => !isNaN(v));
    if (values.length === 0) {
      numericMarginals[idx] = { type: 'constant', value: 0 };
      return;
    }
    const sorted = [...values].sort((a, b) => a - b);
    numericMarginals[idx] = {
      type: 'empirical',
      cdf: buildEmpiricalCDF(values),
      inverseCdf: buildInverseCDF(values),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: mean(values),
      std: std(values) || 1,
    };
  });

  // --- Categorical marginals: frequency tables ---
  const categoricalMarginals = {};
  categoricalIndices.forEach(idx => {
    const freq = {};
    data.forEach(row => {
      const v = String(row[idx] ?? '');
      freq[v] = (freq[v] || 0) + 1;
    });
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    const categories = Object.keys(freq);
    const probabilities = categories.map(c => freq[c] / total);
    // Cumulative probabilities for sampling
    const cumProb = [];
    let cum = 0;
    probabilities.forEach(p => { cum += p; cumProb.push(cum); });
    categoricalMarginals[idx] = { categories, probabilities, cumProb };
  });

  // --- Transform numeric data to normal space for correlation estimation ---
  const transformedData = data.map(row => {
    const transformed = [...row];
    numericIndices.forEach(idx => {
      const marginal = numericMarginals[idx];
      if (marginal.type === 'constant') {
        transformed[idx] = 0;
        return;
      }
      const u = marginal.cdf(Number(row[idx]));
      // Clamp to avoid -Inf/+Inf from invertNormalCDF
      const uClamped = Math.max(0.001, Math.min(0.999, u));
      transformed[idx] = invertNormalCDF(uClamped);
    });
    return transformed;
  });

  // --- Estimate correlation matrix in the normal space ---
  const corrResult = correlationMethod === 'spearman'
    ? spearmanCorrelationMatrix(transformedData, numericIndices, headers)
    : correlationMatrix(transformedData, numericIndices, headers);

  // Ensure the matrix is positive semi-definite
  const psdMatrix = nearestPSD(corrResult.matrix);

  // Cholesky decomposition for correlated sampling
  const choleskyL = choleskyDecompose(psdMatrix);

  return {
    numericMarginals,
    categoricalMarginals,
    correlationMatrix: psdMatrix,
    choleskyL,
    numericIndices,
    categoricalIndices,
    correlationLabels: corrResult.labels,
    headers,
  };
}

/**
 * Generate N new synthetic rows using a fitted Gaussian Copula model.
 */
function sampleGaussianCopula(model, n, rng) {
  const { numericMarginals, categoricalMarginals, choleskyL, numericIndices, categoricalIndices, headers } = model;
  const dim = numericIndices.length;
  const rows = [];

  for (let i = 0; i < n; i++) {
    const row = Array(headers.length).fill(null);

    // 1. Generate correlated normal samples via Cholesky
    const z = Array(dim).fill(0).map(() => gaussianRandom(rng));
    const correlated = matrixVectorMultiply(choleskyL, z);

    // 2. Transform back through normal CDF → uniform → inverse empirical CDF
    numericIndices.forEach((colIdx, j) => {
      const marginal = numericMarginals[colIdx];
      if (marginal.type === 'constant') {
        row[colIdx] = marginal.value;
        return;
      }
      const u = normalCDF(correlated[j]); // correlated normal → uniform
      const value = marginal.inverseCdf(u); // uniform → original scale
      row[colIdx] = Number(value.toFixed(4));
    });

    // 3. Sample categorical columns independently from frequency tables
    categoricalIndices.forEach(colIdx => {
      const marginal = categoricalMarginals[colIdx];
      const r = rng();
      let picked = marginal.categories[marginal.categories.length - 1];
      for (let k = 0; k < marginal.cumProb.length; k++) {
        if (r <= marginal.cumProb[k]) {
          picked = marginal.categories[k];
          break;
        }
      }
      row[colIdx] = picked;
    });

    rows.push(row);
  }

  return rows;
}


// ============================================================
// 2. BAYESIAN NETWORK SYNTHESIZER
// ============================================================

/**
 * Learn a Bayesian Network structure via mutual information and sample from it.
 */
function fitBayesianNetwork(data, numericIndices, categoricalIndices, headers, options = {}) {
  const { maxParents = 3, significanceThreshold = 0.01 } = options;
  const allIndices = [...numericIndices, ...categoricalIndices];
  const nCols = allIndices.length;

  // --- Build mutual information matrix ---
  const miMatrix = Array.from({ length: nCols }, () => Array(nCols).fill(0));
  for (let i = 0; i < nCols; i++) {
    const colI = data.map(r => numericIndices.includes(allIndices[i])
      ? Number(r[allIndices[i]]) : String(r[allIndices[i]] ?? ''));
    for (let j = i + 1; j < nCols; j++) {
      const colJ = data.map(r => numericIndices.includes(allIndices[j])
        ? Number(r[allIndices[j]]) : String(r[allIndices[j]] ?? ''));
      const mi = mutualInformation(colI, colJ);
      miMatrix[i][j] = mi;
      miMatrix[j][i] = mi;
    }
  }

  // --- Greedy DAG construction: for each node, pick top-k parents by MI ---
  const parents = Array.from({ length: nCols }, () => []);
  for (let i = 0; i < nCols; i++) {
    const scored = miMatrix[i]
      .map((mi, j) => ({ j, mi }))
      .filter(d => d.j !== i && d.mi > significanceThreshold)
      .sort((a, b) => b.mi - a.mi)
      .slice(0, maxParents);

    // Only add as parent if j < i to maintain DAG property (topological order)
    scored.forEach(d => {
      if (d.j < i) parents[i].push(d.j);
    });
  }

  // --- Build conditional distributions for each column ---
  const conditionals = allIndices.map((colIdx, nodeIdx) => {
    const isNumeric = numericIndices.includes(colIdx);
    const parentNodes = parents[nodeIdx];

    if (parentNodes.length === 0) {
      // No parents — use marginal distribution
      if (isNumeric) {
        const vals = data.map(r => Number(r[colIdx])).filter(v => !isNaN(v));
        return { type: 'marginal_numeric', values: vals, mean: mean(vals), std: std(vals) || 1 };
      } else {
        const freq = {};
        data.forEach(r => { const v = String(r[colIdx] ?? ''); freq[v] = (freq[v] || 0) + 1; });
        const total = Object.values(freq).reduce((a, b) => a + b, 0);
        const categories = Object.keys(freq);
        const cumProb = [];
        let cum = 0;
        categories.forEach(c => { cum += freq[c] / total; cumProb.push(cum); });
        return { type: 'marginal_categorical', categories, cumProb };
      }
    }

    // Has parents — build conditional lookup table (discretized for efficiency)
    const bins = 5;
    const condTable = {};

    data.forEach(row => {
      // Create parent key
      const parentKey = parentNodes.map(pIdx => {
        const pColIdx = allIndices[pIdx];
        if (numericIndices.includes(pColIdx)) {
          const v = Number(row[pColIdx]);
          if (isNaN(v)) return '?';
          // Discretize parent value
          const vals = data.map(r => Number(r[pColIdx])).filter(x => !isNaN(x));
          const mn = Math.min(...vals), mx = Math.max(...vals);
          const range = mx - mn || 1;
          return String(Math.min(bins - 1, Math.floor(((v - mn) / range) * bins)));
        }
        return String(row[pColIdx] ?? '');
      }).join('|');

      if (!condTable[parentKey]) condTable[parentKey] = [];
      condTable[parentKey].push(isNumeric ? Number(row[colIdx]) : String(row[colIdx] ?? ''));
    });

    return {
      type: isNumeric ? 'conditional_numeric' : 'conditional_categorical',
      parentNodes,
      condTable,
      allIndices,
      colIdx,
      bins,
    };
  });

  return { allIndices, parents, conditionals, numericIndices, categoricalIndices, headers };
}

/**
 * Sample N rows from a fitted Bayesian Network.
 */
function sampleBayesianNetwork(model, n, rng) {
  const { allIndices, conditionals, numericIndices, headers } = model;
  const rows = [];

  for (let i = 0; i < n; i++) {
    const row = Array(headers.length).fill(null);
    const generatedNode = Array(allIndices.length).fill(null);

    // Sample in topological order (index order since parents always have lower index)
    for (let nodeIdx = 0; nodeIdx < allIndices.length; nodeIdx++) {
      const colIdx = allIndices[nodeIdx];
      const cond = conditionals[nodeIdx];

      if (cond.type === 'marginal_numeric') {
        // Sample from empirical: pick random value and add small noise
        const vals = cond.values;
        const base = vals[Math.floor(rng() * vals.length)];
        row[colIdx] = Number((base + gaussianRandom(rng) * cond.std * 0.1).toFixed(4));
      } else if (cond.type === 'marginal_categorical') {
        const r = rng();
        let picked = cond.categories[cond.categories.length - 1];
        for (let k = 0; k < cond.cumProb.length; k++) {
          if (r <= cond.cumProb[k]) { picked = cond.categories[k]; break; }
        }
        row[colIdx] = picked;
      } else if (cond.type === 'conditional_numeric' || cond.type === 'conditional_categorical') {
        // Build parent key from already-generated values
        const parentKey = cond.parentNodes.map(pIdx => {
          const pColIdx = cond.allIndices[pIdx];
          const pVal = row[pColIdx];
          if (numericIndices.includes(pColIdx)) {
            if (pVal === null || isNaN(pVal)) return '?';
            const allVals = cond.condTable ? Object.values(cond.condTable).flat() : [0];
            // Approximate discretization
            return String(Math.min(cond.bins - 1, Math.max(0, Math.floor(rng() * cond.bins))));
          }
          return String(pVal ?? '');
        }).join('|');

        const candidates = cond.condTable[parentKey];

        if (candidates && candidates.length > 0) {
          if (cond.type === 'conditional_numeric') {
            const base = candidates[Math.floor(rng() * candidates.length)];
            const s = std(candidates.map(Number).filter(v => !isNaN(v))) || 1;
            row[colIdx] = Number((Number(base) + gaussianRandom(rng) * s * 0.1).toFixed(4));
          } else {
            row[colIdx] = candidates[Math.floor(rng() * candidates.length)];
          }
        } else {
          // Fallback: sample from any available bucket
          const allBuckets = Object.values(cond.condTable);
          if (allBuckets.length > 0) {
            const bucket = allBuckets[Math.floor(rng() * allBuckets.length)];
            const val = bucket[Math.floor(rng() * bucket.length)];
            row[colIdx] = cond.type === 'conditional_numeric' ? Number(Number(val).toFixed(4)) : val;
          } else {
            row[colIdx] = cond.type === 'conditional_numeric' ? 0 : '';
          }
        }
      }
      generatedNode[nodeIdx] = row[colIdx];
    }

    rows.push(row);
  }

  return rows;
}


// ============================================================
// 3. KERNEL DENSITY ESTIMATION (KDE) SYNTHESIZER
// ============================================================

/**
 * Fit KDE model: per-column bandwidth selection using Silverman's rule.
 */
function fitKDE(data, numericIndices, categoricalIndices, headers, options = {}) {
  const { bandwidthMultiplier = 1.0 } = options;

  const numericModels = {};
  numericIndices.forEach(idx => {
    const values = data.map(r => Number(r[idx])).filter(v => !isNaN(v));
    const h = silvermanBandwidth(values) * bandwidthMultiplier;
    numericModels[idx] = { values, bandwidth: h, mean: mean(values), std: std(values) || 1 };
  });

  const categoricalModels = {};
  categoricalIndices.forEach(idx => {
    const freq = {};
    data.forEach(r => { const v = String(r[idx] ?? ''); freq[v] = (freq[v] || 0) + 1; });
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    const categories = Object.keys(freq);
    const cumProb = [];
    let cum = 0;
    categories.forEach(c => { cum += freq[c] / total; cumProb.push(cum); });
    categoricalModels[idx] = { categories, cumProb };
  });

  return { numericModels, categoricalModels, numericIndices, categoricalIndices, headers };
}

/**
 * Sample N rows from a KDE model.
 * For each numeric column: pick a random training point, add Gaussian noise scaled by bandwidth.
 * For each categorical column: sample from smoothed frequency distribution.
 */
function sampleKDE(model, n, rng) {
  const { numericModels, categoricalModels, numericIndices, categoricalIndices, headers } = model;
  const rows = [];

  for (let i = 0; i < n; i++) {
    const row = Array(headers.length).fill(null);

    numericIndices.forEach(idx => {
      const m = numericModels[idx];
      if (m.values.length === 0) { row[idx] = 0; return; }
      // Pick a random kernel center
      const center = m.values[Math.floor(rng() * m.values.length)];
      // Add Gaussian noise with bandwidth
      const sample = center + gaussianRandom(rng) * m.bandwidth;
      row[idx] = Number(sample.toFixed(4));
    });

    categoricalIndices.forEach(idx => {
      const m = categoricalModels[idx];
      const r = rng();
      let picked = m.categories[m.categories.length - 1];
      for (let k = 0; k < m.cumProb.length; k++) {
        if (r <= m.cumProb[k]) { picked = m.categories[k]; break; }
      }
      row[idx] = picked;
    });

    rows.push(row);
  }

  return rows;
}


// ============================================================
// 4. VARIATIONAL AUTOENCODER (VAE) — Pyodide-Powered
// ============================================================

/**
 * Check if Pyodide is available and initialize it.
 * Returns null if Pyodide cannot be loaded.
 */
let pyodideInstance = null;

async function ensurePyodide() {
  if (pyodideInstance) return pyodideInstance;

  if (typeof loadPyodide === 'undefined') {
    // Try to load Pyodide from CDN
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        setTimeout(reject, 15000); // 15s timeout
      });
    } catch (e) {
      console.warn('[Synthesizer] Pyodide CDN load failed:', e);
      return null;
    }
  }

  try {
    pyodideInstance = await loadPyodide();
    await pyodideInstance.loadPackage(['numpy', 'scipy']);
    return pyodideInstance;
  } catch (e) {
    console.warn('[Synthesizer] Pyodide initialization failed:', e);
    return null;
  }
}

/**
 * Train and sample from a simple VAE using Pyodide (numpy/scipy).
 * Falls back to Gaussian Copula if Pyodide is unavailable.
 */
async function synthesizeVAE(data, numericIndices, categoricalIndices, headers, n, rng, options = {}) {
  const { latentDim = 4, epochs = 50, learningRate = 0.01 } = options;

  const pyodide = await ensurePyodide();
  if (!pyodide) {
    console.warn('[Synthesizer] VAE unavailable, falling back to Gaussian Copula');
    return null; // Caller will handle fallback
  }

  try {
    // Prepare numeric data matrix for Python
    const numericData = data.map(row =>
      numericIndices.map(idx => {
        const v = Number(row[idx]);
        return isNaN(v) ? 0 : v;
      })
    );

    // Pass data to Python
    pyodide.globals.set('raw_data', pyodide.toPy(numericData));
    pyodide.globals.set('n_samples', n);
    pyodide.globals.set('latent_dim', latentDim);
    pyodide.globals.set('n_epochs', epochs);
    pyodide.globals.set('lr', learningRate);
    pyodide.globals.set('seed_val', Math.floor(rng() * 100000));

    const result = pyodide.runPython(`
import numpy as np
from scipy import stats

np.random.seed(seed_val)

data = np.array(raw_data, dtype=np.float64)
n_train, n_features = data.shape

# Standardize
mu = data.mean(axis=0)
sigma = data.std(axis=0)
sigma[sigma == 0] = 1.0
X = (data - mu) / sigma

# Simple VAE with numpy: encoder/decoder as linear layers
d = latent_dim

# Initialize weights
W_enc = np.random.randn(n_features, d) * 0.1
b_enc = np.zeros(d)
W_mu = np.random.randn(d, d) * 0.1
W_logvar = np.random.randn(d, d) * 0.1
W_dec = np.random.randn(d, n_features) * 0.1
b_dec = np.zeros(n_features)

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))

for epoch in range(n_epochs):
    # Forward pass (batch)
    h = np.tanh(X @ W_enc + b_enc)
    z_mu = h @ W_mu
    z_logvar = h @ W_logvar
    
    # Reparameterization trick
    eps = np.random.randn(n_train, d)
    z = z_mu + np.exp(0.5 * z_logvar) * eps
    
    # Decode
    x_recon = z @ W_dec + b_dec
    
    # Loss gradients (simplified)
    recon_err = x_recon - X
    kl_grad_mu = z_mu / n_train
    kl_grad_logvar = (np.exp(z_logvar) - 1) / (2 * n_train)
    
    # Update decoder
    W_dec -= lr * (z.T @ recon_err) / n_train
    b_dec -= lr * recon_err.mean(axis=0)
    
    # Update encoder (backprop through reparameterization)
    dz = recon_err @ W_dec.T + kl_grad_mu
    dh = dz @ W_mu.T * (1 - h**2)
    W_enc -= lr * (X.T @ dh) / n_train
    b_enc -= lr * dh.mean(axis=0)
    W_mu -= lr * (h.T @ (dz + kl_grad_mu)) / n_train
    W_logvar -= lr * (h.T @ kl_grad_logvar) / n_train

# Sample new data
z_new = np.random.randn(n_samples, d)
x_new = z_new @ W_dec + b_dec

# De-standardize
x_new = x_new * sigma + mu

x_new.tolist()
    `);

    const syntheticNumeric = result.toJs({ create_proxies: false });

    // Build full rows including categorical columns
    const rows = [];
    // Build categorical marginals for sampling
    const catMarginals = {};
    categoricalIndices.forEach(idx => {
      const freq = {};
      data.forEach(r => { const v = String(r[idx] ?? ''); freq[v] = (freq[v] || 0) + 1; });
      const total = Object.values(freq).reduce((a, b) => a + b, 0);
      const categories = Object.keys(freq);
      const cumProb = [];
      let cum = 0;
      categories.forEach(c => { cum += freq[c] / total; cumProb.push(cum); });
      catMarginals[idx] = { categories, cumProb };
    });

    for (let i = 0; i < n; i++) {
      const row = Array(headers.length).fill(null);
      // Fill numeric columns
      numericIndices.forEach((colIdx, j) => {
        row[colIdx] = Number(Number(syntheticNumeric[i][j]).toFixed(4));
      });
      // Fill categorical columns
      categoricalIndices.forEach(colIdx => {
        const m = catMarginals[colIdx];
        const r = rng();
        let picked = m.categories[m.categories.length - 1];
        for (let k = 0; k < m.cumProb.length; k++) {
          if (r <= m.cumProb[k]) { picked = m.categories[k]; break; }
        }
        row[colIdx] = picked;
      });
      rows.push(row);
    }

    return rows;
  } catch (e) {
    console.error('[Synthesizer] VAE execution failed:', e);
    return null; // Fallback
  }
}


// ============================================================
// QUALITY ASSESSMENT
// ============================================================

/**
 * Compute comprehensive quality metrics comparing synthetic to original data.
 */
export function computeSynthesisQuality(originalData, syntheticData, numericIndices, categoricalIndices, originalHeaders) {
  if (!syntheticData || syntheticData.length === 0) {
    return { correlationFidelity: 0, distributionFidelity: 0, diversityScore: 0, redundancyScore: 0 };
  }

  // 1. Correlation Fidelity — compare correlation matrices
  let correlationFidelity = 1.0;
  if (numericIndices.length >= 2) {
    const origCorr = correlationMatrix(originalData, numericIndices, originalHeaders);
    const synthCorr = correlationMatrix(syntheticData, numericIndices, originalHeaders);
    const n = origCorr.matrix.length;
    let totalDiff = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        totalDiff += Math.abs(origCorr.matrix[i][j] - synthCorr.matrix[i][j]);
        count++;
      }
    }
    const avgDiff = count > 0 ? totalDiff / count : 0;
    correlationFidelity = Number(Math.max(0, 1 - avgDiff).toFixed(4));
  }

  // 2. Distribution Fidelity — average KS-test across numeric columns
  let distributionFidelity = 1.0;
  if (numericIndices.length > 0) {
    let totalKS = 0;
    numericIndices.forEach(idx => {
      const origVals = originalData.map(r => Number(r[idx])).filter(v => !isNaN(v)).sort((a, b) => a - b);
      const synthVals = syntheticData.map(r => Number(r[idx])).filter(v => !isNaN(v)).sort((a, b) => a - b);
      if (origVals.length === 0 || synthVals.length === 0) return;

      // KS statistic
      let maxD = 0;
      const n1 = origVals.length, n2 = synthVals.length;
      let i = 0, j = 0;
      while (i < n1 && j < n2) {
        const v1 = origVals[i], v2 = synthVals[j];
        if (v1 <= v2) i++;
        if (v2 <= v1) j++;
        const d = Math.abs(i / n1 - j / n2);
        if (d > maxD) maxD = d;
      }
      totalKS += maxD;
    });
    const avgKS = totalKS / numericIndices.length;
    distributionFidelity = Number(Math.max(0, 1 - avgKS * 2).toFixed(4)); // Scale: KS of 0.5 → fidelity 0
  }

  // 3. Diversity Score — average pairwise distance within synthetic set (sampled)
  let diversityScore = 50;
  if (syntheticData.length >= 2 && numericIndices.length > 0) {
    const sampleSize = Math.min(50, syntheticData.length);
    let totalDist = 0;
    let pairs = 0;
    for (let i = 0; i < sampleSize; i++) {
      for (let j = i + 1; j < sampleSize; j++) {
        let dist = 0;
        numericIndices.forEach(idx => {
          const a = Number(syntheticData[i][idx]) || 0;
          const b = Number(syntheticData[j][idx]) || 0;
          dist += (a - b) ** 2;
        });
        totalDist += Math.sqrt(dist);
        pairs++;
      }
    }
    const avgDist = pairs > 0 ? totalDist / pairs : 0;

    // Compare to original data diversity
    let origDist = 0;
    let origPairs = 0;
    const origSample = Math.min(50, originalData.length);
    for (let i = 0; i < origSample; i++) {
      for (let j = i + 1; j < origSample; j++) {
        let dist = 0;
        numericIndices.forEach(idx => {
          const a = Number(originalData[i][idx]) || 0;
          const b = Number(originalData[j][idx]) || 0;
          dist += (a - b) ** 2;
        });
        origDist += Math.sqrt(dist);
        origPairs++;
      }
    }
    const avgOrigDist = origPairs > 0 ? origDist / origPairs : 1;
    const ratio = avgOrigDist > 0 ? avgDist / avgOrigDist : 1;
    diversityScore = Math.round(Math.max(0, Math.min(100, ratio * 80)));
  }

  // 4. Redundancy Score — % of synthetic rows very close to original rows
  let redundancyScore = 0;
  if (numericIndices.length > 0) {
    let nearDuplicates = 0;
    const colRanges = {};
    numericIndices.forEach(idx => {
      const vals = originalData.map(r => Number(r[idx])).filter(v => !isNaN(v));
      const mn = Math.min(...vals), mx = Math.max(...vals);
      colRanges[idx] = (mx - mn) || 1;
    });

    const epsilon = 0.05; // Threshold for "near-duplicate"
    const checkSample = Math.min(200, syntheticData.length);
    for (let i = 0; i < checkSample; i++) {
      let minDist = Infinity;
      for (let j = 0; j < originalData.length; j++) {
        let dist = 0;
        numericIndices.forEach(idx => {
          const a = (Number(syntheticData[i][idx]) || 0);
          const b = (Number(originalData[j][idx]) || 0);
          dist += ((a - b) / colRanges[idx]) ** 2;
        });
        dist = Math.sqrt(dist / numericIndices.length);
        if (dist < minDist) minDist = dist;
      }
      if (minDist < epsilon) nearDuplicates++;
    }
    redundancyScore = Number(((nearDuplicates / checkSample) * 100).toFixed(1));
  }

  return { correlationFidelity, distributionFidelity, diversityScore, redundancyScore };
}


// ============================================================
// PUBLIC API
// ============================================================

/**
 * Synthesize a dataset using the specified algorithm.
 *
 * @param {Object} params
 * @param {Array}  params.data - Original data rows
 * @param {Array}  params.headers - Column headers
 * @param {Array}  params.numericIndices - Indices of numeric columns
 * @param {Array}  params.categoricalIndices - Indices of categorical columns
 * @param {string} params.algorithm - 'copula' | 'bayesian_network' | 'kde' | 'vae'
 * @param {number} params.rowCount - Number of synthetic rows to generate
 * @param {Object} params.algorithmParams - Algorithm-specific parameters
 * @param {number} params.seed - Random seed for reproducibility
 * @param {Function} params.onProgress - Progress callback (stage, percent)
 *
 * @returns {Object} { syntheticData, syntheticHeaders, qualityReport, metadata }
 */
export async function synthesizeDataset({
  data,
  headers,
  numericIndices,
  categoricalIndices,
  algorithm = 'copula',
  rowCount = 100,
  algorithmParams = {},
  seed = 42,
  onProgress = () => {},
}) {
  const startTime = performance.now();
  const rng = createRNG(seed);

  let syntheticRows;
  let modelInfo = {};

  onProgress(`Fitting ${algorithm.toUpperCase()} model...`, 20);

  try {
    switch (algorithm) {
      case 'copula': {
        const model = fitGaussianCopula(data, numericIndices, categoricalIndices, headers, algorithmParams);
        onProgress('Generating synthetic samples...', 50);
        syntheticRows = sampleGaussianCopula(model, rowCount, rng);
        modelInfo = {
          correlationMatrix: model.correlationMatrix,
          correlationLabels: model.correlationLabels,
        };
        break;
      }

      case 'bayesian_network': {
        const model = fitBayesianNetwork(data, numericIndices, categoricalIndices, headers, algorithmParams);
        onProgress('Sampling from Bayesian Network...', 50);
        syntheticRows = sampleBayesianNetwork(model, rowCount, rng);
        modelInfo = { parents: model.parents };
        break;
      }

      case 'kde': {
        const model = fitKDE(data, numericIndices, categoricalIndices, headers, algorithmParams);
        onProgress('Sampling from KDE model...', 50);
        syntheticRows = sampleKDE(model, rowCount, rng);
        break;
      }

      case 'vae': {
        onProgress('Initializing Python runtime (Pyodide)...', 30);
        syntheticRows = await synthesizeVAE(data, numericIndices, categoricalIndices, headers, rowCount, rng, algorithmParams);
        if (!syntheticRows) {
          // Fallback to Copula
          onProgress('VAE unavailable — falling back to Gaussian Copula...', 40);
          const model = fitGaussianCopula(data, numericIndices, categoricalIndices, headers, algorithmParams);
          onProgress('Generating synthetic samples (Copula fallback)...', 60);
          syntheticRows = sampleGaussianCopula(model, rowCount, rng);
          modelInfo = { fallback: true, correlationMatrix: model.correlationMatrix };
        }
        break;
      }

      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }

    onProgress('Computing quality metrics...', 80);

    // Compute quality report
    const qualityReport = computeSynthesisQuality(
      data, syntheticRows, numericIndices, categoricalIndices, headers
    );

    const generationTime = Number(((performance.now() - startTime) / 1000).toFixed(2));

    onProgress('Synthesis complete.', 100);

    return {
      syntheticData: syntheticRows,
      syntheticHeaders: headers,
      qualityReport,
      metadata: {
        algorithm,
        params: algorithmParams,
        generationTime,
        rowCount: syntheticRows.length,
        originalRowCount: data.length,
        seed,
        ...modelInfo,
      },
    };
  } catch (err) {
    console.error('[Synthesizer] Synthesis failed:', err);
    throw err;
  }
}
