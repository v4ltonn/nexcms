#!/usr/bin/env node
/**
 * Fix existing posts: replace slugs that end with timestamp/random suffix (e.g. -1772805693204-2)
 * with a clean slug from the title only. Use -2, -3 etc. only for duplicates.
 *
 * Run on server: node scripts/fix-slugs-remove-timestamp.js [limit] [--dry-run]
 * Example: node scripts/fix-slugs-remove-timestamp.js 50000 --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { cleanSlugFromTitle } = require('../utils/content-quality-gate');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => !a.startsWith('--'));
const LIMIT = parseInt(limitArg || '100000', 10) || 100000;

const TIMESTAMP_SLUG_REGEX = /^(.+?)-\d{10,}[-\d]*$/;

async function run() {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });

  const posts = await Post.find({
    status: 'published',
    deleted: { $ne: true },
    slug: { $regex: /-\d{10,}[-\d]*$/ }
  })
    .select('_id slug title')
    .sort({ publishedAt: -1 })
    .limit(LIMIT)
    .lean();

  console.log('Found', posts.length, 'posts with timestamp-like slug suffix.\n');
  if (dryRun) console.log('[DRY RUN - no changes will be saved]\n');

  let fixed = 0;
  let skipped = 0;

  for (const post of posts) {
    const baseSlug = cleanSlugFromTitle(post.title);
    if (!baseSlug || baseSlug === post.slug) {
      skipped++;
      continue;
    }
    let newSlug = baseSlug;
    let suffix = 0;
    while (await Post.findOne({ slug: newSlug, _id: { $ne: post._id } })) {
      suffix++;
      newSlug = baseSlug.replace(/-+$/, '') + '-' + suffix;
    }
    if (newSlug === post.slug) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log('[dry-run]', post.slug, '->', newSlug);
      fixed++;
      continue;
    }
    await Post.updateOne({ _id: post._id }, { $set: { slug: newSlug } });
    console.log('  ', post.slug, '->', newSlug);
    fixed++;
  }

  console.log('\nDone. Fixed:', fixed, 'Skipped:', skipped);
  if (dryRun && fixed) console.log('Run without --dry-run to apply.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
