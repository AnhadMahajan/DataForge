/**
 * DataForge — Pipeline Manager & Hybrid Backend Client
 * Orchestrates computation across:
 * 1. Native Python Backend (FastAPI on http://127.0.0.1:8000) when available
 * 2. In-Browser Pyodide Web Worker (WebAssembly Scikit-Learn) as instant fallback
 * 3. In-Browser Data Worker for non-blocking UI tasks
 * 4. Exact Mathematical Fidelity & Privacy Auditing
 * 5. 100% Reproducible Python Script Export
 */

import { auditSyntheticFidelity } from './fidelity-audit.js';

const DEFAULT_LOCAL_BACKEND = 'http://127.0.0.1:8000';
let nativeBackendCache = null; // null = untested, true/false = tested
let nativeBackendInfo = null;

/**
 * Get active Backend URL (localStorage override, protocol-safe default, or null for browser Pyodide).
 */
export function getBackendUrl() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('dataforge_backend_url');
    if (custom !== null) {
      return custom.trim() || null;
    }
    // If on https: (e.g. Vercel deployment), do not probe insecure http:// localhost by default
    if (window.location.protocol === 'https:') {
      return null;
    }
  }
  return DEFAULT_LOCAL_BACKEND;
}

/**
 * Save custom Backend URL to localStorage.
 */
export function setBackendUrl(url) {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem('dataforge_backend_url');
    } else {
      localStorage.setItem('dataforge_backend_url', url.trim());
    }
    nativeBackendCache = null;
    nativeBackendInfo = null;
  }
}

// ---- Standard Data Worker State ----
let dataWorker = null;
let dataWorkerAvailable = null;
const pendingDataTasks = new Map();
let dataTaskCounter = 0;

// ---- Pyodide Python Worker State ----
let pyodideWorker = null;
let pyodideWorkerAvailable = null;
const pendingPyodideTasks = new Map();
let pyodideTaskCounter = 0;

/**
 * Check if the native or remote FastAPI Python backend is running.
 */
export async function checkNativeBackend() {
  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    nativeBackendCache = false;
    nativeBackendInfo = null;
    return { online: false, info: null, mode: 'browser_pyodide' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    const res = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      nativeBackendCache = true;
      nativeBackendInfo = data;
      return { online: true, info: data, url: backendUrl, mode: 'native_python' };
    }
  } catch (err) {
    nativeBackendCache = false;
    nativeBackendInfo = null;
  }
  return { online: false, info: null, mode: 'browser_pyodide' };
}

/**
 * Get current backend status (cached or checked).
 */
export function getBackendStatus() {
  const backendUrl = getBackendUrl();
  return {
    isNative: nativeBackendCache === true,
    info: nativeBackendInfo,
    url: backendUrl || 'In-Browser WebAssembly (Pyodide)',
    isHttpsDeployment: typeof window !== 'undefined' && window.location.protocol === 'https:',
  };
}

/**
 * Initialize or retrieve the Data Web Worker.
 */
function getDataWorker() {
  if (dataWorkerAvailable === false) return null;

  if (!dataWorker) {
    try {
      const workerUrl = new URL('../workers/data-worker.js', import.meta.url);
      dataWorker = new Worker(workerUrl, { type: 'module' });

      dataWorker.onmessage = (e) => {
        const { taskId, type, ...rest } = e.data;
        const pending = pendingDataTasks.get(taskId);
        if (!pending) return;

        switch (type) {
          case 'progress':
            if (pending.onProgress) pending.onProgress(rest.stage, rest.percent);
            break;
          case 'result':
            pendingDataTasks.delete(taskId);
            pending.resolve(rest.data);
            break;
          case 'error':
            pendingDataTasks.delete(taskId);
            pending.reject(new Error(rest.message));
            break;
        }
      };

      dataWorker.onerror = (err) => {
        console.error('[Pipeline] Data Worker error:', err);
        for (const [taskId, pending] of pendingDataTasks.entries()) {
          pending.reject(new Error('Data Worker crashed: ' + (err.message || 'unknown error')));
          pendingDataTasks.delete(taskId);
        }
        dataWorker = null;
        dataWorkerAvailable = false;
      };

      dataWorkerAvailable = true;
    } catch (err) {
      console.warn('[Pipeline] Data Worker unavailable, falling back:', err.message);
      dataWorkerAvailable = false;
      dataWorker = null;
      return null;
    }
  }

  return dataWorker;
}

