import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';
import { sendWelcomeEmail, sendPasswordResetOTP, sendPasswordResetEmail } from '../utils/emailService.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user
// @route   POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError('User already exists', 400);
  }
  
  const user = await User.create({
    name,
    email,
    password,
    role: 'user'
  });
  
  const token = generateToken(user._id);
  
  // ✅ Send welcome email (don't block registration if email fails)
  try {
    await sendWelcomeEmail(user.email, user.name);
    console.log('Welcome email sent to:', email);
  } catch (emailError) {
    console.error('Welcome email failed:', emailError.message);
    // Don't return error - registration still successful
  }
  
  res.status(201).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid credentials', 401);
  }
  
  const token = generateToken(user._id);
  
  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// @desc    Get current user profile
// @route   GET /api/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

// @desc    Update current user profile
// @route   PUT /api/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  const { name, phone, address } = req.body;
  
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) {
    user.address = {
      ...user.address,
      ...address
    };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: user
  });
});

// @desc    Add new address
// @route   POST /api/auth/addresses
export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  const newAddress = { ...req.body, isDefault: user.addresses.length === 0 };
  user.addresses.push(newAddress);
  await user.save();

  res.status(201).json({ success: true, data: user.addresses });
});

// @desc    Update address
// @route   PUT /api/auth/addresses/:id
export const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  const address = user.addresses.id(req.params.id);
  if (!address) throw new AppError('Address not found', 404);

  Object.assign(address, req.body);
  await user.save();

  res.json({ success: true, data: user.addresses });
});

// @desc    Delete address
// @route   DELETE /api/auth/addresses/:id
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
  await user.save();

  res.json({ success: true, data: user.addresses });
});

// @desc    Set default address
// @route   PATCH /api/auth/addresses/:id/default
export const setDefaultAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);

  user.addresses.forEach(addr => {
    addr.isDefault = addr._id.toString() === req.params.id;
  });
  
  await user.save();
  res.json({ success: true, data: user.addresses });
});

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Support both flows:
    // - default "otp" for current frontend
    // - optional "token" mode for production link-based reset (expires in 1 hour)
    const mode = (req.body.mode || 'otp').toLowerCase();

    if (mode === 'token') {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();

      await sendPasswordResetEmail(user.email, user.name, resetToken);
      return res.json({ success: true, message: 'Password reset link sent to your email' });
    }

    // OTP mode (legacy UI)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetOTP = otp;
    user.resetOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await sendPasswordResetOTP(user, otp);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
export const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.resetOTP !== otp || user.resetOTPExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    
    res.json({ success: true, message: 'OTP verified' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, token, newPassword } = req.body;
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Token-based reset (1 hour expiry)
    if (token) {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      if (user.resetPasswordToken !== hashedToken || !user.resetPasswordExpire || user.resetPasswordExpire < Date.now()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      }
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      return res.json({ success: true, message: 'Password reset successful' });
    }

    // OTP-based reset (legacy)
    if (user.resetOTP !== otp || user.resetOTPExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.password = newPassword;
    user.resetOTP = undefined;
    user.resetOTPExpire = undefined;
    await user.save();
    
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};