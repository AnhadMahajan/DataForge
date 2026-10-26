# DataForge — Express.js & MongoDB MVC Backend (v2.0)

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21+-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Alpine%2020-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Render](https://img.shields.io/badge/Render-Cloud%20Blueprint-46E3B7?style=flat&logo=render&logoColor=black)](https://render.com/)

> **High-performance Model-View-Controller (MVC) REST API Engine powering tabular generative synthesis, statistical fidelity audits, downstream TSTR benchmarks, and multi-format data export.**

---

## 🏛️ System Architecture

DataForge Backend implements a decoupled **Model-View-Controller (MVC)** architectural pattern built with modern ES Modules:

```
backend/
├── config/
│   └── db.js                 # Resilient MongoDB connection manager with auto-reconnect
├── controllers/
│   ├── authController.js       # User registration, login, and JWT token issuance
│   ├── datasetController.js    # Ingestion, multipart parsing & column profiling
│   ├── evaluationController.js # KS-test, Wasserstein, DCR & TSTR benchmarks
│   ├── exportController.js     # RFC-4180 CSV, JSON, and Relational SQL DDL/DML exports
│   └── synthesisController.js  # Gaussian Copula & tabular synthesis orchestration
├── docs/
│   ├── DataForge_API_Collection.json     # Thunder Client suite with sample bodies
│   └── DataForge_Postman_Collection.json # Postman v2.1.0 collection with env variables
├── middlewares/
│   ├── authMiddleware.js     # JWT Bearer verification and RBAC enforcement
│   ├── errorMiddleware.js    # Centralized error handler (CastError, ValidationError, JWT)
│   └── uploadMiddleware.js   # Multer file upload filter for CSV/JSON
├── models/
│   ├── AuditLog.js           # Compliance audit logging (IP, User-Agent, action, user)
│   ├── Dataset.js            # Dataset metadata, column profiles & data matrices
│   ├── EvaluationReport.js   # Audit metrics & TSTR benchmark results
│   ├── SynthesisJob.js       # Synthesis jobs, parameters, seed & previews
│   └── User.js               # User accounts with bcrypt hashing & RBAC roles
├── routes/
│   ├── authRoutes.js         # /api/auth endpoints
│   ├── datasetRoutes.js      # /api/datasets endpoints
│   ├── evaluationRoutes.js   # /api/evaluation endpoints
│   ├── exportRoutes.js       # /api/export endpoints
│   ├── healthRoutes.js       # /api/health telemetry with live Mongo ping
│   └── synthesisRoutes.js    # /api/synthesis endpoints
├── Dockerfile                # Production-hardened Node.js 20 Alpine image
├── render.yaml               # Render Cloud Web Service free-tier blueprint
├── server.js                 # Express server bootstrap & middleware pipeline
└── test-backend.js           # Integration test suite for all endpoints
```

### Module Responsibilities
- **Person 1 (Lead Architect)**: Mathematical Synthesis Engine & Empirical TSTR Benchmarking (`synthesisController.js`, `evaluationController.js`, `synthesisEngine.js`).
- **Person 2 (Auth & Security)**: JWT Authentication & Role-Based Access Control (`User.js`, `authController.js`, `authMiddleware.js`).
- **Person 3 (Ingestion & Profiling)**: Tabular Upload & Statistical Profiler (`Dataset.js`, `datasetController.js`, `profilingService.js`).
- **Person 4 (Export, Telemetry & DevOps)**: Multi-Format Export Engine, Compliance Audit Logging, Live Telemetry, Docker, Render Blueprint & Postman Suite (`AuditLog.js`, `exportController.js`, `exportRoutes.js`, `healthRoutes.js`, `Dockerfile`, `render.yaml`, Postman/Thunder collections).

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) or free MongoDB Atlas URI