/**
 * Initialize or retrieve the Pyodide Python Web Worker.
 */
function getPyodideWorker() {
  if (pyodideWorkerAvailable === false) return null;

  if (!pyodideWorker) {
    try {
      const workerUrl = new URL('../workers/pyodide-worker.js', import.meta.url);
      pyodideWorker = new Worker(workerUrl);

      pyodideWorker.onmessage = (e) => {
        const { taskId, type, ...rest } = e.data;
        const pending = pendingPyodideTasks.get(taskId);
        if (!pending) return;

        switch (type) {
          case 'progress':
            if (pending.onProgress) pending.onProgress(rest.stage, rest.percent);
            break;
          case 'result':
            pendingPyodideTasks.delete(taskId);
            pending.resolve(rest.data);
            break;
          case 'error':
            pendingPyodideTasks.delete(taskId);
            pending.reject(new Error(rest.message));
            break;
        }
      };

      pyodideWorker.onerror = (err) => {
        console.error('[Pipeline] Pyodide Worker error:', err);
        for (const [taskId, pending] of pendingPyodideTasks.entries()) {
          pending.reject(new Error('Pyodide Worker error: ' + (err.message || 'unknown error')));
          pendingPyodideTasks.delete(taskId);
        }
        pyodideWorker = null;
        pyodideWorkerAvailable = false;
      };

      pyodideWorkerAvailable = true;
    } catch (err) {
      console.warn('[Pipeline] Pyodide Worker unavailable:', err.message);
      pyodideWorkerAvailable = false;
      pyodideWorker = null;
      return null;
    }
  }

  return pyodideWorker;
}

/**
 * Run a task on the Data Worker (with synchronous fallback).
 */
export async function runPipeline(task, payload, onProgress = () => {}) {
  const w = getDataWorker();

  if (w) {
    return new Promise((resolve, reject) => {
      const taskId = `task_${++dataTaskCounter}_${Date.now()}`;
      pendingDataTasks.set(taskId, { resolve, reject, onProgress });
      try {
        w.postMessage({ taskId, task, payload });
      } catch (err) {
        pendingDataTasks.delete(taskId);
        runSynchronous(task, payload, onProgress).then(resolve).catch(reject);
      }
    });
  } else {
    return runSynchronous(task, payload, onProgress);
  }
}

/**
 * Run a Real Python / Scikit-Learn task via Native FastAPI or Pyodide Fallback.
 */
export async function runPyodideTask(task, payload, onProgress = () => {}) {
  const w = getPyodideWorker();
  if (!w) {
    return runSynchronous(task, payload, onProgress);
  }

  return new Promise((resolve, reject) => {
    const taskId = `pytask_${++pyodideTaskCounter}_${Date.now()}`;
    pendingPyodideTasks.set(taskId, { resolve, reject, onProgress });
    try {
      w.postMessage({ taskId, task, payload });
    } catch (err) {
      pendingPyodideTasks.delete(taskId);
      runSynchronous(task, payload, onProgress).then(resolve).catch(reject);
    }
  });
}

/**
 * Run real Train on Synthetic, Test on Real (TSTR) Benchmark via Scikit-Learn.
 * Automatically uses Native FastAPI Python backend if running, otherwise uses in-browser Pyodide.
 */
