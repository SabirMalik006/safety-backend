import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart 
} from '../controllers/cartController.js';

const router = express.Router();

// All cart routes are protected
router.use(protect);

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
router.get('/', getCart);

// @desc    Add to cart
// @route   POST /api/cart
// @access  Private
router.post('/', addToCart);

// @desc    Update cart item
// @route   PUT /api/cart/:itemId
// @access  Private
router.put('/:itemId', updateCartItem);

// @desc    Remove from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
router.delete('/:itemId', removeFromCart);

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
router.delete('/', clearCart);

export default router;