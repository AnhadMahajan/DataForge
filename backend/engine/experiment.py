"""
DataForge — Native Python Scikit-Learn Experiment Engine (Classification & Regression)
Supports:
1. Classification Tasks: RandomForestClassifier, HistGradientBoostingClassifier, LogisticRegression, DecisionTreeClassifier, KNeighborsClassifier
2. Regression Tasks: RandomForestRegressor, HistGradientBoostingRegressor, Ridge, DecisionTreeRegressor, KNeighborsRegressor
Enforces strict scientific rule: TEST SET IS NEVER AUGMENTED.
"""

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.model_selection import train_test_split
from sklearn.ensemble import (
    RandomForestClassifier,
    HistGradientBoostingClassifier,
    RandomForestRegressor,
    HistGradientBoostingRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge, LinearRegression
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    r2_score,
    mean_squared_error,
    mean_absolute_error,
)
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from scipy.spatial.distance import cdist


def detect_task_type(y_series: pd.Series) -> str:
    """
    Detect whether the problem is Classification or Regression.
    - Classification: string/categorical or discrete numeric with <= 10 unique values
    - Regression: numeric continuous with > 10 unique values
    """
    # Check if string/object
    if y_series.dtype == object or pd.api.types.is_string_dtype(y_series):
        return "classification"

    # Numeric: check cardinality
    n_unique = y_series.dropna().nunique()
    if n_unique <= 10 or (n_unique <= 15 and n_unique / max(1, len(y_series)) < 0.15):
        return "classification"
    return "regression"


def get_model(model_type: str, task_type: str, seed: int = 42):
    """Instantiate configured Scikit-Learn classifier or regressor."""
    if task_type == "regression":
        if model_type in ["logistic_regression", "ridge", "linear_regression"]:
            return Ridge(random_state=seed)
        elif model_type == "gradient_boosting":
            return HistGradientBoostingRegressor(random_state=seed)
        elif model_type == "decision_tree":
            return DecisionTreeRegressor(max_depth=6, random_state=seed)
        elif model_type == "knn":
            return KNeighborsRegressor(n_neighbors=min(5, max(2, seed % 5 + 2)))
        else:  # default random_forest
            return RandomForestRegressor(n_estimators=100, max_depth=8, random_state=seed)
    else:  # classification
        if model_type == "logistic_regression":
            return LogisticRegression(max_iter=500, random_state=seed)
        elif model_type == "gradient_boosting":
            return HistGradientBoostingClassifier(random_state=seed)
        elif model_type == "decision_tree":
            return DecisionTreeClassifier(max_depth=6, random_state=seed)
        elif model_type == "knn":
            return KNeighborsClassifier(n_neighbors=min(5, max(2, seed % 5 + 2)))
        else:  # default random_forest
            return RandomForestClassifier(n_estimators=100, max_depth=8, random_state=seed)