export async function runTSTRBenchmark({
  realData,
  syntheticData,
  headers,
  targetCol,
  modelType = 'random_forest',
  testSize = 0.25,
  seed = 42,
  onProgress = () => {},
}) {
  // Check native or remote backend first
  const status = await checkNativeBackend();
  if (status.online && status.url) {
    onProgress('Executing on Native Python Server (FastAPI + Scikit-Learn)...', 30);
    try {
      const res = await fetch(`${status.url}/api/benchmark/tstr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          realData,
          syntheticData,
          targetCol,
          modelType,
          testSize,
          seed,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Native backend TSTR evaluation failed');
      }

      onProgress('Native Scikit-Learn TSTR evaluation complete.', 100);
      return await res.json();
    } catch (err) {
      console.warn('[Pipeline] Native backend failed, falling back to in-browser Pyodide:', err.message);
    }
  }

  // Fallback to Pyodide in-browser worker
  return runPyodideTask('tstr_benchmark', {
    realData,
    syntheticData,
    headers,
    targetCol,
    modelType,
    testSize,
    seed,
  }, onProgress);
}

/**
 * Run full Multi-Strategy Scikit-Learn Experiment via Native Python or Pyodide.
 */
export async function runExperimentPipeline({
  headers,
  data,
  targetCol,
  strategies,
  strategyParams,
  runs = 3,
  trainTestSplit = 0.8,
  modelType = 'random_forest',
  baseSeed = 42,
  onProgress = () => {},
}) {
  // Check native or remote backend first
  const status = await checkNativeBackend();
  if (status.online && status.url) {
    onProgress('Executing on Native Python Backend (FastAPI + Scikit-Learn)...', 30);
    try {
      const res = await fetch(`${status.url}/api/experiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers,
          data,
          targetCol,
          strategies,
          strategyParams,
          runs,
          trainTestSplit,
          modelType,
          baseSeed,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Native backend experiment execution failed');
      }

      onProgress('Scikit-Learn experiment pipeline complete.', 100);
      return await res.json();
    } catch (err) {
      console.warn('[Pipeline] Native experiment execution failed, falling back to in-browser Pyodide:', err.message);
    }
  }

  // Fallback to in-browser Pyodide WebAssembly worker
  return runPyodideTask('run_experiment', {
    headers,
    data,
    targetCol,
    strategies,
    strategyParams,
    runs,
    trainTestSplit,
    modelType,
    baseSeed,
  }, onProgress);
}

/**
 * Run Statistical Fidelity & Privacy Audit (Instant, Pure Math).
 */
export function auditFidelity(realData, syntheticData, headers, numericIndices, categoricalIndices) {
  return auditSyntheticFidelity(realData, syntheticData, headers, numericIndices, categoricalIndices);
}

/**
 * Generate a standalone, reproducible Python script for Jupyter / Colab.
 */
export function generateStandalonePythonScript({
  datasetName = 'dataset',
  targetCol = 'target',
  modelType = 'random_forest',
  testSize = 0.25,
  seed = 42,
}) {
  return `# ==============================================================================
# DataForge — Reproducible Python Benchmark Script
# Auto-generated for: ${datasetName}
# Run this script in Jupyter Notebook, Google Colab, or pure Python 3.9+
# ==============================================================================

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
import matplotlib.pyplot as plt

# 1. Load Real and Synthetic Datasets
print("Loading datasets...")
df_real = pd.read_csv("${datasetName}_real.csv")
df_synth = pd.read_csv("${datasetName}_synthetic.csv")

target_col = "${targetCol}"
print(f"Target Column: {target_col}")

# Clean target missing rows
df_real = df_real.dropna(subset=[target_col])
df_synth = df_synth.dropna(subset=[target_col])

X_real = df_real.drop(columns=[target_col])
y_real = df_real[target_col].astype(str)

X_synth = df_synth.drop(columns=[target_col])
y_synth = df_synth[target_col].astype(str)

# 2. Stratified Split on Real Data (Test set held out for both models)
X_train_real, X_test_real, y_train_real, y_test_real = train_test_split(
    X_real, y_real, test_size=${testSize}, random_state=${seed}, stratify=y_real
)

print(f"Train Real: {len(X_train_real)} samples | Test Real: {len(X_test_real)} samples | Synthetic: {len(X_synth)} samples")

# 3. Preprocessing Pipeline
num_cols = X_real.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = [c for c in X_real.columns if c not in num_cols]

transformers = []
if num_cols:
    transformers.append(('num', Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ]), num_cols))

if cat_cols:
    transformers.append(('cat', Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ]), cat_cols))

preprocessor = ColumnTransformer(transformers=transformers)

# 4. Model Selection (${modelType})
def create_model():
${modelType === 'logistic_regression'
  ? '    return LogisticRegression(max_iter=500, random_state=' + seed + ')'
  : modelType === 'gradient_boosting'
  ? '    return HistGradientBoostingClassifier(random_state=' + seed + ')'
  : '    return RandomForestClassifier(n_estimators=100, max_depth=8, random_state=' + seed + ')'}

# 5. Baseline: Train on Real -> Test on Real
print("\\n--- Training Baseline Model on Real Data ---")
pipe_real = Pipeline([('preprocessor', preprocessor), ('model', create_model())])
pipe_real.fit(X_train_real, y_train_real)
preds_real = pipe_real.predict(X_test_real)
acc_real = accuracy_score(y_test_real, preds_real)
print(f"Baseline Test Accuracy: {acc_real:.4f}")
print(classification_report(y_test_real, preds_real))

# 6. TSTR: Train on Synthetic -> Test on Real
print("\\n--- Training TSTR Model on Synthetic Data ---")
pipe_synth = Pipeline([('preprocessor', preprocessor), ('model', create_model())])
pipe_synth.fit(X_synth, y_synth)
preds_synth = pipe_synth.predict(X_test_real)
acc_synth = accuracy_score(y_test_real, preds_synth)
print(f"Synthetic-Trained Test Accuracy: {acc_synth:.4f}")
print(classification_report(y_test_real, preds_synth))

print(f"\\nTSTR Retention Gap: {(acc_synth - acc_real):+.4f}")
`;
}

