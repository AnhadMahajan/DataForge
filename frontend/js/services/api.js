/**
 * DataForge — Frontend API Client for Express.js MVC Backend
 * Seamlessly interfaces frontend pages with the deployed/local Express REST API.
 */

import { getBackendUrl } from './pipeline.js';

/**
 * Retrieve auth headers (including Bearer JWT if logged in).
 */
function getHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('dataforge_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

/**
 * Core HTTP Request Wrapper
 */
async function request(endpoint, options = {}) {
  const baseUrl = getBackendUrl() || 'http://localhost:5000';
  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers),
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('application/sql')) {
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Request failed with status ${res.status}`);
    return text;
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || json.detail || `Request failed with status ${res.status}`);
  }
  return json;
}

export const api = {
  // ---- Health & Telemetry ----
  async getHealth() {
    return request('/api/health', { method: 'GET' });
  },

  // ---- Authentication ----
  async register(name, email, password, role = 'user') {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role }),
    });
    if (res.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('dataforge_token', res.token);
    }
    return res;
  },

  async login(email, password) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('dataforge_token', res.token);
    }
    return res;
  },

  async getMe() {
    return request('/api/auth/me', { method: 'GET' });
  },

  // ---- Generative Synthesis ----
  async runSynthesis({ name = 'Synthetic Generation', headers, data, algorithm = 'copula', rowCount = 100, seed = 42 }) {
    return request('/api/synthesis/run', {
      method: 'POST',
      body: JSON.stringify({ name, headers, data, algorithm, rowCount, seed }),
    });
  },

  async getSynthesisJobs() {
    return request('/api/synthesis/jobs', { method: 'GET' });
  },

  // ---- Statistical Fidelity & TSTR Benchmark ----
  async runFidelityAudit({ headers, realData, syntheticData }) {
    return request('/api/evaluation/audit', {
      method: 'POST',
      body: JSON.stringify({ headers, realData, syntheticData }),
    });
  },

  async runTstrBenchmark({
    title = 'TSTR Evaluation',
    headers,
    realData,
    syntheticData,
    targetCol,
    modelType = 'random_forest',
    testSize = 0.25,
    seed = 42,
  }) {
    return request('/api/evaluation/tstr', {
      method: 'POST',
      body: JSON.stringify({ title, headers, realData, syntheticData, targetCol, modelType, testSize, seed }),
    });
  },

  async getEvaluationReports() {
    return request('/api/evaluation/reports', { method: 'GET' });
  },

  // ---- Dataset Ingestion & Profiling ----
  async uploadDataset(file, name, description = '', targetColumn = '') {
    const baseUrl = getBackendUrl() || 'http://localhost:5000';
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (description) formData.append('description', description);
    if (targetColumn) formData.append('targetColumn', targetColumn);

    const headers = {};
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('dataforge_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/datasets/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Upload failed with status ${res.status}`);
    return json;
  },

  async getDatasets(page = 1, limit = 20) {
    return request(`/api/datasets?page=${page}&limit=${limit}`, { method: 'GET' });
  },

  async getDatasetById(id) {
    return request(`/api/datasets/${id}`, { method: 'GET' });
  },

  async deleteDataset(id) {
    return request(`/api/datasets/${id}`, { method: 'DELETE' });
  },

  // ---- Multi-Format Export Engine ----
  async exportCsv(filename, headers, data) {
    return request('/api/export/csv', {
      method: 'POST',
      body: JSON.stringify({ filename, headers, data }),
    });
  },

  async exportJson(filename, headers, data, structure = 'structured') {
    return request('/api/export/json', {
      method: 'POST',
      body: JSON.stringify({ filename, headers, data, structure }),
    });
  },

  async exportSql(tableName, headers, data, options = {}) {
    return request('/api/export/sql', {
      method: 'POST',
      body: JSON.stringify({ tableName, headers, data, ...options }),
    });
  },
};

export default api;
