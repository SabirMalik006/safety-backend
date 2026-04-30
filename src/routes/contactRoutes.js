import express from 'express';
import { submitContact, getAllContacts, markAsRead, deleteContact } from '../controllers/contactController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', submitContact);
router.get('/all', protect, admin, getAllContacts);
router.put('/:id/read', protect, admin, markAsRead);
router.delete('/:id', protect, admin, deleteContact);

export default router;