/**
 * DataForge — System Health & Telemetry Routes
 * Architecture: MVC Route Layer (Assigned to: Person 4 / DevOps & Telemetry)
 */

import express from 'express';
import mongoose from 'mongoose';
import os from 'os';

const router = express.Router();

/**
 * Format uptime in seconds into a human-readable duration string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * State map for Mongoose readyState
 */
const MONGO_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * @route   GET /api/health
 * @desc    Get live server telemetry, live MongoDB ping status, memory footprint & endpoint catalog
 * @access  Public
 */
router.get('/', async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  let mongoPingStatus = 'offline';
  let mongoPingLatencyMs = null;

  // Execute live MongoDB admin ping if connected
  if (isDbConnected && mongoose.connection.db) {
    try {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      mongoPingLatencyMs = Date.now() - pingStart;
      mongoPingStatus = 'pong';
    } catch (pingErr) {
      mongoPingStatus = `ping_error: ${pingErr.message}`;
    }
  }

  const uptimeSec = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  const telemetry = {
    status: 'online',
    service: 'DataForge Express & MongoDB Engine',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: isDbConnected ? 'connected' : 'disconnected / standby',
      readyState: MONGO_STATES[mongoose.connection.readyState] || 'unknown',
      readyStateCode: mongoose.connection.readyState,
      ping: mongoPingStatus,
      latencyMs: mongoPingLatencyMs,
      host: isDbConnected ? mongoose.connection.host : 'local-standby',
      port: isDbConnected ? mongoose.connection.port : 27017,
      name: isDbConnected ? mongoose.connection.name : 'dataforge',
    },
    system: {
      uptimeSeconds: uptimeSec,
      uptimeFormatted: formatUptime(uptimeSec),
      serverStartedAt: new Date(Date.now() - uptimeSec * 1000).toISOString(),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        externalMb: Math.round(mem.external / 1024 / 1024),
        arrayBuffersMb: Math.round((mem.arrayBuffers || 0) / 1024 / 1024),
      },
      host: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        processId: process.pid,
        cpuCount: os.cpus().length,
        freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
        totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
      },
    },
    endpoints: [
      { path: '/api/health', method: 'GET', module: 'Telemetry & Health' },
      { path: '/api/auth/register', method: 'POST', module: 'Authentication & Security' },
      { path: '/api/auth/login', method: 'POST', module: 'Authentication & Security' },
      { path: '/api/auth/me', method: 'GET', module: 'Authentication & Security' },
      { path: '/api/datasets/upload', method: 'POST', module: 'Dataset Ingestion & Profiling' },
      { path: '/api/datasets', method: 'GET', module: 'Dataset Ingestion & Profiling' },
      { path: '/api/datasets/:id', method: 'GET', module: 'Dataset Ingestion & Profiling' },
      { path: '/api/datasets/:id', method: 'DELETE', module: 'Dataset Ingestion & Profiling' },
      { path: '/api/synthesis/run', method: 'POST', module: 'Mathematical Synthesis Engine' },
      { path: '/api/synthesis/jobs', method: 'GET', module: 'Mathematical Synthesis Engine' },
      { path: '/api/synthesis/jobs/:id', method: 'GET', module: 'Mathematical Synthesis Engine' },
      { path: '/api/synthesis/jobs/:id', method: 'DELETE', module: 'Mathematical Synthesis Engine' },
      { path: '/api/evaluation/audit', method: 'POST', module: 'Fidelity & Privacy Auditing' },
      { path: '/api/evaluation/tstr', method: 'POST', module: 'TSTR Machine Learning Benchmark' },
      { path: '/api/evaluation/reports', method: 'GET', module: 'Fidelity & Privacy Auditing' },
      { path: '/api/evaluation/reports/:id', method: 'GET', module: 'Fidelity & Privacy Auditing' },
      { path: '/api/export', method: 'GET', module: 'Dataset Multi-Format Export Engine' },
      { path: '/api/export/csv', method: 'POST', module: 'Dataset Multi-Format Export Engine' },
      { path: '/api/export/json', method: 'POST', module: 'Dataset Multi-Format Export Engine' },
      { path: '/api/export/sql', method: 'POST', module: 'Dataset Multi-Format Export Engine' },
    ],
  };

  res.status(200).json(telemetry);
});

export default router;
