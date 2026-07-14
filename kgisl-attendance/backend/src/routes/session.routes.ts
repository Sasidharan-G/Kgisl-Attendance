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
  pauseSessionHandler,
  resumeSessionHandler,
  startExtraSessionHandler,
} from '../controllers/session.controller';

const router = Router();

router.post('/', requireAuth('FACULTY'), startSessionHandler);
router.post('/extra', requireAuth('FACULTY'), startExtraSessionHandler);
router.get('/active/mine', requireAuth('FACULTY'), getActiveSessionHandler);
router.post('/:sessionId/end', requireAuth('FACULTY'), endSessionHandler);
router.post('/:sessionId/pause', requireAuth('FACULTY'), pauseSessionHandler);
router.post('/:sessionId/resume', requireAuth('FACULTY'), resumeSessionHandler);
router.post('/:sessionId/manual-attendance', requireAuth('FACULTY'), manualAttendanceHandler);
router.patch('/:sessionId/attendance', requireAuth('FACULTY'), correctAttendanceHandler);
router.get('/:sessionId/stats', requireAuth('FACULTY', 'STUDENT'), getSessionStatsHandler);
router.get('/:sessionId/public', requireAuth('STUDENT'), getSessionPublicInfoHandler);

export default router;
