import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { bulkCreateStudentsHandler, createStudentHandler, deleteStudentHandler, getMyAttendanceHandler, listStudentsHandler, resetStudentDeviceHandler, setStudentStatusHandler } from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);
router.get('/me/attendance', requireAuth('STUDENT'), getMyAttendanceHandler);
router.post('/', requireAuth('FACULTY'), createStudentHandler);
router.post('/bulk', requireAuth('FACULTY'), bulkCreateStudentsHandler);
router.delete('/:id', requireAuth('ADMIN', 'FACULTY'), deleteStudentHandler);
router.patch('/:id/status', requireAuth('ADMIN', 'FACULTY'), setStudentStatusHandler);
router.post('/:id/device-reset', requireAuth('ADMIN', 'FACULTY'), resetStudentDeviceHandler);

export default router;
