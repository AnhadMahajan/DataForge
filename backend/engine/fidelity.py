"""
DataForge — Statistical Fidelity & Privacy Audit Engine (Native Python)
Uses SciPy & NumPy for fast, exact metric calculations:
- 2-Sample Kolmogorov-Smirnov Test
- Wasserstein-1 Distance (Earth Mover's Distance)
- Pairwise Covariance Matrix Frobenius Norm Error
- Categorical Total Variation Distance (TVD)
- Distance to Closest Record (DCR) Privacy Audit
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.spatial.distance import cdist


def audit_synthetic_fidelity(df_real: pd.DataFrame, df_synth: pd.DataFrame) -> dict:
    """
    Compute comprehensive statistical fidelity and privacy audit between real and synthetic dataframes.
    """
    headers = df_real.columns.tolist()
    numeric_cols = df_real.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = [c for c in headers if c not in numeric_cols]

    feature_audits = []
    total_ks_score = 0.0
    total_cat_score = 0.0

    # 1. Continuous Features (KS-Test & Wasserstein-1)
    for col in numeric_cols:
        r_vals = df_real[col].dropna().values.astype(float)
        s_vals = df_synth[col].dropna().values.astype(float)

        if len(r_vals) > 0 and len(s_vals) > 0:
            ks_res = stats.ks_2samp(r_vals, s_vals)
            w1 = float(stats.wasserstein_distance(r_vals, s_vals))
            r_range = float(np.ptp(r_vals)) or 1.0
            norm_w1 = round(w1 / r_range, 4)

            ks_stat = float(ks_res.statistic)
            ks_pvalue = float(ks_res.pvalue)
            ks_fidelity = round(max(0.0, 1.0 - ks_stat), 4)
            total_ks_score += ks_fidelity

            r_mean = float(np.mean(r_vals))
            s_mean = float(np.mean(s_vals))
            r_std = float(np.std(r_vals)) or 1.0
            s_std = float(np.std(s_vals)) or 1.0

            drift_severity = "safe" if ks_stat < 0.15 else ("moderate" if ks_stat < 0.35 else "severe")

            feature_audits.append({
                "name": col,
                "type": "numeric",
                "ksStatistic": round(ks_stat, 4),
                "ksPValue": round(ks_pvalue, 4),
                "ksFidelity": ks_fidelity,
                "wassersteinDistance": round(w1, 4),
                "normalizedWasserstein": norm_w1,
                "realMean": round(r_mean, 2),
                "synthMean": round(s_mean, 2),
                "realStd": round(r_std, 2),
                "synthStd": round(s_std, 2),
                "meanDiffPct": round(abs(s_mean - r_mean) / abs(r_mean) * 100, 1) if r_mean != 0 else 0.0,
                "driftSeverity": drift_severity,
            })

    # 2. Categorical Features (Total Variation Distance)
    for col in categorical_cols:
        r_freq = df_real[col].value_counts(normalize=True)
        s_freq = df_synth[col].value_counts(normalize=True)

        all_cats = list(set(r_freq.index.astype(str)).union(set(s_freq.index.astype(str))))
        tvd = 0.0
        breakdown = []

        for cat in all_cats:
            p_r = float(r_freq.get(cat, 0.0))
            p_s = float(s_freq.get(cat, 0.0))
            tvd += abs(p_r - p_s) * 0.5
            breakdown.append({
                "category": str(cat),
                "realProb": round(p_r, 4),
                "synthProb": round(p_s, 4),
            })

        cat_fidelity = round(max(0.0, 1.0 - tvd), 4)
        total_cat_score += cat_fidelity

        feature_audits.append({
            "name": col,
            "type": "categorical",
            "totalVariationDistance": round(tvd, 4),
            "categoricalFidelity": cat_fidelity,
            "categoryBreakdown": breakdown,
        })

    numeric_fidelity = round(total_ks_score / len(numeric_cols), 4) if numeric_cols else 1.0
    categorical_fidelity = round(total_cat_score / len(categorical_cols), 4) if categorical_cols else 1.0

    # 3. Correlation Matrix Frobenius Norm Preservation
    correlation_fidelity = 1.0
    real_corr_dict = None
    synth_corr_dict = None

    if len(numeric_cols) >= 2:
        r_corr = df_real[numeric_cols].corr().fillna(0).values
        s_corr = df_synth[numeric_cols].corr().fillna(0).values

        frobenius_diff = float(np.linalg.norm(s_corr - r_corr, "fro"))
        frobenius_real = float(np.linalg.norm(r_corr, "fro")) or 1.0
        correlation_fidelity = round(max(0.0, 1.0 - (frobenius_diff / frobenius_real)), 4)

        real_corr_dict = {"labels": numeric_cols, "matrix": np.round(r_corr, 3).tolist()}
        synth_corr_dict = {"labels": numeric_cols, "matrix": np.round(s_corr, 3).tolist()}

    # 4. Privacy Audit: Distance to Closest Record (DCR)
    # Normalize numeric features to [0, 1] range for Euclidean distance computation
    if len(numeric_cols) > 0:
        r_num = df_real[numeric_cols].fillna(df_real[numeric_cols].median()).values
        s_num = df_synth[numeric_cols].fillna(df_real[numeric_cols].median()).values

        mins = np.min(r_num, axis=0)
        maxs = np.max(r_num, axis=0)
        ranges = np.where(maxs - mins > 0, maxs - mins, 1.0)

        r_norm = (r_num - mins) / ranges
        s_norm = (s_num - mins) / ranges

        # Sample up to 500 rows for distance matrix
        check_s = s_norm[:min(500, len(s_norm))]
        check_r = r_norm[:min(1000, len(r_norm))]

        # cdist computes pairwise euclidean distance matrix (shape: len(check_s), len(check_r))
        dists = cdist(check_s, check_r, metric="euclidean") / np.sqrt(len(numeric_cols))
        min_dists = np.min(dists, axis=1)

        median_dcr = float(np.median(min_dists))
        min_dcr = float(np.min(min_dists))
        memorized_count = int(np.sum(min_dists < 0.03))
        memorization_risk_pct = round((memorized_count / len(min_dists)) * 100, 1)
        privacy_score = max(0, min(100, int(100 - memorization_risk_pct * 2)))
        dcr_dist = np.round(np.sort(min_dists), 4).tolist()
    else:
        median_dcr = 0.5
        min_dcr = 0.5
        memorization_risk_pct = 0.0
        privacy_score = 100
        dcr_dist = []

    overall_score = int(round((numeric_fidelity * 0.4 + categorical_fidelity * 0.3 + correlation_fidelity * 0.3) * 100))

    return {
        "overallScore": overall_score,
        "numericFidelity": numeric_fidelity,
        "categoricalFidelity": categorical_fidelity,
        "correlationFidelity": correlation_fidelity,
        "privacyScore": privacy_score,
        "dcrStats": {
            "medianDCR": round(median_dcr, 4),
            "minDCR": round(min_dcr, 4),
            "memorizationRiskPercent": memorization_risk_pct,
            "dcrDistribution": dcr_dist[:100],  # top 100 quantiles
        },
        "featureAudits": feature_audits,
        "correlationMatrixReal": real_corr_dict,
        "correlationMatrixSynth": synth_corr_dict,
    }
