#!/usr/bin/env node
/**
 * Fix existing posts: strip junk phrases from content/contentHtml, cap excerpt to 160 chars.
 * Run on server: node scripts/fix-content-quality-existing.js [sampleSize] [--dry-run]
 *
 * Default: 500 most recent published posts. Use --dry-run to only report what would change.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { stripJunkPhrases, capExcerpt, hasJunk, MAX_EXCERPT_LENGTH } = require('../utils/clean-content-for-seo');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sampleSize = parseInt(args.find(a => !a.startsWith('--')) || '500', 10) || 500;

function getEffectiveExcerpt(post) {
  return (post.seo && post.seo.description) || post.excerpt || '';
}

async function run() {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });

  const posts = await Post.find({
    status: 'published',
    deleted: { $ne: true },
  })
    .select('slug title excerpt content contentHtml seo')
    .sort({ publishedAt: -1 })
    .limit(sampleSize)
    .lean();

  let fixedJunk = 0;
  let fixedExcerpt = 0;
  let skipped = 0;

  for (const post of posts) {
    let content = post.content || '';
    let contentHtml = post.contentHtml || '';
    const excerpt = getEffectiveExcerpt(post);
    const seoDesc = (post.seo && post.seo.description) || '';

    const hadJunk = hasJunk(content, contentHtml);
    const newContent = hadJunk ? stripJunkPhrases(content) : content;
    const newContentHtml = hadJunk ? stripJunkPhrases(contentHtml) : contentHtml;

    const excerptLen = (excerpt || '').length;
    const cappedExcerpt = excerptLen > MAX_EXCERPT_LENGTH ? capExcerpt(excerpt, MAX_EXCERPT_LENGTH) : excerpt;
    const seoLen = (seoDesc || '').length;
    const cappedSeo = seoLen > MAX_EXCERPT_LENGTH ? capExcerpt(seoDesc, MAX_EXCERPT_LENGTH) : seoDesc;

    const needsJunkFix = hadJunk && (newContent !== content || newContentHtml !== contentHtml);
    const needsExcerptFix = excerptLen > MAX_EXCERPT_LENGTH || seoLen > MAX_EXCERPT_LENGTH;

    if (!needsJunkFix && !needsExcerptFix) {
      skipped++;
      continue;
    }

    if (dryRun) {
      if (needsJunkFix) console.log(`[dry-run] Would strip junk: ${post.slug}`);
      if (needsExcerptFix) console.log(`[dry-run] Would cap excerpt (${excerptLen}→${cappedExcerpt.length}): ${post.slug}`);
      if (needsJunkFix) fixedJunk++;
      if (needsExcerptFix) fixedExcerpt++;
      continue;
    }

    const update = {};
    if (needsJunkFix) {
      update.content = newContent;
      update.contentHtml = newContentHtml;
      fixedJunk++;
    }
    if (needsExcerptFix) {
      update.excerpt = cappedExcerpt;
      if (post.seo && typeof post.seo === 'object' && post.seo.description !== undefined) {
        update['seo.description'] = cappedExcerpt;
      }
      fixedExcerpt++;
    }

    await Post.updateOne({ _id: post._id }, { $set: update });
    if (needsJunkFix) console.log(`  Stripped junk: ${post.slug}`);
    if (needsExcerptFix) console.log(`  Capped excerpt: ${post.slug}`);
  }

  console.log('\nDone.');
  console.log(`  Posts with junk stripped: ${fixedJunk}`);
  console.log(`  Posts with excerpt capped to ${MAX_EXCERPT_LENGTH}: ${fixedExcerpt}`);
  console.log(`  Unchanged: ${skipped}`);
  if (dryRun && (fixedJunk || fixedExcerpt)) console.log('\nRun without --dry-run to apply changes.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
