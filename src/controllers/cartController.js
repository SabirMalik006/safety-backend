import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

const getFirstImageUrl = (product) => {
  const first = product?.images?.[0];
  if (!first) return '';
  if (typeof first === 'string') return first;
  return first.url || '';
};

const isProbablyUrl = (val) =>
  typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));

export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name price images inStock');
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [], total: 0 });

    // Normalize images for response (and optionally fix bad stored values)
    cart.items.forEach((it) => {
      const fallback = getFirstImageUrl(it.product);
      if (!isProbablyUrl(it.image) && fallback) {
        it.image = fallback;
      }
    });
    await cart.save();

    res.json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, selectedColor = '' } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [], total: 0 });
    
    const existingIndex = cart.items.findIndex(item => item.product.toString() === productId && item.selectedColor === selectedColor);
    if (existingIndex > -1) cart.items[existingIndex].quantity += quantity;
    else cart.items.push({ product: productId, name: product.name, price: product.price, quantity, selectedColor, image: getFirstImageUrl(product) });
    
    await cart.save();
    await cart.populate('items.product', 'name price images inStock');
    res.json({ success: true, message: 'Added to cart', data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    
    const itemIndex = cart.items.findIndex(item => item._id.toString() === req.params.itemId);
    if (itemIndex === -1) return res.status(404).json({ success: false, message: 'Item not found' });
    
    if (quantity <= 0) cart.items.splice(itemIndex, 1);
    else cart.items[itemIndex].quantity = quantity;
    
    await cart.save();
    await cart.populate('items.product', 'name price images inStock');
    res.json({ success: true, message: 'Cart updated', data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
    await cart.save();
    await cart.populate('items.product', 'name price images inStock');
    res.json({ success: true, message: 'Removed from cart', data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) cart.items = [];
    await cart?.save();
    res.json({ success: true, message: 'Cart cleared', data: { items: [], total: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
