import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
export const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ 
    product: req.params.productId, 
    isApproved: true 
  }).populate('user', 'name avatar');
  
  res.json({ success: true, data: reviews });
});

// @desc    Create review
// @route   POST /api/reviews
export const createReview = asyncHandler(async (req, res) => {
  // Handle authenticated vs guest
  if (req.user) {
    req.body.user = req.user.id;
  } else if (!req.body.guestName) {
    throw new AppError('Name is required for feedback', 400);
  }

  // Prevent duplicate product reviews if logged in
  if (req.user && req.body.product) {
    const existingReview = await Review.findOne({
      user: req.user.id,
      product: req.body.product
    });
    
    if (existingReview) {
      throw new AppError('You already reviewed this product', 400);
    }
  }
  
  const review = await Review.create(req.body);
  
  // Only update product rating if it's a product review
  if (req.body.product) {
    const reviews = await Review.find({ product: req.body.product, isApproved: true });
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length;
      await Product.findByIdAndUpdate(req.body.product, {
        rating: avgRating || 0,
        numReviews: reviews.length
      });
    }
  }
  
  res.status(201).json({ success: true, data: review });
});

// @desc    Get all reviews (admin)
// @route   GET /api/reviews/all
export const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find().populate('user', 'name').populate('product', 'name');
  res.json({ success: true, data: reviews });
});

// @desc    Approve review
// @route   PUT /api/reviews/:id/approve
export const approveReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);
  
  review.isApproved = true;
  await review.save();
  
  res.json({ success: true, data: review });
});

// @desc    Delete review
// @route   DELETE /api/reviews/:id
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);
  
  await review.deleteOne();
  res.json({ success: true, message: 'Review deleted' });
});