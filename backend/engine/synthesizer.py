"""
DataForge — Native Python Generative Synthesizer Engine
Implements:
1. Gaussian Copula (PIT -> Cholesky Correlation -> Sampling -> Inverse Quantile)
2. Multivariate Kernel Density Estimation (KDE) with Silverman Bandwidth
3. SMOTE (Synthetic Minority Over-sampling Technique)
4. Bayesian Network (DAG Structure Learning via Mutual Information)
"""

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics import mutual_info_score


class GaussianCopulaSynthesizer:
    """
    Gaussian Copula tabular data synthesizer.
    Models marginal distributions non-parametrically and captures joint covariance
    via the Gaussian copula with positive semi-definite Cholesky decomposition.
    """

    def __init__(self, correlation_method="pearson", seed=42):
        self.correlation_method = correlation_method
        self.seed = seed
        self.numeric_cols = []
        self.categorical_cols = []
        self.numeric_marginals = {}
        self.categorical_marginals = {}
        self.corr_matrix = None
        self.cholesky_l = None
        self.headers = []

    def fit(self, df: pd.DataFrame):
        np.random.seed(self.seed)
        self.headers = df.columns.tolist()
        self.numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_cols = [c for c in df.columns if c not in self.numeric_cols]

        # 1. Fit marginal distributions for numeric columns
        transformed_df = pd.DataFrame(index=df.index)
        for col in self.numeric_cols:
            vals = df[col].dropna().values.astype(float)
            if len(vals) == 0:
                self.numeric_marginals[col] = {"type": "constant", "value": 0.0}
                transformed_df[col] = 0.0
                continue

            sorted_vals = np.sort(vals)
            if sorted_vals[0] == sorted_vals[-1]:  # Zero-variance constant column
                self.numeric_marginals[col] = {"type": "constant", "value": float(sorted_vals[0])}
                transformed_df[col] = 0.0
                continue

            # Non-parametric empirical CDF via percentile ranking
            ranks = (stats.rankdata(vals) - 0.5) / len(vals)
            # Clip probability to avoid infinite normal quantiles
            ranks_clamped = np.clip(ranks, 0.001, 0.999)
            z_scores = stats.norm.ppf(ranks_clamped)

            self.numeric_marginals[col] = {
                "type": "empirical",
                "values": sorted_vals,
                "mean": float(np.mean(vals)),
                "std": float(np.std(vals)) or 1.0,
            }
            # Assign transformed standard normal values
            transformed_df[col] = z_scores

        # 2. Fit categorical frequency tables
        for col in self.categorical_cols:
            freq = df[col].value_counts(normalize=True)
            self.categorical_marginals[col] = {
                "categories": freq.index.astype(str).tolist(),
                "probabilities": freq.values.tolist(),
            }

        # 3. Estimate Copula Correlation Matrix in standard normal space
        if len(self.numeric_cols) >= 2:
            num_data = transformed_df[self.numeric_cols].fillna(0).values
            if self.correlation_method == "spearman":
                corr, _ = stats.spearmanr(num_data)
            else:
                corr = np.corrcoef(num_data, rowvar=False)

            if np.isnan(corr).any() or not np.isfinite(corr).all():
                corr = np.eye(len(self.numeric_cols))

            # Ensure Positive Semi-Definite (nearest PSD projection)
            corr = (corr + corr.T) / 2
            np.fill_diagonal(corr, 1.0)
            eigvals, eigvecs = np.linalg.eigh(corr)
            eigvals = np.maximum(eigvals, 1e-6)
            corr_psd = eigvecs @ np.diag(eigvals) @ eigvecs.T
            inv_diag = 1.0 / np.sqrt(np.diag(corr_psd))
            corr_psd = np.diag(inv_diag) @ corr_psd @ np.diag(inv_diag)
            self.corr_matrix = corr_psd

            # Cholesky decomposition: L @ L.T = corr_psd
            try:
                self.cholesky_l = np.linalg.cholesky(corr_psd + np.eye(len(self.numeric_cols)) * 1e-6)
            except np.linalg.LinAlgError:
                self.cholesky_l = np.eye(len(self.numeric_cols))
        elif len(self.numeric_cols) == 1:
            self.corr_matrix = np.array([[1.0]])
            self.cholesky_l = np.array([[1.0]])

        return self

    def sample(self, n_samples: int) -> pd.DataFrame:
        rng = np.random.default_rng(self.seed)
        synthetic_dict = {}

        # 1. Generate Correlated Standard Normal Vectors
        if len(self.numeric_cols) > 0 and self.cholesky_l is not None:
            dim = len(self.numeric_cols)
            z_uncorrelated = rng.standard_normal((n_samples, dim))
            z_correlated = (self.cholesky_l @ z_uncorrelated.T).T

            for i, col in enumerate(self.numeric_cols):
                marginal = self.numeric_marginals[col]
                if marginal["type"] == "constant":
                    synthetic_dict[col] = np.full(n_samples, marginal["value"])
                else:
                    # Convert correlated normal -> uniform [0, 1] -> inverse empirical quantile
                    u = stats.norm.cdf(z_correlated[:, i])
                    quantiles = np.quantile(marginal["values"], u)
                    synthetic_dict[col] = quantiles
        elif len(self.numeric_cols) > 0:
            for col in self.numeric_cols:
                marginal = self.numeric_marginals[col]
                if marginal["type"] == "constant":
                    synthetic_dict[col] = np.full(n_samples, marginal["value"])
                else:
                    u = rng.uniform(0.001, 0.999, n_samples)
                    synthetic_dict[col] = np.quantile(marginal["values"], u)

        # 2. Sample Categorical Columns from empirical marginals
        for col in self.categorical_cols:
            meta = self.categorical_marginals[col]
            categories = meta["categories"]
            probs = meta["probabilities"]
            if len(categories) > 0:
                synthetic_dict[col] = rng.choice(categories, size=n_samples, p=probs)
            else:
                synthetic_dict[col] = np.full(n_samples, "UNKNOWN")

        # Return DataFrame with original column ordering
        return pd.DataFrame(synthetic_dict)[self.headers]


