/**
 * DataForge — Vercel Serverless Function Entrypoint
 * Bridges requests arriving at /api/* directly to the Express.js MVC Application.
 */

import app from '../backend/server.js';

export default app;
