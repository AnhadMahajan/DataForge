"""
DataForge — Scikit-Learn Evaluation & TSTR Benchmarking (Native Python)
Supports both Classification & Regression TSTR Benchmarks.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import (
    RandomForestClassifier,
    HistGradientBoostingClassifier,
    RandomForestRegressor,
    HistGradientBoostingRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
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


def detect_task_type(y_series: pd.Series) -> str:
    if y_series.dtype == object or pd.api.types.is_string_dtype(y_series):
        return "classification"
    n_unique = y_series.dropna().nunique()
    if n_unique <= 10 or (n_unique <= 15 and n_unique / max(1, len(y_series)) < 0.15):
        return "classification"
    return "regression"


def get_model(model_type: str, task_type: str, seed: int = 42):
    if task_type == "regression":
        if model_type in ["logistic_regression", "ridge"]:
            return Ridge(random_state=seed)
        elif model_type == "gradient_boosting":
            return HistGradientBoostingRegressor(random_state=seed)
        elif model_type == "decision_tree":
            return DecisionTreeRegressor(max_depth=6, random_state=seed)
        else:  # default random_forest
            return RandomForestRegressor(n_estimators=100, max_depth=8, random_state=seed)
    else:
        if model_type == "logistic_regression":
            return LogisticRegression(max_iter=500, random_state=seed)
        elif model_type == "gradient_boosting":
            return HistGradientBoostingClassifier(random_state=seed)
        elif model_type == "decision_tree":
            return DecisionTreeClassifier(max_depth=6, random_state=seed)
        else:  # default random_forest
            return RandomForestClassifier(n_estimators=100, max_depth=8, random_state=seed)


def run_tstr_benchmark(
    df_real: pd.DataFrame,
    df_synth: pd.DataFrame,
    target_col: str,
    model_type: str = "random_forest",
    test_size: float = 0.25,
    seed: int = 42,
) -> dict:
    """
    Train on Synthetic, Test on Real (TSTR) Benchmark for Classification & Regression.
    """
    # Clean column names
    clean_map = {c: str(c).strip() for c in df_real.columns}
    df_real = df_real.rename(columns=clean_map)
    df_synth = df_synth.rename(columns=clean_map)

    target_col_clean = str(target_col).strip()
    if target_col_clean not in df_real.columns:
        raise ValueError(f"Target column '{target_col}' not found in real dataset.")

    df_real = df_real.dropna(subset=[target_col_clean]).copy()
    df_synth = df_synth.dropna(subset=[target_col_clean]).copy()

    # Automatically clean numeric columns
    for col in df_real.columns:
        if col == target_col_clean:
            continue
        c_r = pd.to_numeric(df_real[col], errors="coerce")
        if c_r.notna().sum() > len(df_real) * 0.6:
            df_real[col] = c_r
            df_synth[col] = pd.to_numeric(df_synth[col], errors="coerce")

    # Exclude ID / Index columns
    id_cols = [c for c in df_real.columns if c != target_col_clean and (c.lower() in ["unnamed: 0", "index", "id"] or not c)]
    feat_cols = [c for c in df_real.columns if c != target_col_clean and c not in id_cols]
    if not feat_cols:
        feat_cols = [c for c in df_real.columns if c != target_col_clean]

    # Detect task type
    target_num = pd.to_numeric(df_real[target_col_clean], errors="coerce")
    if target_num.notna().sum() == len(df_real):
        df_real[target_col_clean] = target_num
        df_synth[target_col_clean] = pd.to_numeric(df_synth[target_col_clean], errors="coerce")
        task_type = detect_task_type(df_real[target_col_clean])
    else:
        task_type = "classification"

    X_real = df_real[feat_cols]
    X_synth = df_synth[feat_cols]

    if task_type == "regression":
        y_real = df_real[target_col_clean].astype(float)
        y_synth = df_synth[target_col_clean].astype(float)
        classes = ["continuous_target"]
    else:
        y_real = df_real[target_col_clean].astype(str)
        y_synth = df_synth[target_col_clean].astype(str)
        classes = sorted(list(set(y_real.unique()).union(set(y_synth.unique()))))

    # Guard test split size
    t_size = float(test_size)
    if len(X_real) * t_size < 2:
        t_size = max(0.2, 2.0 / len(X_real))

    # Stratified split for classification, random split for regression
    try:
        if task_type == "classification":
            X_train_real, X_test_real, y_train_real, y_test_real = train_test_split(
                X_real, y_real, test_size=t_size, random_state=int(seed), stratify=y_real
            )
        else:
            X_train_real, X_test_real, y_train_real, y_test_real = train_test_split(
                X_real, y_real, test_size=t_size, random_state=int(seed)
            )
    except Exception:
        X_train_real, X_test_real, y_train_real, y_test_real = train_test_split(
            X_real, y_real, test_size=t_size, random_state=int(seed)
        )

    # Feature transformers
    num_cols = X_real.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = [c for c in X_real.columns if c not in num_cols]

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

    # 1. Baseline Model
    pipe_real = Pipeline([
        ("preprocessor", preprocessor),
        ("model", get_model(model_type, task_type, int(seed))),
    ])
    pipe_real.fit(X_train_real, y_train_real)
    preds_baseline = pipe_real.predict(X_test_real)

    # 2. Synthetic Model
    pipe_synth = Pipeline([
        ("preprocessor", preprocessor),
        ("model", get_model(model_type, task_type, int(seed))),
    ])
    pipe_synth.fit(X_synth, y_synth)
    preds_synthetic = pipe_synth.predict(X_test_real)

    if task_type == "regression":
        r2_base = float(r2_score(y_test_real, preds_baseline))
        rmse_base = float(np.sqrt(mean_squared_error(y_test_real, preds_baseline)))
        mae_base = float(mean_absolute_error(y_test_real, preds_baseline))

        r2_synth = float(r2_score(y_test_real, preds_synthetic))
        rmse_synth = float(np.sqrt(mean_squared_error(y_test_real, preds_synthetic)))
        mae_synth = float(mean_absolute_error(y_test_real, preds_synthetic))

        tstr_retention = round((r2_synth / r2_base * 100), 1) if r2_base > 0 else (100.0 if r2_synth > 0 else 0.0)

        return {
            "taskType": "regression",
            "classes": ["Continuous Target"],
            "modelType": model_type,
            "trainRealSamples": len(X_train_real),
            "testRealSamples": len(X_test_real),
            "trainSyntheticSamples": len(X_synth),
            "baseline": {
                "r2": round(r2_base, 4),
                "rmse": round(rmse_base, 4),
                "mae": round(mae_base, 4),
                "accuracy": round(max(0.0, r2_base), 4),
                "f1": round(max(0.0, r2_base), 4),
                "precision": round(max(0.0, r2_base), 4),
                "recall": round(max(0.0, r2_base), 4),
                "confusionMatrix": [[int(np.mean(y_test_real)), int(np.mean(preds_baseline))]],
                "perClass": {"regression": {"precision": round(r2_base, 4), "recall": round(r2_base, 4), "f1": round(r2_base, 4), "support": len(y_test_real)}},
            },
            "synthetic": {
                "r2": round(r2_synth, 4),
                "rmse": round(rmse_synth, 4),
                "mae": round(mae_synth, 4),
                "accuracy": round(max(0.0, r2_synth), 4),
                "f1": round(max(0.0, r2_synth), 4),
                "precision": round(max(0.0, r2_synth), 4),
                "recall": round(max(0.0, r2_synth), 4),
                "confusionMatrix": [[int(np.mean(y_test_real)), int(np.mean(preds_synthetic))]],
                "perClass": {"regression": {"precision": round(r2_synth, 4), "recall": round(r2_synth, 4), "f1": round(r2_synth, 4), "support": len(y_test_real)}},
            },
            "tstrRetention": tstr_retention,
            "deltaAccuracy": round(r2_synth - r2_base, 4),
            "deltaF1": round(r2_synth - r2_base, 4),
            "deltaRMSE": round(rmse_synth - rmse_base, 2),
        }
    else:
        def evaluate(y_true, y_pred):
            acc = float(accuracy_score(y_true, y_pred))
            p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
            cm = confusion_matrix(y_true, y_pred, labels=classes).tolist()

            p_per, r_per, f1_per, sup = precision_recall_fscore_support(y_true, y_pred, labels=classes, zero_division=0)
            per_class = {}
            for i, c in enumerate(classes):
                per_class[str(c)] = {
                    "precision": round(float(p_per[i]), 4),
                    "recall": round(float(r_per[i]), 4),
                    "f1": round(float(f1_per[i]), 4),
                    "support": int(sup[i]),
                }

            return {
                "accuracy": round(acc, 4),
                "precision": round(float(p), 4),
                "recall": round(float(r), 4),
                "f1": round(float(f1), 4),
                "confusionMatrix": cm,
                "perClass": per_class,
            }

        baseline_res = evaluate(y_test_real, preds_baseline)
        synthetic_res = evaluate(y_test_real, preds_synthetic)

        base_f1 = baseline_res["f1"]
        synth_f1 = synthetic_res["f1"]
        tstr_retention = round((synth_f1 / base_f1 * 100), 1) if base_f1 > 0 else 100.0

        return {
            "taskType": "classification",
            "classes": classes,
            "modelType": model_type,
            "trainRealSamples": len(X_train_real),
            "testRealSamples": len(X_test_real),
            "trainSyntheticSamples": len(X_synth),
            "baseline": baseline_res,
            "synthetic": synthetic_res,
            "tstrRetention": tstr_retention,
            "deltaAccuracy": round(synthetic_res["accuracy"] - baseline_res["accuracy"], 4),
            "deltaF1": round(synthetic_res["f1"] - baseline_res["f1"], 4),
        }