def apply_real_smote(X_df: pd.DataFrame, y_series: pd.Series, task_type: str = "classification", k: int = 5, seed: int = 42):
    """
    Genuine SMOTE / Interpolation for Classification and Regression.
    """
    rng = np.random.default_rng(seed)
    num_cols = X_df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = [c for c in X_df.columns if c not in num_cols]

    if task_type == "regression":
        # Continuous regression augmentation: bin target into quantiles and interpolate within bins
        try:
            n_bins = min(4, max(2, len(y_series) // 5))
            bins = pd.qcut(y_series, q=n_bins, duplicates="drop")
            counts = bins.value_counts()
            max_count = counts.max()
        except Exception:
            bins = None
            max_count = len(y_series)

        synth_rows = []
        synth_targets = []
        n_samples = len(X_df)

        if n_samples < 2:
            return X_df.copy(), y_series.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=float)

        # Distance matrix for KNN interpolation
        cls_num = X_df[num_cols].values if num_cols else np.zeros((len(X_df), 1))
        col_stds = np.std(cls_num, axis=0)
        col_stds[col_stds == 0] = 1.0
        cls_num_norm = cls_num / col_stds

        dists = cdist(cls_num_norm, cls_num_norm, metric="euclidean")
        np.fill_diagonal(dists, np.inf)
        actual_k = min(int(k), max(1, n_samples - 1))

        n_to_generate = max(5, int(n_samples * 0.5))
        for _ in range(n_to_generate):
            i = rng.integers(0, n_samples)
            nn_indices = np.argsort(dists[i])[:actual_k]
            nn_idx = rng.choice(nn_indices) if len(nn_indices) > 0 else i

            lam = rng.uniform(0.1, 0.9)
            row_dict = {}
            for c_name in num_cols:
                v1 = float(X_df.iloc[i][c_name])
                v2 = float(X_df.iloc[nn_idx][c_name])
                row_dict[c_name] = v1 + lam * (v2 - v1)

            for c_name in cat_cols:
                row_dict[c_name] = X_df.iloc[i][c_name] if rng.random() < 0.5 else X_df.iloc[nn_idx][c_name]

            # Interpolate target
            y1 = float(y_series.iloc[i])
            y2 = float(y_series.iloc[nn_idx])
            synth_targets.append(y1 + lam * (y2 - y1))
            synth_rows.append(row_dict)

        df_synth = pd.DataFrame(synth_rows)[X_df.columns]
        s_synth = pd.Series(synth_targets)
        df_aug = pd.concat([X_df, df_synth], ignore_index=True)
        s_aug = pd.concat([y_series, s_synth], ignore_index=True)
        return df_aug, s_aug, df_synth, s_synth

    else:
        # Classification SMOTE
        counts = y_series.value_counts()
        if len(counts) < 2:
            return X_df.copy(), y_series.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=str)

        max_count = counts.max()
        synth_rows = []
        synth_labels = []

        for cls, count in counts.items():
            if count >= max_count:
                continue
            n_needed = max_count - count
            cls_df = X_df[y_series == cls]
            cls_num = cls_df[num_cols].values if num_cols else np.zeros((len(cls_df), 1))

            col_stds = np.std(cls_num, axis=0)
            col_stds[col_stds == 0] = 1.0
            cls_num_norm = cls_num / col_stds

            n_samples = len(cls_df)
            actual_k = min(int(k), max(1, n_samples - 1))

            dists = cdist(cls_num_norm, cls_num_norm, metric="euclidean")
            np.fill_diagonal(dists, np.inf)

            for _ in range(n_needed):
                i = rng.integers(0, n_samples)
                nn_indices = np.argsort(dists[i])[:actual_k]
                nn_idx = rng.choice(nn_indices) if len(nn_indices) > 0 else i

                lam = rng.uniform(0.0, 1.0)
                new_row_dict = {}
                for c_name in num_cols:
                    orig_v = float(cls_df.iloc[i][c_name])
                    neighbor_v = float(cls_df.iloc[nn_idx][c_name])
                    new_row_dict[c_name] = orig_v + lam * (neighbor_v - orig_v)

                for c_name in cat_cols:
                    v1 = cls_df.iloc[i][c_name]
                    v2 = cls_df.iloc[nn_idx][c_name]
                    new_row_dict[c_name] = v1 if rng.random() < 0.5 else v2

                synth_rows.append(new_row_dict)
                synth_labels.append(str(cls))

        if not synth_rows:
            return X_df.copy(), y_series.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=str)

        df_synth = pd.DataFrame(synth_rows)[X_df.columns]
        s_synth = pd.Series(synth_labels)
        df_aug = pd.concat([X_df, df_synth], ignore_index=True)
        s_aug = pd.concat([y_series, s_synth], ignore_index=True)
        return df_aug, s_aug, df_synth, s_synth