### 2. Environment Configuration
Create a `.env` file inside the `backend/` directory (or copy `.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/dataforge
JWT_SECRET=dataforge_super_secure_jwt_secret_key_2026_production
CLIENT_URL=http://localhost:3005
```

### 3. Installation & Local Development
```bash
# Navigate to backend directory
cd backend

# Install production and development dependencies
npm install

# Start in development mode with automatic hot reload
npm run dev

# Or start in standard production mode
npm start
```
The server will boot on `http://localhost:5000`.

---

## 🧪 Automated Testing

Run the automated backend integration test suite:
```bash
npm test
```
The test suite boots an in-memory server, validates connection health, runs a Gaussian Copula synthesis batch, executes fidelity audits & TSTR benchmarks, and verifies CSV, JSON, and SQL export generation.

---

## 📡 API Reference & Specifications

### 1. Telemetry & Health Monitoring
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | Root engine info, version, and active status |
| `GET` | `/api/health` | Public | Live telemetry, real-time MongoDB ping latency, RSS/heap memory, uptime, and endpoint catalog |

#### Sample Healthcheck Response:
```json
{
  "status": "online",
  "service": "DataForge Express & MongoDB Engine",
  "version": "2.0.0",
  "timestamp": "2026-10-26T12:40:00.000Z",
  "database": {
    "status": "connected",
    "readyState": "connected",
    "ping": "pong",
    "latencyMs": 2,
    "host": "localhost",
    "name": "dataforge"
  },
  "system": {
    "uptimeSeconds": 142,
    "uptimeFormatted": "2m 22s",
    "memory": {
      "rssMb": 64,
      "heapTotalMb": 38,
      "heapUsedMb": 24
    }
  }
}
```

---

### 2. Authentication & RBAC
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new researcher account (`name`, `email`, `password`, `role`) |
| `POST` | `/api/auth/login` | Public | Authenticate and obtain JWT Bearer token |
| `GET` | `/api/auth/me` | Bearer Auth | Retrieve logged-in researcher profile |

---

### 3. Dataset Ingestion & Profiling
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/datasets/upload` | Public/Auth | Multipart CSV/JSON upload with automated statistical profiling |
| `GET` | `/api/datasets` | Public/Auth | Paginated dataset list with metadata and column distributions |
| `GET` | `/api/datasets/:id` | Public/Auth | Dataset details, column summaries, and sample preview slice |
| `DELETE` | `/api/datasets/:id` | Public/Auth | Remove dataset and associated records |

---

### 4. Mathematical Synthesis Core
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/synthesis/run` | Public/Auth | Run Gaussian Copula, KDE, or SMOTE tabular synthesis |
| `GET` | `/api/synthesis/jobs` | Public/Auth | Paginated list of past synthesis runs |
| `GET` | `/api/synthesis/jobs/:id` | Public/Auth | Detailed job metrics and synthesized tabular matrix |
| `DELETE` | `/api/synthesis/jobs/:id` | Public/Auth | Remove synthesis job from history |

---

### 5. Statistical Fidelity & TSTR Benchmark
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/evaluation/audit` | Public/Auth | Compute Kolmogorov-Smirnov test, 1-Wasserstein distance, and DCR privacy score |
| `POST` | `/api/evaluation/tstr` | Public/Auth | Run Train-on-Synthetic, Test-on-Real (TSTR) ML empirical proof |
| `GET` | `/api/evaluation/reports` | Public/Auth | Retrieve historical fidelity & TSTR benchmark audit reports |

---

### 6. Dataset Export Engine (Person 4)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/export` | Public | Export format specifications and engine capabilities |
| `POST` | `/api/export/csv` | Public/Auth | Download RFC-4180 compliant CSV with strict escaping & CRLF line breaks |
| `POST` | `/api/export/json` | Public/Auth | Download structured JSON with metadata header or flat record array |
| `POST` | `/api/export/sql` | Public/Auth | Generate relational SQL schema inference (`CREATE TABLE`) and batch `INSERT INTO` DML |

#### Export Request Payload Sample:
```json
{
  "filename": "synthetic_credit_dataset.csv",
  "headers": ["applicant_id", "annual_income", "credit_score", "loan_approved"],
  "data": [
    [101, 75000, 720, "1"],
    [102, 42000, 580, "0"],
    [103, 98000, 790, "1"]
  ]
}
```

#### SQL Export Request Options:
```json
{
  "tableName": "synthetic_credit_data",
  "batchSize": 100,
  "includeDropTable": true,
  "headers": ["applicant_id", "annual_income", "credit_score", "loan_approved"],
  "data": [
    [101, 75000.50, 720, true],
    [102, 42000.00, 580, false]
  ]
}
```

---

## 🔒 Audit Logging & System Compliance

The backend automatically records all critical operations into MongoDB via the `AuditLog` schema (`backend/models/AuditLog.js`):
- **User Reference**: Tracks user identity (`req.user._id`) or anonymous sessions.
- **Action Types**: `DATASET_UPLOAD`, `SYNTHESIS_RUN`, `EVALUATION_AUDIT`, `TSTR_BENCHMARK`, `EXPORT_CSV`, `EXPORT_JSON`, `EXPORT_SQL`, `USER_REGISTER`, `USER_LOGIN`.
- **IP Address & User-Agent**: Captures client remote IP (including `x-forwarded-for` proxies) and client browser/tool agent.
- **Timestamp & Details**: ISO timestamp with indexing for rapid compliance filtering.

---

## 📬 Postman & Thunder Client Testing Guide

The complete evaluation test suite is located in `backend/docs/`:
1. `DataForge_API_Collection.json`: Thunder Client export (import directly in VS Code Thunder Client).
2. `DataForge_Postman_Collection.json`: Postman v2.1.0 collection (import directly in Postman).

### Steps to Test with Postman:
1. Open **Postman** $\to$ Click **Import** $\to$ Select `backend/docs/DataForge_Postman_Collection.json`.
2. Ensure the collection variable `BASE_URL` is set to `http://localhost:5000`.
3. Execute the requests in sequence:
   - **1. Health & Telemetry**: Confirm status is `online` and MongoDB ping is `pong`.
   - **2. Authentication**: Run `User Registration` followed by `User Login`. Copy the returned `token` into the `AUTH_TOKEN` collection variable.
   - **4. Synthesis Core**: Trigger `Run Gaussian Copula Synthesis`. Note the returned `syntheticData`.
   - **5. Fidelity & TSTR**: Run `Fidelity & Privacy Audit` and `TSTR ML Benchmark`.
   - **6. Export Engine**: Execute `Export to CSV`, `Export to JSON`, and `Export to SQL` to test file downloads and schemas.

---

## 🐳 Docker Deployment

A lightweight, production-hardened container based on **Node.js 20 on Alpine Linux** is included:

```bash
# Build the Docker container image
docker build -t dataforge-backend ./backend

# Run the container with port mapping and environment variables
docker run -d \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGO_URI="mongodb+srv://<user>:<pass>@cluster.mongodb.net/dataforge" \
  -e JWT_SECRET="your_production_secret" \
  --name dataforge-api \
  dataforge-backend

# Check container health and logs
docker logs -f dataforge-api
```

---

## ☁️ Cloud Deployment on Render

Deploy the backend to Render's free tier using the included blueprint:
1. Push your repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com/) $\to$ Click **New** $\to$ **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml`.
4. Fill in the required environment variable:
   - `MONGO_URI`: Your MongoDB Atlas connection string.
5. Click **Apply Blueprint**. Render builds and serves the service with health checks mapped to `/api/health`.
