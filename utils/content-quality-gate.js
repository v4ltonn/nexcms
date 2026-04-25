/**
 * Content quality gate – use in fetchers to avoid creating LOW_DEMAND / thin posts.
 * Call before saving a new post; skip or save as draft if gate fails.
 */

const DEFAULT_MIN_CONTENT_LENGTH = 450;
const DEFAULT_MIN_EXCERPT_LENGTH = 80;
const DEFAULT_MAX_EXCERPT_LENGTH = 160;
const MAX_SLUG_LENGTH = 80;

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Plain-text length of post body (from content or contentHtml).
 */
function getContentLength(content, contentHtml) {
  const raw = (content || '').trim();
  const fromHtml = stripHtml(contentHtml || '');
  return Math.max(raw.length, fromHtml.length);
}

/**
 * Check if post has enough body content (avoids thin content that gets LOW_DEMAND).
 * @param {string} content
 * @param {string} contentHtml
 * @param {number} minLength
 * @returns {{ ok: boolean, length: number, reason?: string }}
 */
function minContentLength(content, contentHtml, minLength = DEFAULT_MIN_CONTENT_LENGTH) {
  const length = getContentLength(content, contentHtml);
  if (length < minLength) {
    return { ok: false, length, reason: `Content too short (${length} < ${minLength} chars)` };
  }
  return { ok: true, length };
}

/**
 * Check excerpt length (for meta/SEO): min and max.
 */
function minExcerptLength(excerpt, minLength = DEFAULT_MIN_EXCERPT_LENGTH) {
  const len = (excerpt || '').trim().length;
  if (len < minLength) {
    return { ok: false, length: len, reason: `Excerpt too short (${len} < ${minLength} chars)` };
  }
  return { ok: true, length: len };
}

/**
 * Check excerpt not over max (SEO meta description ~160).
 */
function excerptNotOverMax(excerpt, maxLength = DEFAULT_MAX_EXCERPT_LENGTH) {
  const len = (excerpt || '').trim().length;
  if (len > maxLength) {
    return { ok: false, length: len, reason: `Excerpt too long (${len} > ${maxLength} chars)` };
  }
  return { ok: true, length: len };
}

/**
 * Title should not end with "..." (looks truncated / low quality).
 */
function titleNotTruncated(title) {
  const t = (title || '').trim();
  if (t.endsWith('...')) {
    return { ok: false, reason: 'Title is truncated (...)' };
  }
  return { ok: true };
}

/**
 * Slug should ideally not be a long timestamp suffix (e.g. -1767123456789).
 * Detects common pattern: ends with - and digits (10+).
 */
function slugHasNoTimestampSuffix(slug) {
  const s = (slug || '').trim();
  if (/-\d{10,}\d*$/.test(s)) {
    return { ok: false, reason: 'Slug has timestamp/ID suffix (looks low-quality)' };
  }
  return { ok: true };
}

/**
 * Slug length cap (long slugs are ugly and can look spammy).
 */
function slugLengthOk(slug, maxLen = MAX_SLUG_LENGTH) {
  const len = (slug || '').length;
  if (len > maxLen) {
    return { ok: false, length: len, reason: `Slug too long (${len} > ${maxLen})` };
  }
  return { ok: true, length: len };
}

/**
 * Run full quality gate. Use before Post.save() in fetchers.
 * @param {Object} opts - { title, content, contentHtml, excerpt, slug }
 * @param {Object} options - { minContentLength (number), minExcerptLength, requireNoTimestampSlug, requireNoTruncatedTitle }
 * @returns {{ pass: boolean, errors: string[] }}
 */
function runQualityGate(opts, options = {}) {
  const {
    minContentLength: minContentLen = DEFAULT_MIN_CONTENT_LENGTH,
    minExcerptLength: minExcerptLen = DEFAULT_MIN_EXCERPT_LENGTH,
    requireNoTimestampSlug = true,
    requireNoTruncatedTitle = true,
  } = options;

  const errors = [];

  const contentCheck = minContentLength(opts.content, opts.contentHtml, minContentLen);
  if (!contentCheck.ok) errors.push(contentCheck.reason);

  if (opts.excerpt != null) {
    const excerptCheck = minExcerptLength(opts.excerpt, minExcerptLen);
    if (!excerptCheck.ok) errors.push(excerptCheck.reason);
    const excerptMaxCheck = excerptNotOverMax(opts.excerpt, options.maxExcerptLength ?? DEFAULT_MAX_EXCERPT_LENGTH);
    if (!excerptMaxCheck.ok) errors.push(excerptMaxCheck.reason);
  }

  if (requireNoTruncatedTitle) {
    const titleCheck = titleNotTruncated(opts.title);
    if (!titleCheck.ok) errors.push(titleCheck.reason);
  }

  if (opts.slug != null && requireNoTimestampSlug) {
    const slugCheck = slugHasNoTimestampSuffix(opts.slug);
    if (!slugCheck.ok) errors.push(slugCheck.reason);
  }

  if (opts.slug != null) {
    const lenCheck = slugLengthOk(opts.slug);
    if (!lenCheck.ok) errors.push(lenCheck.reason);
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

/**
 * Suggest a clean slug (no timestamp). Truncate to maxLen at word boundary.
 */
function cleanSlugFromTitle(title, maxLen = MAX_SLUG_LENGTH) {
  if (!title || typeof title !== 'string') return '';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug.length <= maxLen) return slug;
  const truncated = slug.substring(0, maxLen);
  const lastDash = truncated.lastIndexOf('-');
  return lastDash > maxLen * 0.6 ? truncated.substring(0, lastDash) : truncated;
}

module.exports = {
  getContentLength,
  minContentLength,
  minExcerptLength,
  excerptNotOverMax,
  titleNotTruncated,
  slugHasNoTimestampSuffix,
  slugLengthOk,
  runQualityGate,
  cleanSlugFromTitle,
  DEFAULT_MIN_CONTENT_LENGTH,
  DEFAULT_MIN_EXCERPT_LENGTH,
  DEFAULT_MAX_EXCERPT_LENGTH,
  MAX_SLUG_LENGTH,
};
