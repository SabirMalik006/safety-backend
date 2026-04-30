const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../utils/emailService');

const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, subtotal, shipping = 199, total, notes } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) return res.status(400).json({ success: false, message: 'Cart is empty' });
    
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      if (!product || product.stock < item.quantity) return res.status(400).json({ success: false, message: `${item.name} out of stock` });
    }
    
    const orderItems = cart.items.map(item => ({ product: item.product._id, name: item.name, price: item.price, quantity: item.quantity, selectedColor: item.selectedColor, image: item.image }));
    const order = await Order.create({ user: req.user._id, orderItems, shippingAddress: { ...shippingAddress, email: req.user.email }, paymentMethod, subtotal, shipping, total, notes });
    
    for (const item of cart.items) await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });
    cart.items = [];
    await cart.save();
    await sendOrderConfirmation(req.user, order);
    
    res.status(201).json({ success: true, message: 'Order placed', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status) query.orderStatus = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query).populate('user', 'name email').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Order.countDocuments(query);
    res.json({ success: true, count: orders.length, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (status === 'delivered') order.deliveredAt = Date.now();
    await order.save();
    await sendOrderStatusUpdate(order.user, order, oldStatus, status);
    res.json({ success: true, message: 'Order status updated', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'processing' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });
    const totalRevenue = await Order.aggregate([{ $match: { orderStatus: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
    res.json({ success: true, data: { totalOrders, pendingOrders, processingOrders, shippedOrders, deliveredOrders, cancelledOrders, totalRevenue: totalRevenue[0]?.total || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus, getOrderStats };