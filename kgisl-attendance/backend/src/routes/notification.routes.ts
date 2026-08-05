import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listNotificationsHandler, markAllNotificationsReadHandler, markNotificationReadHandler } from '../controllers/notification.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), listNotificationsHandler);
router.patch('/read-all', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), markAllNotificationsReadHandler);
router.patch('/:id/read', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), markNotificationReadHandler);

export default router;
