import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  bulkCreateBlockTestsHandler,
  bulkCreateEventsHandler,
  createBlockTestHandler,
  createEventHandler,
  deleteBlockTestHandler,
  deleteEventHandler,
  listBlockTestsHandler,
  listEventsHandler,
} from '../controllers/calendar.controller';

const router = Router();

// Everyone signed in can read the academic calendar; only administrators change it.
router.get('/events', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), listEventsHandler);
router.post('/events', requireAuth('ADMIN'), createEventHandler);
router.post('/events/bulk', requireAuth('ADMIN'), bulkCreateEventsHandler);
router.delete('/events/:id', requireAuth('ADMIN'), deleteEventHandler);

router.get('/block-tests', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), listBlockTestsHandler);
router.post('/block-tests', requireAuth('ADMIN'), createBlockTestHandler);
router.post('/block-tests/bulk', requireAuth('ADMIN'), bulkCreateBlockTestsHandler);
router.delete('/block-tests/:id', requireAuth('ADMIN'), deleteBlockTestHandler);

export default router;
