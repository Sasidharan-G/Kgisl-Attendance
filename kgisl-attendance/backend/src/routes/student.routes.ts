import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createStudentHandler, deleteStudentHandler, listStudentsHandler } from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);
router.post('/', requireAuth('ADMIN'), createStudentHandler);
router.delete('/:id', requireAuth('ADMIN'), deleteStudentHandler);

export default router;
