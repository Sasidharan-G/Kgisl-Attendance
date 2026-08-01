import { Router } from 'express';
import {
  facultyLoginHandler,
  adminLoginHandler,
  studentLoginHandler,
  refreshHandler,
  logoutHandler,
  registerFacultyHandler,
  changePasswordHandler,
  createPasswordResetCodeHandler,
  confirmPasswordResetHandler,
  requestPasswordResetHandler,
  googleAuthConfigHandler,
  googleLoginHandler,
} from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/faculty/register', requireAuth('ADMIN'), authRateLimiter, registerFacultyHandler);
router.post('/faculty/login', authRateLimiter, facultyLoginHandler);
router.post('/admin/login', authRateLimiter, adminLoginHandler);
router.post('/student/login', authRateLimiter, studentLoginHandler);
router.get('/google/config', googleAuthConfigHandler);
router.post('/google', authRateLimiter, googleLoginHandler);
router.post('/refresh', authRateLimiter, refreshHandler);
router.post('/logout', logoutHandler);
router.post('/change-password', requireAuth('ADMIN', 'FACULTY', 'STUDENT'), authRateLimiter, changePasswordHandler);
router.post('/password-reset/code', requireAuth('ADMIN'), authRateLimiter, createPasswordResetCodeHandler);
router.post('/password-reset/request', authRateLimiter, requestPasswordResetHandler);
router.post('/password-reset/confirm', authRateLimiter, confirmPasswordResetHandler);

export default router;
