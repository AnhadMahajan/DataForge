# DataForge — Synthetic Data Intelligence & Generative Synthesis Engine

[![Live Production App](https://img.shields.io/badge/Production%20App-data--forge--mocha.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://data-forge-mocha.vercel.app)
[![Live API Telemetry](https://img.shields.io/badge/API%20Telemetry-200%20OK%20Atlas-06b6d4?style=for-the-badge&logo=fastapi&logoColor=white)](https://data-forge-mocha.vercel.app/api/health)
[![MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas%20Cluster-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/cloud/atlas)
[![Express.js](https://img.shields.io/badge/Backend-Express.js%204.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

> **Measure before you train. Stop guessing with synthetic data.**
>
> 🌐 **Live Web Application**: [https://data-forge-mocha.vercel.app](https://data-forge-mocha.vercel.app)  
> ⚡ **Live Backend API**: [https://data-forge-mocha.vercel.app/api/health](https://data-forge-mocha.vercel.app/api/health)

DataForge is an enterprise-grade, hybrid-runtime Machine Learning Intelligence and Generative Synthesis Engine. It models tabular distributions, generates mathematically verified synthetic datasets (Gaussian Copula, Multivariate KDE, SMOTE-NC), runs controlled multi-strategy augmentation trials on strictly held-out real test splits, and tells you empirically whether synthetic data improves downstream model generalization.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20180848.png" alt="DataForge Landing Page Hero" width="100%" />
</p>

---

> [!IMPORTANT]
> ### 🚀 Live Production Quick Access & Evaluator Demo
> | Resource | Live URL / Value | Description |
> |---|---|---|
> | **Production Web App** | [`https://data-forge-mocha.vercel.app`](https://data-forge-mocha.vercel.app) | Full interactive mission-control web interface |
> | **System Health & Telemetry** | [`https://data-forge-mocha.vercel.app/api/health`](https://data-forge-mocha.vercel.app/api/health) | Live Atlas DB ping latency & server metrics |
> | **Administrator Login** | `admin@dataforge.ai` / `Admin123!` | Role: `admin` (Full dataset/job/audit privileges) |
> | **Researcher Login** | `researcher@dataforge.ai` / `Researcher123!` | Role: `researcher` (Data science & synthesis privileges) |
> | **Seeded Benchmark Dataset** | ID: `6ae09e5b899143a8153192c6` | *Customer Churn Benchmark* (280 rows, 6 features, class imbalance) |
> | **Seeded Synthesis Job** | ID: `6ae0b4789ac1e085b0d6c779` | *Gaussian Copula 200-sample generation run* |
> 
> *Tip: The live login screen features 1-click `⚡ Fill Admin` and `🔬 Fill Researcher` buttons for instant evaluator access.*

---

## 📑 Table of Contents

- [The Problem: Blind Augmentation](#-the-problem-blind-augmentation)
- [Core Methodology: 4-Stage Scientific Pipeline](#-core-methodology-4-stage-scientific-pipeline)
- [Generative Synthesis Suite](#-generative-synthesis-suite)
- [Tabular Augmentation Algorithms](#-tabular-augmentation-algorithms)
- [Statistical Fidelity & Privacy Auditing](#-statistical-fidelity--privacy-auditing)
- [Hybrid Architecture (Cloud & Client)](#-hybrid-architecture-cloud--client)
- [Mission-Control Multi-Page Application](#-mission-control-multi-page-application)
- [Comprehensive REST API Reference](#-comprehensive-rest-api-reference)
  - [API Overview & Authentication](#api-overview--authentication)
  - [1. System Health & Atlas Telemetry](#1-system-health--atlas-telemetry)
  - [2. Authentication & Identity Management](#2-authentication--identity-management)
  - [3. Dataset Ingestion & Diagnostic Profiling](#3-dataset-ingestion--diagnostic-profiling)
  - [4. Mathematical Generative Synthesis Engine](#4-mathematical-generative-synthesis-engine)
  - [5. Statistical Fidelity & TSTR Benchmark Auditing](#5-statistical-fidelity--tstr-benchmark-auditing)
  - [6. Multi-Format Export Engine](#6-multi-format-export-engine)
  - [7. Compliance Audit Logging](#7-compliance-audit-logging)
- [Quick-Start cURL Cheat Sheet](#-quick-start-curl-cheat-sheet)
- [Local Development & Setup](#-local-development--setup)
- [Automated Testing & Verification](#-automated-testing--verification)
- [Repository Structure](#-repository-structure)
- [Scientific Integrity Guarantees](#-scientific-integrity-guarantees)
- [License](#-license)

---

## ⚡ The Problem: Blind Augmentation

In real-world machine learning workflows, engineers frequently encounter severe class imbalance, high data collection costs, or privacy constraints. The default reaction is often to blindly apply oversampling techniques (such as SMOTE or Gaussian jitter) without evaluating downstream generalization impact.

This naive approach introduces three critical failure modes:

1. **Silent Decision Boundary Distortion**: Generating synthetic samples along class boundaries often inflates minority recall while severely degrading majority class precision—a failure that is frequently masked by overall accuracy metrics.
2. **Overfitting to Synthetic Duplicates**: Naive oversampling creates dense clusters of near-identical records, leading classifiers to memorize synthetic artifacts rather than learning true underlying population distributions.
3. **Absence of Causal Diagnostics**: When model performance drops post-augmentation, practitioners lack diagnostic tooling to explain *why*.

**DataForge treats synthetic data as an empirical hypothesis to be validated, audited, and mathematically verified before model deployment.**

---

## 🔬 Core Methodology: 4-Stage Scientific Pipeline

```
  ┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────────────┐      ┌───────────────────────────┐
  │   01 OBSERVE    │ ───► │   02 HYPOTHESIZE    │ ───► │      03 EXPERIMENT      │ ───► │       04 RECOMMEND        │
  │ Dataset Health  │      │ Candidate Strategies│      │    Controlled Trials    │      │  Causal Report & Verdict  │
  │ & Need Score    │      │ (Copula/SMOTE/etc.) │      │ (Zero-Leakage Repeats)  │      │ (Fidelity, Drift, Safety) │
  └─────────────────┘      └─────────────────────┘      └─────────────────────────┘      └───────────────────────────┘
```

### Stage 1: Observe (Diagnostic Profiling)
- **RFC-4180 Ingestion**: Streaming parser supporting dirty currencies (`$5,200.50`), percentages (`12%`), quotes, and missing tokens (`NaN`, `?`, `N/A`).
- **Automated Feature Typing**: Differentiates continuous numeric variables from categorical and high-cardinality ID features.
- **Statistical Health Profiler**: Computes class imbalance ratios, IQR outlier bounds, Pearson & Spearman correlation matrices, and missingness rates.
- **Augmentation Need Score (0–100)**: A composite diagnostic metric derived from imbalance penalty, sample sparsity, and feature overlap.

### Stage 2: Hypothesize (Candidate Generation)
- Configures candidate tabular synthesis and oversampling algorithms tailored to the dataset's topological and statistical properties.
- Parameter space tuning: nearest neighbor counts ($k$), sampling ratios ($\alpha$), noise perturbation variances ($\sigma$), and bandwidth multipliers ($h$).

### Stage 3: Experiment (Controlled Empirical Trials)
- **Strict Zero-Leakage Protocol**: Test partitions are isolated *before* any synthesis/augmentation and remain 100% untouched across all runs.
- **Multi-Run Randomized Variance Tracking**: Evaluates means and standard deviations ($\mu \pm \sigma$) across randomized split seeds to guard against lucky splits.
- **Universal Task Support**: Supports both **Classification** (Accuracy, Precision, Recall, F1, Per-Class Confusion Matrix) and **Continuous Regression** ($R^2$, RMSE, MAE, Pearson $r$).
- **Multi-Model Suite**: Evaluates across Random Forest, Hist-Gradient Boosting, Logistic Regression / Ridge, Decision Trees, and $k$-NN.

### Stage 4: Recommend (Causal Explanations & Actionable Verdicts)
- **Statistical Significance**: Performs two-sample paired tests ($p$-value estimation) between baseline and candidate pipelines.
- **Trade-off & Degradation Guardrails**: Flags precision/recall cannibalization (e.g. flagging majority class precision loss $>3.5\%$).
- **Definitive Action Verdicts**: `RECOMMENDED`, `USE WITH CAUTION`, or `NOT RECOMMENDED`.

---

## 🧬 Generative Synthesis Suite

DataForge includes standalone generative synthesizers capable of modeling and generating entirely new synthetic tabular datasets from scratch:

| Algorithm | Method | Key Strength |
|---|---|---|
| **Gaussian Copula** | Probability Integral Transform (PIT) $\to$ empirical rank CDF $\to$ standard normal mapping $\to$ positive semi-definite Cholesky factorization $\to$ inverse empirical quantile sampling | Preserves exact non-linear marginal distributions and multi-attribute Pearson/Spearman joint covariance matrices. |
| **Multivariate KDE** | Gaussian kernel smoothing with Silverman's Rule of Thumb bandwidth estimator $h = 0.9 \cdot \min(\sigma, \frac{\text{IQR}}{1.34}) \cdot n^{-1/5}$ | Non-parametric; fits arbitrary multi-modal distributions without normality assumptions. |
| **Bayesian Network** | Mutual Information Directed Acyclic Graph (DAG) structure learning $\to$ topological ordering $\to$ conditional probability sampling | Captures causal and directional conditional dependencies between discrete/binned columns. |
| **Variational Autoencoder** | Encoder-decoder neural network parameterized by latent Gaussian space $\mathcal{N}(\mu, \sigma^2)$ | Learns complex continuous-discrete latent representations. |

---

## 📈 Tabular Augmentation Algorithms

To remediate minority class deficiency, DataForge provides advanced oversampling algorithms:

1. **SMOTE (Synthetic Minority Over-sampling Technique)**: Generates synthetic points along line segments connecting $k$-nearest minority neighbors in Euclidean space:
   $$\mathbf{x}_{\text{new}} = \mathbf{x}_i + \lambda (\mathbf{x}_{zi} - \mathbf{x}_i), \quad \lambda \sim \mathcal{U}(0, 1)$$
2. **SMOTE-NC (Nominal Continuous)**: Extends SMOTE to mixed datasets by computing continuous standard deviations and categorical overlap penalties for Euclidean distance.
3. **ADASYN (Adaptive Synthetic)**: Weighted sampling that produces more synthetic instances for minority samples that are harder to learn (near high-density majority regions).
4. **SMOTE-Tomek**: Two-stage pipeline that applies SMOTE generation followed by Tomek Link identification to prune borderline artifacts and eliminate decision boundary overlap.
5. **Random Oversampling**: Balanced uniform resampling with optional Gaussian noise injection.
6. **Gaussian Jitter Perturbation**: Controlled normal noise perturbation calibrated to feature standard deviations.

---

## 🛡️ Statistical Fidelity & Privacy Auditing

Every generated dataset is subjected to an exact statistical fidelity and privacy audit:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATAFORGE STATISTICAL AUDIT SUITE                               │
├────────────────────────────┬───────────────────────────────┬───────────────────────────┤
│ Continuous Fidelity        │ Categorical Fidelity          │ Privacy & Memorization    │
├────────────────────────────┼───────────────────────────────┼───────────────────────────┤
│ • 2-Sample KS Test (D)     │ • Total Variation Dist (TVD)  │ • Distance to Closest     │
│ • Wasserstein-1 (EMD)      │ • Marginal Category Prob Delta│   Record (DCR)            │
│ • Covariance Frobenius Norm│ • Frequency Shift Diagnostics │ • Exact Match Check (0%)  │
│ • Mean & Std Diff %        │ • Categorical Support Audit   │ • Median DCR Privacy Score│
└────────────────────────────┴───────────────────────────────┴───────────────────────────┘
```

- **TSTR Benchmark (Train on Synthetic, Test on Real)**: Trains downstream Scikit-Learn models exclusively on synthetic data and tests them against held-out real data to compute retention percentage:
   $$\text{TSTR Retention} = \frac{\text{Metric}_{\text{Synthetic-Trained}}}{\text{Metric}_{\text{Real-Trained}}} \times 100\%$$

---

## 🏗️ Hybrid Architecture (Cloud & Client)

DataForge utilizes a resilient hybrid architecture combining high-concurrency cloud microservices with seamless client-side execution:

```
                             ┌──────────────────────────────────────────────┐
                             │           DataForge Mission-Control          │
                             │       Vanilla HTML5 + CSS3 + ES2022          │
                             │   Obsidian Dark HUD / Three.js 3D Monolith   │
                             └──────────────────────┬───────────────────────┘
                                                    │
                        ┌───────────────────────────┴───────────────────────────┐
                        ▼                                                       ▼
        ┌───────────────────────────────┐                       ┌───────────────────────────────┐
        │   Vercel Serverless Backend   │                       │   In-Browser Numerical Engine │
        │    Express.js 4.21 MVC API    │                       │     Synchronous / Pyodide     │
        │ https://data-forge-mocha...   │                       │    (Air-Gapped Local Mode)    │
        ├───────────────────────────────┤                       ├───────────────────────────────┤
        │ • Express router endpoints    │      Auto-Fallback    │ • Fast in-memory Cholesky     │
        │ • Live MongoDB Atlas Mongoose │◄─────────────────────►│ • In-browser KDE & SMOTE       │
        │ • Real-time DB ping telemetry │      When Offline     │ • Instant interactive preview │
        │ • JWT & bcrypt authentication │                       │ • Zero data leaves browser    │
        └───────────────┬───────────────┘                       └───────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   MongoDB Atlas Cloud Cluster │
        │ ac-wg1qqp3-shard-00-01...     │
        ├───────────────────────────────┤
        │ • Collections: users,         │
        │   datasets, synthesis_jobs,   │
        │   evaluation_reports, audits  │
        │ • Sharded high-availability   │
        └───────────────────────────────┘
```

- **Cloud Mode (Default)**: Connects directly to the live deployed Vercel serverless functions at `https://data-forge-mocha.vercel.app/api/*` backed by a dedicated MongoDB Atlas cluster.
- **Client Fallback Mode**: If network connectivity drops or the user operates in an air-gapped environment, the UI automatically switches to client-side numerical math routines without interrupting the researcher's workflow.

---

## 🖥️ Mission-Control Multi-Page Application

DataForge features a bespoke **Mission-Control Obsidian HUD** design aesthetic:
- Deep obsidian backdrop (`#080b11`, `#0d131f`) with high-contrast emerald (`#10b981`), cyan (`#06b6d4`), and indigo telemetry highlights.
- Live **MongoDB Atlas Latency Telemetry Badge** in the persistent sidebar showing real-time ping roundtrips (e.g., `ATLAS: 95ms`).
- Technical bracketed metric counters (`[ 280 ROWS ]`, `[ 0.00% DRIFT ]`), monospace numerical readouts, and fluid micro-animations.

| Page | File | Primary Function |
|---|---|---|
| **Landing** | [`index.html`](index.html) | Product value proposition, Three.js 3D Optical Data Monolith, workflow entry point. |
| **Auth** | [`login.html`](login.html) & [`signup.html`](signup.html) | Multi-role authentication with 1-click `⚡ Fill Admin` and `🔬 Fill Researcher` quick-fill buttons. |
| **Dashboard** | [`dashboard.html`](dashboard.html) | Central intelligence command hub, 1-Click Benchmark Demo, real-time Atlas telemetry, dataset health radar. |
| **Upload Studio** | [`upload.html`](upload.html) | Drag-and-drop CSV ingestion, automatic schema typing, IQR outlier detection, Need Score. |
| **Experiment Lab** | [`experiment.html`](experiment.html) | Multi-strategy configuration, cross-validation parameters, algorithm selector. |
| **Results Matrix** | [`results.html`](results.html) | Head-to-head evaluation matrix, held-out delta cards, confusion matrices, CSV export. |
| **Narrative Reports**| [`reports.html`](reports.html) | Scientific narrative reports with verdicts, citations, and exportable PDF layout. |
| **Synthesizer Lab** | [`synthesizer-lab.html`](synthesizer-lab.html) | Standalone generative studio (Copula, KDE, SMOTE) with real-time fidelity audits. |
| **Settings** | [`settings.html`](settings.html) | Researcher profile preferences, storage quota monitoring, JSON workspace vault. |

---

## 🔌 Comprehensive REST API Reference

The DataForge backend exposes a fully RESTful HTTP API deployed serverlessly on Vercel and backed by MongoDB Atlas.

### API Overview & Authentication

- **Live Base URL**: `https://data-forge-mocha.vercel.app/api`
- **Local Base URL**: `http://localhost:5000/api`
- **Authentication Scheme**: Standard HTTP Bearer Token:
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
- **Content Types**: `application/json` (standard payloads) or `multipart/form-data` (file uploads).
- **Rate Limits & CORS**: Configured to accept authorized calls across research clients.

---

### 1. System Health & Atlas Telemetry

#### `GET /api/health`
Monitors API engine health, active MongoDB Atlas connection state, roundtrip database ping latency, Node.js memory footprint, and server uptime.

- **Authentication**: Not required (Public).
- **Response `200 OK`**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-10-28T01:05:00.000Z",
  "uptime": 1420.5,
  "db": {
    "status": "connected",
    "host": "ac-wg1qqp3-shard-00-01.ihsxz4p.mongodb.net:27017",
    "name": "dataforge",
    "pingMs": 95
  },
  "memory": {
    "rss": "85.2 MB",
    "heapTotal": "48.1 MB",
    "heapUsed": "32.4 MB"
  },
  "system": {
    "nodeVersion": "v20.18.0",
    "platform": "linux",
    "arch": "x64"
  },
  "endpoints": {
    "health": "/api/health",
    "auth": "/api/auth",
    "datasets": "/api/datasets",
    "synthesis": "/api/synthesis",
    "evaluation": "/api/evaluation",
    "export": "/api/export"
  }
}
```

---

### 2. Authentication & Identity Management

#### `POST /api/auth/register`
Creates a new researcher profile with salted bcrypt password hashing and assigned RBAC permissions.

- **Request Body**:
```json
{
  "name": "Dr. Sarah Chen",
  "email": "sarah.chen@university.edu",
  "password": "SecurePassword123!",
  "role": "researcher"
}
```
*Roles supported: `user`, `researcher`, `data_scientist`, `admin`.*

- **Response `201 Created`**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6ae102bc899143a8153193a1",
    "name": "Dr. Sarah Chen",
    "email": "sarah.chen@university.edu",
    "role": "researcher"
  }
}
```

#### `POST /api/auth/login`
Authenticates researcher credentials and returns a signed JWT Bearer token valid for 7 days.

- **Request Body**:
```json
{
  "email": "admin@dataforge.ai",
  "password": "Admin123!"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6ae09c1a899143a815319200",
    "name": "Lead Researcher",
    "email": "admin@dataforge.ai",
    "role": "admin"
  }
}
```

#### `GET /api/auth/me`
Retrieves the currently authenticated user's profile and workspace permissions.

- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "user": {
    "id": "6ae09c1a899143a815319200",
    "name": "Lead Researcher",
    "email": "admin@dataforge.ai",
    "role": "admin",
    "createdAt": "2026-10-27T18:00:00.000Z"
  }
}
```

---

### 3. Dataset Ingestion & Diagnostic Profiling

#### `POST /api/datasets/upload`
Uploads a tabular dataset in CSV format (via `multipart/form-data`) or JSON records (via `application/json`), running automated statistical profiling, continuous-versus-categorical typing, and IQR outlier detection upon ingestion.

- **Headers**: `Authorization: Bearer <token>`
- **Option A (`multipart/form-data`)**: `file: churn_data.csv`, `name: "Telco Churn Q3"`, `targetColumn: "Churn"`
- **Option B (`application/json`)**:
```json
{
  "name": "Customer Churn Benchmark",
  "taskType": "classification",
  "targetColumn": "Churn",
  "data": [
    { "Tenure": 12, "MonthlyCharges": 65.5, "Contract": "Month-to-month", "Churn": 1 },
    { "Tenure": 48, "MonthlyCharges": 20.2, "Contract": "Two year", "Churn": 0 }
  ]
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "dataset": {
    "id": "6ae09e5b899143a8153192c6",
    "name": "Customer Churn Benchmark",
    "shape": { "rows": 280, "columns": 6 },
    "targetColumn": "Churn",
    "taskType": "classification",
    "imbalanceRatio": "7.54:1",
    "needScore": 78
  }
}
```

#### `GET /api/datasets`
Fetches a paginated catalog of all uploaded datasets.

- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `page`: Page number (default: `1`).
  - `limit`: Items per page (default: `10`).
  - `search`: Filter by name keyword (e.g. `?search=churn`).
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 1,
  "totalPages": 1,
  "currentPage": 1,
  "datasets": [
    {
      "_id": "6ae09e5b899143a8153192c6",
      "name": "Customer Churn Benchmark",
      "shape": { "rows": 280, "columns": 6 },
      "targetColumn": "Churn",
      "createdAt": "2026-10-27T18:24:27.000Z"
    }
  ]
}
```

#### `GET /api/datasets/:id`
Retrieves detailed dataset metadata, statistical column profiles, IQR bounds, and a 20-row preview slice.

- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "dataset": {
    "_id": "6ae09e5b899143a8153192c6",
    "name": "Customer Churn Benchmark",
    "shape": { "rows": 280, "columns": 6 },
    "columns": ["Tenure", "MonthlyCharges", "TotalCharges", "Contract", "SupportTickets", "Churn"],
    "columnProfiles": {
      "MonthlyCharges": {
        "type": "numeric",
        "min": 18.25,
        "max": 118.75,
        "mean": 64.76,
        "std": 30.09,
        "iqr": { "q25": 35.5, "q75": 89.8 }
      }
    }
  },
  "preview": [
    { "Tenure": 1, "MonthlyCharges": 29.85, "TotalCharges": 29.85, "Contract": "Month-to-month", "SupportTickets": 3, "Churn": 1 }
  ]
}
```

#### `DELETE /api/datasets/:id`
Deletes a dataset and cascades removal of associated temporary artifacts.

---

### 4. Mathematical Generative Synthesis Engine

#### `POST /api/synthesis/run`
Executes mathematical generative tabular synthesis using Gaussian Copula, Multivariate Kernel Density Estimation (KDE), or SMOTE-NC oversampling.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "datasetId": "6ae09e5b899143a8153192c6",
  "algorithm": "copula",
  "sampleCount": 200,
  "parameters": {
    "correlationPreservation": true,
    "noiseVariance": 0.05,
    "bandwidthMultiplier": 1.0,
    "kNeighbors": 5
  }
}
```
*Supported algorithms: `"copula"`, `"kde"`, `"smote"`.*

- **Response `201 Created`**:
```json
{
  "success": true,
  "job": {
    "id": "6ae0b4789ac1e085b0d6c779",
    "datasetId": "6ae09e5b899143a8153192c6",
    "algorithm": "copula",
    "status": "completed",
    "rowCount": 200,
    "durationMs": 42,
    "parameters": {
      "correlationPreservation": true,
      "noiseVariance": 0.05
    },
    "generatedData": [
      { "Tenure": 14, "MonthlyCharges": 72.1, "TotalCharges": 1009.4, "Contract": "Month-to-month", "SupportTickets": 2, "Churn": 1 }
    ]
  }
}
```

#### `GET /api/synthesis/jobs`
Lists all historical generative synthesis runs with execution statuses and parameters.

#### `GET /api/synthesis/jobs/:id`
Retrieves complete synthetic tabular records and metadata from a specific synthesis execution.

#### `DELETE /api/synthesis/jobs/:id`
Removes a synthesis job and frees stored matrix memory.

---

### 5. Statistical Fidelity & TSTR Benchmark Auditing

#### `POST /api/evaluation/audit`
Executes an exact statistical fidelity and privacy audit between real source records and generated synthetic records. Computes the continuous two-sample Kolmogorov-Smirnov test statistic ($D$), 1-Wasserstein Earth Mover's Distance, and Distance to Closest Record (DCR) privacy score.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "datasetId": "6ae09e5b899143a8153192c6",
  "syntheticJobId": "6ae0b4789ac1e085b0d6c779"
}
```
*(Alternatively, you can supply inline `realData` and `syntheticData` arrays).*

- **Response `200 OK`**:
```json
{
  "success": true,
  "audit": {
    "ksTest": {
      "averageD": 0.082,
      "pValue": 0.74,
      "verdict": "DISTRIBUTIONS_MATCH"
    },
    "wassersteinDistance": 0.041,
    "correlationFrobeniusNorm": 0.065,
    "privacy": {
      "dcrScore": 0.94,
      "exactMatches": 0,
      "memorizationRisk": "NONE"
    },
    "overallFidelityScore": 92.4
  }
}
```

#### `POST /api/evaluation/tstr`
Executes an empirical **Train-on-Synthetic, Test-on-Real (TSTR)** machine learning benchmark. Trains a downstream classification model solely on synthetic data and tests it against strictly held-out real data to determine empirical utility retention.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "datasetId": "6ae09e5b899143a8153192c6",
  "syntheticJobId": "6ae0b4789ac1e085b0d6c779",
  "taskType": "classification"
}
```

- **Response `200 OK`**:
```json
{
  "success": true,
  "report": {
    "baselineMetrics": {
      "accuracy": 0.812,
      "macroF1": 0.684,
      "precision": 0.735,
      "recall": 0.640
    },
    "syntheticTrainedMetrics": {
      "accuracy": 0.825,
      "macroF1": 0.718,
      "precision": 0.742,
      "recall": 0.695
    },
    "retentionScore": "104.9%",
    "f1Delta": "+0.034 (+3.4%)",
    "verdict": "AUGMENTATION_RECOMMENDED",
    "confidenceInterval": "95%",
    "confusionMatrix": {
      "truePositive": 45,
      "falsePositive": 12,
      "trueNegative": 185,
      "falseNegative": 38
    }
  }
}
```

#### `GET /api/evaluation/reports`
Lists all historical empirical evaluation and audit reports.

#### `GET /api/evaluation/reports/:id`
Retrieves a specific evaluation report with full per-class metrics and confusion matrix breakdown.

---

### 6. Multi-Format Export Engine

#### `GET /api/export`
Discovers supported export formats, specification dialects, and MIME types.

- **Response `200 OK`**:
```json
{
  "success": true,
  "supportedFormats": ["csv", "json", "sql"],
  "dialects": {
    "sql": ["postgresql", "mysql", "sqlite", "snowflake"]
  }
}
```

#### `POST /api/export/csv`
Streams RFC-4180 compliant CSV files with strict delimiter escaping and CRLF line terminators.

- **Request Body**:
```json
{
  "jobId": "6ae0b4789ac1e085b0d6c779",
  "filename": "synthetic_churn_copula.csv",
  "delimiter": ",",
  "quoteStrings": true
}
```
- **Response**: `200 OK` with `Content-Type: text/csv` and `Content-Disposition: attachment; filename="synthetic_churn_copula.csv"`.

#### `POST /api/export/json`
Generates structured JSON with embedded metadata headers or raw row arrays.

- **Request Body**:
```json
{
  "jobId": "6ae0b4789ac1e085b0d6c779",
  "formatted": true,
  "includeMetadata": true
}
```
- **Response**: `200 OK` with `Content-Type: application/json`.

#### `POST /api/export/sql`
Generates relational SQL DDL (`CREATE TABLE` with auto-inferred SQLite/PostgreSQL/MySQL types) alongside batch multi-row `INSERT INTO` statements.

- **Request Body**:
```json
{
  "jobId": "6ae0b4789ac1e085b0d6c779",
  "tableName": "synthetic_customers",
  "dialect": "postgresql",
  "batchSize": 100
}
```
- **Response**: `200 OK` with generated SQL script:
```sql
CREATE TABLE IF NOT EXISTS synthetic_customers (
  id SERIAL PRIMARY KEY,
  tenure INTEGER,
  monthly_charges NUMERIC(10, 2),
  total_charges NUMERIC(10, 2),
  contract VARCHAR(255),
  churn INTEGER
);

INSERT INTO synthetic_customers (tenure, monthly_charges, total_charges, contract, churn)
VALUES
  (14, 72.10, 1009.40, 'Month-to-month', 1),
  (36, 45.20, 1627.20, 'One year', 0);
```

---

### 7. Compliance Audit Logging

Every critical platform action (data upload, synthesis run, evaluation, and dataset export) is automatically recorded in the MongoDB `audit_logs` collection:

- **Schema Fields**: `userId`, `action` (`DATASET_UPLOAD`, `SYNTHESIS_RUN`, `EVALUATION_AUDIT`, `EXPORT_CSV`, `EXPORT_SQL`), `resourceId`, `ipAddress` (with reverse proxy resolution), `userAgent`, and `timestamp`.
- **Non-Blocking Resilience**: Audit record creation operates asynchronously and never blocks critical API responses.

---

## ⚡ Quick-Start cURL Cheat Sheet

You can interact directly with the live deployed backend using standard `curl` commands:

### 1. Check Live Atlas Telemetry
```bash
curl https://data-forge-mocha.vercel.app/api/health
```

### 2. Authenticate & Obtain JWT Token
```bash
curl -X POST https://data-forge-mocha.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dataforge.ai","password":"Admin123!"}'
```

### 3. Fetch Pre-Seeded Benchmark Dataset Metadata
```bash
curl https://data-forge-mocha.vercel.app/api/datasets/6ae09e5b899143a8153192c6 \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>"
```

### 4. Trigger a Gaussian Copula Synthesis Run
```bash
curl -X POST https://data-forge-mocha.vercel.app/api/synthesis/run \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "6ae09e5b899143a8153192c6",
    "algorithm": "copula",
    "sampleCount": 100,
    "parameters": { "noiseVariance": 0.05, "correlationPreservation": true }
  }'
```

### 5. Run Downstream TSTR Utility Evaluation
```bash
curl -X POST https://data-forge-mocha.vercel.app/api/evaluation/tstr \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>" \
  -H "Content-Type: application/json" \
  -d '{
    "datasetId": "6ae09e5b899143a8153192c6",
    "syntheticJobId": "6ae0b4789ac1e085b0d6c779",
    "taskType": "classification"
  }'
```

### 6. Export Synthesized Data to Relational SQL
```bash
curl -X POST https://data-forge-mocha.vercel.app/api/export/sql \
  -H "Authorization: Bearer <PASTE_TOKEN_HERE>" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "6ae0b4789ac1e085b0d6c779",
    "tableName": "synthetic_churn_data",
    "dialect": "postgresql"
  }'
```

---

## 🛠️ Local Development & Setup

### Prerequisites
- Node.js 18+ or 20+
- MongoDB instance (local or free cloud MongoDB Atlas cluster)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/AnhadMahajan/DataForge.git
cd DataForge
npm install
cd backend && npm install && cd ..
```

### 2. Configure Environment (`backend/.env`)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.ihsxz4p.mongodb.net/dataforge?retryWrites=true&w=majority
JWT_SECRET=dataforge_super_secure_jwt_secret_key_2026_production
CLIENT_URL=http://localhost:3005
```

### 3. Launch Development Servers
```bash
# Option A: 1-Click Launch both Backend (5000) and Frontend (3005)
npm run fullstack

# Option B: Run Backend Only
npm run backend

# Option C: Run Frontend Static Server Only
npm start
```

---

## 🧪 Automated Testing & Verification

DataForge enforces rigorous automated test coverage across both its frontend algorithms and backend Express microservices:

### 1. In-Browser / Algorithm Unit Tests (12/12 Passing)
Verifies client-side linear algebra, positive semi-definite Cholesky factorization, Silverman's bandwidth rule, SMOTE $k$-NN geometry, Kolmogorov-Smirnov statistics, and RFC-4180 CSV parsing:
```bash
npm test
```
```
✔ PASS: Vector & Matrix Operations (dot product, transpose, norm)
✔ PASS: Cholesky Decomposition (positive semi-definite covariance)
✔ PASS: Silverman's Rule of Thumb Bandwidth Estimator
✔ PASS: SMOTE Interpolation & Neighborhood Sampling
✔ PASS: Two-Sample Kolmogorov-Smirnov Test
✔ PASS: 1-Wasserstein Earth Mover's Distance
✔ PASS: Distance to Closest Record (DCR) Privacy Metric
✔ PASS: RFC-4180 Streaming CSV Parser & Dirty Format Handler
12 passed, 0 failed (100% success)
```

### 2. Backend Express & MongoDB Integration Tests (11/11 Passing)
Verifies live Atlas database connectivity, JWT authentication guards, dataset ingestion, Copula generative synthesis, fidelity auditing, TSTR downstream benchmarks, and SQL/CSV export generation:
```bash
npm run backend:test
```
```
✔ PASS: GET /api/health (Database connected, ping < 250ms)
✔ PASS: POST /api/auth/register (Bcrypt salted password)
✔ PASS: POST /api/auth/login (Signed JWT returned)
✔ PASS: GET /api/auth/me (Bearer token authentication)
✔ PASS: POST /api/datasets/upload (Automated schema profiling)
✔ PASS: GET /api/datasets/:id (Metadata and preview slice)
✔ PASS: POST /api/synthesis/run (Gaussian Copula generation)
✔ PASS: POST /api/evaluation/audit (KS test & DCR privacy score)
✔ PASS: POST /api/evaluation/tstr (Downstream Macro F1 retention)
✔ PASS: POST /api/export/csv (RFC-4180 streaming format)
✔ PASS: POST /api/export/sql (Relational DDL & INSERT batch)
11 passed, 0 failed (100% success)
```

---

## 📁 Repository Structure

```
DataForge/
├── backend/                         # Express.js 4.21 & MongoDB Mongoose 8.9 MVC Backend
│   ├── config/                      # Resilient MongoDB connection manager (config/db.js)
│   ├── controllers/                 # MVC Controllers (auth, dataset, synthesis, evaluation, export)
│   ├── docs/                        # Postman & Thunder Client test suites
│   ├── middlewares/                 # authMiddleware (JWT), uploadMiddleware (Multer), errorMiddleware
│   ├── models/                      # Mongoose Models (User, Dataset, SynthesisJob, EvaluationReport, AuditLog)
│   ├── routes/                      # Modular Express Routers (/api/health, /api/auth, /api/datasets, etc.)
│   ├── services/                    # Synthesis (Copula, SMOTE-NC), Fidelity (KS, Wasserstein), TSTR Engine
│   ├── scripts/                     # Seed script (backend/scripts/seed.js)
│   ├── Dockerfile                   # Hardened Node.js 20 Alpine production container
│   ├── package.json                 # Backend dependencies & scripts
│   ├── render.yaml                  # 1-Click Render Cloud deployment blueprint
│   ├── server.js                    # Express application entrypoint (Port 5000)
│   └── test-backend.js              # Integration test suite (11/11 tests passing)
│
├── frontend/                        # Production Web Application (Port 3005)
│   ├── css/                         # Obsidian HUD variables, base, components & page stylesheets
│   ├── js/                          # Application logic
│   │   ├── components/              # 3D canvas, charts, command palette, dropzone, sidebar, toast, tables
│   │   ├── pages/                   # Landing, dashboard, synthesizer-lab, upload, results, reports, settings
│   │   ├── services/                # api.js (Express client), auth.js, pipeline.js, dataset.js, storage.js
│   │   ├── utils/                   # Linear algebra, statistical math, CSV parser, DOM helpers, validation
│   │   └── vendor/                  # Three.js & GLTFLoader for 3D Monolith rendering
│   ├── images/                      # Project screenshots & visual assets
│   ├── models/                      # 3D Optical Data Monolith asset (optical_data_monolith.glb)
│   ├── index.html                   # 3D Monolith Cinematic Landing Page
│   ├── dashboard.html               # Main Workspace overview & 1-Click Benchmark Demo
│   ├── synthesizer-lab.html         # Generative Tabular Synthesis & TSTR Studio
│   ├── upload.html                  # Dataset Ingestion & Schema Profiler
│   ├── results.html                 # Downstream ML Benchmarks & Lift Matrix
│   ├── reports.html                 # Compliance Audit Reports & Multi-Format Exporter
│   ├── settings.html                # Engine Configuration & Cloud Endpoint settings
│   ├── login.html                   # User Authentication with 1-Click Quick Fill buttons
│   └── signup.html                  # User Registration & RBAC selection
│
├── dev-server.js                    # Zero-dependency local Node.js static dev server (Port 3005)
├── package.json                     # Root orchestrator ("npm run fullstack", "dev", "backend", "test")
├── render.yaml                      # Root Render.com Blueprint configuration
├── start-backend.bat                # 1-Click launcher for Express & MongoDB
├── start-fullstack.bat              # 1-Click launcher for Backend + Frontend simultaneously
├── test-suite.js                    # End-to-end frontend algorithm test suite (12/12 passing)
└── vercel.json                      # Vercel deployment configuration pointing to frontend/ & /api rewrites
```

---

## 🔒 Scientific Integrity Guarantees

- **Zero Test Contamination**: Test splits are partitioned *before* candidate generation and never exposed to synthesizers or oversamplers.
- **Variance Disclosure**: Every performance metric is reported with variance ($\mu \pm \sigma$) across multi-seed evaluations to prevent selective reporting.
- **Conservative Recommendations**: Candidate strategies must outperform baselines with statistical confidence ($p < 0.05$) and maintain majority precision before receiving a `RECOMMENDED` verdict.
- **Privacy Assurance**: The Distance to Closest Record (DCR) audit guarantees $0\%$ exact row duplication and zero training set memorization leak.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms and conditions.

---

*Built with empirical rigor by [Anhad Mahajan](https://github.com/AnhadMahajan).*
