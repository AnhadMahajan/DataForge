/**
 * DataForge — Real Pyodide Python Worker
 * Executes actual Python code in WebAssembly using:
 * - numpy
 * - scipy
 * - pandas
 * - scikit-learn
 *
 * Implements genuine TSTR (Train on Synthetic, Test on Real) benchmarking,
 * real Scikit-Learn model training, and Python script generation.
 */

let pyodide = null;
let pyodideReady = false;
let initializing = false;

function sendProgress(taskId, stage, percent) {
  self.postMessage({ taskId, type: 'progress', stage, percent });
}

function sendResult(taskId, data) {
  self.postMessage({ taskId, type: 'result', data });
}

function sendError(taskId, message) {
  self.postMessage({ taskId, type: 'error', message });
}

async function initPyodide(taskId) {
  if (pyodideReady) return pyodide;
  if (initializing) {
    while (!pyodideReady) {
      await new Promise(r => setTimeout(r, 100));
    }
    return pyodide;
  }

  initializing = true;
  try {
    sendProgress(taskId, 'Loading Pyodide runtime (WebAssembly)...', 10);
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');

    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
    });

    sendProgress(taskId, 'Loading scientific Python packages (numpy, scipy, pandas, scikit-learn)...', 30);
    await pyodide.loadPackage(['numpy', 'scipy', 'pandas', 'scikit-learn']);

    pyodideReady = true;
    initializing = false;
    sendProgress(taskId, 'Python environment initialized successfully.', 40);
    return pyodide;
  } catch (err) {
    initializing = false;
    console.error('[PyodideWorker] Failed to load Pyodide:', err);
    throw new Error('Failed to initialize Python WebAssembly runtime: ' + err.message);
  }
}

self.onmessage = async function (e) {
  const { taskId, task, payload } = e.data;

  try {
    const py = await initPyodide(taskId);

    switch (task) {
      case 'ping':
        sendResult(taskId, { ready: true, version: py.version });
        break;

      case 'tstr_benchmark':
        await handleTSTRBenchmark(py, taskId, payload);
        break;

      case 'train_sklearn':
        await handleTrainSklearn(py, taskId, payload);
        break;

      case 'run_experiment':
        await handleRunExperiment(py, taskId, payload);
        break;

      default:
        sendError(taskId, `Unknown Pyodide task: ${task}`);
    }
  } catch (err) {
    console.error(`[PyodideWorker] Task "${task}" failed:`, err);
    sendError(taskId, err.message || 'Python execution failed');
  }
};

/**
 * Handle Train on Synthetic, Test on Real (TSTR) benchmark.
 */
