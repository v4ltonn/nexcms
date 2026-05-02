require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Post = require('../models/Post');

async function createVulnerabilitiesCategory() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Create or find Vulnerabilities category
    let vulnCategory = await Category.findOne({ slug: 'vulnerabilities' });
    
    if (!vulnCategory) {
      vulnCategory = new Category({
        name: 'Vulnerabilities',
        slug: 'vulnerabilities',
        description: 'Latest security vulnerabilities and CVE reports. Critical security advisories and vulnerability disclosures.',
        color: '#ff4444',
        icon: 'fas fa-bug',
        postCount: 0
      });
      await vulnCategory.save();
      console.log('✅ Created Vulnerabilities category');
    } else {
      console.log('✅ Vulnerabilities category already exists');
    }
    
    // Find all CVE posts and move them to Vulnerabilities category
    const cvePosts = await Post.find({
      $or: [
        { title: { $regex: /^CVE-\d{4}-\d+/i } },
        { title: { $regex: /\{"Source"/i } }
      ]
    });
    
    console.log(`\n📊 Found ${cvePosts.length} CVE posts to move\n`);
    
    let moved = 0;
    for (const post of cvePosts) {
      post.category = vulnCategory._id;
      await post.save();
      moved++;
      if (moved % 10 === 0) {
        console.log(`   Moved ${moved}/${cvePosts.length} posts...`);
      }
    }
    
    // Update category post count
    vulnCategory.postCount = await Post.countDocuments({ category: vulnCategory._id });
    await vulnCategory.save();
    
    console.log(`\n✅ Moved ${moved} posts to Vulnerabilities category`);
    console.log(`✅ Category now has ${vulnCategory.postCount} posts\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createVulnerabilitiesCategory();

