import express from 'express';
import { getProducts, getProduct, getProductBySlug, createProduct, updateProduct, deleteProduct, uploadProductImages, deleteProductImage } from '../controllers/productController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/slug/:slug', getProductBySlug);
router.get('/:id', getProduct);
router.post('/', protect, admin, createProduct);
router.post('/upload-images', protect, admin, upload.array('images', 5), uploadProductImages);
router.delete('/delete-image', protect, admin, deleteProductImage);
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

export default router;