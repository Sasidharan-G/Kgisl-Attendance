import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getSessionAttendanceHandler, listSessionHistoryHandler } from '../controllers/history.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listSessionHistoryHandler);
router.get('/:sessionId', requireAuth('ADMIN', 'FACULTY'), getSessionAttendanceHandler);

export default router;
