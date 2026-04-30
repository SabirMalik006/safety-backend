import Product from '../models/Product.js';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Get all products
// @route   GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const { category, featured, search, minPrice, maxPrice } = req.query;

  let query = { isActive: true };

  if (category) query.category = category;
  if (featured === 'true') query.isFeatured = true;
  if (search) query.name = { $regex: search, $options: 'i' };
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  const products = await Product.find(query).populate('category');
  res.json({ success: true, count: products.length, data: products });
});

// @desc    Get single product
// @route   GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category');
  if (!product) throw new AppError('Product not found', 404);

  res.json({ success: true, data: product });
});

// @desc    Create product (admin)
// @route   POST /api/products
export const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});

// @desc    Update product (admin)
// @route   PUT /api/products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  res.json({ success: true, data: updated });
});

// @desc    Delete product (admin)
// @route   DELETE /api/products/:id
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});

// @desc    Upload product images
// @route   POST /api/products/upload-images
export const uploadProductImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const images = req.files.map(file => ({
      url: file.path,
      publicId: file.filename,
      alt: req.body.alt || 'Product image'
    }));

    res.json({ success: true, data: images });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product image from Cloudinary
// @route   DELETE /api/products/delete-image
export const deleteProductImage = async (req, res, next) => {
  try {
    const { publicId } = req.body;
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    next(error);
  }
};

