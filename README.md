# DataForge — Synthetic Data Intelligence & Generative Synthesis Engine

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.3+-F7931E?style=flat&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Measure before you train. Stop guessing with synthetic data.**

DataForge is a high-performance, hybrid-runtime Machine Learning Intelligence and Generative Synthesis Engine. It analyzes tabular datasets, generates high-fidelity synthetic data, runs controlled multi-strategy augmentation trials on strictly held-out real test splits, and tells you mathematically whether synthetic data actually improves downstream model generalization.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20180848.png" alt="DataForge Landing Page Hero" width="100%" />
</p>

---

## 📑 Table of Contents

- [The Problem: Blind Augmentation](#-the-problem-blind-augmentation)
- [Core Methodology: 4-Stage Scientific Pipeline](#-core-methodology-4-stage-scientific-pipeline)
- [Generative Synthesis Suite](#-generative-synthesis-suite)
- [Tabular Augmentation Algorithms](#-tabular-augmentation-algorithms)
- [Statistical Fidelity & Privacy Auditing](#-statistical-fidelity--privacy-auditing)
- [Hybrid Dual-Engine Architecture](#-hybrid-dual-engine-architecture)
- [Multi-Page Application & Visual Tour](#-multi-page-application--visual-tour)
  - [1. Landing & Product Overview](#1-landing--product-overview)
  - [2. Researcher Onboarding & Authentication](#2-researcher-onboarding--authentication)
  - [3. Intelligence Dashboard & Workspace Hub](#3-intelligence-dashboard--workspace-hub)
  - [4. Dataset Ingestion & Diagnostic Profiler](#4-dataset-ingestion--diagnostic-profiler)
  - [5. Controlled Experimentation Lab](#5-controlled-experimentation-lab)
  - [6. Empirical Evaluation & Results Matrix](#6-empirical-evaluation--results-matrix)
  - [7. Workspace Settings & Vault Manager](#7-workspace-settings--vault-manager)
- [Native Backend REST API Reference](#-native-backend-rest-api-reference)
- [Getting Started](#-getting-started)
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
- **RFC-4180 Ingestion**: Robust streaming CSV parser supporting dirty currencies (`$5,200.50`), percentages (`12%`), quotes, and missing tokens (`NaN`, `?`, `N/A`).
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

## 🏗️ Hybrid Dual-Engine Architecture

DataForge uses a dual-engine architecture that runs locally in pure client-side mode, or connects to a high-performance native Python server:

```
                            ┌────────────────────────────────────────┐
                            │         DataForge Frontend (MPA)       │
                            │  Vanilla HTML5 + Vanilla CSS3 + ES6+   │
                            │   Glassmorphic Monochrome Design UI    │
                            └───────────────────┬────────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │    Native Python Backend    │                   │   In-Browser Client Engine  │
        │    FastAPI + Scikit-Learn   │                   │    WebAssembly + Workers    │
        │    http://127.0.0.1:8000    │                   │   (Zero-Install Privacy)    │
        ├─────────────────────────────┤                   ├─────────────────────────────┤
        │ • Multi-core Scikit-Learn   │   Auto-Fallback   │ • Pyodide Scikit-Learn WASM │
        │ • SciPy exact KS & EMD      │ ◄────────────────►│ • Pure JS Cholesky / Linalg │
        │ • Pandas DataFrame engine   │   When Offline    │ • In-Browser Data Worker    │
        │ • NumPy matrix acceleration │                   │ • LocalStorage persistence  │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

- **Pipeline Manager (`pipeline.js`)**: Probes `http://127.0.0.1:8000/api/health`. If the native backend is active, computation runs at full Scikit-Learn C-speed; if offline, it seamlessly falls back to Pyodide WebAssembly or the in-browser Web Worker.
- **100% Reproducible Code Generation**: Automatically compiles end-to-end Python Scikit-Learn scripts ready to download or copy directly to your clipboard.

---

## 🖥️ Multi-Page Application & Visual Tour

DataForge provides a multi-page interface tailored for machine learning researchers and data scientists:

| Page | File | Primary Function |
|---|---|---|
| **Landing** | [`index.html`](index.html) | Product value proposition, interactive showcase, workflow entry point. |
| **Auth** | [`signup.html`](signup.html) & [`login.html`](login.html) | Secure local session authentication, password entropy analysis. |
| **Dashboard** | [`dashboard.html`](dashboard.html) | Central command center, 1-click synthetic benchmark demo, dataset health radar. |
| **Upload** | [`upload.html`](upload.html) | CSV drag-and-drop ingestion, automated typing, outlier detection, Need Score. |
| **Experiment Lab** | [`experiment.html`](experiment.html) | Multi-strategy configuration, cross-validation parameters, algorithm selector. |
| **Results Matrix** | [`results.html`](results.html) | Head-to-head evaluation matrix, held-out delta cards, confusion matrices, CSV export. |
| **Narrative Reports**| [`reports.html`](reports.html) | Scientific narrative reports with verdicts, citations, and exportable PDF layout. |
| **Synthesizer Lab** | [`synthesizer-lab.html`](synthesizer-lab.html) | Standalone generative studio (Copula, KDE, Bayes) with real-time fidelity audits. |
| **Settings** | [`settings.html`](settings.html) | Researcher profile preferences, storage quota monitoring, JSON workspace vault. |

---

### 1. Landing & Product Overview
The landing page introduces the core thesis of DataForge—treating synthetic data augmentation as an empirical hypothesis to be validated with mathematical rigor before model training.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20180848.png" alt="DataForge Landing Page Hero" width="100%" />
</p>

- **Value Proposition**: Clear overview of how DataForge replaces blind oversampling with empirical validation.
- **Direct Navigation**: 1-click entry to the workflow, feature highlights, and interactive preview canvas.

---

### 2. Researcher Onboarding & Authentication
A dedicated, privacy-first researcher authentication interface with client-side credential hashing and password strength verification.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20180908.png" alt="Researcher Onboarding & Account Creation" width="100%" />
</p>

- **Scientific Guarantees**: Highlights the 0% data leakage policy and zero-overhead client execution.
- **Security**: Real-time password entropy meter with character requirement validation.

---

### 3. Intelligence Dashboard & Workspace Hub
The central command hub gives researchers an immediate birds-eye view of their datasets, recent experiments, and recommended data strategies.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20181132.png" alt="Research Dashboard & Workspace Hub" width="100%" />
</p>

- **Live Metrics**: Vault datasets count, total experiment runs, and maximum observed F1 gain.
- **Empirical Recommendation**: Highlights top-performing strategies (e.g. *Random Oversampling* or *SMOTE-NC*) with statistical confidence ratings.
- **Augmentation Impact Overview & Health Radar**: Visual distribution charts and diagnostic radar assessing class imbalance and outlier presence.

---

### 4. Dataset Ingestion & Diagnostic Profiler
A robust data ingestion studio supporting drag-and-drop CSV upload and built-in benchmark datasets for instant exploration.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20180938.png" alt="Dataset Ingestion & Diagnostic Profiler" width="100%" />
</p>

- **Streaming CSV Parser**: Ingests files up to 5MB with automatic handling of quotes, dirty formats, and missing values.
- **Benchmark Sample Loader**: Instant 1-click loading of the *Customer Churn Risk* benchmark dataset (280 rows, imbalanced classes, simulated outliers).
- **Vault History**: Lists previously ingested datasets for fast switching across experiments.

---

### 5. Controlled Experimentation Lab
Configure and calibrate multiple synthetic data and oversampling strategies to run concurrently against unaugmented baselines.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20181002.png" alt="Scientific Experimentation Lab" width="100%" />
</p>

- **Experiment Setup**: Dataset health score indicator, class imbalance ratio (e.g. 7.54:1), and pipeline readiness verification.
- **Multi-Strategy Selection**: Select and run **SMOTE-NC**, **ADASYN**, **SMOTE-Tomek**, and **Random Oversampling** in parallel.
- **Interactive Hyperparameter Sliders**: Dynamic adjustment of $k$-nearest neighbors ($k=5$), boundary cleaning flags, and Gaussian jitter variance percentages.

---

### 6. Empirical Evaluation & Results Matrix
The analytical core of DataForge, displaying statistical verdicts, comparative metrics on strictly held-out test splits, and export utilities.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20181118.png" alt="Empirical Evaluation & Results Matrix" width="100%" />
</p>

- **Actionable Verdict Banner**: Prominently displays clear guidance (e.g., `Augmentation Recommended` with high statistical confidence $p = 0.05$).
- **Held-Out Metric Delta Cards**: Side-by-side comparison of **Macro F1-Score** (+1.5% gain), **Accuracy**, **Precision**, and **Recall** (+4.5% gain) against baseline.
- **Export & Report Actions**: Direct export of results matrix CSV, augmented datasets, synthetic datasets, and 1-click generation of narrative scientific reports.

---

### 7. Workspace Settings & Vault Manager
Manage researcher credentials, audit local storage quotas, and monitor hybrid runtime engine execution states.

<p align="center">
  <img src="images/Screenshot%202026-08-25%20181153.png" alt="Workspace Settings & Vault Manager" width="100%" />
</p>

- **Researcher Profile**: Custom user credentials and workspace identification.
- **Runtime Engine Status**: Visual indicator showing whether the **Browser Python (Pyodide)** or **Native FastAPI Backend** is actively powering the workspace.
- **Data & Storage Quotas**: Manage client-side LocalStorage quotas, import/export workspace JSON vaults, and customize evaluation defaults.

---

## 🔌 Express.js & MongoDB MVC Backend API (v2.0)

DataForge v2.0 features an enterprise-grade **Express.js & MongoDB MVC Backend** located in [`backend/`](backend/README.md). It orchestrates mathematical generative synthesis, statistical fidelity audits, downstream TSTR machine learning benchmarks, compliance audit logging, and multi-format dataset exports.

### Architecture Overview

```
backend/
├── config/db.js              # Resilient MongoDB Atlas / local connection manager
├── controllers/              # MVC Controller Layer (auth, datasets, synthesis, eval, export)
├── docs/                     # Thunder Client & Postman Collection exports
├── middlewares/              # JWT auth, RBAC authorization, error handling, Multer upload
├── models/                   # Mongoose Schemas: User, Dataset, SynthesisJob, EvaluationReport, AuditLog
├── routes/                   # Express Routers (/api/health, /api/auth, /api/datasets, /api/synthesis, /api/evaluation, /api/export)
├── Dockerfile                # Production-hardened Node.js 20 Alpine container
├── render.yaml               # Cloud deployment blueprint for Render Web Service
└── test-backend.js           # Integration test suite verifying all 6 API modules
```

---

### Core API Modules & Endpoints

#### 1. System Health & Telemetry
- **`GET /api/health`**: Returns live MongoDB connection status & ping latency, server uptime, Node.js memory footprint (RSS/Heap), host CPU/OS diagnostics, and active API catalog.
- **`GET /`**: API engine identification and version status.

#### 2. Authentication & RBAC (Person 2)
- **`POST /api/auth/register`**: Creates researcher profile with bcrypt password hashing and assigned RBAC role (`user`, `data_scientist`, `admin`).
- **`POST /api/auth/login`**: Authenticates credentials and returns signed JWT Bearer token.
- **`GET /api/auth/me`**: Retrieves authenticated researcher profile.

#### 3. Dataset Ingestion & Profiling (Person 3)
- **`POST /api/datasets/upload`**: Multipart file upload (`.csv`, `.json`) with automated statistical column profiling.
- **`GET /api/datasets`**: Paginated dataset listing with metadata, shape, and column profiles.
- **`GET /api/datasets/:id`**: Retrieves dataset metadata with a 20-row preview slice.
- **`DELETE /api/datasets/:id`**: Removes dataset and associated indices.

#### 4. Mathematical Synthesis Core (Person 1)
- **`POST /api/synthesis/run`**: Generates synthetic tabular records using Gaussian Copula, Multivariate KDE, or SMOTE.
- **`GET /api/synthesis/jobs`**: Paginated history of generative synthesis runs.
- **`GET /api/synthesis/jobs/:id`**: Fetches complete synthesized dataset matrix and generation metrics.
- **`DELETE /api/synthesis/jobs/:id`**: Removes synthesis job.

#### 5. Statistical Fidelity & TSTR Benchmark (Person 1)
- **`POST /api/evaluation/audit`**: Computes Kolmogorov-Smirnov test, 1-Wasserstein metric, and Distance to Closest Record (DCR) privacy score.
- **`POST /api/evaluation/tstr`**: Runs empirical Train-on-Synthetic, Test-on-Real (TSTR) benchmark measuring Macro F1 lift on held-out data.
- **`GET /api/evaluation/reports`**: Lists historical validation reports.

#### 6. Dataset Multi-Format Export Engine (Person 4)
- **`GET /api/export`**: Discovers available export formats and specifications.
- **`POST /api/export/csv`**: Generates RFC-4180 compliant CSV downloads with strict quote/delimiter escaping and CRLF line breaks.
- **`POST /api/export/json`**: Formats synthetic datasets into structured JSON with embedded metadata headers or raw record arrays.
- **`POST /api/export/sql`**: Generates relational SQL DDL (`CREATE TABLE` with automatic type inference) and batch `INSERT INTO` statements.

---

### 🔒 Compliance Audit Logging

Every critical platform action is automatically recorded in MongoDB via `backend/models/AuditLog.js`:
- **Compliance Schema**: Tracks `user` reference, `action` (`EXPORT_CSV`, `EXPORT_SQL`, `SYNTHESIS_RUN`, `DATASET_UPLOAD`), `resourceId`, client `ipAddress` (with reverse proxy detection), client `userAgent`, and `timestamp`.
- **Non-Blocking Resilience**: Safe error-catching ensures audit persistence never blocks critical application execution.

---

### 🛠️ Backend Setup & Execution

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment (`backend/.env`)**:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/dataforge
   JWT_SECRET=dataforge_super_secure_jwt_secret_key_2026_production
   CLIENT_URL=http://localhost:3005
   ```

3. **Start the Express Backend Server**:
   ```bash
   # Development mode with hot-reloading
   npm run dev

   # Production mode
   npm start
   ```

4. **Run Backend Integration Tests**:
   ```bash
   npm test
   ```

---

### 📬 Evaluation Postman & Thunder Client Suite

Comprehensive API suites are provided in `backend/docs/`:
- **`DataForge_API_Collection.json`**: Complete Thunder Client collection ready for VS Code import.
- **`DataForge_Postman_Collection.json`**: Postman v2.1.0 collection with pre-configured `{{BASE_URL}}` environment variables and realistic sample payloads.

---

### 🐳 Docker & Cloud Deployment

#### Docker Container
A minimal Node.js 20 Alpine container image with zero-dependency health checks:
```bash
# Build production image
docker build -t dataforge-backend ./backend

# Run container
docker run -d -p 5000:5000 --name dataforge-api dataforge-backend
```

#### Render.com Cloud Blueprint
Deploy with one click to Render free tier using `render.yaml` or `backend/render.yaml`:
1. Link your repository in Render Dashboard.
2. Render detects `render.yaml` and deploys the web service with automatic health checks pointing to `/api/health`.
3. Provide your `MONGO_URI` (MongoDB Atlas free tier M0) in the Render environment settings.

---

---

## 📁 Repository Structure

```
DataForge/
├── backend/                         # Express.js 4.21 & MongoDB Mongoose 8.9 MVC Backend
│   ├── config/                      # Resilient MongoDB connection manager
│   ├── controllers/                 # MVC Controllers (auth, dataset, synthesis, evaluation, export)
│   ├── docs/                        # Postman & Thunder Client test suites
│   ├── middlewares/                 # authMiddleware (JWT), uploadMiddleware (Multer), errorMiddleware
│   ├── models/                      # Mongoose Models (User, Dataset, SynthesisJob, EvaluationReport, AuditLog)
│   ├── routes/                      # Modular Express Routers (/api/health, /api/auth, /api/datasets, etc.)
│   ├── services/                    # Synthesis (Copula, SMOTE-NC), Fidelity (KS, Wasserstein), TSTR Engine
│   ├── Dockerfile                   # Hardened Node.js 20 Alpine production container
│   ├── package.json                 # Backend dependencies & scripts
│   ├── render.yaml                  # 1-Click Render Cloud deployment blueprint
│   ├── server.js                    # Express application entrypoint (Port 5000)
│   └── test-backend.js              # Integration test suite (11/11 tests passing)
│
├── frontend/                        # Production Web Application (Port 3005)
│   ├── css/                         # Variables, layout, animations, components & page stylesheets
│   ├── js/                          # Application logic
│   │   ├── components/              # 3D canvas, charts, command palette, dropzone, sidebar, toast, tables
│   │   ├── pages/                   # Landing, dashboard, synthesizer-lab, upload, results, reports, settings
│   │   ├── services/                # api.js (Express client), auth.js, pipeline.js, dataset.js, storage.js
│   │   ├── utils/                   # Linear algebra, statistical math, CSV parser, DOM helpers, validation
│   │   └── vendor/                  # Three.js & GLTFLoader for 3D Monolith rendering
│   ├── images/                      # Project screenshots & visual assets
│   ├── models/                      # 3D Optical Data Monolith asset (optical_data_monolith.glb)
│   ├── index.html                   # 3D Monolith Cinematic Landing Page
│   ├── dashboard.html               # Main Workspace overview
│   ├── synthesizer-lab.html         # Generative Tabular Synthesis & TSTR Studio
│   ├── upload.html                  # Dataset Ingestion & Schema Profiler
│   ├── results.html                 # Downstream ML Benchmarks & Lift Matrix
│   ├── reports.html                 # Compliance Audit Reports & Multi-Format Exporter
│   ├── settings.html                # Engine Configuration & Cloud Endpoint settings
│   ├── login.html                   # User Authentication
│   └── signup.html                  # User Registration & RBAC selection
│
├── dev-server.js                    # Zero-dependency local Node.js static dev server (Port 3005)
├── package.json                     # Root orchestrator ("npm run fullstack", "dev", "backend", "test")
├── render.yaml                      # Root Render.com Blueprint configuration
├── start-backend.bat                # 1-Click launcher for Express & MongoDB
├── start-fullstack.bat              # 1-Click launcher for Backend + Frontend simultaneously
├── test-suite.js                    # End-to-end frontend algorithm test suite (12/12 passing)
└── vercel.json                      # Vercel deployment configuration pointing to frontend/
```

---

## 🔒 Scientific Integrity Guarantees

- **Zero Test Contamination**: Test splits are partitioned *before* candidate generation and never exposed to synthesizers or oversamplers.
- **Variance Disclosure**: Every performance metric is reported with variance ($\mu \pm \sigma$) across multi-seed evaluations to prevent selective reporting.
- **Conservative Recommendations**: Candidate strategies must outperform baselines with statistical confidence ($p < 0.05$) and maintain majority precision before receiving a `RECOMMENDED` verdict.
- **Client-Side Privacy**: By default, no datasets are transmitted to external cloud servers; computation is localized to your machine.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms and conditions.

---

*Built with empirical rigor by [Anhad Mahajan](https://github.com/AnhadMahajan).*
