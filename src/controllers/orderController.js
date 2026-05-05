import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { 
  sendOrderConfirmation, 
  sendOrderStatusUpdate,
  sendPaymentVerificationEmail 
} from '../utils/emailService.js';

const getFirstImageUrl = (product) => {
  const first = product?.images?.[0];
  if (!first) return '';
  if (typeof first === 'string') return first;
  return first.url || '';
};

const isProbablyUrl = (val) =>
  typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));

// ============================================
// PLACE ORDER WITH PAYMENT PROOF
// ============================================
// ============================================
// PLACE ORDER (COD or Prepaid)
// ============================================
export const createOrder = async (req, res) => {
  try {
    const { 
      orderItems, shippingAddress, paymentMethod, 
      itemsPrice, shippingPrice, totalPrice,
      paymentProof, orderNotes
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

    // Determine initial status based on payment method
    let paymentStatus = 'pending';
    let orderStatus = 'pending';

    if (paymentMethod !== 'cod') {
      paymentStatus = 'pending_verification';
    }

    // Create order
    const orderData = {
      user: req.user.id,
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      totalPrice,
      orderStatus,
      paymentStatus,
      orderNotes
    };

    if (paymentProof) {
      orderData.paymentProof = {
        screenshotUrl: paymentProof.screenshotUrl || '',
        transactionId: paymentProof.transactionId || '',
        paymentDate: paymentProof.paymentDate || Date.now(),
        paymentAccount: paymentProof.paymentAccount || '',
        remarks: paymentProof.remarks || ''
      };
    }

    const order = await Order.create(orderData);

    // Reduce stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    // Send confirmation email
    try {
      await sendOrderConfirmation(order, req.user);
    } catch (err) {
      console.error('Email confirmation error:', err.message);
    }

    res.status(201).json({ 
      success: true, 
      data: order,
      message: paymentMethod === 'cod' 
        ? 'Order placed successfully!' 
        : 'Order placed! Payment verification pending.' 
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
    const orders = await Order.find({ user: req.user.id })
      .populate('orderItems.product', 'images')
      .sort('-createdAt');

    // Backfill broken/missing item images from populated product images
    orders.forEach((order) => {
      order.orderItems.forEach((it) => {
        const fallback = getFirstImageUrl(it.product);
        if (!isProbablyUrl(it.image) && fallback) {
          it.image = fallback;
        }
      });
    });

    // Persist fixes so future reads are clean
    await Promise.all(orders.map((o) => o.save()));

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
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'images');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    // Check ownership or admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    // Backfill broken/missing item images
    order.orderItems.forEach((it) => {
      const fallback = getFirstImageUrl(it.product);
      if (!isProbablyUrl(it.image) && fallback) {
        it.image = fallback;
      }
    });
    await order.save();

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
    const { status, orderStatus } = req.body;
    const finalStatus = status || orderStatus;
    
    const order = await Order.findById(req.params.id).populate('user');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = finalStatus;
    await order.save();

    // Send email notification
    try {
      await sendOrderStatusUpdate(order, order.user, oldStatus, finalStatus);
    } catch (err) {
      console.error('Order status email error:', err.message);
    }

    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// UPLOAD PAYMENT PROOF SCREENSHOT
// ============================================
export const uploadPaymentProof = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    res.status(200).json({
      success: true,
      url: req.file.path, // Cloudinary URL
      message: 'Screenshot uploaded successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Upload failed: ' + error.message });
  }
};