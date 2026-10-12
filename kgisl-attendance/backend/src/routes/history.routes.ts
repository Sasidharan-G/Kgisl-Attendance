import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  listSessionHistoryHandler,
  getSessionAttendanceHandler,
  analyticsSummaryHandler,
  attendanceReportHandler,
  listAuditLogsHandler,
} from '../controllers/history.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listSessionHistoryHandler);
router.get('/summary', requireAuth('ADMIN', 'FACULTY'), analyticsSummaryHandler);
router.get('/report', requireAuth('ADMIN', 'FACULTY'), attendanceReportHandler);
router.get('/audit', requireAuth('ADMIN'), listAuditLogsHandler);
router.get('/:sessionId', requireAuth('ADMIN', 'FACULTY'), getSessionAttendanceHandler);

export default router;