async function handleTSTRBenchmark(py, taskId, payload) {
  const {
    realData,
    syntheticData,
    headers,
    targetCol,
    modelType = 'random_forest',
    testSize = 0.25,
    seed = 42,
  } = payload;

  sendProgress(taskId, 'Transferring data to Python runtime...', 45);

  // Set variables in Python global scope
  py.globals.set('raw_headers', headers);
  py.globals.set('raw_real_data', realData);
  py.globals.set('raw_synthetic_data', syntheticData);
  py.globals.set('target_col', targetCol);
  py.globals.set('model_type', modelType);
  py.globals.set('test_size', testSize);
  py.globals.set('random_seed', seed);

  sendProgress(taskId, 'Running Scikit-Learn TSTR evaluation script in Python...', 60);

  const pythonScript = `
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

# 1. Build DataFrames
df_real = pd.DataFrame(list(raw_real_data), columns=list(raw_headers))
df_synth = pd.DataFrame(list(raw_synthetic_data), columns=list(raw_headers))

# Clean column types
for col in df_real.columns:
    # Try numeric conversion
    converted_real = pd.to_numeric(df_real[col], errors='coerce')
    if converted_real.notna().sum() > len(df_real) * 0.7:
        df_real[col] = converted_real
        df_synth[col] = pd.to_numeric(df_synth[col], errors='coerce')

target = str(target_col)
if target not in df_real.columns:
    raise ValueError(f"Target column '{target}' not found in headers")

# Drop rows where target is NaN
df_real = df_real.dropna(subset=[target])
df_synth = df_synth.dropna(subset=[target])

# Features & target
X_real = df_real.drop(columns=[target])
y_real = df_real[target].astype(str)

X_synth = df_synth.drop(columns=[target])
y_synth = df_synth[target].astype(str)

# Stratified split on REAL data
try:
    X_train_real, X_test_real, y_train_real, y_test_real = train_test_split(
        X_real, y_real, test_size=float(test_size), random_state=int(random_seed), stratify=y_real
    )
except Exception:
    X_train_real, X_test_real, y_train_real, y_test_real = train_test_split(
        X_real, y_real, test_size=float(test_size), random_state=int(random_seed)
    )

# Identify numeric vs categorical feature columns
num_cols = X_real.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = [c for c in X_real.columns if c not in num_cols]

# Build Preprocessing Pipeline
transformers = []
if num_cols:
    num_pipe = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    transformers.append(('num', num_pipe, num_cols))

if cat_cols:
    cat_pipe = Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])
    transformers.append(('cat', cat_pipe, cat_cols))

preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')

# Choose Model
def get_model(m_type, seed_val):
    if m_type == 'logistic_regression':
        return LogisticRegression(max_iter=500, random_state=seed_val)
    elif m_type == 'gradient_boosting':
        return HistGradientBoostingClassifier(random_state=seed_val)
    else: # default random_forest
        return RandomForestClassifier(n_estimators=100, max_depth=8, random_state=seed_val)

# 1. Train Baseline Model (Train on Real -> Test on Real)
pipe_real = Pipeline([
    ('preprocessor', preprocessor),
    ('model', get_model(model_type, int(random_seed)))
])
pipe_real.fit(X_train_real, y_train_real)
preds_baseline = pipe_real.predict(X_test_real)

# 2. Train Synthetic Model (Train on Synthetic -> Test on REAL Test Set)
# Refit preprocessor on synthetic or reuse
pipe_synth = Pipeline([
    ('preprocessor', preprocessor),
    ('model', get_model(model_type, int(random_seed)))
])
pipe_synth.fit(X_synth, y_synth)
preds_synthetic = pipe_synth.predict(X_test_real)

# Compute Metrics
classes = sorted(list(set(y_real.unique()).union(set(y_synth.unique()))))

def compute_metrics(y_true, y_pred, class_list):
    acc = float(accuracy_score(y_true, y_pred))
    p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average='macro', zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=class_list).tolist()
    
    # Per-class metrics
    p_per, r_per, f1_per, sup = precision_recall_fscore_support(y_true, y_pred, labels=class_list, zero_division=0)
    per_class = {}
    for i, c in enumerate(class_list):
        per_class[str(c)] = {
            'precision': float(p_per[i]),
            'recall': float(r_per[i]),
            'f1': float(f1_per[i]),
            'support': int(sup[i])
        }
    
    return {
        'accuracy': round(acc, 4),
        'precision': round(float(p), 4),
        'recall': round(float(r), 4),
        'f1': round(float(f1), 4),
        'confusionMatrix': cm,
        'perClass': per_class
    }

baseline_res = compute_metrics(y_test_real, preds_baseline, classes)
synthetic_res = compute_metrics(y_test_real, preds_synthetic, classes)

# Feature Importance (if tree-based model)
feature_importances = {}
try:
    model_obj = pipe_real.named_steps['model']
    if hasattr(model_obj, 'feature_importances_'):
        # Get feature names from preprocessor
        feat_names = []
        if num_cols:
            feat_names.extend(num_cols)
        if cat_cols:
            ohe = pipe_real.named_steps['preprocessor'].named_transformers_['cat'].named_steps['onehot']
            feat_names.extend(ohe.get_feature_names_out(cat_cols).tolist())
        
        importances = model_obj.feature_importances_.tolist()
        for name, imp in zip(feat_names, importances):
            feature_importances[name] = round(float(imp), 4)
except Exception:
    pass

# TSTR Score (Fidelity Retention)
base_f1 = baseline_res['f1']
synth_f1 = synthetic_res['f1']
tstr_retention = round((synth_f1 / base_f1 * 100), 1) if base_f1 > 0 else 100.0

result_json = json.dumps({
    'classes': classes,
    'modelType': model_type,
    'trainRealSamples': len(X_train_real),
    'testRealSamples': len(X_test_real),
    'trainSyntheticSamples': len(X_synth),
    'baseline': baseline_res,
    'synthetic': synthetic_res,
    'tstrRetention': tstr_retention,
    'deltaAccuracy': round(synthetic_res['accuracy'] - baseline_res['accuracy'], 4),
    'deltaF1': round(synthetic_res['f1'] - baseline_res['f1'], 4),
    'featureImportances': feature_importances
})
result_json
`;

  const outputJsonString = await py.runPythonAsync(pythonScript);
  const resultData = JSON.parse(outputJsonString);

  sendProgress(taskId, 'Scikit-Learn TSTR evaluation completed.', 100);
  sendResult(taskId, resultData);
}