/**
 * Synchronous fallback for basic data tasks.
 */
async function runSynchronous(task, payload, onProgress) {
  onProgress('Executing synchronous fallback...', 10);

  switch (task) {
    case 'parse_csv': {
      const { parseCSV } = await import('../utils/csv.js');
      const result = parseCSV(payload.csvText, payload.options);
      if (!result.success) throw new Error(result.error.message || 'CSV parsing failed');
      return result.data;
    }

    case 'analyze': {
      const { analyzeDataset } = await import('./analysis.js');
      return analyzeDataset(payload.dataset);
    }

    case 'synthesize': {
      const { synthesizeDataset } = await import('./synthesizer.js');
      return synthesizeDataset({
        ...payload,
        onProgress: (stage, pct) => onProgress(stage, pct),
      });
    }

    case 'run_experiment': {
      const {
        headers,
        data,
        targetCol,
        strategies = ['smote', 'adasyn', 'oversampling', 'noise_injection'],
        strategyParams = {},
        runs = 3,
        trainTestSplit = 0.8,
        modelType = 'random_forest',
        baseSeed = 42,
      } = payload;

      const { analyzeDataset } = await import('./analysis.js');
      const { runControlledEvaluation, compareEvaluations } = await import('./evaluation.js');
      const { applySMOTE, applyADASYN, applySMOTETomek, applyRandomOversampling, applyNoiseInjection } = await import('./augmentation.js');
      const { generateRecommendation } = await import('./recommendations.js');

      const targetIdx = headers.indexOf(targetCol);
      if (targetIdx === -1) throw new Error(`Target column "${targetCol}" not found in headers.`);

      const labels = data.map(r => r[targetIdx]);
      const featureData = data.map(r => r.filter((_, i) => i !== targetIdx));
      const featureHeaders = headers.filter((_, i) => i !== targetIdx);

      const numericIndices = [];
      const categoricalIndices = [];
      const idIndices = [];
      const idPattern = /^(id|_id|uuid|guid|pk|ssn|email|index|key|identifier|client_id|customer_id|user_id|order_id|patient_id)$/i;

      featureHeaders.forEach((h, idx) => {
        if (idPattern.test(String(h).trim())) {
          idIndices.push(idx);
          return;
        }
        const sampleVals = featureData.slice(0, 50).map(r => r[idx]).filter(v => v !== null && v !== undefined && v !== '');
        const numCount = sampleVals.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && v !== '')).length;
        if (sampleVals.length > 0 && numCount / sampleVals.length > 0.7) {
          numericIndices.push(idx);
        } else {
          categoricalIndices.push(idx);
        }
      });

      onProgress('Evaluating Baseline Model...', 20);
      const evalModelType = modelType === 'logistic_regression' ? 'logistic_regression' : modelType === 'decision_tree' ? 'decision_tree' : 'knn';

      const baseline = await runControlledEvaluation({
        data: featureData,
        labels,
        numericIndices,
        categoricalIndices,
        idIndices,
        runs,
        trainTestSplit,
        modelType: evalModelType,
        baseSeed,
        augmentFn: null,
      });

      const strategyResults = [];
      const totalStrats = strategies.length;

      const { generateCSV } = await import('../utils/csv.js');
      const { computeKolmogorovSmirnov, computeWassersteinDistance, mean, std } = await import('../utils/math.js');

      for (let i = 0; i < totalStrats; i++) {
        const strat = strategies[i];
        const pct = Math.round(20 + ((i + 1) / (totalStrats || 1)) * 70);
        onProgress(`Evaluating strategy: ${strat}...`, pct);

        let augFn = null;
        const opt = { ...(strategyParams[strat] || {}), categoricalIndices, seed: baseSeed };

        if (strat === 'smote') augFn = (d, l, num, o) => applySMOTE(d, l, num, { ...o, ...opt });
        else if (strat === 'adasyn') augFn = (d, l, num, o) => applyADASYN(d, l, num, { ...o, ...opt });
        else if (strat === 'smote_tomek') augFn = (d, l, num, o) => applySMOTETomek(d, l, num, { ...o, ...opt });
        else if (strat === 'oversampling') augFn = (d, l, num, o) => applyRandomOversampling(d, l, num, { ...o, ...opt });
        else if (strat === 'noise_injection') augFn = (d, l, num, o) => applyNoiseInjection(d, l, num, { ...o, ...opt });

        if (augFn) {
          const sampleAug = augFn(featureData, labels, numericIndices, { seed: baseSeed, categoricalIndices });
          
          const augmentedFullRows = (sampleAug.augmentedData || []).map((row, rIdx) => {
            const fullRow = [...row];
            fullRow.splice(targetIdx, 0, sampleAug.augmentedLabels[rIdx]);
            return fullRow;
          });

          const syntheticFullRows = (sampleAug.syntheticData || []).map((row, rIdx) => {
            const fullRow = [...row];
            fullRow.splice(targetIdx, 0, sampleAug.syntheticLabels[rIdx]);
            return fullRow;
          });

          const augmentedCSV = generateCSV(headers, augmentedFullRows);
          const syntheticCSV = generateCSV(headers, syntheticFullRows);

          const featureDrift = [];
          numericIndices.forEach(fIdx => {
            const featName = featureHeaders[fIdx] || `Feature_${fIdx}`;
            const origVals = featureData.map(r => Number(r[fIdx])).filter(v => !isNaN(v));
            const synthVals = (sampleAug.syntheticData || []).map(r => Number(r[fIdx])).filter(v => !isNaN(v));

            const origM = origVals.length > 0 ? mean(origVals) : 0;
            const origS = origVals.length > 1 ? std(origVals) : 1;
            const synthM = synthVals.length > 0 ? mean(synthVals) : origM;
            const synthS = synthVals.length > 1 ? std(synthVals) : origS;

            const ks = computeKolmogorovSmirnov(origVals, synthVals);
            const w1 = computeWassersteinDistance(origVals, synthVals);

            featureDrift.push({
              featureName: featName,
              featureIndex: fIdx,
              originalMean: Number(origM.toFixed(2)),
              originalStd: Number(origS.toFixed(2)),
              syntheticMean: Number(synthM.toFixed(2)),
              syntheticStd: Number(synthS.toFixed(2)),
              ksStatistic: ks.statistic,
              driftSeverity: ks.driftSeverity,
              wassersteinDistance: w1,
            });
          });

          const evalRes = await runControlledEvaluation({
            data: featureData,
            labels,
            numericIndices,
            categoricalIndices,
            idIndices,
            runs,
            trainTestSplit,
            modelType: evalModelType,
            baseSeed,
            augmentFn: augFn,
          });

          const comparison = compareEvaluations(baseline, evalRes);
          strategyResults.push({
            strategy: strat,
            strategyType: strat,
            strategyParams: opt,
            results: evalRes,
            evaluation: evalRes,
            comparison,
            featureDrift,
            syntheticData: sampleAug.syntheticData || [],
            syntheticCount: sampleAug.syntheticCount || 0,
            augmentedRowCount: augmentedFullRows.length,
            augmentedCSV,
            syntheticCSV,
          });
        }
      }

      const rec = generateRecommendation({ analysisResult: {} }, baseline, strategyResults);
      return {
        baseline,
        strategyResults,
        recommendation: rec,
        backend: 'In-Browser JavaScript Engine',
      };
    }

    case 'tstr_benchmark': {
      const { realData, syntheticData, headers, targetCol, modelType = 'random_forest', testSize = 0.25, seed = 42 } = payload;
      const { createDatasetEncoder, createModel } = await import('./evaluation.js');
      const { accuracy } = await import('../utils/math.js');

      const targetIdx = headers.indexOf(targetCol);
      if (targetIdx === -1) throw new Error(`Target column "${targetCol}" not found.`);

      const realY = realData.map(r => r[targetIdx]);
      const realX_raw = realData.map(r => r.filter((_, i) => i !== targetIdx));
      const synthY = syntheticData.map(r => r[targetIdx]);
      const synthX_raw = syntheticData.map(r => r.filter((_, i) => i !== targetIdx));
      const featHeaders = headers.filter((_, i) => i !== targetIdx);

      const splitIdx = Math.max(1, Math.floor(realData.length * (1 - testSize)));
      const trainRealRaw = realX_raw.slice(0, splitIdx);
      const trainRealY = realY.slice(0, splitIdx);
      const testRealRaw = realX_raw.slice(splitIdx);
      const testRealY = realY.slice(splitIdx);

      const numIdx = [];
      const catIdx = [];
      featHeaders.forEach((h, i) => {
        const val = realX_raw[0]?.[i];
        if (typeof val === 'number' || !isNaN(Number(val))) numIdx.push(i);
        else catIdx.push(i);
      });

      const encoder = createDatasetEncoder(realX_raw, numIdx, catIdx, []);
      const trainRealEncoded = encoder.encodeMatrix(trainRealRaw);
      const testRealEncoded = encoder.encodeMatrix(testRealRaw);
      const synthEncoded = encoder.encodeMatrix(synthX_raw);

      const evalModelType = modelType === 'logistic_regression' ? 'logistic_regression' : 'knn';
      const mBaseline = createModel(evalModelType);
      mBaseline.fit(trainRealEncoded, trainRealY);
      const predsBase = mBaseline.predict(testRealEncoded);
      const baseAcc = accuracy(testRealY, predsBase);

      const mTstr = createModel(evalModelType);
      mTstr.fit(synthEncoded, synthY);
      const predsTstr = mTstr.predict(testRealEncoded);
      const tstrAcc = accuracy(testRealY, predsTstr);

      return {
        baselineAccuracy: baseAcc,
        tstrAccuracy: tstrAcc,
        retentionRate: baseAcc > 0 ? (tstrAcc / baseAcc) * 100 : 100,
        gap: tstrAcc - baseAcc,
        backend: 'In-Browser JavaScript Engine',
      };
    }

    default:
      throw new Error(`Unknown pipeline task: ${task}`);
  }
}

/**
 * Cancel running pipeline tasks.
 */
export function cancelPipeline() {
  if (dataWorker) {
    dataWorker.terminate();
    dataWorker = null;
    dataWorkerAvailable = null;
    for (const [taskId, pending] of pendingDataTasks.entries()) {
      pending.reject(new Error('Pipeline cancelled by user'));
      pendingDataTasks.delete(taskId);
    }
  }

  if (pyodideWorker) {
    pyodideWorker.terminate();
    pyodideWorker = null;
    pyodideWorkerAvailable = null;
    for (const [taskId, pending] of pendingPyodideTasks.entries()) {
      pending.reject(new Error('Python runtime task cancelled by user'));
      pendingPyodideTasks.delete(taskId);
    }
  }
}
