# DataForge — Project Memory & Architecture Context

> **Primary Second Brain Vault:** `C:/Users/amanm/OneDrive/Desktop/Obsidian/personal`  
> **Master Project Note:** `[[Projects/DataForge]]`  
> **Architecture Blueprint:** `[[Architecture/DataForge_Synthetic_Intelligence_Pipeline]]`  
> **Dev Log:** `[[Dev Logs/2026-08-30 - DataForge Universal ML and Hybrid Architecture]]`

---

## 📌 Project Identity
- **Name:** DataForge (Tabular Synthetic Data & Augmentation Intelligence Platform)
- **Tech Stack:** Express.js 4.21, Mongoose 8.9 (MongoDB), Node.js v20+, JavaScript ES6, HTML5, Vanilla CSS, Three.js, Pyodide WebAssembly.
- **Ports:**
  - Frontend Web Server: `http://localhost:3005`
  - Express.js & MongoDB MVC Backend: `http://localhost:5000` (API Health: `http://localhost:5000/api/health`)

- **Deployment & Cloud Hosting:**
  - Vercel App: Linked via GitHub (`AnhadMahajan/DataForge` on `main`)
  - Express Backend Deployment: Render Web Service via `backend/render.yaml` or Docker container via `backend/Dockerfile`
  - Cloud Database: MongoDB Atlas free tier cluster
  - Cloud Execution Mode: Hybrid architecture with auto-fallback to In-Browser Pyodide WebAssembly when server is offline or unreachable.

---

## 🎯 Architecture Summary
1. **Dispatcher (`js/services/pipeline.js`)**: Decouples UI from runtime; probes Express backend on `http://localhost:5000`, syncs JWT tokens, and seamlessly falls back to Pyodide WebAssembly with zero install.
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
   - Modeled in Blender (`3.2 x 1.0 x 4.8` slab) featuring 4-segment precision chamfered bevels (`OpticalMonolith_Glass`), a bead-blasted dark titanium pedestal (`TitaniumPedestal`), and an internal multivariate data lattice.
   - Real-time 3D raycasting with `distanceToPoint(nodeWorldPos)` detection radius and hairline HUD tooltip with Web Audio acoustic ticks.
6. **Express.js & MongoDB MVC Architecture (Phase 2 Continuous Evaluation)**:
   - **Backend Engine Port:** `http://localhost:5000` (API Health: `/api/health`)
   - **Database:** MongoDB (`mongodb://localhost:27017/dataforge` or MongoDB Atlas Cluster)
   - **MVC File Hierarchy**:
     - `config/`: `db.js` (Mongoose connection & retry handler)
     - `models/`: `User.js` (P2), `Dataset.js` (P3), `SynthesisJob.js` (P1), `EvaluationReport.js` (P1), `AuditLog.js` (P4)
     - `controllers/`: `authController.js` (P2), `datasetController.js` (P3), `synthesisController.js` (P1), `evaluationController.js` (P1), `exportController.js` (P4)
     - `routes/`: `authRoutes.js`, `datasetRoutes.js`, `synthesisRoutes.js`, `evaluationRoutes.js`, `exportRoutes.js`, `healthRoutes.js`
     - `middlewares/`: `authMiddleware.js`, `uploadMiddleware.js`, `errorMiddleware.js`
     - `services/`: `synthesisEngine.js`, `fidelityEngine.js`, `tstrEngine.js`, `profilingService.js`
     - `docs/`: `DataForge_API_Collection.json` (Thunder Client) & `DataForge_Postman_Collection.json` (Postman)
   - **Git Activity & Branch Isolation (10+ Pushes Each)**:
     - P1 (User): `feature/core-synthesis-tstr-engine` (12 commits)
     - P2 (Teammate 2): `feature/auth-security-rbac` (10 commits)
     - P3 (Teammate 3): `feature/dataset-ingestion-profiling` (10 commits)
     - P4 (Teammate 4): `feature/export-audit-deployment` (10 commits)
   - **Continuous Evaluation Phase 2 Verification**:
     - All 4 PRs merged into `main`.
     - Frontend-backend unified integration verified: `node test-suite.js` (12/12 suites PASS), `node backend/test-backend.js` (11/11 tests PASS).
     - Dead code, pycache, and temporary screenshot artifacts purged.
     - Cloud deployment ready via `backend/render.yaml` and `backend/Dockerfile`.
