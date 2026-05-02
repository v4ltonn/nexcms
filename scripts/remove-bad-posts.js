require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Category = require('../models/Category');

async function removeBadPosts() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Get Tools category
    const toolsCategory = await Category.findOne({ slug: 'tools' });
    if (!toolsCategory) {
      console.log('❌ Tools category not found');
      process.exit(1);
    }
    
    // Non-tech keywords that shouldn't be in Tools category
    const nonTechKeywords = [
      'farmers',
      'almanac',
      'recipe',
      'cooking',
      'gardening',
      'farming',
      'agriculture',
      'weather forecast',
      'horoscope',
      'astrology',
      'cookbook',
      'food',
      'restaurant',
      'travel guide',
      'vacation',
      'hotel',
      'real estate',
      'home improvement',
      'decorating',
      'fashion',
      'clothing',
      'beauty',
      'makeup',
      'health tips',
      'medical advice',
      'fitness routine',
      'diet plan'
    ];
    
    // Find bad posts in Tools category
    const allToolsPosts = await Post.find({
      category: toolsCategory._id,
      deleted: { $ne: true }
    });
    
    console.log(`\n📊 Checking ${allToolsPosts.length} posts in Tools category...\n`);
    
    const badPosts = [];
    for (const post of allToolsPosts) {
      const title = (post.title || '').toLowerCase();
      const excerpt = (post.excerpt || '').toLowerCase();
      const content = (post.content || '').toLowerCase();
      
      const isNonTech = nonTechKeywords.some(keyword => 
        title.includes(keyword) || excerpt.includes(keyword) || content.includes(keyword)
      );
      
      if (isNonTech) {
        badPosts.push(post);
        console.log(`⚠️  Found non-tech post: ${post.title.substring(0, 70)}`);
      }
    }
    
    if (badPosts.length === 0) {
      console.log('✅ No bad posts found!');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`\n🗑️  Deleting ${badPosts.length} non-tech posts...\n`);
    
    for (const post of badPosts) {
      post.deleted = true;
      await post.save();
      console.log(`✅ Deleted: ${post.title.substring(0, 70)}`);
    }
    
    // Update category count
    toolsCategory.postCount = await Post.countDocuments({ 
      category: toolsCategory._id, 
      deleted: { $ne: true } 
    });
    await toolsCategory.save();
    
    console.log(`\n✅ Deleted ${badPosts.length} non-tech posts from Tools category`);
    console.log(`✅ Tools category now has ${toolsCategory.postCount} posts\n`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeBadPosts();




