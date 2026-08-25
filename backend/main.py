"""
DataForge — Native Python FastAPI Server
High-performance REST API for Generative Synthesis, Fidelity Auditing, and Scikit-Learn TSTR Benchmarking.
"""

import sys
import numpy as np
import pandas as pd
import scipy
import sklearn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Dict, Optional

from backend.engine.synthesizer import GaussianCopulaSynthesizer, KDESynthesizer
from backend.engine.fidelity import audit_synthetic_fidelity
from backend.engine.evaluator import run_tstr_benchmark
from backend.engine.experiment import run_full_experiment_pipeline

app = FastAPI(
    title="DataForge Native Python Backend",
    description="High-performance Scikit-Learn, SciPy & NumPy engine for data synthesis and fidelity benchmarking.",
    version="2.0.0",
)

# Enable CORS for all frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Pydantic Request Models ----

class SynthesisRequest(BaseModel):
    headers: List[str]
    data: List[List[Any]]
    algorithm: str = "copula"
    rowCount: int = 100
    params: Optional[Dict[str, Any]] = None
    seed: int = 42


class AuditRequest(BaseModel):
    headers: List[str]
    realData: List[List[Any]]
    syntheticData: List[List[Any]]


class TSTRRequest(BaseModel):
    headers: List[str]
    realData: List[List[Any]]
    syntheticData: List[List[Any]]
    targetCol: str
    modelType: str = "random_forest"
    testSize: float = 0.25
    seed: int = 42


class ExperimentRequest(BaseModel):
    headers: List[str]
    data: List[List[Any]]
    targetCol: str
    strategies: Optional[List[str]] = None
    strategyParams: Optional[Dict[str, Any]] = None
    runs: int = 3
    trainTestSplit: float = 0.8
    modelType: str = "random_forest"
    baseSeed: int = 42


# ---- Endpoints ----

@app.get("/api/health")
def healthcheck():
    """Healthcheck returning runtime environment info."""
    return {
        "status": "online",
        "backend": "DataForge Native Python Engine",
        "pythonVersion": sys.version.split()[0],
        "packages": {
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "pandas": pd.__version__,
            "scikit-learn": sklearn.__version__,
        },
    }


@app.post("/api/synthesize")
def synthesize(req: SynthesisRequest):
    """Generate synthetic tabular data via Gaussian Copula or KDE."""
    try:
        df = pd.DataFrame(req.data, columns=req.headers)

        # Auto-convert numeric columns
        for col in df.columns:
            converted = pd.to_numeric(df[col], errors="coerce")
            if converted.notna().sum() > len(df) * 0.6:
                df[col] = converted

        if req.algorithm == "kde":
            bw = req.params.get("bandwidthMultiplier", 1.0) if req.params else 1.0
            model = KDESynthesizer(bandwidth_multiplier=bw, seed=req.seed)
        else:  # default copula
            corr_method = req.params.get("correlationMethod", "pearson") if req.params else "pearson"
            model = GaussianCopulaSynthesizer(correlation_method=corr_method, seed=req.seed)

        model.fit(df)
        synth_df = model.sample(req.rowCount)

        return {
            "syntheticHeaders": synth_df.columns.tolist(),
            "syntheticData": synth_df.values.tolist(),
            "rowCount": len(synth_df),
            "algorithm": req.algorithm,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audit")
def audit(req: AuditRequest):
    """Run exact statistical fidelity and privacy audit."""
    try:
        df_real = pd.DataFrame(req.realData, columns=req.headers)
        df_synth = pd.DataFrame(req.syntheticData, columns=req.headers)

        for col in req.headers:
            c_r = pd.to_numeric(df_real[col], errors="coerce")
            if c_r.notna().sum() > len(df_real) * 0.6:
                df_real[col] = c_r
                df_synth[col] = pd.to_numeric(df_synth[col], errors="coerce")

        report = audit_synthetic_fidelity(df_real, df_synth)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/benchmark/tstr")
def benchmark_tstr(req: TSTRRequest):
    """Run real Scikit-Learn TSTR downstream ML evaluation."""
    try:
        df_real = pd.DataFrame(req.realData, columns=req.headers)
        df_synth = pd.DataFrame(req.syntheticData, columns=req.headers)

        for col in req.headers:
            if col == req.targetCol:
                continue
            c_r = pd.to_numeric(df_real[col], errors="coerce")
            if c_r.notna().sum() > len(df_real) * 0.6:
                df_real[col] = c_r
                df_synth[col] = pd.to_numeric(df_synth[col], errors="coerce")

        result = run_tstr_benchmark(
            df_real=df_real,
            df_synth=df_synth,
            target_col=req.targetCol,
            model_type=req.modelType,
            test_size=req.testSize,
            seed=req.seed,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/experiment")
def experiment(req: ExperimentRequest):
    """Run full Scikit-Learn multi-strategy augmentation experiment."""
    try:
        df = pd.DataFrame(req.data, columns=req.headers)

        result = run_full_experiment_pipeline(
            df_raw=df,
            target_col=req.targetCol,
            strategies=req.strategies,
            strategy_params=req.strategyParams,
            runs=req.runs,
            train_test_split_ratio=req.trainTestSplit,
            model_type=req.modelType,
            base_seed=req.baseSeed,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

