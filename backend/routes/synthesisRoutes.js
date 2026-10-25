/**
 * DataForge — Synthesis Routes
 * Architecture: MVC Route Layer (Assigned to: Person 1 / Lead Architect)
 */

import express from 'express';
import {
  runSynthesis,
  getSynthesisJobs,
  getSynthesisJobById,
  deleteSynthesisJob,
} from '../controllers/synthesisController.js';

const router = express.Router();

router.route('/run').post(runSynthesis);
router.route('/jobs').get(getSynthesisJobs);
router.route('/jobs/:id').get(getSynthesisJobById).delete(deleteSynthesisJob);

export default router;
