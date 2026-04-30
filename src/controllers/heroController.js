import Hero from '../models/Hero.js';
import { asyncHandler, AppError } from '../middleware/errorMiddleware.js';

// @desc    Get all active heroes
// @route   GET /api/hero
export const getHeroes = asyncHandler(async (req, res) => {
  const heroes = await Hero.find({ isActive: true }).sort('order');
  res.json({ success: true, count: heroes.length, data: heroes });
});

// @desc    Get all heroes (admin)
// @route   GET /api/hero/all
export const getAllHeroes = asyncHandler(async (req, res) => {
  const heroes = await Hero.find().sort('order');
  res.json({ success: true, data: heroes });
});

// @desc    Create hero
// @route   POST /api/hero
export const createHero = asyncHandler(async (req, res) => {
  const hero = await Hero.create(req.body);
  res.status(201).json({ success: true, data: hero });
});

// @desc    Update hero
// @route   PUT /api/hero/:id
export const updateHero = asyncHandler(async (req, res) => {
  const hero = await Hero.findById(req.params.id);
  if (!hero) throw new AppError('Hero not found', 404);
  
  const updated = await Hero.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  res.json({ success: true, data: updated });
});

// @desc    Delete hero
// @route   DELETE /api/hero/:id
export const deleteHero = asyncHandler(async (req, res) => {
  const hero = await Hero.findById(req.params.id);
  if (!hero) throw new AppError('Hero not found', 404);
  
  await hero.deleteOne();
  res.json({ success: true, message: 'Hero deleted' });
});