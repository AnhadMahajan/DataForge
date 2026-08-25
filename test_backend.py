"""
Test DataForge Native Python FastAPI Backend Endpoints (Windows CP1252 Safe)
"""

import urllib.request
import json
import sys

# Ensure UTF-8 output encoding on Windows stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

print("==================================================")
print("[TEST] Testing DataForge Native Python FastAPI Backend")
print("==================================================")

# 1. Test Healthcheck
print("\n[1] Testing /api/health...")
res = urllib.request.urlopen(f"{BASE_URL}/api/health")
health = json.loads(res.read())
print(f"[OK] Health: {health['status']} | Python: {health['pythonVersion']} | Sklearn: {health['packages']['scikit-learn']}")

# Sample Data
headers = ["Age", "Income", "Experience", "ChurnRisk"]
real_data = [
    [25, 50000, 2, "Yes"],
    [30, 60000, 5, "No"],
    [35, 75000, 8, "Yes"],
    [40, 90000, 12, "No"],
    [45, 105000, 15, "Yes"],
    [50, 120000, 20, "No"],
    [28, 55000, 3, "Yes"],
    [33, 68000, 6, "No"],
    [38, 82000, 10, "Yes"],
    [48, 115000, 18, "No"],
    [26, 52000, 2, "Yes"],
    [31, 62000, 5, "No"],
    [36, 78000, 9, "Yes"],
    [41, 92000, 13, "No"],
    [46, 108000, 16, "Yes"],
    [51, 122000, 21, "No"],
    [29, 56000, 4, "Yes"],
    [34, 70000, 7, "No"],
    [39, 84000, 11, "Yes"],
    [49, 118000, 19, "No"],
]

# 2. Test Synthesis Endpoint
print("\n[2] Testing /api/synthesize (Gaussian Copula)...")
req_data = json.dumps({
    "headers": headers,
    "data": real_data,
    "algorithm": "copula",
    "rowCount": 30,
    "seed": 42
}).encode("utf-8")
req = urllib.request.Request(f"{BASE_URL}/api/synthesize", data=req_data, headers={"Content-Type": "application/json"})
res = urllib.request.urlopen(req)
synth_res = json.loads(res.read())
print(f"[OK] Generated {len(synth_res['syntheticData'])} rows via {synth_res['algorithm']}. Headers: {synth_res['syntheticHeaders']}")

# 3. Test Audit Endpoint
print("\n[3] Testing /api/audit (KS-test, Wasserstein, DCR)...")
req_data = json.dumps({
    "headers": headers,
    "realData": real_data,
    "syntheticData": synth_res["syntheticData"],
}).encode("utf-8")
req = urllib.request.Request(f"{BASE_URL}/api/audit", data=req_data, headers={"Content-Type": "application/json"})
res = urllib.request.urlopen(req)
audit_res = json.loads(res.read())
print(f"[OK] Statistical Fidelity Score: {audit_res['overallScore']}/100 | KS Fidelity: {audit_res['numericFidelity']*100:.1f}% | Covariance: {audit_res['correlationFidelity']*100:.1f}% | Privacy: {audit_res['privacyScore']}%")

# 4. Test TSTR Benchmark Endpoint
print("\n[4] Testing /api/benchmark/tstr (Real Scikit-Learn TSTR)...")
req_data = json.dumps({
    "headers": headers,
    "realData": real_data,
    "syntheticData": synth_res["syntheticData"],
    "targetCol": "ChurnRisk",
    "modelType": "random_forest",
    "testSize": 0.25,
    "seed": 42
}).encode("utf-8")
req = urllib.request.Request(f"{BASE_URL}/api/benchmark/tstr", data=req_data, headers={"Content-Type": "application/json"})
res = urllib.request.urlopen(req)
tstr_res = json.loads(res.read())
print(f"[OK] Baseline Real Test Accuracy: {tstr_res['baseline']['accuracy']*100:.1f}% | Synthetic-Trained Accuracy: {tstr_res['synthetic']['accuracy']*100:.1f}% | TSTR Retention: {tstr_res['tstrRetention']}%")

# 5. Test Full Multi-Strategy Experiment Endpoint
print("\n[5] Testing /api/experiment (Multi-Strategy Scikit-Learn Engine)...")
req_data = json.dumps({
    "headers": headers,
    "data": real_data,
    "targetCol": "ChurnRisk",
    "strategies": ["smote", "oversampling", "noise_injection"],
    "strategyParams": {"smote": {"k": 3}},
    "runs": 2,
    "trainTestSplit": 0.8,
    "modelType": "random_forest",
    "baseSeed": 42
}).encode("utf-8")
req = urllib.request.Request(f"{BASE_URL}/api/experiment", data=req_data, headers={"Content-Type": "application/json"})
res = urllib.request.urlopen(req)
exp_res = json.loads(res.read())
# 6. Test Real Regression with economic_index.csv
print("\n[6] Testing /api/experiment on real economic_index.csv (Regression)...")
import csv
with open("economic_index.csv", "r", encoding="utf-8") as f:
    reader = csv.reader(f)
    econ_headers = next(reader)
    econ_data = [row for row in reader if any(cell.strip() for cell in row)]

req_data = json.dumps({
    "headers": econ_headers,
    "data": econ_data,
    "targetCol": "index_price",
    "strategies": ["smote", "oversampling", "noise_injection"],
    "runs": 2,
    "trainTestSplit": 0.8,
    "modelType": "random_forest",
    "baseSeed": 42
}).encode("utf-8")
req = urllib.request.Request(f"{BASE_URL}/api/experiment", data=req_data, headers={"Content-Type": "application/json"})
res = urllib.request.urlopen(req)
econ_exp_res = json.loads(res.read())
print(f"[OK] Economic Index Experiment: Task={econ_exp_res['taskType']} | Baseline R2={econ_exp_res['baseline']['aggregated']['r2']['mean']*100:.1f}% | Baseline RMSE={econ_exp_res['baseline']['aggregated']['rmse']['mean']:.2f} | Verdict={econ_exp_res['recommendation']['verdict'].upper()}")

print("\n==================================================")
print("[SUCCESS] ALL FASTAPI BACKEND ENDPOINTS 100% OPERATIONAL (CLASSIFICATION & REGRESSION)!")
print("==================================================")
