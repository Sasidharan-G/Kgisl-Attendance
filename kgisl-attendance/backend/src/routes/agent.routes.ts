import { Router } from 'express';
import { handleAgentChat } from '../controllers/agent.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/chat', requireAuth('ADMIN', 'FACULTY'), handleAgentChat);

export default router;