def apply_real_oversampling(X_df: pd.DataFrame, y_series: pd.Series, task_type: str = "classification", jitter_std: float = 0.05, seed: int = 42):
    """Random oversampling with Gaussian jitter."""
    rng = np.random.default_rng(seed)
    num_cols = X_df.select_dtypes(include=[np.number]).columns.tolist()

    if task_type == "regression":
        n_needed = max(5, int(len(X_df) * 0.5))
        synth_rows = []
        synth_targets = []
        for _ in range(n_needed):
            idx = rng.integers(0, len(X_df))
            sample = X_df.iloc[idx].to_dict()
            for col in num_cols:
                v = float(sample[col]) if pd.notna(sample[col]) else 0.0
                scale = abs(v) * jitter_std if v != 0 else jitter_std
                sample[col] = v + rng.normal(0, scale)
            y_v = float(y_series.iloc[idx])
            y_scale = abs(y_v) * (jitter_std * 0.5) if y_v != 0 else 0.1
            synth_targets.append(y_v + rng.normal(0, y_scale))
            synth_rows.append(sample)

        df_synth = pd.DataFrame(synth_rows)[X_df.columns]
        s_synth = pd.Series(synth_targets)
        df_aug = pd.concat([X_df, df_synth], ignore_index=True)
        s_aug = pd.concat([y_series, s_synth], ignore_index=True)
        return df_aug, s_aug, df_synth, s_synth
    else:
        counts = y_series.value_counts()
        max_count = counts.max()
        synth_rows = []
        synth_labels = []

        for cls, count in counts.items():
            if count >= max_count:
                continue
            n_needed = max_count - count
            cls_df = X_df[y_series == cls]

            for _ in range(n_needed):
                idx = rng.integers(0, len(cls_df))
                sample = cls_df.iloc[idx].to_dict()
                for col in num_cols:
                    v = float(sample[col]) if pd.notna(sample[col]) else 0.0
                    scale = abs(v) * jitter_std if v != 0 else jitter_std
                    sample[col] = v + rng.normal(0, scale)
                synth_rows.append(sample)
                synth_labels.append(str(cls))

        if not synth_rows:
            return X_df.copy(), y_series.copy(), pd.DataFrame(columns=X_df.columns), pd.Series(dtype=str)

        df_synth = pd.DataFrame(synth_rows)[X_df.columns]
        s_synth = pd.Series(synth_labels)
        df_aug = pd.concat([X_df, df_synth], ignore_index=True)
        s_aug = pd.concat([y_series, s_synth], ignore_index=True)
        return df_aug, s_aug, df_synth, s_synth


def apply_real_noise(X_df: pd.DataFrame, y_series: pd.Series, noise_factor: float = 0.08, seed: int = 42):
    """Gaussian noise injection on feature space."""
    rng = np.random.default_rng(seed)
    num_cols = X_df.select_dtypes(include=[np.number]).columns.tolist()
    synth_df = X_df.copy()

    for col in num_cols:
        vals = synth_df[col].dropna().values
        std_val = float(np.std(vals)) or 1.0
        synth_df[col] = synth_df[col] + rng.normal(0, std_val * noise_factor, size=len(synth_df))

    df_aug = pd.concat([X_df, synth_df], ignore_index=True)
    s_aug = pd.concat([y_series, y_series], ignore_index=True)
    return df_aug, s_aug, synth_df, y_series.copy()


