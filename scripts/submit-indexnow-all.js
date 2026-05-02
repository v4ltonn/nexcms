require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { submitUrl } = require('../services/indexnow');

async function main() {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  const posts = await Post.find({ status: 'published', deleted: { $ne: true } }).select('slug');
  console.log(`Submitting ${posts.length} URLs to IndexNow...`);

  let success = 0;
  for (const post of posts) {
    const url = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`;
    try {
      const res = await submitUrl(url);
      if (res.ok) success += 1;
      // gentle pacing
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      // continue
    }
  }

  console.log(`Done. Submitted: ${success}/${posts.length}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});









