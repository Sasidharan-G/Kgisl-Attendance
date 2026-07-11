import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listFacultyHandler, createFacultyHandler, deleteFacultyHandler } from '../controllers/faculty.controller';

const router = Router();

router.get('/', requireAuth('ADMIN'), listFacultyHandler);
router.post('/', requireAuth('ADMIN'), createFacultyHandler);
router.delete('/:id', requireAuth('ADMIN'), deleteFacultyHandler);

export default router;
