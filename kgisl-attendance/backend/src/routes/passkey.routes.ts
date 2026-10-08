import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { passkeyStudentRateLimiter } from '../middleware/rateLimiter.middleware';
import {
  authOptionsHandler,
  passkeyStatusHandler,
  registerOptionsHandler,
  registerVerifyHandler,
} from '../controllers/passkey.controller';

const router = Router();

router.get('/status', requireAuth('STUDENT'), passkeyStatusHandler);
router.post('/register/options', requireAuth('STUDENT'), passkeyStudentRateLimiter, registerOptionsHandler);
router.post('/register/verify', requireAuth('STUDENT'), passkeyStudentRateLimiter, registerVerifyHandler);
router.post('/authenticate/options', requireAuth('STUDENT'), passkeyStudentRateLimiter, authOptionsHandler);

export default router;
