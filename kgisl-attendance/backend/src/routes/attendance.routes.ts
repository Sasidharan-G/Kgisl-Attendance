import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { scanAttendanceHandler } from '../controllers/attendance.controller';

const router = Router();

router.post('/scan', requireAuth('STUDENT'), scanAttendanceHandler);

export default router;
