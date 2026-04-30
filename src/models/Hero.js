import mongoose from 'mongoose';

const heroSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  subtitle: String,
  description: String,
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  imagePublicId: String,
  buttonText: { type: String, default: 'Shop Now' },
  buttonLink: { type: String, default: '/collections/all-bags' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  backgroundColor: String,
  textColor: String
}, { timestamps: true });

export default mongoose.model('Hero', heroSchema);