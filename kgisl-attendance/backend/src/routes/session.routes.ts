import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  startSessionHandler,
  endSessionHandler,
  getSessionStatsHandler,
  getSessionPublicInfoHandler,
  manualAttendanceHandler,
  getActiveSessionHandler,
  correctAttendanceHandler,
} from '../controllers/session.controller';

const router = Router();

router.post('/', requireAuth('FACULTY'), startSessionHandler);
router.get('/active/mine', requireAuth('FACULTY'), getActiveSessionHandler);
router.post('/:sessionId/end', requireAuth('FACULTY'), endSessionHandler);
router.post('/:sessionId/manual-attendance', requireAuth('FACULTY'), manualAttendanceHandler);
router.patch('/:sessionId/attendance', requireAuth('FACULTY'), correctAttendanceHandler);
router.get('/:sessionId/stats', requireAuth('FACULTY', 'STUDENT'), getSessionStatsHandler);
router.get('/:sessionId/public', requireAuth('STUDENT'), getSessionPublicInfoHandler);

export default router;
