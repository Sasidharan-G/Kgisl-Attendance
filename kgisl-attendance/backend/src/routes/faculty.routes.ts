import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listFacultyHandler, createFacultyHandler } from '../controllers/faculty.controller';

const router = Router();

router.get('/', requireAuth('ADMIN'), listFacultyHandler);
router.post('/', requireAuth('ADMIN'), createFacultyHandler);

export default router;
