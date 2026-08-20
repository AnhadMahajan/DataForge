# DataForge — Synthetic Data Intelligence Engine

> **Measure before you train. Stop guessing with synthetic data.**

DataForge is a client-side machine learning intelligence engine that analyzes tabular datasets, evaluates candidate augmentation strategies under controlled conditions, and tells you mathematically whether synthetic data actually improves downstream model generalization.

---

## ⚡ The Problem: Blind Augmentation

In modern machine learning pipelines, teams frequently encounter class imbalance or small sample sizes and blindly apply synthetic data techniques like SMOTE or Gaussian noise injection. 

However, conventional synthetic data tools suffer from three critical flaws:
1. **Silent Boundary Distortion**: Generating synthetic samples near class decision boundaries frequently degrades majority class precision while masking the drop in overall accuracy.
2. **Overfitting to Duplication**: Naive oversampling creates dense clusters of near-identical samples that cause classifiers to memorize synthetic artifacts rather than learning generalizable features.
3. **Lack of Causal Explanations**: When performance drops, engineers rarely know *why*. Without diagnostic visibility, teams abandon augmentation altogether instead of adjusting the parameter space.

**DataForge treats synthetic data as an empirical hypothesis to be tested and verified before deployment.**

---

## 🔬 Core Methodology: 4-Stage Scientific Pipeline

```
  ┌────────────────┐      ┌────────────────────┐      ┌───────────────────────┐      ┌─────────────────────────┐
  │   01 OBSERVE   │ ───► │  02 HYPOTHESIZE    │ ───► │     03 EXPERIMENT     │ ───► │      04 RECOMMEND       │
  │ Dataset Health │      │ Candidate Strategies│     │ Controlled Trials     │      │ Causal Report & Verdict │
  └────────────────┘      └────────────────────┘      └───────────────────────┘      └─────────────────────────┘
```

1. **Observe**: Profile the raw dataset to compute class imbalance ratios, IQR outlier bounds, Pearson correlation matrices, and a composite **Augmentation Need Score (0–100)**.
2. **Hypothesize**: Configure candidate augmentation strategies tailored to the dataset's feature space (e.g. SMOTE with k-nearest neighbors, jittered random oversampling, Gaussian perturbation).
3. **Experiment**: Execute multi-run randomized trials ($N$ iterations) on strictly **held-out, unaugmented test splits** to benchmark candidate strategies against unaugmented baselines.
4. **Recommend**: Receive plain-English explanations citing exact feature shifts, statistical significance tests ($p$-value estimates), class degradation flags, and an actionable verdict (`RECOMMENDED`, `USE WITH CAUTION`, `NOT RECOMMENDED`).

---

## 🚀 Key Features

- **🛡️ Zero Data Leakage**: Test partitions are isolated *before* any augmentation and remain 100% untouched across all runs.
- **📊 Multi-Run Variance Tracking**: Every evaluation measures standard deviations ($\mu \pm \sigma$) across randomized seeds to prevent false positives caused by lucky data splits.
- **⚠️ Degradation & Trade-off Warnings**: Automatically flags when an augmentation strategy improves minority recall at the expense of significant majority precision loss ($>3.5\%$).
- **✨ Synthetic Quality Metrics**: Evaluates Diversity Score (0–100), Duplicate Redundancy %, and Distribution Shift ($\Delta$) for each generated variant.
- **🔒 Pure Client-Side Privacy**: Zero data leaves your browser. All parsing, mathematical analysis, model training, and storage run locally in client memory.
- **📱 Fully Responsive Design**: Seamless experience across mobile phones (with frosted bottom navigation), tablets, and widescreen desktop monitors.

---

## 📐 System Architecture & Multi-Page App (MPA)

DataForge is built with zero external runtime dependencies using vanilla web standards:

