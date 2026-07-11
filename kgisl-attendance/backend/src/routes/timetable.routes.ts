import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createAllocationHandler, deleteAllocationHandler, listAllocationsHandler } from '../controllers/timetable.controller';

const router = Router();
router.get('/', requireAuth('ADMIN', 'FACULTY'), listAllocationsHandler);
router.post('/', requireAuth('ADMIN'), createAllocationHandler);
router.delete('/:id', requireAuth('ADMIN'), deleteAllocationHandler);
export default router;
