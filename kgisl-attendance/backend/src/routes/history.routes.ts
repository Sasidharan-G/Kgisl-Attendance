import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { analyticsSummaryHandler, getSessionAttendanceHandler, listAuditLogsHandler, listSessionHistoryHandler } from '../controllers/history.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listSessionHistoryHandler);
router.get('/summary', requireAuth('ADMIN', 'FACULTY'), analyticsSummaryHandler);
router.get('/audit', requireAuth('ADMIN', 'FACULTY'), listAuditLogsHandler);
router.get('/:sessionId', requireAuth('ADMIN', 'FACULTY'), getSessionAttendanceHandler);

export default router;