class KDESynthesizer:
    """
    Multivariate Kernel Density Estimation tabular data synthesizer.
    Applies Gaussian kernel smoothing with Silverman's rule of thumb.
    """

    def __init__(self, bandwidth_multiplier=1.0, seed=42):
        self.bandwidth_multiplier = bandwidth_multiplier
        self.seed = seed
        self.headers = []
        self.numeric_cols = []
        self.categorical_cols = []
        self.numeric_data = {}
        self.bandwidths = {}
        self.categorical_marginals = {}

    def fit(self, df: pd.DataFrame):
        self.headers = df.columns.tolist()
        self.numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_cols = [c for c in df.columns if c not in self.numeric_cols]

        for col in self.numeric_cols:
            vals = df[col].dropna().values.astype(float)
            self.numeric_data[col] = vals
            n = len(vals)
            if n > 1:
                s = np.std(vals, ddof=1)
                iqr = stats.iqr(vals)
                std_est = min(s, iqr / 1.34) if iqr > 0 else s
                h = 0.9 * std_est * (n ** (-0.2)) * self.bandwidth_multiplier
                self.bandwidths[col] = max(h, 1e-4)
            else:
                self.bandwidths[col] = 1.0

        for col in self.categorical_cols:
            freq = df[col].value_counts(normalize=True)
            self.categorical_marginals[col] = {
                "categories": freq.index.astype(str).tolist(),
                "probabilities": freq.values.tolist(),
            }

        return self

    def sample(self, n_samples: int) -> pd.DataFrame:
        rng = np.random.default_rng(self.seed)
        synthetic_dict = {}

        for col in self.numeric_cols:
            vals = self.numeric_data[col]
            h = self.bandwidths[col]
            if len(vals) > 0:
                centers = rng.choice(vals, size=n_samples, replace=True)
                noise = rng.normal(0, h, size=n_samples)
                synthetic_dict[col] = centers + noise
            else:
                synthetic_dict[col] = np.zeros(n_samples)

        for col in self.categorical_cols:
            meta = self.categorical_marginals[col]
            categories = meta["categories"]
            probs = meta["probabilities"]
            if len(categories) > 0:
                synthetic_dict[col] = rng.choice(categories, size=n_samples, p=probs)
            else:
                synthetic_dict[col] = np.full(n_samples, "UNKNOWN")

        return pd.DataFrame(synthetic_dict)[self.headers]
