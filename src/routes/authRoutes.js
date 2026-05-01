import express from 'express';
import { register, login, getMe , forgotPassword, verifyOTP, resetPassword} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.put('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.post('/test-resend', async (req, res) => {
  const { sendEmail } = await import('../utils/emailService.js');
  const result = await sendEmail({
    to: req.body.email || process.env.RESEND_FROM_EMAIL,
    subject: 'Resend Test Email',
    html: '<h1>✅ Resend is Working!</h1><p>Your email configuration is correct.</p>'
  });
  res.json(result);
});

export default router;