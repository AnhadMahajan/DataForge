/**
 * DataForge — System Health & Telemetry Routes
 * Architecture: MVC Route Layer (Assigned to: Person 4 / DevOps & Telemetry)
 */

import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  res.status(200).json({
    status: 'online',
    service: 'DataForge Express & MongoDB Engine',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    database: {
      status: isDbConnected ? 'connected' : 'disconnected / standby',
      host: isDbConnected ? mongoose.connection.host : 'local-standby',
      name: isDbConnected ? mongoose.connection.name : 'dataforge',
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
    },
    endpoints: [
      '/api/health',
      '/api/synthesis/run',
      '/api/synthesis/jobs',
      '/api/evaluation/audit',
      '/api/evaluation/tstr',
      '/api/evaluation/reports',
      '/api/auth/register',
      '/api/auth/login',
      '/api/datasets/upload',
      '/api/export/csv',
    ],
  });
});

export default router;
