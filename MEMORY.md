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

---

## 🎯 Architecture Summary
1. **Dispatcher (`js/services/pipeline.js`)**: Decouples UI from runtime; dispatches to native FastAPI or in-browser Pyodide worker.
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
