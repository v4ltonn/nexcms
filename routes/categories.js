const express = require('express');
const Category = require('../models/Category');

const router = express.Router();

// Get all categories (exclude Vulnerabilities from homepage/category listings)
router.get('/', async (req, res) => {
  try {
    // Exclude Vulnerabilities category - it should only be accessible via direct post links
    const categories = await Category.find({ 
      isActive: true,
      slug: { $ne: 'vulnerabilities' }
    })
      .sort({ sortOrder: 1, name: 1 });
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=60');
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single category
router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
