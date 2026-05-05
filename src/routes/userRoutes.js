import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

// Get user wishlist
router.get('/profile/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');
    res.json({ success: true, data: user.wishlist || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle wishlist item
router.post('/profile/wishlist/toggle', protect, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID is required' });
    
    const user = await User.findById(req.user._id);
    if (!user.wishlist) user.wishlist = [];
    
    const index = user.wishlist.findIndex(id => id.toString() === productId.toString());
    if (index > -1) {
      user.wishlist.splice(index, 1);
    } else {
      user.wishlist.push(productId);
    }
    
    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('wishlist');
    
    res.json({ success: true, data: updatedUser.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all users (admin)
router.get('/', protect, admin, async (req, res) => {
  const users = await User.find().select('-password');
  res.json({ success: true, data: users });
});

// Get single user
router.get('/:id', protect, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
});

// Update user
router.put('/:id', protect, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
  res.json({ success: true, data: user });
});

// Delete user (admin)
router.delete('/:id', protect, admin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'User deleted' });
});

export default router;