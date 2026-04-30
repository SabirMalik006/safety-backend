import express from 'express';
import { getHeroes, getAllHeroes, createHero, updateHero, deleteHero } from '../controllers/heroController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getHeroes);
router.get('/all', protect, admin, getAllHeroes);
router.post('/', protect, admin, createHero);
router.put('/:id', protect, admin, updateHero);
router.delete('/:id', protect, admin, deleteHero);

export default router;