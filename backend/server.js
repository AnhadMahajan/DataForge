/**
 * DataForge — Express.js & MongoDB MVC Server
 * Architectural Pattern: Model-View-Controller (MVC)
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { connectDB } from './config/db.js';
import { notFoundHandler, errorHandler } from './middlewares/errorMiddleware.js';

// Import Route Handlers
import healthRoutes from './routes/healthRoutes.js';
import synthesisRoutes from './routes/synthesisRoutes.js';
import evaluationRoutes from './routes/evaluationRoutes.js';
import authRoutes from './routes/authRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
import exportRoutes from './routes/exportRoutes.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Environment Variables (supports running from root or backend directory)
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

// Initialize Database Connection
connectDB();

const app = express();

// Ensure database connection in serverless / asynchronous contexts
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[DB Middleware Warning]', err.message);
  }
  next();
});

// Security & Parsing Middlewares
app.use(helmet());
app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Root Status
app.get(['/', '/api'], (req, res) => {
  res.status(200).json({
    name: 'DataForge API Engine',
    version: '2.0.0',
    documentation: '/api/health',
    status: 'active',
  });
});

// Import Direct Controllers for In-Browser / Legacy Client Aliases
import { runSynthesis } from './controllers/synthesisController.js';
import { runFidelityAudit, runTstrBenchmark } from './controllers/evaluationController.js';

// Mount MVC API Routes
app.use('/api/health', healthRoutes);
app.use('/api/synthesis', synthesisRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/export', exportRoutes);

// Compatibility Endpoints for Hybrid In-Browser / Legacy Client Calls
app.post('/api/synthesize', runSynthesis);
app.post('/api/audit', runFidelityAudit);
app.post('/api/benchmark/tstr', runTstrBenchmark);

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

let server = null;
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`[DataForge Server] Running on http://localhost:${PORT}`);
    console.log(`[DataForge Server] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[DataForge Server] Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });
}

export { app, server };
export default app;
