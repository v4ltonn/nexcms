#!/usr/bin/env node
/**
 * Content quality check for production (run on server: ssh root@dedi)
 *
 * Connects to the DB (prod when run on dedi), samples recent published posts,
 * and reports: excerpt quality, content length, junk text, tags, meta description.
 *
 * Usage on server:
 *   cd /path/to/nexcms-cms   # or your app root on dedi
 *   node scripts/check-content-quality-prod.js [sampleSize]
 *
 * Default sample: 500 most recent published posts.
 * Uses MONGODB_URI from .env (prod on dedi).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');
const { hasJunk } = require('../utils/clean-content-for-seo');

const SAMPLE_SIZE = parseInt(process.argv[2], 10) || 500;

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTextLength(post) {
  const raw = post.content || '';
  const fromHtml = stripHtml(post.contentHtml || '');
  return Math.max(raw.length, fromHtml.length);
}

function getEffectiveExcerpt(post) {
  return (post.seo && post.seo.description) || post.excerpt || stripHtml(post.content || '').substring(0, 200);
}

function getEffectiveMetaDescription(post) {
  const meta = (post.seo && post.seo.description) || post.excerpt;
  if (meta) return meta;
  const fromContent = stripHtml(post.content || '').substring(0, 160);
  return fromContent;
}

async function run() {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected. Sampling', SAMPLE_SIZE, 'most recent published posts.\n');

  const posts = await Post.find({
    status: 'published',
    deleted: { $ne: true },
  })
    .select('slug title excerpt content contentHtml tags seo publishedAt')
    .sort({ publishedAt: -1 })
    .limit(SAMPLE_SIZE)
    .lean();

  const stats = {
    total: posts.length,
    excerpt: { missing: 0, tooShort: 0, short: 0, good: 0, long: 0 },
    contentLength: { thin: 0, short: 0, ok: 0 },
    junk: 0,
    tagsMissing: 0,
    tagsFew: 0,
    tagsOk: 0,
    metaShort: 0,
    metaOk: 0,
  };

  const examples = {
    excerptMissing: [],
    excerptTooShort: [],
    thinContent: [],
    hasJunk: [],
    metaShort: [],
  };

  for (const post of posts) {
    const excerpt = getEffectiveExcerpt(post);
    const excerptLen = excerpt.length;
    if (!excerpt || excerptLen < 50) {
      stats.excerpt.missing++;
      if (examples.excerptMissing.length < 5) examples.excerptMissing.push(post.slug);
    } else if (excerptLen < 80) {
      stats.excerpt.tooShort++;
      if (examples.excerptTooShort.length < 5) examples.excerptTooShort.push(post.slug);
    } else if (excerptLen < 120) stats.excerpt.short++;
    else if (excerptLen <= 160) stats.excerpt.good++;
    else stats.excerpt.long++;

    const textLen = getTextLength(post);
    if (textLen < 300) {
      stats.contentLength.thin++;
      if (examples.thinContent.length < 5) examples.thinContent.push(post.slug);
    } else if (textLen < 600) stats.contentLength.short++;
    else stats.contentLength.ok++;

    if (hasJunk(post.content, post.contentHtml)) {
      stats.junk++;
      if (examples.hasJunk.length < 5) examples.hasJunk.push(post.slug);
    }

    const tagCount = (post.tags && post.tags.length) || 0;
    if (tagCount === 0) stats.tagsMissing++;
    else if (tagCount <= 2) stats.tagsFew++;
    else stats.tagsOk++;

    const meta = getEffectiveMetaDescription(post);
    const metaLen = meta.length;
    if (metaLen > 0 && metaLen < 100) {
      stats.metaShort++;
      if (examples.metaShort.length < 5) examples.metaShort.push(post.slug);
    } else if (metaLen >= 100) stats.metaOk++;
  }

  // Report
  console.log('=== CONTENT QUALITY REPORT (production sample) ===\n');
  console.log('Sample size:', stats.total, 'posts\n');

  console.log('--- Excerpt / meta description ---');
  console.log('  Missing / very short (<80):', stats.excerpt.missing);
  console.log('  Short (80–119):', stats.excerpt.short);
  console.log('  Good (120–160):', stats.excerpt.good);
  console.log('  Long (>160):', stats.excerpt.long);
  if (examples.excerptMissing.length) {
    console.log('  Example slugs (missing):', examples.excerptMissing.join(', '));
  }
  if (examples.excerptTooShort.length) {
    console.log('  Example slugs (too short):', examples.excerptTooShort.join(', '));
  }
  console.log('');

  console.log('--- Content length (plain text) ---');
  console.log('  Thin (<300 chars):', stats.contentLength.thin);
  console.log('  Short (300–599):', stats.contentLength.short);
  console.log('  OK (600+):', stats.contentLength.ok);
  if (examples.thinContent.length) {
    console.log('  Example slugs (thin):', examples.thinContent.join(', '));
  }
  console.log('');

  console.log('--- Junk phrases (should be cleaned) ---');
  console.log('  Posts with junk text:', stats.junk);
  if (examples.hasJunk.length) {
    console.log('  Example slugs:', examples.hasJunk.join(', '));
  }
  console.log('');

  console.log('--- Tags ---');
  console.log('  No tags:', stats.tagsMissing);
  console.log('  1–2 tags:', stats.tagsFew);
  console.log('  3+ tags:', stats.tagsOk);
  console.log('');

  console.log('--- Meta description (for SEO) ---');
  console.log('  Short (<100 chars):', stats.metaShort);
  console.log('  OK (100+):', stats.metaOk);
  if (examples.metaShort.length) {
    console.log('  Example slugs (short meta):', examples.metaShort.join(', '));
  }
  console.log('');

  // One-line summary
  const issues = [];
  if (stats.excerpt.missing + stats.excerpt.tooShort > 0) {
    issues.push(`${stats.excerpt.missing + stats.excerpt.tooShort} poor excerpt`);
  }
  if (stats.contentLength.thin > 0) issues.push(`${stats.contentLength.thin} thin content`);
  if (stats.junk > 0) issues.push(`${stats.junk} with junk text`);
  if (stats.tagsMissing > 0) issues.push(`${stats.tagsMissing} no tags`);
  if (stats.metaShort > 0) issues.push(`${stats.metaShort} short meta`);
  console.log('Summary:', issues.length ? issues.join('; ') : 'No major issues in sample.');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
