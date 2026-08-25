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

const NATIVE_BACKEND_URL = 'http://127.0.0.1:8000';
let nativeBackendCache = null; // null = untested, true/false = tested
let nativeBackendInfo = null;

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
 * Check if the native FastAPI Python backend is running locally.
 */
export async function checkNativeBackend() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${NATIVE_BACKEND_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      nativeBackendCache = true;
      nativeBackendInfo = data;
      return { online: true, info: data };
    }
  } catch (err) {
    nativeBackendCache = false;
    nativeBackendInfo = null;
  }
  return { online: false, info: null };
}

/**
 * Get current backend status (cached or checked).
 */
export function getBackendStatus() {
  return {
    isNative: nativeBackendCache === true,
    info: nativeBackendInfo,
    url: NATIVE_BACKEND_URL,
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
    throw new Error('Python WebAssembly runtime is not supported in this browser environment.');
  }

  return new Promise((resolve, reject) => {
    const taskId = `pytask_${++pyodideTaskCounter}_${Date.now()}`;
    pendingPyodideTasks.set(taskId, { resolve, reject, onProgress });
    try {
      w.postMessage({ taskId, task, payload });
    } catch (err) {
      pendingPyodideTasks.delete(taskId);
      reject(new Error('Failed to post task to Pyodide Worker: ' + err.message));
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
  // Check native backend first
  const status = await checkNativeBackend();
  if (status.online) {
    onProgress('Executing on Native Python Server (FastAPI + Scikit-Learn)...', 30);
    try {
      const res = await fetch(`${NATIVE_BACKEND_URL}/api/benchmark/tstr`, {
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
  // Check native backend first
  const status = await checkNativeBackend();
  if (status.online) {
    onProgress('Executing on Native Python Backend (FastAPI + Scikit-Learn)...', 30);
    try {
      const res = await fetch(`${NATIVE_BACKEND_URL}/api/experiment`, {
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
      const { runExperiment } = await import('./experiment.js');
      const result = await runExperiment({
        ...payload,
        onProgress: (msg, pct) => onProgress(msg, pct),
      });
      if (!result.success) throw new Error(result.error?.message || 'Experiment failed');
      return result.data;
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
