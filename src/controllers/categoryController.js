import Category from '../models/Category.js';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';

// @desc    Get all categories
// @route   GET /api/categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort('order');
  res.json({ success: true, data: categories });
});

// @desc    Get all categories (admin)
// @route   GET /api/categories/all
export const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort('order');
  res.json({ success: true, data: categories });
});

// @desc    Create category
// @route   POST /api/categories
export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ success: true, data: category });
});

// @desc    Update category
// @route   PUT /api/categories/:id
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  
  const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  res.json({ success: true, data: updated });
});

// @desc    Delete category
// @route   DELETE /api/categories/:id
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  
  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});