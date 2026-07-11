import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createStudentHandler, listStudentsHandler } from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);
router.post('/', requireAuth('ADMIN'), createStudentHandler);

export default router;