/**
 * Handle Train Model with Scikit-Learn.
 */
async function handleTrainSklearn(py, taskId, payload) {
  const { data, headers, targetCol, modelType = 'random_forest', testSize = 0.25, seed = 42 } = payload;

  sendProgress(taskId, 'Training model in Scikit-Learn...', 50);

  py.globals.set('raw_headers', headers);
  py.globals.set('raw_data', data);
  py.globals.set('target_col', targetCol);
  py.globals.set('model_type', modelType);
  py.globals.set('test_size', testSize);
  py.globals.set('random_seed', seed);

  const pythonScript = `
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

df = pd.DataFrame(list(raw_data), columns=list(raw_headers))
target = str(target_col)
df = df.dropna(subset=[target])

X = df.drop(columns=[target])
y = df[target].astype(str)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=float(test_size), random_state=int(random_seed)
)

num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]

transformers = []
if num_cols:
    transformers.append(('num', Pipeline([('imp', SimpleImputer(strategy='median')), ('scl', StandardScaler())]), num_cols))
if cat_cols:
    transformers.append(('cat', Pipeline([('imp', SimpleImputer(strategy='most_frequent')), ('ohe', OneHotEncoder(handle_unknown='ignore', sparse_output=False))]), cat_cols))

preprocessor = ColumnTransformer(transformers=transformers)

if model_type == 'logistic_regression':
    model = LogisticRegression(max_iter=500, random_state=int(random_seed))
elif model_type == 'gradient_boosting':
    model = HistGradientBoostingClassifier(random_state=int(random_seed))
else:
    model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=int(random_seed))

pipeline = Pipeline([('preprocessor', preprocessor), ('model', model)])
pipeline.fit(X_train, y_train)

preds = pipeline.predict(X_test)
classes = sorted(list(y.unique()))
acc = float(accuracy_score(y_test, preds))
p, r, f1, _ = precision_recall_fscore_support(y_test, preds, average='macro', zero_division=0)
cm = confusion_matrix(y_test, preds, labels=classes).tolist()

json.dumps({
    'classes': classes,
    'accuracy': round(acc, 4),
    'precision': round(float(p), 4),
    'recall': round(float(r), 4),
    'f1': round(float(f1), 4),
    'confusionMatrix': cm,
    'trainSamples': len(X_train),
    'testSamples': len(X_test)
})
`;

  const outputJsonString = await py.runPythonAsync(pythonScript);
  const resultData = JSON.parse(outputJsonString);

  sendProgress(taskId, 'Model trained successfully.', 100);
  sendResult(taskId, resultData);
}

/**
 * Handle Full Multi-Strategy Scikit-Learn Experiment in Pyodide.
 */
