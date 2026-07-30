import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createCorrectionHandler, listCorrectionsHandler, reviewCorrectionHandler } from '../controllers/correction.controller';
const router = Router();
router.get('/', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), listCorrectionsHandler);
router.post('/', requireAuth('STUDENT'), createCorrectionHandler);
router.patch('/:id/review', requireAuth('ADMIN', 'FACULTY'), reviewCorrectionHandler);
export default router;
