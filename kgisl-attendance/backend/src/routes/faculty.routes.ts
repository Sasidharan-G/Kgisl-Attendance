import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listFacultyHandler, createFacultyHandler, setFacultyStatusHandler } from '../controllers/faculty.controller';

const router = Router();

router.get('/', requireAuth('ADMIN'), listFacultyHandler);
router.post('/', requireAuth('ADMIN'), createFacultyHandler);
router.patch('/:id/status', requireAuth('ADMIN'), setFacultyStatusHandler);

export default router;
