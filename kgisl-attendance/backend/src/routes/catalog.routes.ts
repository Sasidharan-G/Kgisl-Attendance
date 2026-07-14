import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listSubjectsHandler, listRoomsHandler, listBatchesHandler, createBatchHandler, updateBatchHandler } from '../controllers/catalog.controller';

const router = Router();

router.get('/subjects', requireAuth('ADMIN', 'FACULTY'), listSubjectsHandler);
router.get('/rooms', requireAuth('ADMIN', 'FACULTY'), listRoomsHandler);
router.get('/batches', requireAuth('ADMIN', 'FACULTY'), listBatchesHandler);
router.post('/batches', requireAuth('ADMIN'), createBatchHandler);
router.patch('/batches/:id', requireAuth('ADMIN'), updateBatchHandler);

export default router;