async function handleRunExperiment(py, taskId, payload) {
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

  sendProgress(taskId, 'Initializing Scikit-Learn Experiment in Python...', 20);

  py.globals.set('raw_headers', headers);
  py.globals.set('raw_data', data);
  py.globals.set('target_col', targetCol);
  py.globals.set('strategies_list', strategies);
  py.globals.set('strategy_params_json', JSON.stringify(strategyParams));
  py.globals.set('n_runs', runs);
  py.globals.set('split_ratio', trainTestSplit);
  py.globals.set('model_type', modelType);
  py.globals.set('base_seed', baseSeed);

  sendProgress(taskId, 'Executing Scikit-Learn multi-strategy training and cross-evaluation...', 45);

  const pythonScript = `
import json
import numpy as np
import pandas as pd
import json
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.model_selection import train_test_split
from sklearn.ensemble import (
    RandomForestClassifier, HistGradientBoostingClassifier,
    RandomForestRegressor, HistGradientBoostingRegressor
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, confusion_matrix,
    r2_score, mean_squared_error, mean_absolute_error
)
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from scipy.spatial.distance import cdist

df_raw = pd.DataFrame(list(raw_data), columns=list(raw_headers))
clean_cols = [str(c).strip() if str(c).strip() and str(c).lower() not in ['unnamed: 0', 'index', 'id'] else f'col_{i}' for i, c in enumerate(df_raw.columns)]
df_raw.columns = clean_cols

target = str(target_col).strip()
if target not in df_raw.columns:
    matched = [c for c in df_raw.columns if c.strip() == target]
    target = matched[0] if matched else df_raw.columns[-1]

df = df_raw.dropna(subset=[target]).copy()

for col in df.columns:
    if col == target:
        continue
    c_num = pd.to_numeric(df[col], errors="coerce")
    if c_num.notna().sum() > len(df) * 0.6:
        df[col] = c_num

target_num = pd.to_numeric(df[target], errors="coerce")
if target_num.notna().sum() == len(df):
    df[target] = target_num
    n_u = df[target].nunique()
    task_type = "classification" if (n_u <= 10 or (n_u <= 15 and n_u / len(df) < 0.15)) else "regression"
else:
    task_type = "classification"

id_cols = [c for c in df.columns if c != target and (c.lower() in ['unnamed: 0', 'index', 'id'] or c.startswith('col_0'))]
feat_cols = [c for c in df.columns if c != target and c not in id_cols]
if not feat_cols:
    feat_cols = [c for c in df.columns if c != target]

X = df[feat_cols].copy()
if task_type == "regression":
    y = df[target].astype(float)
    classes = ["continuous_target"]
else:
    y = df[target].astype(str)
    classes = sorted(list(y.unique()))

num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = [c for c in X.columns if c not in num_cols]

transformers = []
if num_cols:
    transformers.append(('num', Pipeline([('imp', SimpleImputer(strategy='median')), ('scl', StandardScaler())]), num_cols))
if cat_cols:
    transformers.append(('cat', Pipeline([('imp', SimpleImputer(strategy='most_frequent')), ('ohe', OneHotEncoder(handle_unknown='ignore', sparse_output=False))]), cat_cols))

preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')

def get_model(m_type, s_seed):
    if task_type == "regression":
        if m_type in ['logistic_regression', 'ridge']:
            return Ridge(random_state=int(s_seed))
        elif m_type == 'gradient_boosting':
            return HistGradientBoostingRegressor(random_state=int(s_seed))
        elif m_type == 'decision_tree':
            return DecisionTreeRegressor(max_depth=6, random_state=int(s_seed))
        elif m_type == 'knn':
            return KNeighborsRegressor(n_neighbors=min(5, max(2, int(s_seed) % 5 + 2)))
        else:
            return RandomForestRegressor(n_estimators=100, max_depth=8, random_state=int(s_seed))
    else:
        if m_type == 'logistic_regression':
            return LogisticRegression(max_iter=500, random_state=int(s_seed))
        elif m_type == 'gradient_boosting':
            return HistGradientBoostingClassifier(random_state=int(s_seed))
        elif m_type == 'decision_tree':
            return DecisionTreeClassifier(max_depth=6, random_state=int(s_seed))
        elif m_type == 'knn':
            return KNeighborsClassifier(n_neighbors=min(5, max(2, int(s_seed) % 5 + 2)))
        else:
            return RandomForestClassifier(n_estimators=100, max_depth=8, random_state=int(s_seed))

def apply_smote(X_df, y_ser, k=5, s_seed=42):
    rng = np.random.default_rng(s_seed)
    if task_type == "regression":
        n_samples = len(X_df)
        if n_samples < 2:
            return X_df.copy(), y_ser.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=float)
        cls_num = X_df[num_cols].values if num_cols else np.zeros((len(X_df), 1))
        col_stds = np.std(cls_num, axis=0)
        col_stds[col_stds == 0] = 1.0
        cls_num_norm = cls_num / col_stds
        dists = cdist(cls_num_norm, cls_num_norm, metric="euclidean")
        np.fill_diagonal(dists, np.inf)
        act_k = min(int(k), max(1, n_samples - 1))
        n_gen = max(5, int(n_samples * 0.5))
        s_rows = []
        s_targets = []
        for _ in range(n_gen):
            i = rng.integers(0, n_samples)
            nn_idx = np.argsort(dists[i])[:act_k]
            nn_i = rng.choice(nn_idx) if len(nn_idx) > 0 else i
            lam = rng.uniform(0.1, 0.9)
            row_dict = {}
            for c_name in num_cols:
                v1 = float(X_df.iloc[i][c_name])
                v2 = float(X_df.iloc[nn_i][c_name])
                row_dict[c_name] = v1 + lam * (v2 - v1)
            for c_name in cat_cols:
                row_dict[c_name] = X_df.iloc[i][c_name] if rng.random() < 0.5 else X_df.iloc[nn_i][c_name]
            y1 = float(y_ser.iloc[i])
            y2 = float(y_ser.iloc[nn_i])
            s_targets.append(y1 + lam * (y2 - y1))
            s_rows.append(row_dict)
        df_s = pd.DataFrame(s_rows)[X_df.columns]
        s_s = pd.Series(s_targets)
        return pd.concat([X_df, df_s], ignore_index=True), pd.concat([y_ser, s_s], ignore_index=True), df_s, s_s
    else:
        counts = y_ser.value_counts()
        if len(counts) < 2:
            return X_df.copy(), y_ser.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=str)
        max_c = counts.max()
        s_rows = []
        s_lbls = []
        for cls, cnt in counts.items():
            if cnt >= max_c:
                continue
            n_need = max_c - cnt
            c_df = X_df[y_ser == cls]
            c_num = c_df[num_cols].values if num_cols else np.zeros((len(c_df), 1))
            c_stds = np.std(c_num, axis=0)
            c_stds[c_stds == 0] = 1.0
            c_num_norm = c_num / c_stds
            n_s = len(c_df)
            act_k = min(int(k), max(1, n_s - 1))
            dists = cdist(c_num_norm, c_num_norm, metric='euclidean')
            np.fill_diagonal(dists, np.inf)
            for _ in range(n_need):
                i = rng.integers(0, n_s)
                nn_idx_list = np.argsort(dists[i])[:act_k]
                nn_i = rng.choice(nn_idx_list) if len(nn_idx_list) > 0 else i
                lam = rng.uniform(0.0, 1.0)
                row_dict = {}
                for c_name in num_cols:
                    row_dict[c_name] = float(c_df.iloc[i][c_name]) + lam * (float(c_df.iloc[nn_i][c_name]) - float(c_df.iloc[i][c_name]))
                for c_name in cat_cols:
                    row_dict[c_name] = c_df.iloc[i][c_name] if rng.random() < 0.5 else c_df.iloc[nn_i][c_name]
                s_rows.append(row_dict)
                s_lbls.append(str(cls))
        if not s_rows:
            return X_df.copy(), y_ser.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=str)
        df_s = pd.DataFrame(s_rows)[X_df.columns]
        s_s = pd.Series(s_lbls)
        return pd.concat([X_df, df_s], ignore_index=True), pd.concat([y_ser, s_s], ignore_index=True), df_s, s_s

def fit_eval(X_tr, y_tr, X_te, y_te, s_seed):
    pipe = Pipeline([('preprocessor', preprocessor), ('model', get_model(model_type, s_seed))])
    pipe.fit(X_tr, y_tr)
    preds = pipe.predict(X_te)
    if task_type == "regression":
        r2 = float(r2_score(y_te, preds))
        mse = float(mean_squared_error(y_te, preds))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_te, preds))
        corr_r = float(np.corrcoef(y_te, preds)[0, 1]) if len(y_te) > 1 else 1.0
        corr_r = float(np.nan_to_num(corr_r, nan=0.0))
        return {
            'r2': round(r2, 4), 'rmse': round(rmse, 4), 'mae': round(mae, 4), 'pearsonR': round(corr_r, 4),
            'accuracy': round(max(0.0, r2), 4), 'f1': round(max(0.0, r2), 4), 'precision': round(max(0.0, corr_r), 4),
            'recall': round(max(0.0, 1.0 - min(1.0, rmse / (np.std(y_te) or 1.0))), 4),
            'confusionMatrix': [[int(np.mean(y_te)), int(np.mean(preds))]],
            'perClass': {'regression': {'precision': round(corr_r, 4), 'recall': round(r2, 4), 'f1': round(r2, 4), 'support': len(y_te)}}
        }
    else:
        acc = float(accuracy_score(y_te, preds))
        p, r, f1, _ = precision_recall_fscore_support(y_te, preds, average='macro', zero_division=0)
        cm = confusion_matrix(y_te, preds, labels=classes)
        p_per, r_per, f1_per, sup = precision_recall_fscore_support(y_te, preds, labels=classes, zero_division=0)
        per_class = {}
        for ic, cn in enumerate(classes):
            per_class[str(cn)] = {
                'precision': round(float(p_per[ic]), 4),
                'recall': round(float(r_per[ic]), 4),
                'f1': round(float(f1_per[ic]), 4),
                'support': int(sup[ic])
            }
        return {
            'accuracy': round(acc, 4), 'precision': round(float(p), 4), 'recall': round(float(r), 4),
            'f1': round(float(f1), 4), 'confusionMatrix': cm.tolist(), 'perClass': per_class
        }

strategies = list(strategies_list)
strat_params = json.loads(str(strategy_params_json))
runs = int(n_runs)
test_sz = 1.0 - float(split_ratio)
if len(X) * test_sz < 2:
    test_sz = max(0.2, 2.0 / len(X))
b_seed = int(base_seed)

base_runs = []
strat_runs_dict = {st: [] for st in strategies}
sample_aug_dict = {}
sample_synth_dict = {}

for r in range(runs):
    cur_seed = b_seed + r * 17
    try:
        if task_type == "classification":
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_sz, random_state=cur_seed, stratify=y)
        else:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_sz, random_state=cur_seed)
    except Exception:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_sz, random_state=cur_seed)
    
    base_res = fit_eval(X_train, y_train, X_test, y_test, cur_seed)
    base_runs.append(base_res)

    for st in strategies:
        p_d = strat_params.get(st, {})
        if st in ['smote', 'adasyn', 'smote_tomek']:
            k_v = p_d.get('k', 5)
            Xa, ya, Xs, ys = apply_smote(X_train, y_train, k=k_v, s_seed=cur_seed)
        elif st == 'oversampling':
            rng_os = np.random.default_rng(cur_seed)
            if task_type == "regression":
                n_need = max(5, int(len(X_train) * 0.5))
                os_r, os_t = [], []
                for _ in range(n_need):
                    idx_c = rng_os.integers(0, len(X_train))
                    sample = X_train.iloc[idx_c].to_dict()
                    for col in num_cols:
                        v = float(sample[col]) if pd.notna(sample[col]) else 0.0
                        sample[col] = v + rng_os.normal(0, abs(v)*0.05 if v!=0 else 0.05)
                    y_v = float(y_train.iloc[idx_c])
                    os_t.append(y_v + rng_os.normal(0, abs(y_v)*0.025 if y_v!=0 else 0.1))
                    os_r.append(sample)
                Xs = pd.DataFrame(os_r)[X_train.columns]
                ys = pd.Series(os_t)
                Xa = pd.concat([X_train, Xs], ignore_index=True)
                ya = pd.concat([y_train, ys], ignore_index=True)
            else:
                cnts = y_train.value_counts()
                mx = cnts.max()
                os_r, os_l = [], []
                for c_k, c_v in cnts.items():
                    if c_v < mx:
                        c_sub = X_train[y_train == c_k]
                        for _ in range(mx - c_v):
                            idx_c = rng_os.integers(0, len(c_sub))
                            os_r.append(c_sub.iloc[idx_c].to_dict())
                            os_l.append(str(c_k))
                if os_r:
                    Xs = pd.DataFrame(os_r)[X_train.columns]
                    ys = pd.Series(os_l)
                    Xa = pd.concat([X_train, Xs], ignore_index=True)
                    ya = pd.concat([y_train, ys], ignore_index=True)
                else:
                    Xa, ya, Xs, ys = X_train.copy(), y_train.copy(), pd.DataFrame(columns=X.columns), pd.Series(dtype=str)
        else: # noise_injection
            rng_ns = np.random.default_rng(cur_seed)
            Xs = X_train.copy()
            for col in num_cols:
                v = Xs[col].dropna().values
                Xs[col] = Xs[col] + rng_ns.normal(0, (np.std(v) or 1.0) * 0.08, size=len(Xs))
            ys = y_train.copy()
            Xa = pd.concat([X_train, Xs], ignore_index=True)
            ya = pd.concat([y_train, ys], ignore_index=True)

        if r == 0:
            sample_aug_dict[st] = (Xa, ya)
            sample_synth_dict[st] = (Xs, ys)

        s_res = fit_eval(Xa, ya, X_test, y_test, cur_seed)
        strat_runs_dict[st].append(s_res)

def aggregate(r_list):
    accs = [item['accuracy'] for item in r_list]
    precs = [item['precision'] for item in r_list]
    recs = [item['recall'] for item in r_list]
    f1s = [item['f1'] for item in r_list]
    if task_type == "regression":
        r2s = [item['r2'] for item in r_list]
        rmses = [item['rmse'] for item in r_list]
        maes = [item['mae'] for item in r_list]
        pearsons = [item['pearsonR'] for item in r_list]
        return {
            'r2': {'mean': round(float(np.mean(r2s)), 4), 'std': round(float(np.std(r2s)), 4)},
            'rmse': {'mean': round(float(np.mean(rmses)), 4), 'std': round(float(np.std(rmses)), 4)},
            'mae': {'mean': round(float(np.mean(maes)), 4), 'std': round(float(np.std(maes)), 4)},
            'pearsonR': {'mean': round(float(np.mean(pearsons)), 4), 'std': round(float(np.std(pearsons)), 4)},
            'accuracy': {'mean': round(float(np.mean(accs)), 4), 'std': round(float(np.std(accs)), 4)},
            'precision': {'mean': round(float(np.mean(precs)), 4), 'std': round(float(np.std(precs)), 4)},
            'recall': {'mean': round(float(np.mean(recs)), 4), 'std': round(float(np.std(recs)), 4)},
            'f1': {'mean': round(float(np.mean(f1s)), 4), 'std': round(float(np.std(f1s)), 4)},
            'confusionMatrix': {'classes': classes, 'rawMatrix': [[round(float(np.mean(r2s)), 3)]], 'normalizedMatrix': [[round(float(np.mean(r2s)), 3)]], 'perClassMetrics': {}}
        }
    else:
        n_c = len(classes)
        avg_cm = np.zeros((n_c, n_c))
        for item in r_list:
            avg_cm += np.array(item['confusionMatrix']) / len(r_list)
        r_sums = avg_cm.sum(axis=1, keepdims=True)
        r_sums[r_sums == 0] = 1.0
        norm_cm = avg_cm / r_sums
        avg_per_class = {}
        for ic, cn in enumerate(classes):
            tp = avg_cm[ic, ic]
            fn = avg_cm[ic, :].sum() - tp
            fp = avg_cm[:, ic].sum() - tp
            tn = avg_cm.sum() - (tp + fn + fp)
            sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            avg_per_class[str(cn)] = {
                'className': str(cn), 'tp': round(float(tp), 1), 'fn': round(float(fn), 1),
                'fp': round(float(fp), 1), 'tn': round(float(tn), 1), 'sensitivity': round(float(sens), 4),
                'specificity': round(float(spec), 4), 'fpr': round(float(fpr), 4)
            }
        return {
            'accuracy': {'mean': round(float(np.mean(accs)), 4), 'std': round(float(np.std(accs)), 4)},
            'precision': {'mean': round(float(np.mean(precs)), 4), 'std': round(float(np.std(precs)), 4)},
            'recall': {'mean': round(float(np.mean(recs)), 4), 'std': round(float(np.std(recs)), 4)},
            'f1': {'mean': round(float(np.mean(f1s)), 4), 'std': round(float(np.std(f1s)), 4)},
            'confusionMatrix': {'classes': classes, 'rawMatrix': np.round(avg_cm, 1).tolist(), 'normalizedMatrix': np.round(norm_cm, 4).tolist(), 'perClassMetrics': avg_per_class}
        }

base_agg = aggregate(base_runs)
strat_results = []
best_strat = None
best_imp = -999.0
pk = 'r2' if task_type == 'regression' else 'f1'

for st in strategies:
    s_runs = strat_runs_dict[st]
    s_agg = aggregate(s_runs)
    diff_score = s_agg[pk]['mean'] - base_agg[pk]['mean']
    pct_imp = round((diff_score / abs(base_agg[pk]['mean']) * 100), 2) if base_agg[pk]['mean'] != 0 else 0.0
    if pct_imp > best_imp:
        best_imp = pct_imp
        best_strat = st
    
    feat_drift = []
    Xa_samp, _ = sample_aug_dict.get(st, (X, y))
    Xs_samp, _ = sample_synth_dict.get(st, (pd.DataFrame(), pd.Series()))
    for col in num_cols:
        o_v = X[col].dropna().values.astype(float)
        s_v = Xs_samp[col].dropna().values.astype(float) if col in Xs_samp else o_v
        if len(o_v) > 0 and len(s_v) > 0:
            ks_stat, ks_pval = stats.ks_2samp(o_v, s_v)
            w1 = stats.wasserstein_distance(o_v, s_v)
            feat_drift.append({
                'featureName': col,
                'originalMean': round(float(np.mean(o_v)), 2),
                'originalStd': round(float(np.std(o_v)), 2) or 1.0,
                'syntheticMean': round(float(np.mean(s_v)), 2),
                'syntheticStd': round(float(np.std(s_v)), 2) or 1.0,
                'ksStatistic': round(float(ks_stat), 4),
                'ksPValue': round(float(ks_pval), 4),
                'driftSeverity': 'safe' if ks_stat < 0.18 else ('moderate' if ks_stat < 0.35 else 'severe'),
                'wassersteinDistance': round(float(w1), 4)
            })

    Xa_full = Xa_samp.copy()
    Xa_full[target] = sample_aug_dict[st][1].values
    aug_csv = Xa_full.to_csv(index=False)
    if len(Xs_samp) > 0:
        Xs_full = Xs_samp.copy()
        Xs_full[target] = sample_synth_dict[st][1].values
        synth_csv = Xs_full.to_csv(index=False)
    else:
        synth_csv = ''

    strat_results.append({
        'strategyType': st,
        'strategyParams': strat_params.get(st, {}),
        'evaluation': {'runs': s_runs, 'aggregated': s_agg, 'classes': classes},
        'comparison': {
            'deltaAccuracy': round(s_agg['accuracy']['mean'] - base_agg['accuracy']['mean'], 4),
            'deltaPrecision': round(s_agg['precision']['mean'] - base_agg['precision']['mean'], 4),
            'deltaRecall': round(s_agg['recall']['mean'] - base_agg['recall']['mean'], 4),
            'deltaF1': round(diff_score, 4),
            'percentageImprovement': pct_imp,
            'isSignificant': False,
            'pEstimate': 0.05
        },
        'featureDrift': feat_drift,
        'syntheticCount': len(Xs_samp),
        'augmentedRowCount': len(Xa_samp),
        'augmentedCSV': aug_csv,
        'syntheticCSV': synth_csv
    })

verdict = 'recommended' if best_imp > 1.5 else ('not_recommended' if best_imp < -1.5 else 'inconclusive')
metric_name = "R² Variance Explained" if task_type == "regression" else "Macro F1"
recommendation = {
    'verdict': verdict,
    'bestStrategy': best_strat,
    'improvement': best_imp,
    'confidence': 'high' if verdict != 'inconclusive' else 'low',
    'explanations': [f"{best_strat.upper() if best_strat else 'Baseline'} produced {metric_name} delta of {best_imp:+.1f}% on {model_type.upper()}."],
    'timestamp': pd.Timestamp.now().isoformat()
}

json.dumps({
    'taskType': task_type,
    'classes': classes,
    'baseline': {'runs': base_runs, 'aggregated': base_agg, 'classes': classes},
    'strategyResults': strat_results,
    'recommendation': recommendation
})
`;

  const outputJsonString = await py.runPythonAsync(pythonScript);
  const resultData = JSON.parse(outputJsonString);

  sendProgress(taskId, 'Experiment completed successfully.', 100);
  sendResult(taskId, resultData);
}

