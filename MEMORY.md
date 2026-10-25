# DataForge — Project Memory & Architecture Context

> **Primary Second Brain Vault:** `C:/Users/amanm/OneDrive/Desktop/Obsidian/personal`  
> **Master Project Note:** `[[Projects/DataForge]]`  
> **Architecture Blueprint:** `[[Architecture/DataForge_Synthetic_Intelligence_Pipeline]]`  
> **Dev Log:** `[[Dev Logs/2026-08-30 - DataForge Universal ML and Hybrid Architecture]]`

---

## 📌 Project Identity
- **Name:** DataForge (Tabular Synthetic Data & Augmentation Intelligence Platform)
- **Tech Stack:** Python 3.13.5 (FastAPI, Scikit-Learn 1.6.1, NumPy 2.1.3, Pandas 2.2.3, SciPy 1.15.3), JavaScript ES6, HTML5, Vanilla CSS, Pyodide WebAssembly.
- **Ports:**
  - Frontend Web Server: `http://localhost:3005`
  - Native Python FastAPI: `http://127.0.0.1:8000` (OpenAPI docs at `http://127.0.0.1:8000/docs`)

- **Deployment & Cloud Hosting:**
  - Vercel App: Linked via GitHub (`AnhadMahajan/DataForge` on `main`)
  - Config: `vercel.json` (enables `cleanUrls`, custom security headers, worker headers)
  - Cloud Execution Mode: In-browser WebAssembly (Pyodide) automatically activates under HTTPS / Vercel without throwing mixed-content errors.
  - Remote FastAPI Backend: Configurable in Workspace Settings (`settings.html#backend`) for custom cloud FastAPI endpoints (Railway, Render, Fly.io, Hugging Face Spaces).

---

## 🎯 Architecture Summary
1. **Dispatcher (`js/services/pipeline.js`)**: Decouples UI from runtime; detects environment protocol (HTTPS vs HTTP localhost), checks native FastAPI or custom backend, and seamlessly falls back to Pyodide WebAssembly with zero install.
2. **Scikit-Learn ML Engines**:
   - Classification: `RandomForestClassifier`, `HistGradientBoostingClassifier`, `LogisticRegression`, `DecisionTreeClassifier`, `KNeighborsClassifier`.
   - Regression: `RandomForestRegressor`, `HistGradientBoostingRegressor`, `Ridge`, `DecisionTreeRegressor`, `KNeighborsRegressor`.
3. **Controlled Augmentation Protocols**:
   - SMOTE, ADASYN, SMOTE-Tomek, Random Oversampling with Gaussian Jitter, Feature Noise Injection.
   - **Zero Leakage**: Test partition is strictly isolated *before* augmentation and never augmented.
4. **4-Tier Statistical Fidelity & Privacy Audit**:
   - 2-Sample Kolmogorov-Smirnov ($D, p$)
   - Wasserstein-1 Distance (Earth Mover's)
   - Frobenius Covariance Norm ($\|\Sigma_{\text{real}} - \Sigma_{\text{synth}}\|_F$)
   - Distance to Closest Record (DCR) Privacy Score
5. **3D Optical Data Monolith Cinematic Landing Engine (`models/optical_data_monolith.glb`, `js/pages/landing.js`)**:
   - **Bespoke Blender 3D Asset**: Modeled in Blender (`3.2 x 1.0 x 4.8` slab) featuring 4-segment precision chamfered bevels (`OpticalMonolith_Glass`), a bead-blasted dark titanium pedestal (`TitaniumPedestal`) with stabilizing foot flanges, an internal multivariate data lattice (90 cold-white majority nodes, 16 warm-amber minority nodes, 24 emerald synthetic interpolation nodes), and an internal decision manifold ribbon.
   - **Three.js Optical & Material Engine**:
     - Physically based transmission (`transmission: 0.95`, `ior: 1.54`, `clearcoat: 1.0`, `roughness: 0.02`) illuminated by an on-the-fly PMREM studio cubemap generator (overhead softbox, left fill strip, right specular kicker, gradient floor bounce).
     - Dynamic $k$-NN laser filaments connecting amber minority anchors and emerald geodesic paths.
     - Laser-etched optical alignment corner ticks and soft ground contact shadow plane.
   - **Interactive Raycasting HUD Probe**:
     - Real-time 3D raycasting with `distanceToPoint(nodeWorldPos)` detection radius.
     - Dynamic hairline HUD tooltip following the cursor displaying exact hexadecimal node ID, 3D coordinates, local density norm, and eigenvalue $\lambda_1$.
     - Emissive intensity hover pulse on acquired nodes with synchronized tactile Web Audio acoustic micro-ticks (`playSubtleClick(1200, 0.015)`).
   - **Restrained Editorial Design System (Linear / Apple Pro)**:
     - Obsidian canvas with alternating split layout per chapter (Hero on left, Monolith on right; Chapter 2 Monolith on left, Narrative on right; Chapter 3 TSTR Console on left, Monolith in architectural isometric view on right; Chapter 4 CTA on left, Monolith on right).
     - Vertical timeline progression navigation on right edge.
     - Mobile responsiveness (<768px) with subtle glass backdrops and auto-scaled camera framing.
   - **Local Deployment Rule**: Strictly local development; all assets and changes remain local without pushing to GitHub.
6. **Express.js & MongoDB MVC Architecture (Phase 2 Continuous Evaluation)**:
   - **Backend Engine Port:** `http://localhost:5000` (API Health: `/api/health`)
   - **Database:** MongoDB (`mongodb://localhost:27017/dataforge` or MongoDB Atlas Cluster)
   - **MVC File Hierarchy**:
     - `config/`: `db.js` (Mongoose connection & retry handler)
     - `models/`: `User.js` (P2), `Dataset.js` (P3), `SynthesisJob.js` (P1), `EvaluationReport.js` (P1), `AuditLog.js` (P4)
     - `controllers/`: `authController.js` (P2), `datasetController.js` (P3), `synthesisController.js` (P1), `evaluationController.js` (P1), `exportController.js` (P4), `healthController.js` (P4)
     - `routes/`: `authRoutes.js`, `datasetRoutes.js`, `synthesisRoutes.js`, `evaluationRoutes.js`, `exportRoutes.js`, `healthRoutes.js`
     - `middlewares/`: `authMiddleware.js`, `uploadMiddleware.js`, `errorMiddleware.js`
     - `services/`: `synthesisEngine.js`, `fidelityEngine.js`, `tstrEngine.js`, `profilingService.js`
     - `docs/`: `DataForge_API_Collection.json` (Thunder Client & Postman test suite)
   - **Zero-Conflict 4-Person Git Strategy**:
     - P1 (User): `feature/core-synthesis-tstr-engine` (12 commits)
     - P2 (Teammate 2): `feature/auth-security-rbac` (10 commits)
     - P3 (Teammate 3): `feature/dataset-ingestion-profiling` (10 commits)
     - P4 (Teammate 4): `feature/export-audit-deployment` (10 commits)


