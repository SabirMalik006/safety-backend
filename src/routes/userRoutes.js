import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

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