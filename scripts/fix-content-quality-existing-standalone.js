#!/usr/bin/env node
/**
 * Standalone fix for existing posts: strip junk phrases, cap excerpt to 160.
 * No external utils required – paste this single file on the server and run:
 *   node scripts/fix-content-quality-existing-standalone.js [sampleSize] [--dry-run]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');

const MAX_EXCERPT_LENGTH = 160;
const JUNK_PHRASES = [
  'Enter fullscreen mode',
  'Exit fullscreen mode',
  'Hide this comment',
  'Hide child comments',
  'For further actions',
  'you may consider blocking',
  'reporting abuse',
  'Source:',
  'Read more at',
  'Originally posted at',
  'Click here to read',
];

function stripJunkPhrases(str) {
  if (!str || typeof str !== 'string') return str;
  let out = str;
  for (const phrase of JUNK_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi');
    out = out.replace(re, ' ').replace(/\s+/g, ' ').trim();
  }
  return out.replace(/\s+/g, ' ').trim();
}

function capExcerpt(excerpt, maxLen) {
  maxLen = maxLen || MAX_EXCERPT_LENGTH;
  if (!excerpt || typeof excerpt !== 'string') return excerpt;
  const t = excerpt.trim();
  if (t.length <= maxLen) return t;
  const truncated = t.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) return truncated.substring(0, lastSpace).trim();
  return truncated.trim();
}

function hasJunk(content, contentHtml) {
  const combined = `${content || ''} ${contentHtml || ''}`.toLowerCase();
  return JUNK_PHRASES.some(phrase => combined.includes(phrase.toLowerCase()));
}

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
    const content = post.content || '';
    const contentHtml = post.contentHtml || '';
    const excerpt = getEffectiveExcerpt(post);
    const seoDesc = (post.seo && post.seo.description) || '';

    const hadJunk = hasJunk(content, contentHtml);
    const newContent = hadJunk ? stripJunkPhrases(content) : content;
    const newContentHtml = hadJunk ? stripJunkPhrases(contentHtml) : contentHtml;

    const excerptLen = (excerpt || '').length;
    const cappedExcerpt = excerptLen > MAX_EXCERPT_LENGTH ? capExcerpt(excerpt, MAX_EXCERPT_LENGTH) : excerpt;
    const seoLen = (seoDesc || '').length;

    const needsJunkFix = hadJunk && (newContent !== content || newContentHtml !== contentHtml);
    const needsExcerptFix = excerptLen > MAX_EXCERPT_LENGTH || seoLen > MAX_EXCERPT_LENGTH;

    if (!needsJunkFix && !needsExcerptFix) {
      skipped++;
      continue;
    }

    if (dryRun) {
      if (needsJunkFix) console.log('[dry-run] Would strip junk: ' + post.slug);
      if (needsExcerptFix) console.log('[dry-run] Would cap excerpt (' + excerptLen + '->' + cappedExcerpt.length + '): ' + post.slug);
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
    if (needsJunkFix) console.log('  Stripped junk: ' + post.slug);
    if (needsExcerptFix) console.log('  Capped excerpt: ' + post.slug);
  }

  console.log('\nDone.');
  console.log('  Posts with junk stripped: ' + fixedJunk);
  console.log('  Posts with excerpt capped to ' + MAX_EXCERPT_LENGTH + ': ' + fixedExcerpt);
  console.log('  Unchanged: ' + skipped);
  if (dryRun && (fixedJunk || fixedExcerpt)) console.log('\nRun without --dry-run to apply changes.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
