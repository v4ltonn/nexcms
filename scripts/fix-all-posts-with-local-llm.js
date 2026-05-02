#!/usr/bin/env node
/**
 * Fix existing posts using the LOCAL LLM: SEO excerpts, tags, expand thin content.
 * Run where Ollama is available (LOCAL_LLM_URL). Use MONGODB_URI to point at your DB.
 *
 * Speed defaults: parallel waves (--concurrency), short wave delay, no sleep on unchanged posts.
 *
 *   node scripts/fix-all-posts-with-local-llm.js [limit] [--dry-run] [--skip-cve] [--distinct-title] [--rewrite-body]
 *
 * Examples:
 *   node scripts/fix-all-posts-with-local-llm.js 500 --dry-run
 *   node scripts/fix-all-posts-with-local-llm.js 100000 --distinct-title --keep-slug
 *   node scripts/fix-all-posts-with-local-llm.js 5000 --concurrency=12 --delay-ms=30 --skip-delay-ms=0
 *
 * Requires: Ollama running at LOCAL_LLM_URL (e.g. http://127.0.0.1:11434).
 */

const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Post = require('../models/Post');
require('../models/Category');
const localLlm = require('../services/local-llm');
const {
  getExcerpt,
  getTags,
  ensureMinimumContent,
  getUniqueSEOTitle,
  rewriteBodyDistinct,
} = require('../utils/llm-content-enhancer');
const { capExcerpt, stripJunkPhrases, MAX_EXCERPT_LENGTH } = require('../utils/clean-content-for-seo');
const { cleanSlugFromTitle } = require('../utils/content-quality-gate');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipCve = args.includes('--skip-cve');
const distinctTitleFlag = args.includes('--distinct-title');
const rewriteBodyFlag = args.includes('--rewrite-body');
const keepSlugFlag = args.includes('--keep-slug');

function parseEqArg(prefix, defaultVal) {
  const a = args.find(x => x.startsWith(prefix));
  if (!a) return defaultVal;
  const v = a.slice(prefix.length);
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

const delayMsArg = args.find(a => a.startsWith('--delay-ms='));
const parsedDelay = delayMsArg ? parseInt(delayMsArg.split('=')[1], 10) : NaN;
/** Pause after each parallel wave completes (ms). Default: fast. */
const WAVE_DELAY_MS = Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay : 50;
const SKIP_DELAY_MS = parseEqArg('--skip-delay-ms=', 0);
/**
 * Parallel posts per wave. Default = ceil(40% of logical CPUs), min 4, max 48.
 * Override with --concurrency=N. If Ollama times out, set CONCURRENCY lower or tune OLLAMA_NUM_PARALLEL.
 */
const cpuN = Math.max(1, (os.cpus() && os.cpus().length) || 4);
const DEFAULT_CONCURRENCY = Math.min(
  Math.max(Math.ceil(cpuN * 0.4), 4),
  48
);
const CONCURRENCY = Math.min(Math.max(parseEqArg('--concurrency=', DEFAULT_CONCURRENCY), 1), 48);

const limitArg = args.find(a => !a.startsWith('--'));
const LIMIT = Math.min(parseInt(limitArg || '100000', 10) || 100000, 200000);
const BATCH_SIZE = Math.max(CONCURRENCY * 4, 80);
const MAX_SLUG_LEN = 80;

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Case/whitespace-insensitive title compare (LLM often matches except casing). */
function normTitleKey(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '');
}

