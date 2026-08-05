import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listSubjectsHandler, listRoomsHandler, listBatchesHandler, createBatchHandler, updateBatchHandler, createSubjectHandler, updateSubjectHandler, createRoomHandler, updateRoomHandler, approveBatchArchiveHandler, retrieveBatchHandler } from '../controllers/catalog.controller';

const router = Router();

router.get('/subjects', requireAuth('ADMIN', 'FACULTY'), listSubjectsHandler);
router.get('/rooms', requireAuth('ADMIN', 'FACULTY'), listRoomsHandler);
router.get('/batches', requireAuth('ADMIN', 'FACULTY'), listBatchesHandler);
router.post('/batches', requireAuth('ADMIN'), createBatchHandler);
router.patch('/batches/:id', requireAuth('ADMIN'), updateBatchHandler);
router.post('/batches/:id/archive-approve', requireAuth('ADMIN'), approveBatchArchiveHandler);
router.post('/batches/:id/retrieve', requireAuth('ADMIN'), retrieveBatchHandler);
router.post('/subjects', requireAuth('ADMIN'), createSubjectHandler);
router.patch('/subjects/:id', requireAuth('ADMIN'), updateSubjectHandler);
router.post('/rooms', requireAuth('ADMIN'), createRoomHandler);
router.patch('/rooms/:id', requireAuth('ADMIN'), updateRoomHandler);

export default router;