```
DataForge/
├── index.html               # Public Landing Page & Interactive Showcase
├── signup.html              # User Registration with Strength Meter
├── login.html               # Sign In & Session Guard
├── dashboard.html           # Main Workspace & 1-Click Benchmark Demo
├── upload.html              # Dataset Ingestion & Statistical Profiler
├── experiment.html          # Multi-Strategy Experiment Configuration Lab
├── results.html             # Comparative Evaluation Matrix & CSV Exporter
├── reports.html             # Structured Scientific Narrative Reports
├── settings.html            # Profile, Quota Bar & Workspace Backup/Export
│
├── css/
│   ├── variables.css        # Design tokens & fluid clamp typography
│   ├── reset.css            # Modern element reset
│   ├── base.css             # Typography & global body styling
│   ├── components.css       # Cards, pill badges, inputs, buttons, tables
│   ├── layout.css           # Responsive sidebar, bottom nav, modal & grid
│   ├── utilities.css        # Spacing, flexbox, typography helpers
│   ├── animations.css       # Keyframes & smooth entry transitions
│   └── pages/               # Page-specific stylesheets
│
├── js/
│   ├── utils/               # Math, CSV parser, DOM, formatting, validation
│   ├── services/            # Storage, Auth, Dataset, Analysis, Augmentation,
│   │                        # Evaluation, Recommendations, Reports, Experiment
│   ├── components/          # Charts (Canvas), Tables, Dropzone, Modals, Sidebar, Toast
│   └── pages/               # Page controller scripts
│
├── docs/                    # Complete 8-part architectural specification
├── server.js                # Lightweight zero-dependency local static server
├── test-suite.js            # End-to-end Node.js automated test suite
└── package.json             # ES Module project manifest
```

---

## 🛠️ Getting Started

### Option 1: Zero-Dependency Node.js Server (Recommended)
Clone the repository and launch the local server:
```bash
git clone https://github.com/AnhadMahajan/DataForge.git
cd DataForge
npm start
```
Then navigate to **`http://localhost:3000`** in your browser.

### Option 2: Direct Browser Execution
Open **`index.html`** directly in any modern web browser supporting ES Modules (Chrome, Firefox, Safari, Edge).

---

## 🧪 Automated Testing

Run the full end-to-end automated test suite:
```bash
npm test
```
The test suite validates:
- [x] Mathematical utilities, IQR outlier detection, and cryptographic hashing
- [x] RFC-4180 CSV parser and data type inference
- [x] Local storage CRUD, namespacing, and authentication session guards
- [x] Dataset health metrics and Augmentation Need Score calculation
- [x] SMOTE, Random Oversampling, and Gaussian Noise augmentation algorithms
- [x] Stratified cross-validation and k-NN / Decision Tree classification
- [x] Statistical recommendation engine and narrative report compiler

---

## 📚 Specification Documentation

Comprehensive architectural and design documents are located in [`docs/`](docs/):

| Document | Purpose |
|---|---|
| [**01-VISION.md**](docs/01-VISION.md) | Problem statement, value proposition, and design principles |
| [**02-DESIGN-SYSTEM.md**](docs/02-DESIGN-SYSTEM.md) | Monochrome glassmorphism tokens, typography, and contrast rules |
| [**03-ARCHITECTURE.md**](docs/03-ARCHITECTURE.md) | Service layer architecture, directory structure, module contracts |
| [**04-PAGES-AND-FLOWS.md**](docs/04-PAGES-AND-FLOWS.md) | Detailed specifications for all 9 application views and state transitions |
| [**05-DATA-LAYER.md**](docs/05-DATA-LAYER.md) | LocalStorage schema, data models, persistence, and backup protocols |
| [**06-CORE-ENGINE.md**](docs/06-CORE-ENGINE.md) | Mathematical formulation of SMOTE, Noise, k-NN, and Recommendations |
| [**07-BUILD-ORDER.md**](docs/07-BUILD-ORDER.md) | Phased implementation roadmap and verification checkpoints |
| [**08-ANTI-PATTERNS.md**](docs/08-ANTI-PATTERNS.md) | Scientific integrity guardrails and anti-slop guidelines |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