function normTextKey(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Process one post; safe to run in parallel with others (different _id).
 * @returns {Promise<{ skipped: boolean, deltas: object, logs: string[], err?: string }>}
 */
async function processOnePost(post) {
  const deltas = {
    fixedExcerpt: 0,
    fixedTags: 0,
    fixedContent: 0,
    fixedSlug: 0,
    fixedDistinctTitle: 0,
    fixedRewriteBody: 0,
  };
  const logs = [];

  try {
    const title = post.title || '';
    const content = post.content || '';
    const contentHtml = post.contentHtml || '';
    const currentExcerpt = (post.seo && post.seo.description) || post.excerpt || '';
    const currentTags = post.tags || [];
    const categorySlug = (post.category && post.category.slug) || '';
    const categoryName = (post.category && post.category.name) || '';
    const textLen = Math.max(content.length, stripHtml(contentHtml).length);

    let titleForPipeline = title;
    let bodyForPipeline = content;

    if (textLen < 450 && content && !rewriteBodyFlag) {
      try {
        const expanded = await ensureMinimumContent(title, content, 450);
        if (expanded && expanded.length > content.length) bodyForPipeline = expanded;
      } catch (e) {
        console.error('  Expand error', post.slug, e.message);
      }
    }

    if (rewriteBodyFlag) {
      try {
        const rw = await rewriteBodyDistinct(titleForPipeline, bodyForPipeline);
        if (rw && rw.length >= 200) bodyForPipeline = rw;
      } catch (e) {
        console.error('  Rewrite body error', post.slug, e.message);
      }
    }

    if (distinctTitleFlag) {
      try {
        const nu = await getUniqueSEOTitle(titleForPipeline, categoryName, bodyForPipeline);
        if (nu) {
          const capped =
            nu.length > 200 ? nu.substring(0, 200).replace(/\s+\S*$/, '') : nu;
          if (capped) titleForPipeline = capped;
        }
      } catch (e) {
        console.error('  Distinct title error', post.slug, e.message);
      }
    }

    let newExcerpt = null;
    let newTags = null;
    const newContent = bodyForPipeline !== content ? bodyForPipeline : null;
    const newTitle = titleForPipeline !== title ? titleForPipeline : null;
    let newSlug = null;

    try {
      const inputForExcerpt =
        (titleForPipeline ? titleForPipeline + '\n\n' : '') +
        stripHtml(contentHtml || bodyForPipeline).substring(0, 1200);
      newExcerpt = await getExcerpt(inputForExcerpt, MAX_EXCERPT_LENGTH);
      newExcerpt = newExcerpt ? capExcerpt(newExcerpt, MAX_EXCERPT_LENGTH) : null;
    } catch (e) {
      console.error('  Excerpt error', post.slug, e.message);
    }

    try {
      newTags = await getTags(titleForPipeline, bodyForPipeline, categorySlug);
      if (newTags && !Array.isArray(newTags)) newTags = [newTags];
    } catch (e) {
      console.error('  Tags error', post.slug, e.message);
    }

    if (!keepSlugFlag) {
      try {
        const suggested = await localLlm.suggestSlugForSEO(titleForPipeline);
        const baseSlug = (suggested && suggested.length >= 5)
          ? suggested.slice(0, MAX_SLUG_LEN).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
          : cleanSlugFromTitle(titleForPipeline);
        if (baseSlug && baseSlug !== post.slug) {
          let candidate = baseSlug;
          let suffix = 0;
          let existing = await Post.findOne({ slug: candidate, _id: { $ne: post._id } });
          while (existing) {
            suffix++;
            const base = baseSlug.replace(/-+$/, '');
            candidate = base + '-' + suffix;
            if (candidate.length > MAX_SLUG_LEN) candidate = candidate.slice(0, MAX_SLUG_LEN);
            existing = await Post.findOne({ slug: candidate, _id: { $ne: post._id } });
          }
          if (candidate !== post.slug) newSlug = candidate;
        }
      } catch (e) {
        console.error('  Slug error', post.slug, e.message);
      }
    }

    const needsExcerpt =
      newExcerpt && normTextKey(newExcerpt) !== normTextKey(currentExcerpt);
    const needsTags =
      newTags &&
      newTags.length > 0 &&
      JSON.stringify(newTags.slice(0, 10)) !== JSON.stringify((currentTags || []).slice(0, 10));
    const needsContent = newContent != null && newContent !== content;
    const needsTitle = newTitle != null && normTitleKey(newTitle) !== normTitleKey(title);
    const needsSlug = newSlug && newSlug !== post.slug;

    if (!needsExcerpt && !needsTags && !needsContent && !needsSlug && !needsTitle) {
      if (SKIP_DELAY_MS > 0) await sleep(SKIP_DELAY_MS);
      return { skipped: true, deltas, logs };
    }

    if (dryRun) {
      if (needsExcerpt) {
        deltas.fixedExcerpt = 1;
        logs.push(`[dry-run] Excerpt: ${post.slug}`);
      }
      if (needsTags) {
        deltas.fixedTags = 1;
        logs.push(`[dry-run] Tags: ${post.slug}`);
      }
      if (needsContent) {
        deltas.fixedContent = 1;
        if (rewriteBodyFlag) deltas.fixedRewriteBody = 1;
        logs.push(`[dry-run] Content: ${post.slug}`);
      }
      if (needsTitle) {
        deltas.fixedDistinctTitle = 1;
        logs.push(`[dry-run] Title: ${post.slug} -> ${newTitle}`);
      }
      if (needsSlug) {
        deltas.fixedSlug = 1;
        logs.push(`[dry-run] Slug: ${post.slug} -> ${newSlug}`);
      }
      return { skipped: false, deltas, logs };
    }

    const update = {};
    if (needsTitle) {
      update.title = newTitle;
      deltas.fixedDistinctTitle = 1;
      logs.push(`  Title: ${post.slug} -> ${newTitle.substring(0, 70)}${newTitle.length > 70 ? '…' : ''}`);
      if (post.thumbnail && post.thumbnail.url) {
        update['thumbnail.alt'] = newTitle.substring(0, 100);
      }
    }
    if (needsExcerpt) {
      update.excerpt = newExcerpt;
      if (post.seo && post.seo.description !== undefined) update['seo.description'] = newExcerpt;
      deltas.fixedExcerpt = 1;
      logs.push(`  Excerpt: ${post.slug}`);
    }
    if (needsTags) {
      update.tags = newTags.slice(0, 12);
      deltas.fixedTags = 1;
    }
    if (needsContent) {
      const cleaned = stripJunkPhrases(newContent);
      update.content = cleaned;
      const paragraphs = cleaned.split(/\n\n/).filter(p => p.trim());
      update.contentHtml = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
      deltas.fixedContent = 1;
      if (rewriteBodyFlag) deltas.fixedRewriteBody = 1;
      logs.push(`  Content: ${post.slug}`);
    }
    if (needsSlug) {
      update.slug = newSlug;
      deltas.fixedSlug = 1;
      logs.push(`  Slug: ${post.slug} -> ${newSlug} (301 from old)`);
    }

    const mongoUpdate = { $set: update };
    if (needsSlug) {
      mongoUpdate.$addToSet = { previousSlugs: post.slug };
    }
    await Post.updateOne({ _id: post._id }, mongoUpdate);

    return { skipped: false, deltas, logs };
  } catch (e) {
    return { skipped: false, deltas, logs: [], err: `${post.slug}: ${e.message}` };
  }
}

async function run() {
  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000 });
  console.log('Checking local LLM...');
  if (!(await localLlm.isAvailable())) {
    console.error('Local LLM is not available. Start Ollama at', process.env.LOCAL_LLM_URL || 'http://127.0.0.1:11434');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(
    'Local LLM OK. Processing up to',
    LIMIT,
    'posts.',
    dryRun ? '(dry-run)' : '',
    skipCve ? '(skip CVE)' : '',
    distinctTitleFlag ? '(distinct-title)' : '',
    rewriteBodyFlag ? '(rewrite-body)' : '',
    keepSlugFlag ? '(keep-slug)' : '',
    `(cpus=${cpuN} concurrency=${CONCURRENCY} wave-delay-ms=${WAVE_DELAY_MS} skip-delay-ms=${SKIP_DELAY_MS})`
  );
  console.log(
    'ETA: log file is under app root, e.g. logs/fix-all-posts.log — tail -f that file; ' +
      'or run from app root: bash scripts/fix-posts-rate.sh'
  );

  const query = { status: 'published', deleted: { $ne: true } };
  if (skipCve) query.slug = { $not: /^cve-/ };
  const total = await Post.countDocuments(query);
  console.log('Total posts matching:', total, '\n');
  if (!distinctTitleFlag) {
    console.log('⚠️  --distinct-title not set: headlines will NOT be rewritten (only excerpt/tags/slug pipeline).\n');
  }

  let processed = 0;
  let fixedExcerpt = 0;
  let fixedTags = 0;
  let fixedContent = 0;
  let fixedSlug = 0;
  let fixedDistinctTitle = 0;
  let fixedRewriteBody = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  while (processed < LIMIT) {
    const remaining = LIMIT - processed;
    const fetchN = Math.min(BATCH_SIZE, remaining);
    const posts = await Post.find(query)
      .populate('category', 'slug name')
      .sort({ publishedAt: -1 })
      .skip(offset)
      .limit(fetchN)
      .lean();

    if (posts.length === 0) break;

    for (let w = 0; w < posts.length; w += CONCURRENCY) {
      if (processed >= LIMIT) break;
      const room = LIMIT - processed;
      const wave = posts.slice(w, w + Math.min(CONCURRENCY, room));
      if (wave.length === 0) break;
      const results = await Promise.all(wave.map(p => processOnePost(p)));

      for (let i = 0; i < results.length; i++) {
        processed++;
        const r = results[i];
        if (r.err) {
          errors++;
          console.error('  Error:', r.err);
        }
        if (r.skipped) {
          skipped++;
        } else {
          fixedExcerpt += r.deltas.fixedExcerpt;
          fixedTags += r.deltas.fixedTags;
          fixedContent += r.deltas.fixedContent;
          fixedSlug += r.deltas.fixedSlug;
          fixedDistinctTitle += r.deltas.fixedDistinctTitle;
          fixedRewriteBody += r.deltas.fixedRewriteBody;
        }
        for (const line of r.logs) console.log(line);
      }

      if (WAVE_DELAY_MS > 0 && w + CONCURRENCY < posts.length && processed < LIMIT) {
        await sleep(WAVE_DELAY_MS);
      }
    }

    if (processed % 500 === 0 && processed > 0) {
      console.log(
        `  ... ${processed} posts examined — ${skipped} no DB write (LLM output matched stored fields; normal on re-runs), ${errors} errors`
      );
    }

    offset += posts.length;
    if (posts.length < fetchN) break;
  }

  console.log('\nDone.');
  console.log('  Processed:', processed);
  console.log('  Excerpts improved:', fixedExcerpt);
  console.log('  Tags improved:', fixedTags);
  console.log('  Thin content expanded:', fixedContent);
  console.log('  Slugs improved (301 from old):', fixedSlug);
  console.log('  Distinct titles (LLM):', fixedDistinctTitle);
  console.log('  Body rewrites (LLM):', fixedRewriteBody);
  console.log('  No DB write (matched already):', skipped);
  console.log('  Errors:', errors);
  console.log(
    '\n"No DB write" = excerpt/tags/title after LLM equals what is already stored (expected on a 2nd full pass). ' +
      'If Distinct titles stayed 0, use lower CONCURRENCY (e.g. 8) and deploy latest local-llm.js (retries + no bogus word-overlap reject).'
  );
  if (dryRun && (fixedExcerpt || fixedTags || fixedContent || fixedSlug || fixedDistinctTitle || fixedRewriteBody)) {
    console.log('\nRun without --dry-run to apply.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
