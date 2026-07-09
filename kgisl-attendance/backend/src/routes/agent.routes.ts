import { Router } from 'express';
import { handleAgentChat } from '../controllers/agent.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Only faculty should access the admin agent
router.post('/chat', requireAuth('FACULTY'), handleAgentChat);

export default router;
