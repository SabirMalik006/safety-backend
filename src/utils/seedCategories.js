const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('../models/Category');

dotenv.config();

const categories = [
  { name: 'Construction Site Supplies', description: 'Professional construction materials and site equipment', order: 1 },
  { name: 'Safety and Emergency Equipment', description: 'PPE, first aid, and emergency response gear', order: 2 },
  { name: 'Power Back up and energy solutions', description: 'Generators, UPS systems, and solar solutions', order: 3 },
  { name: 'Gadgets and Utility Items', description: 'Smart devices and everyday utility products', order: 4 },
  { name: 'Storage and Packaging Solutions', description: 'Industrial storage and packaging materials', order: 5 },
  { name: 'Lights and Portable Lighting Systems', description: 'LED lights, work lights, and portable illumination', order: 6 },
  { name: 'Premium Essentials', description: 'High-end professional equipment', order: 7 }
];

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    await Category.deleteMany({});
    console.log('Cleared existing categories');
    
    const inserted = await Category.insertMany(categories);
    console.log(`✅ Added ${inserted.length} categories:`);
    inserted.forEach(cat => console.log(`   - ${cat.name} (${cat.slug})`));
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
};

seedCategories();