import { Router } from 'express';
import { handleAgentChat } from '../controllers/agent.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { agentRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.post('/chat', requireAuth('ADMIN', 'FACULTY'), agentRateLimiter, handleAgentChat);

export default router;
