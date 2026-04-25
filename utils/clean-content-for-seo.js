/**
 * Shared content cleanup for SEO/quality: junk phrases and excerpt length.
 * Used by fetchers (before save), quality check script, and fix scripts.
 */

const MAX_EXCERPT_LENGTH = 160;

// Same list as scripts/check-content-quality-prod.js – keep in sync
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

/**
 * Remove junk phrases from text (content or HTML string). Case-insensitive.
 * @param {string} str
 * @returns {string}
 */
function stripJunkPhrases(str) {
  if (!str || typeof str !== 'string') return str;
  let out = str;
  for (const phrase of JUNK_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi');
    out = out.replace(re, ' ').replace(/\s+/g, ' ').trim();
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Cap excerpt to maxLen for meta description (SEO). Prefer word boundary.
 * @param {string} excerpt
 * @param {number} maxLen
 * @returns {string}
 */
function capExcerpt(excerpt, maxLen = MAX_EXCERPT_LENGTH) {
  if (!excerpt || typeof excerpt !== 'string') return excerpt;
  const t = excerpt.trim();
  if (t.length <= maxLen) return t;
  const truncated = t.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) return truncated.substring(0, lastSpace).trim();
  return truncated.trim();
}

/**
 * Check if text contains any junk phrase (for reporting).
 * @param {string} content
 * @param {string} contentHtml
 * @returns {boolean}
 */
function hasJunk(content, contentHtml) {
  const combined = `${content || ''} ${contentHtml || ''}`.toLowerCase();
  return JUNK_PHRASES.some(phrase => combined.includes(phrase.toLowerCase()));
}

module.exports = {
  JUNK_PHRASES,
  MAX_EXCERPT_LENGTH,
  stripJunkPhrases,
  capExcerpt,
  hasJunk,
};
