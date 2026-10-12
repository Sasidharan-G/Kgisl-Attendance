import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  startSessionHandler,
  startExtraSessionHandler,
  cancelSessionHandler,
  endSessionHandler,
  getActiveSessionHandler,
  correctAttendanceHandler,
  pauseSessionHandler,
  resumeSessionHandler,
} from '../controllers/session.controller';
import { issueBeaconPacketHandler, revokeBeaconPacketHandler } from '../controllers/beacon.controller';

const router = Router();

router.post('/', requireAuth('FACULTY'), startSessionHandler);
router.post('/extra', requireAuth('FACULTY'), startExtraSessionHandler);
router.get('/active/mine', requireAuth('FACULTY'), getActiveSessionHandler);
router.post('/:sessionId/end', requireAuth('FACULTY'), endSessionHandler);
router.post('/:sessionId/cancel', requireAuth('FACULTY'), cancelSessionHandler);
router.post('/:sessionId/pause', requireAuth('FACULTY'), pauseSessionHandler);
router.post('/:sessionId/resume', requireAuth('FACULTY'), resumeSessionHandler);
router.post('/:sessionId/beacon-packet', requireAuth('FACULTY'), issueBeaconPacketHandler);
router.delete('/:sessionId/beacon-packet', requireAuth('FACULTY'), revokeBeaconPacketHandler);
router.patch('/:sessionId/attendance', requireAuth('FACULTY'), correctAttendanceHandler);

export default router;
