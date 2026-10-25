/**
 * DataForge — Authentication Routes
 * Architecture: MVC Route Layer (Assigned to: Person 2 / Auth & Security)
 */

import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  updatePassword,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes (JWT Bearer Token required)
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

export default router;
