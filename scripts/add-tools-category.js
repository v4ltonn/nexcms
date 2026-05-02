require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

async function addToolsCategory() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Check if Tools category already exists
    const existing = await Category.findOne({ slug: 'tools' });
    if (existing) {
      console.log('✅ Tools category already exists!');
      console.log(`   Name: ${existing.name}`);
      console.log(`   Slug: ${existing.slug}`);
      console.log(`   Description: ${existing.description}`);
      await mongoose.disconnect();
      return;
    }
    
    // Create Tools category
    const toolsCategory = new Category({
      name: 'Tools',
      slug: 'tools',
      description: 'Open source software, developer tools, GitHub projects, and useful utilities for productivity',
      color: '#9d4edd',
      icon: 'fas fa-tools',
      postCount: 0,
      isActive: true,
      sortOrder: 5,
      seo: {
        title: 'Open Source Tools & Software - Developer Utilities',
        description: 'Discover the latest open source tools, GitHub projects, developer utilities, and software downloads for productivity and development',
        keywords: ['open source', 'tools', 'software', 'github', 'developer tools', 'utilities', 'download', 'free software', 'open source software']
      }
    });
    
    await toolsCategory.save();
    console.log('✅ Successfully created Tools category!');
    console.log(`   Name: ${toolsCategory.name}`);
    console.log(`   Slug: ${toolsCategory.slug}`);
    console.log(`   Description: ${toolsCategory.description}`);
    console.log(`   Color: ${toolsCategory.color}`);
    console.log(`   Icon: ${toolsCategory.icon}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addToolsCategory();







