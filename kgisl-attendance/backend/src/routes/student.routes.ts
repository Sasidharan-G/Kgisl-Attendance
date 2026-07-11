import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listStudentsHandler } from '../controllers/student.controller';

const router = Router();

router.get('/', requireAuth('ADMIN', 'FACULTY'), listStudentsHandler);

export default router;
