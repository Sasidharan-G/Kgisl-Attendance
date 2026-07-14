import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createStudentHandler, deleteStudentHandler, getMyAttendanceHandler, listStudentsHandler, setStudentStatusHandler } from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);
router.get('/me/attendance', requireAuth('STUDENT'), getMyAttendanceHandler);
router.post('/', requireAuth('ADMIN'), createStudentHandler);
router.delete('/:id', requireAuth('ADMIN'), deleteStudentHandler);
router.patch('/:id/status', requireAuth('ADMIN'), setStudentStatusHandler);

export default router;