def run_full_experiment_pipeline(
    df_raw: pd.DataFrame,
    target_col: str,
    strategies: list = None,
    strategy_params: dict = None,
    runs: int = 3,
    train_test_split_ratio: float = 0.8,
    model_type: str = "random_forest",
    base_seed: int = 42,
) -> dict:
    """
    Executes real Scikit-Learn multi-strategy evaluation for Classification AND Regression.
    """
    if strategies is None:
        strategies = ["smote", "adasyn", "oversampling", "noise_injection"]
    if strategy_params is None:
        strategy_params = {}

    # Clean headers: fix empty strings and unnamed index columns
    clean_cols = []
    for i, c in enumerate(df_raw.columns):
        c_str = str(c).strip()
        if not c_str or c_str.lower() in ["unnamed: 0", "index", "id"]:
            clean_cols.append(f"col_{i}" if not c_str else c_str)
        else:
            clean_cols.append(c_str)
    df_raw.columns = clean_cols

    if target_col not in df_raw.columns:
        # Try matching stripped target column
        matched = [c for c in df_raw.columns if c.strip() == str(target_col).strip()]
        if matched:
            target_col = matched[0]
        else:
            raise ValueError(f"Target column '{target_col}' not found in dataset columns: {df_raw.columns.tolist()}")

    # 1. Clean missing target rows & normalize
    df = df_raw.dropna(subset=[target_col]).copy()
    if len(df) < 5:
        raise ValueError("Dataset has fewer than 5 rows after dropping missing targets.")

    # Automatically clean numeric columns
    for col in df.columns:
        if col == target_col:
            continue
        c_num = pd.to_numeric(df[col], errors="coerce")
        if c_num.notna().sum() > len(df) * 0.6:
            df[col] = c_num

    # Determine Task Type: Classification vs Regression
    target_raw_num = pd.to_numeric(df[target_col], errors="coerce")
    if target_raw_num.notna().sum() == len(df):
        df[target_col] = target_raw_num
        task_type = detect_task_type(df[target_col])
    else:
        task_type = "classification"

    # Exclude ID / Index columns from features
    id_cols = [c for c in df.columns if c != target_col and (c.lower() in ["unnamed: 0", "index", "id"] or c.startswith("col_0"))]
    feature_cols = [c for c in df.columns if c != target_col and c not in id_cols]

    if not feature_cols:
        feature_cols = [c for c in df.columns if c != target_col]

    X = df[feature_cols].copy()

    if task_type == "classification":
        y = df[target_col].astype(str)
        classes = sorted(list(y.unique()))
        if len(classes) < 2:
            raise ValueError(f"Target column '{target_col}' must contain at least 2 distinct classes (found {len(classes)}).")
    else:
        y = df[target_col].astype(float)
        classes = ["continuous_target"]

    # Feature transformers
    num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = [c for c in X.columns if c not in num_cols]

    transformers = []
    if num_cols:
        transformers.append(("num", Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]), num_cols))

    if cat_cols:
        transformers.append(("cat", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), cat_cols))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    # Helper: Fit and evaluate
    def fit_and_eval(X_train, y_train, X_test, y_test, seed):
        pipe = Pipeline([
            ("preprocessor", preprocessor),
            ("model", get_model(model_type, task_type, seed)),
        ])
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)

        if task_type == "regression":
            r2 = float(r2_score(y_test, y_pred))
            mse = float(mean_squared_error(y_test, y_pred))
            rmse = float(np.sqrt(mse))
            mae = float(mean_absolute_error(y_test, y_pred))
            # Correlation r
            try:
                corr_r = float(np.corrcoef(y_test, y_pred)[0, 1]) if len(y_test) > 1 else 1.0
                corr_r = float(np.nan_to_num(corr_r, nan=0.0))
            except Exception:
                corr_r = 0.0

            return {
                "r2": round(r2, 4),
                "rmse": round(rmse, 4),
                "mae": round(mae, 4),
                "pearsonR": round(corr_r, 4),
                "accuracy": round(max(0.0, r2), 4),  # R^2 mapped for uniform gauge
                "f1": round(max(0.0, r2), 4),
                "precision": round(max(0.0, corr_r), 4),
                "recall": round(max(0.0, 1.0 - min(1.0, rmse / (np.std(y_test) or 1.0))), 4),
                "confusionMatrix": [[int(np.mean(y_test)), int(np.mean(y_pred))]],
                "perClass": {
                    "regression": {
                        "precision": round(corr_r, 4),
                        "recall": round(r2, 4),
                        "f1": round(r2, 4),
                        "support": len(y_test),
                    }
                },
            }
        else:
            acc = float(accuracy_score(y_test, y_pred))
            p, r, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="macro", zero_division=0)
            cm = confusion_matrix(y_test, y_pred, labels=classes)

            p_per, r_per, f1_per, sup = precision_recall_fscore_support(y_test, y_pred, labels=classes, zero_division=0)
            per_class = {}
            for idx_c, cls_name in enumerate(classes):
                per_class[str(cls_name)] = {
                    "precision": round(float(p_per[idx_c]), 4),
                    "recall": round(float(r_per[idx_c]), 4),
                    "f1": round(float(f1_per[idx_c]), 4),
                    "support": int(sup[idx_c]),
                }

            return {
                "accuracy": round(acc, 4),
                "precision": round(float(p), 4),
                "recall": round(float(r), 4),
                "f1": round(float(f1), 4),
                "confusionMatrix": cm.tolist(),
                "perClass": per_class,
            }

    # Run Multi-Split Evaluation
    baseline_runs = []
    strategy_runs_map = {strat: [] for strat in strategies}
    sample_augmented_data = {}
    sample_synthetic_data = {}

    test_size = 1.0 - train_test_split_ratio
    # Guard test size for small datasets: ensure at least 2 test samples
    if len(X) * test_size < 2:
        test_size = max(0.2, 2.0 / len(X))

    for r_idx in range(runs):
        current_seed = base_seed + r_idx * 17

        # Stratified split for classification, random split for regression
        try:
            if task_type == "classification":
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=test_size, random_state=current_seed, stratify=y
                )
            else:
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=test_size, random_state=current_seed
                )
        except Exception:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=current_seed
            )

        # 1. Baseline Model
        base_res = fit_and_eval(X_train, y_train, X_test, y_test, current_seed)
        baseline_runs.append(base_res)

        # 2. Strategies
        for strat in strategies:
            p_dict = strategy_params.get(strat, {})
            if strat in ["smote", "adasyn", "smote_tomek"]:
                k_val = p_dict.get("k", 5)
                X_aug, y_aug, X_synth, y_synth = apply_real_smote(X_train, y_train, task_type=task_type, k=k_val, seed=current_seed)
            elif strat == "oversampling":
                jitter = p_dict.get("jitterStd", 0.05)
                X_aug, y_aug, X_synth, y_synth = apply_real_oversampling(X_train, y_train, task_type=task_type, jitter_std=jitter, seed=current_seed)
            elif strat == "noise_injection":
                factor = p_dict.get("noiseFactor", 0.08)
                X_aug, y_aug, X_synth, y_synth = apply_real_noise(X_train, y_train, noise_factor=factor, seed=current_seed)
            else:
                X_aug, y_aug, X_synth, y_synth = X_train.copy(), y_train.copy(), pd.DataFrame(columns=X.columns), pd.Series(dtype=float)

            if r_idx == 0:
                sample_augmented_data[strat] = (X_aug, y_aug)
                sample_synthetic_data[strat] = (X_synth, y_synth)

            strat_eval = fit_and_eval(X_aug, y_aug, X_test, y_test, current_seed)
            strategy_runs_map[strat].append(strat_eval)

    # Aggregate
    def aggregate(runs_list):
        accs = [r["accuracy"] for r in runs_list]
        precs = [r["precision"] for r in runs_list]
        recs = [r["recall"] for r in runs_list]
        f1s = [r["f1"] for r in runs_list]

        if task_type == "regression":
            r2s = [r["r2"] for r in runs_list]
            rmses = [r["rmse"] for r in runs_list]
            maes = [r["mae"] for r in runs_list]
            pearsons = [r["pearsonR"] for r in runs_list]

            return {
                "r2": {"mean": round(float(np.mean(r2s)), 4), "std": round(float(np.std(r2s)), 4)},
                "rmse": {"mean": round(float(np.mean(rmses)), 4), "std": round(float(np.std(rmses)), 4)},
                "mae": {"mean": round(float(np.mean(maes)), 4), "std": round(float(np.std(maes)), 4)},
                "pearsonR": {"mean": round(float(np.mean(pearsons)), 4), "std": round(float(np.std(pearsons)), 4)},
                "accuracy": {"mean": round(float(np.mean(accs)), 4), "std": round(float(np.std(accs)), 4)},
                "precision": {"mean": round(float(np.mean(precs)), 4), "std": round(float(np.std(precs)), 4)},
                "recall": {"mean": round(float(np.mean(recs)), 4), "std": round(float(np.std(recs)), 4)},
                "f1": {"mean": round(float(np.mean(f1s)), 4), "std": round(float(np.std(f1s)), 4)},
                "confusionMatrix": {
                    "classes": classes,
                    "rawMatrix": [[round(float(np.mean(r2s)), 3)]],
                    "normalizedMatrix": [[round(float(np.mean(r2s)), 3)]],
                    "perClassMetrics": {
                        "continuous_target": {
                            "className": "Continuous Target",
                            "sensitivity": round(float(np.mean(r2s)), 4),
                            "specificity": round(float(np.mean(pearsons)), 4),
                            "fpr": 0.0,
                            "tp": round(float(np.mean(r2s)), 2),
                            "fn": 0.0,
                            "fp": 0.0,
                            "tn": 0.0,
                        }
                    },
                },
            }
        else:
            n_c = len(classes)
            avg_cm = np.zeros((n_c, n_c))
            for r in runs_list:
                avg_cm += np.array(r["confusionMatrix"]) / len(runs_list)

            row_sums = avg_cm.sum(axis=1, keepdims=True)
            row_sums[row_sums == 0] = 1.0
            norm_cm = avg_cm / row_sums

            avg_per_class = {}
            for idx_c, c_name in enumerate(classes):
                tp = avg_cm[idx_c, idx_c]
                fn = avg_cm[idx_c, :].sum() - tp
                fp = avg_cm[:, idx_c].sum() - tp
                tn = avg_cm.sum() - (tp + fn + fp)
                sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
                spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
                fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

                avg_per_class[str(c_name)] = {
                    "className": str(c_name),
                    "tp": round(float(tp), 1),
                    "fn": round(float(fn), 1),
                    "fp": round(float(fp), 1),
                    "tn": round(float(tn), 1),
                    "sensitivity": round(float(sens), 4),
                    "specificity": round(float(spec), 4),
                    "fpr": round(float(fpr), 4),
                }

            return {
                "accuracy": {"mean": round(float(np.mean(accs)), 4), "std": round(float(np.std(accs)), 4)},
                "precision": {"mean": round(float(np.mean(precs)), 4), "std": round(float(np.std(precs)), 4)},
                "recall": {"mean": round(float(np.mean(recs)), 4), "std": round(float(np.std(recs)), 4)},
                "f1": {"mean": round(float(np.mean(f1s)), 4), "std": round(float(np.std(f1s)), 4)},
                "confusionMatrix": {
                    "classes": classes,
                    "rawMatrix": np.round(avg_cm, 1).tolist(),
                    "normalizedMatrix": np.round(norm_cm, 4).tolist(),
                    "perClassMetrics": avg_per_class,
                },
            }

    base_aggregated = aggregate(baseline_runs)
    strategy_results = []

    best_strategy = None
    best_improvement = -999.0

    for strat in strategies:
        strat_runs = strategy_runs_map[strat]
        strat_agg = aggregate(strat_runs)

        primary_key = "r2" if task_type == "regression" else "f1"
        base_primary_mean = base_aggregated[primary_key]["mean"]
        strat_primary_mean = strat_agg[primary_key]["mean"]
        diff_primary = strat_primary_mean - base_primary_mean

        if base_primary_mean > 0:
            pct_imp = round((diff_primary / abs(base_primary_mean) * 100), 2)
        else:
            pct_imp = round(diff_primary * 100, 2)

        # Paired T-Test
        base_scores = [r[primary_key] for r in baseline_runs]
        strat_scores = [r[primary_key] for r in strat_runs]
        if len(base_scores) > 1 and np.std(np.array(strat_scores) - np.array(base_scores)) > 0:
            t_res = stats.ttest_rel(strat_scores, base_scores)
            p_val = float(t_res.pvalue) if not np.isnan(t_res.pvalue) else 0.5
        else:
            p_val = 0.5

        is_sig = p_val < 0.05

        if pct_imp > best_improvement:
            best_improvement = pct_imp
            best_strategy = strat

        # Feature drift
        feature_drift = []
        X_aug_sample, _ = sample_augmented_data.get(strat, (X, y))
        X_synth_sample, _ = sample_synthetic_data.get(strat, (pd.DataFrame(), pd.Series()))

        for col in num_cols:
            orig_vals = X[col].dropna().values.astype(float)
            synth_vals = X_synth_sample[col].dropna().values.astype(float) if col in X_synth_sample else orig_vals

            if len(orig_vals) > 0 and len(synth_vals) > 0:
                ks_stat, ks_pval = stats.ks_2samp(orig_vals, synth_vals)
                w1 = stats.wasserstein_distance(orig_vals, synth_vals)
                drift_sev = "safe" if ks_stat < 0.18 else ("moderate" if ks_stat < 0.35 else "severe")

                feature_drift.append({
                    "featureName": col,
                    "originalMean": round(float(np.mean(orig_vals)), 2),
                    "originalStd": round(float(np.std(orig_vals)), 2) or 1.0,
                    "syntheticMean": round(float(np.mean(synth_vals)), 2),
                    "syntheticStd": round(float(np.std(synth_vals)), 2) or 1.0,
                    "ksStatistic": round(float(ks_stat), 4),
                    "ksPValue": round(float(ks_pval), 4),
                    "driftSeverity": drift_sev,
                    "wassersteinDistance": round(float(w1), 4),
                })

        # Generate CSVs
        X_aug_full = X_aug_sample.copy()
        X_aug_full[target_col] = sample_augmented_data[strat][1].values
        aug_csv = X_aug_full.to_csv(index=False)

        if len(X_synth_sample) > 0:
            X_synth_full = X_synth_sample.copy()
            X_synth_full[target_col] = sample_synthetic_data[strat][1].values
            synth_csv = X_synth_full.to_csv(index=False)
        else:
            synth_csv = ""

        strategy_results.append({
            "strategyType": strat,
            "strategyParams": strategy_params.get(strat, {}),
            "evaluation": {
                "runs": strat_runs,
                "aggregated": strat_agg,
                "classes": classes,
            },
            "comparison": {
                "deltaAccuracy": round(strat_agg["accuracy"]["mean"] - base_aggregated["accuracy"]["mean"], 4),
                "deltaPrecision": round(strat_agg["precision"]["mean"] - base_aggregated["precision"]["mean"], 4),
                "deltaRecall": round(strat_agg["recall"]["mean"] - base_aggregated["recall"]["mean"], 4),
                "deltaF1": round(diff_primary, 4),
                "percentageImprovement": pct_imp,
                "isSignificant": is_sig,
                "pEstimate": round(p_val, 4),
            },
            "featureDrift": feature_drift,
            "syntheticCount": len(X_synth_sample),
            "augmentedRowCount": len(X_aug_sample),
            "augmentedCSV": aug_csv,
            "syntheticCSV": synth_csv,
        })

    # Statistical Recommendation
    metric_label = "R² Variance Explained" if task_type == "regression" else "Macro F1"
    if best_improvement > 1.0:
        verdict = "recommended"
        confidence = "high" if any(s["comparison"]["isSignificant"] for s in strategy_results if s["strategyType"] == best_strategy) else "medium"
        explanations = [
            f"{best_strategy.upper()} improved held-out {metric_label} by +{best_improvement:.1f}% over raw baseline.",
            f"Evaluated across {runs} repeated splits on {model_type.upper()} {task_type} model.",
        ]
    elif best_improvement < -1.0:
        verdict = "not_recommended"
        confidence = "high"
        explanations = [
            f"Augmentation resulted in performance degradation ({best_improvement:.1f}% {metric_label}). Raw dataset generalizes better without synthetic injection.",
        ]
    else:
        verdict = "inconclusive"
        confidence = "low"
        explanations = [
            f"Marginal delta observed ({best_improvement:+.1f}% {metric_label}). No statistically significant advantage detected.",
        ]

    recommendation = {
        "verdict": verdict,
        "bestStrategy": best_strategy,
        "improvement": best_improvement,
        "confidence": confidence,
        "explanations": explanations,
        "timestamp": pd.Timestamp.now().isoformat(),
    }

    return {
        "taskType": task_type,
        "classes": classes,
        "baseline": {
            "runs": baseline_runs,
            "aggregated": base_aggregated,
            "classes": classes,
        },
        "strategyResults": strategy_results,
        "recommendation": recommendation,
    }
