import axios from 'axios';
import crypto from 'crypto';
import Order from '../models/Order.js';

// ============================================
// CASH ON DELIVERY
// ============================================
export const createCODOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.paymentMethod = 'cod';
    order.paymentStatus = 'pending';
    order.orderStatus = 'pending';
    await order.save();
    
    res.json({
      success: true,
      message: 'COD order created successfully',
      data: { orderId: order._id, status: 'pending' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// EASYPAISA
// ============================================
export const initiateEasyPaisaPayment = async (req, res) => {
  try {
    const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // EasyPaisa API Request
    const paymentData = {
      storeId: process.env.EASYPAISA_STORE_ID,
      transactionAmount: amount,
      transactionType: 'SALE',
      mobileAccountNo: customerPhone,
      emailAddress: customerEmail,
      transactionRef: `ORDER_${orderId}_${Date.now()}`,
      postBackURL: `${process.env.FRONTEND_URL}/payment/callback`,
    };
    
    // Generate hash for security
    const hashString = `${process.env.EASYPAISA_STORE_ID}|${paymentData.transactionRef}|${amount}|${process.env.EASYPAISA_HASH_KEY}`;
    paymentData.hashedData = crypto.createHash('sha256').update(hashString).digest('hex');
    
    const response = await axios.post(process.env.EASYPAISA_POST_URL, paymentData);
    
    if (response.data.statusCode === '000') {
      order.paymentMethod = 'easypaisa';
      order.paymentStatus = 'pending';
      await order.save();
      
      res.json({
        success: true,
        paymentUrl: response.data.paymentPageUrl,
        transactionRef: paymentData.transactionRef
      });
    } else {
      res.json({ success: false, message: response.data.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// EasyPaisa Callback Handler
export const easyPaisaCallback = async (req, res) => {
  try {
    const { transactionRef, statusCode, amount } = req.body;
    
    // Find order by transaction reference
    const order = await Order.findOne({ 
      'paymentResult.transactionRef': transactionRef 
    });
    
    if (order && statusCode === '000') {
      order.paymentStatus = 'paid';
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: transactionRef,
        status: 'success',
        updateTime: new Date().toISOString()
      };
      await order.save();
      
      // Send email confirmation
      await sendOrderConfirmation(order, await User.findById(order.user));
    }
    
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?success=${statusCode === '000'}`);
  } catch (error) {
    console.error('EasyPaisa callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment/status?success=false`);
  }
};

// ============================================
// JAZZCASH
// ============================================
export const initiateJazzCashPayment = async (req, res) => {
  try {
    const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    const txDateTime = new Date().toISOString().replace(/[-:T.Z]/g, '');
    const ppTxnRefNo = `TXN${txDateTime}${Math.floor(Math.random() * 10000)}`;
    
    // Generate Integrity Salt
    const hashString = [
      process.env.JAZZCASH_MERCHANT_ID,
      orderId.slice(-10),
      txDateTime,
      amount,
      'PKR',
      process.env.JAZZCASH_INTEGRITY_SALT
    ].join('&');
    
    const secureHash = crypto.createHash('sha256').update(hashString).digest('hex');
    
    const paymentData = {
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
      pp_Password: process.env.JAZZCASH_PASSWORD,
      pp_TxnRefNo: ppTxnRefNo,
      pp_Amount: amount,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: txDateTime,
      pp_BillReference: orderId,
      pp_Description: `Order ${orderId}`,
      pp_ReturnURL: `${process.env.FRONTEND_URL}/payment/callback`,
      pp_SecureHash: secureHash,
      pp_Language: 'EN',
      pp_MobileNumber: customerPhone,
      pp_EmailAddress: customerEmail
    };
    
    order.paymentMethod = 'jazzcash';
    order.paymentStatus = 'pending';
    order.paymentResult = { transactionRef: ppTxnRefNo };
    await order.save();
    
    res.json({
      success: true,
      paymentUrl: process.env.JAZZCASH_POST_URL,
      formData: paymentData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// STRIPE (International - Backup)
// ============================================
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createStripePaymentIntent = async (req, res) => {
  try {
    const { amount, orderId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'pkr',
      metadata: { orderId },
      payment_method_types: ['card']
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmStripePayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      const order = await Order.findById(orderId);
      if (order) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentStatus = 'paid';
        order.paymentResult = {
          id: paymentIntent.id,
          status: paymentIntent.status
        };
        await order.save();
        
        // Send email confirmation
        const user = await User.findById(order.user);
        await sendOrderConfirmation(order, user);
      }
    }
    
    res.json({ success: true, data: paymentIntent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// PAYMENT STATUS CHECK
// ============================================
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({
      success: true,
      data: {
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid,
        paidAt: order.paidAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};