import Product from '../models/Product.js';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Get all products
// @route   GET /api/products
export const getProducts = asyncHandler(async (req, res) => {
  const { category, featured, search, minPrice, maxPrice, sort } = req.query;

  let query = { isActive: true };

  if (category) {
    // If category is a slug, we might need to find the category ID first
    // But let's assume it's passed as ID for now, or handle both
    if (category.match(/^[0-9a-fA-F]{24}$/)) {
      query.category = category;
    } else {
      // It's a slug, we'll need to find the category ID
      const Category = (await import('../models/Category.js')).default;
      const cat = await Category.findOne({ slug: category });
      if (cat) query.category = cat._id;
    }
  }
  
  if (featured === 'true') query.isFeatured = true;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  let apiQuery = Product.find(query).populate('category');

  // Sorting
  if (sort) {
    const sortBy = sort.split(',').join(' ');
    apiQuery = apiQuery.sort(sortBy);
  } else {
    apiQuery = apiQuery.sort('-createdAt');
  }

  const products = await apiQuery;
  res.json({ success: true, count: products.length, data: products });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category');
  if (!product) throw new AppError('Product not found', 404);

  res.json({ success: true, data: product });
});

// @desc    Get single product by slug
// @route   GET /api/products/slug/:slug
export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category');
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

