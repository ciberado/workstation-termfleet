import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
