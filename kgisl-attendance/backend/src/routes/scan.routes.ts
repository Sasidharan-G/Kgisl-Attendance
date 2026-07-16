import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { scanIpRateLimiter, scanStudentRateLimiter } from '../middleware/rateLimiter.middleware';
import { acousticScanHandler, scanHandler } from '../controllers/scan.controller';

const router = Router();

router.post(
  '/acoustic',
  scanIpRateLimiter,
  requireAuth('STUDENT'),
  scanStudentRateLimiter,
  acousticScanHandler
);

router.post(
  '/',
  scanIpRateLimiter,
  requireAuth('STUDENT'),
  scanStudentRateLimiter,
  scanHandler
);

export default router;
