import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  startSessionHandler,
  endSessionHandler,
  getSessionStatsHandler,
  getSessionPublicInfoHandler,
  manualAttendanceHandler,
} from '../controllers/session.controller';

const router = Router();

router.post('/', requireAuth('FACULTY'), startSessionHandler);
router.post('/:sessionId/end', requireAuth('FACULTY'), endSessionHandler);
router.post('/:sessionId/manual-attendance', requireAuth('FACULTY'), manualAttendanceHandler);
router.get('/:sessionId/stats', requireAuth('FACULTY', 'STUDENT'), getSessionStatsHandler);
router.get('/:sessionId/public', requireAuth('STUDENT'), getSessionPublicInfoHandler);

export default router;
