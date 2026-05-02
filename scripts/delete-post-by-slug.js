#!/usr/bin/env node
/**
 * Delete a post by slug (soft delete - sets deleted: true)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: node delete-post-by-slug.js <slug>');
  process.exit(1);
}

async function deletePost() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB');

    const post = await Post.findOne({ slug });
    
    if (!post) {
      console.error(`❌ Post not found: ${slug}`);
      process.exit(1);
    }

    console.log(`\n📰 Found post:`);
    console.log(`   Title: ${post.title}`);
    console.log(`   Slug: ${post.slug}`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Published: ${post.publishedAt || 'N/A'}`);
    console.log(`   Already deleted: ${post.deleted || false}\n`);

    // Soft delete
    post.deleted = true;
    post.deletedAt = new Date();
    post.status = 'soft-deleted';
    await post.save();

    console.log(`✅ Post deleted (soft delete)`);
    console.log(`   - deleted: true`);
    console.log(`   - deletedAt: ${post.deletedAt}`);
    console.log(`   - status: soft-deleted`);
    console.log(`\n✅ Post will no longer appear in sitemap or public listings`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deletePost();
