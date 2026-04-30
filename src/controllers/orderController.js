import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { sendOrderStatusUpdate, sendPaymentVerificationEmail } from '../utils/emailService.js';

// ============================================
// PLACE ORDER WITH PAYMENT PROOF
// ============================================
export const createOrderWithPaymentProof = async (req, res) => {
  try {
    const { 
      orderItems, shippingAddress, paymentMethod, 
      itemsPrice, shippingPrice, totalPrice,
      paymentProof 
    } = req.body;

    // Check stock
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${item.name}` 
        });
      }
    }

    // Create order
    const order = await Order.create({
      user: req.user.id,
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      totalPrice,
      orderStatus: 'pending',
      paymentStatus: 'pending_verification',  // ✅ Wait for admin verification
      paymentProof: {
        screenshotUrl: paymentProof.screenshotUrl,
        transactionId: paymentProof.transactionId,
        paymentDate: paymentProof.paymentDate || Date.now(),
        paymentAccount: paymentProof.paymentAccount,
        remarks: paymentProof.remarks
      }
    });

    // Reduce stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    res.status(201).json({ 
      success: true, 
      data: order,
      message: 'Order placed! Payment verification pending.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ADMIN: VERIFY PAYMENT (APPROVE)
// ============================================
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, adminNotes } = req.body;
    
    const order = await Order.findById(orderId).populate('user');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order
    order.paymentStatus = 'verified';
    order.isPaid = true;
    order.paidAt = Date.now();
    order.orderStatus = 'processing';
    order.paymentVerification = {
      verifiedBy: req.user.id,
      verifiedAt: Date.now(),
      adminNotes: adminNotes
    };
    
    await order.save();

    // Send email to user
    await sendPaymentVerificationEmail(order, order.user, 'approved');

    res.json({ 
      success: true, 
      message: 'Payment verified successfully! Order is now processing.',
      data: order 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ADMIN: REJECT PAYMENT (DISAPPROVE)
// ============================================
export const rejectPayment = async (req, res) => {
  try {
    const { orderId, rejectionReason, adminNotes } = req.body;
    
    const order = await Order.findById(orderId).populate('user');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order
    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';
    order.paymentVerification = {
      verifiedBy: req.user.id,
      verifiedAt: Date.now(),
      rejectionReason: rejectionReason,
      adminNotes: adminNotes
    };
    
    await order.save();

    // Restore stock
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    // Send email to user
    await sendPaymentVerificationEmail(order, order.user, 'rejected', rejectionReason);

    res.json({ 
      success: true, 
      message: 'Payment rejected. Order cancelled and stock restored.',
      data: order 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET PENDING VERIFICATION ORDERS (ADMIN)
// ============================================
export const getPendingVerificationOrders = async (req, res) => {
  try {
    const orders = await Order.find({ 
      paymentStatus: 'pending_verification' 
    }).populate('user', 'name email').sort('-createdAt');
    
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET VERIFICATION DETAILS (ADMIN)
// ============================================
export const getPaymentProofDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ 
      success: true, 
      data: {
        paymentProof: order.paymentProof,
        paymentStatus: order.paymentStatus,
        user: order.user
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET MY ORDERS
// ============================================
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort('-createdAt');
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET ORDER BY ID
// ============================================
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    // Check ownership or admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET ALL ORDERS (ADMIN)
// ============================================
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort('-createdAt');
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// UPDATE ORDER STATUS (ADMIN)
// ============================================
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = orderStatus;
    await order.save();

    // Send email notification
    await sendOrderStatusUpdate(order, order.user, oldStatus, orderStatus);

    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};