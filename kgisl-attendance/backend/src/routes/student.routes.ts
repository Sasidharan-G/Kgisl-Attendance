import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { bulkCreateStudentsHandler, createStudentHandler, deleteStudentHandler, getMyAttendanceHandler, listStudentsHandler, resetStudentDeviceHandler, setStudentStatusHandler } from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);
router.get('/me/attendance', requireAuth('STUDENT'), getMyAttendanceHandler);
router.post('/', requireAuth('ADMIN'), createStudentHandler);
router.post('/bulk', requireAuth('ADMIN'), bulkCreateStudentsHandler);
router.delete('/:id', requireAuth('ADMIN'), deleteStudentHandler);
router.patch('/:id/status', requireAuth('ADMIN'), setStudentStatusHandler);
router.post('/:id/device-reset', requireAuth('ADMIN'), resetStudentDeviceHandler);

export default router;
