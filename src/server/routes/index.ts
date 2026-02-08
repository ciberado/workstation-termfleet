import { Router } from 'express';
import healthRouter from './health.js';
import workstationsRouter from './workstations.js';

const router = Router();

// Mount routes
router.use('/', healthRouter);
router.use('/workstations', workstationsRouter);

export default router;
