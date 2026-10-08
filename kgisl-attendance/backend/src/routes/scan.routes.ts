import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { scanIpRateLimiter, scanStudentRateLimiter } from '../middleware/rateLimiter.middleware';
import { beaconScanHandler, scanHandler } from '../controllers/scan.controller';

const router = Router();

router.post(
  '/beacon',
  scanIpRateLimiter,
  requireAuth('STUDENT'),
  scanStudentRateLimiter,
  beaconScanHandler
);

router.post(
  '/',
  scanIpRateLimiter,
  requireAuth('STUDENT'),
  scanStudentRateLimiter,
  scanHandler
);

export default router;
