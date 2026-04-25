/**
 * Optional content enhancement using a LOCAL LLM only (no API keys, no cloud).
 *
 * If LOCAL_LLM_URL is set to a localhost address and Ollama (or similar) is running,
 * we use it to improve excerpts, tags, and thin content. Otherwise we use
 * the existing rule-based content-optimizer. No external APIs are ever called.
 */

const {
  generateExcerpt,
  extractTags,
  generateMetaDescription,
} = require('./content-optimizer');
const localLlm = require('../services/local-llm');
const { capExcerpt } = require('./clean-content-for-seo');

/**
 * Get best excerpt: try local LLM first if available, else rule-based.
 * @param {string} content - Raw or HTML content
 * @param {number} maxLength - Target length (default 160)
 * @returns {Promise<string>}
 */
async function getExcerpt(content, maxLength = 160) {
  let result;
  if (await localLlm.isAvailable()) {
    const improved = await localLlm.improveExcerpt(content, maxLength);
    result = improved || generateExcerpt(content, maxLength);
  } else {
    result = generateExcerpt(content, maxLength);
  }
  return capExcerpt(result, maxLength);
}

/**
 * Get best tags: try local LLM first if available, else rule-based.
 * @param {string} title
 * @param {string} content
 * @param {string} categorySlug
 * @returns {Promise<string[]>}
 */
async function getTags(title, content, categorySlug) {
  if (await localLlm.isAvailable()) {
    const suggested = await localLlm.suggestTags(title, content, 10);
    if (suggested && suggested.length > 0) {
      const fromRules = extractTags(title, content, categorySlug);
      const combined = [...new Set([...suggested, ...fromRules])].slice(0, 10);
      return combined;
    }
  }
  return extractTags(title, content, categorySlug);
}

/**
 * If content is thin (< minChars), try to expand with local LLM. Otherwise return original.
 * @param {string} title
 * @param {string} content
 * @param {number} minChars - Consider "thin" below this (default 400)
 * @returns {Promise<string>}
 */
async function ensureMinimumContent(title, content, minChars = 400) {
  const plain = (content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length >= minChars) return content;
  if (await localLlm.isAvailable()) {
    const expanded = await localLlm.expandThinSummary(title, content);
    if (expanded) {
      const withOriginal = (content || '').trim() + '\n\n' + expanded;
      return withOriginal;
    }
  }
  return content;
}

/**
 * Distinct SEO headline (local LLM only). Returns null if unavailable.
 */
async function getUniqueSEOTitle(originalTitle, categoryHint, contentSnippet) {
  if (!(await localLlm.isAvailable())) return null;
  const t = await localLlm.uniqueSEOTitle(originalTitle, categoryHint, contentSnippet);
  return t || null;
}

/**
 * Full body rewrite in original words (local LLM). Returns null if unavailable / too short.
 */
async function rewriteBodyDistinct(title, bodyText, maxChars = 2200) {
  if (!(await localLlm.isAvailable())) return null;
  return localLlm.rewriteBodyDistinct(title, bodyText, maxChars);
}

/**
 * Get meta description (150–160 chars). Uses excerpt; no LLM call for meta.
 */
function getMetaDescription(title, excerpt, tags) {
  return generateMetaDescription(title, excerpt, tags);
}

module.exports = {
  getExcerpt,
  getTags,
  ensureMinimumContent,
  getUniqueSEOTitle,
  rewriteBodyDistinct,
  getMetaDescription,
};
