import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  listStudentsHandler,
  getMyAttendanceHandler,
  createStudentHandler,
  bulkCreateStudentsHandler,
  setStudentStatusHandler,
  resetStudentDeviceHandler,
} from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);
router.get('/me/attendance', requireAuth('STUDENT'), getMyAttendanceHandler);
router.post('/', requireAuth('ADMIN', 'FACULTY'), createStudentHandler);
router.post('/bulk', requireAuth('ADMIN', 'FACULTY'), bulkCreateStudentsHandler);
router.patch('/:id/status', requireAuth('ADMIN', 'FACULTY'), setStudentStatusHandler);
router.post('/:id/device-reset', requireAuth('ADMIN', 'FACULTY'), resetStudentDeviceHandler);

export default router;
