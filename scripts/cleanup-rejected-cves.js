/**
 * Cleanup script to remove rejected/refused/invalid CVE posts
 * This script scans all CVE posts and removes those that are rejected
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');

// Check if CVE is rejected/refused/invalid
function isCVERejected(content, title) {
  if (!content && !title) return false;
  
  const text = `${content || ''} ${title || ''}`.toUpperCase();
  
  // Check for rejection keywords
  const rejectionPatterns = [
    /\*\s*REJECT\s*\*/i,
    /DO NOT USE THIS CANDIDATE/i,
    /CANDIDATE WAS ISSUED IN ERROR/i,
    /ISSUED IN ERROR/i,
    /REJECTED REASON/i,
    /REFUSED/i,
    /INVALID CVE/i,
    /CANDIDATE NUMBER.*REJECT/i,
    /NOT VALID/i,
    /WITHDRAWN/i,
    /RESERVED/i,
    /RESERVATION/i
  ];
  
  for (const pattern of rejectionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

async function cleanupRejectedCVEs() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Find all CVE posts
    const cvePosts = await Post.find({
      $or: [
        { title: { $regex: /CVE-\d{4}-\d+/i } },
        { slug: { $regex: /cve-\d{4}-\d+/i } },
        { tags: { $in: ['cve'] } }
      ]
    });
    
    console.log(`\n📊 Found ${cvePosts.length} CVE posts to check\n`);
    
    let deleted = 0;
    let kept = 0;
    
    for (const post of cvePosts) {
      const isRejected = isCVERejected(post.content || '', post.title || '');
      
      if (isRejected) {
        console.log(`🚫 Soft-deleting rejected CVE: ${post.title} (${post.slug})`);
        // Use soft delete instead of hard delete
        post.deleted = true;
        post.deletedAt = new Date();
        post.status = 'soft-deleted';
        await post.save();
        deleted++;
      } else {
        kept++;
      }
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${deleted} rejected CVEs`);
    console.log(`   Kept: ${kept} valid CVEs\n`);
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanupRejectedCVEs();

