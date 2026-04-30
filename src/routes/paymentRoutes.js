import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createCODOrder,
  initiateEasyPaisaPayment,
  easyPaisaCallback,
  initiateJazzCashPayment,
  createStripePaymentIntent,
  confirmStripePayment,
  getPaymentStatus
} from '../controllers/paymentController.js';

const router = express.Router();

// COD
router.post('/cod', protect, createCODOrder);

// EasyPaisa
router.post('/easypaisa', protect, initiateEasyPaisaPayment);
router.post('/easypaisa-callback', easyPaisaCallback);

// JazzCash
router.post('/jazzcash', protect, initiateJazzCashPayment);

// Stripe
router.post('/stripe/create-intent', protect, createStripePaymentIntent);
router.post('/stripe/confirm', protect, confirmStripePayment);

// Status check
router.get('/status/:orderId', protect, getPaymentStatus);

export default router;