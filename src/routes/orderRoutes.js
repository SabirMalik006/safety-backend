import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
  createOrder,
  verifyPayment,
  rejectPayment,
  getPendingVerificationOrders,
  getPaymentProofDetails,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  uploadPaymentProof
} from '../controllers/orderController.js';
import { upload } from '../config/cloudinary.js';
import { downloadInvoice } from '../utils/invoiceGenerator.js';

const router = express.Router();

// User routes
router.post('/', protect, createOrder);
router.post('/upload-proof', protect, upload.single('screenshot'), uploadPaymentProof);
router.get('/my-orders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);

// Admin routes
router.get('/', protect, admin, getAllOrders);
router.get('/pending-verification', protect, admin, getPendingVerificationOrders);
router.get('/:id/payment-proof', protect, admin, getPaymentProofDetails);
router.get('/:id/download-invoice', protect, admin, downloadInvoice);
router.put('/:id/verify-payment', protect, admin, verifyPayment);
router.put('/:id/reject-payment', protect, admin, rejectPayment);
router.put('/:id/status', protect, admin, updateOrderStatus);

export default router;