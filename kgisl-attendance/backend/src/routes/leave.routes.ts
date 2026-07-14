import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createLeaveRequestHandler, listLeaveRequestsHandler, reviewLeaveRequestHandler } from '../controllers/leave.controller';

const router = Router();
router.get('/', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), listLeaveRequestsHandler);
router.post('/', requireAuth('STUDENT'), createLeaveRequestHandler);
router.patch('/:id/review', requireAuth('ADMIN', 'FACULTY'), reviewLeaveRequestHandler);
export default router;
