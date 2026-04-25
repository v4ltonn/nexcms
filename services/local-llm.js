/**
 * Local LLM integration — 100% on your machine. No API keys. No cloud.
 *
 * Talks only to a process on localhost (e.g. Ollama at 127.0.0.1:11434).
 * If the local server is not running, all functions fall back gracefully (no external calls).
 *
 * Security: we only allow baseUrl that resolve to localhost/127.0.0.1.
 */

const DEFAULT_LOCAL_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2';
const REQUEST_TIMEOUT_MS = 30000;

/** Timeout without AbortSignal.timeout (some Node/fetch builds reject non-standard signals). */
function withTimeout(ms, label = 'timeout') {
  return new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms));
}

function getBaseUrl() {
  const url = (process.env.LOCAL_LLM_URL || DEFAULT_LOCAL_URL).trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') return null;
    return url.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Short TTL cache: bulk scripts call isAvailable() many times per post (excerpt, tags, …). */
let _availCache = { until: 0, ok: false };

/**
 * Check if local LLM is available (no outbound call to internet).
 */
async function isAvailable() {
  const now = Date.now();
  if (now < _availCache.until) return _availCache.ok;
  const base = getBaseUrl();
  if (!base) {
    _availCache = { until: now + 2000, ok: false };
    return false;
  }
  try {
    const res = await Promise.race([
      fetch(`${base}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
      withTimeout(4000, 'llm_probe_timeout'),
    ]);
    const ok = res.ok;
    // Success: cache longer (fewer /api/tags hits). Failure: retry sooner.
    _availCache = { until: now + (ok ? 15000 : 800), ok };
    return ok;
  } catch {
    _availCache = { until: now + 800, ok: false };
    return false;
  }
}

function sleepMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Single attempt (no retry). */
async function generateOnce(prompt, options = {}) {
  const base = getBaseUrl();
  if (!base) return null;
  const model = options.model || process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 300;
  try {
    const res = await Promise.race([
      fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { num_predict: maxTokens },
        }),
      }),
      withTimeout(REQUEST_TIMEOUT_MS, 'llm_generate_timeout'),
    ]);
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.response || '').trim();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Generate completion from local LLM. No API key. Local only.
 * Retries a few times on timeout/empty (bulk jobs + high concurrency often hit transient failures).
 * @param {string} prompt
 * @param {{ model?: string, maxTokens?: number, retries?: number }} options  retries = extra attempts after first (default 2)
 * @returns {Promise<string|null>} Response text or null on failure
 */
async function generate(prompt, options = {}) {
  const extra = options.retries !== undefined ? options.retries : 2;
  const attempts = 1 + Math.max(0, Math.min(extra, 5));
  let out = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleepMs(180 * i);
    out = await generateOnce(prompt, options);
    if (out) return out;
  }
  return null;
}

/**
 * SEO-optimized meta description / excerpt.
 * Rules: 150–160 chars, unique phrasing, main topic + reason to click, active voice, no copy-paste from source.
 */
const SEO_EXCERPT_INSTRUCTION = `You are an SEO copywriter. Write exactly ONE meta description for this article.
Rules: 150-160 characters total. Include the main topic and one reason to click. Use active voice. Write in your own words—do not copy sentences from the text. No quotes, no "Description:" label. Output only the meta description.`;

/**
 * Use local LLM to write a short SEO excerpt (maxLength chars). Returns null if LLM unavailable.
 */
async function improveExcerpt(rawText, maxLength = 160) {
  const text = (rawText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const prompt = `${SEO_EXCERPT_INSTRUCTION}\n\nArticle text:\n${text.slice(0, 1000)}`;
  const out = await generate(prompt, { maxTokens: 120 });
  if (!out) return null;
  const cleaned = out.replace(/^["']|["']$/g, '').replace(/^(Description|Summary|Meta):\s*/i, '').trim();
  return cleaned.length > 0 && cleaned.length <= maxLength + 20 ? cleaned.slice(0, maxLength) : null;
}

/**
 * Use local LLM to suggest SEO-relevant tags (search keywords). Returns null if LLM unavailable.
 */
async function suggestTags(title, content, maxTags = 8) {
  const titleStr = (title || '').trim();
  const contentStr = (content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!titleStr) return null;
  const prompt = `You are an SEO specialist. From this article title and excerpt, suggest 6-8 relevant search keywords as tags. Output only a comma-separated list of lowercase tags, no numbers. Focus on terms people actually search for.\n\nTitle: ${titleStr}\n\nExcerpt: ${contentStr}`;
  const out = await generate(prompt, { maxTokens: 100 });
  if (!out) return null;
  const tags = out
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 1 && t.length < 30);
  return tags.length > 0 ? tags.slice(0, maxTags) : null;
}

/**
 * Use local LLM to turn thin content into a 2–3 sentence original summary (for body). Returns null if LLM unavailable.
 * Written in own words for E-E-A-T; no copy-paste from source.
 */
async function expandThinSummary(title, rawContent) {
  const text = (rawContent || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 400) return null;
  const prompt = `You are a factual editor. Expand this short text into 2-3 clear, original sentences that summarize the topic. Write in your own words—do not copy phrases from the source. Output only the summary, no labels or titles.\n\nTitle: ${(title || '').slice(0, 200)}\n\nShort text: ${text.slice(0, 500)}`;
  const out = await generate(prompt, { maxTokens: 200 });
  return out && out.length > 50 ? out.trim() : null;
}

/**
 * Suggest a short SEO-friendly URL slug from the title (3–8 words, lowercase, hyphenated). Returns null if LLM unavailable.
 */
async function suggestSlugForSEO(title) {
  const titleStr = (title || '').trim().slice(0, 200);
  if (!titleStr) return null;
  const prompt = `Convert this article title into a short URL slug: 3-8 words, lowercase, hyphenated. No numbers or dates. Only the slug, nothing else.\nTitle: ${titleStr}`;
  const out = await generate(prompt, { maxTokens: 60 });
  if (!out) return null;
  const slug = out
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.length >= 5 && slug.length <= 80 ? slug : null;
}

function normalizeHeadlineForCompare(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rewrite headline so it is not a near-duplicate of syndicated titles (helps GSC "duplicate" clusters).
 * Retries once if the model echoes the original (common on small models under load).
 */
async function uniqueSEOTitle(originalTitle, categoryHint, contentSnippet) {
  const t = (originalTitle || '').trim().slice(0, 200);
  const ctx = (contentSnippet || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700);
  if (!t) return null;

  const cat = (categoryHint || 'news').slice(0, 40);

  const cleanLine = (raw) => {
    if (!raw) return null;
    let line = raw.split('\n')[0].replace(/^["']|["']$/g, '').replace(/^(title|headline):\s*/i, '').trim();
    if (line.length < 10 || line.length > 200) return null;
    if (/nexcms/i.test(line)) line = line.replace(/\s*[-–|]\s*NexCMS.*$/i, '').trim();
    return line.length >= 10 ? line : null;
  };

  // Only reject exact echo (normalized). Do NOT use word-overlap — same story must keep entity names.
  const tryAccept = (candidate) => {
    const line = cleanLine(candidate);
    if (!line) return null;
    if (normalizeHeadlineForCompare(line) === normalizeHeadlineForCompare(t)) return null;
    return line.length > 200 ? line.slice(0, 200).replace(/\s+\S*$/, '') : line;
  };

  const prompt1 = `You write headlines for NexCMS (tech / cybersecurity / gaming / tools news).

Rewrite the headline below for the SAME story. Rules:
- Use clearly different wording and sentence structure than Original (not a one-word change).
- Do NOT output the Original text or a trivial paraphrase (at least ~40% different words).
- Max 120 characters. No site name. No ALL CAPS. No quotes.
- Output only one line: the new headline.

Category: ${cat}
Original: ${t}
Context: ${ctx || '(none)'}`;

  let out = await generate(prompt1, { maxTokens: 140 });
  let accepted = tryAccept(out);
  if (accepted) return accepted;

  const prompt2 = `Your last headline was too similar to the original. Write a NEW headline for the same news story.

STRICT: The new headline must use different keywords and structure than this text (case-insensitive): "${t.slice(0, 160)}"

Category: ${cat}
One line only, max 120 characters, no quotes:`;

  out = await generate(prompt2, { maxTokens: 140 });
  accepted = tryAccept(out);
  return accepted;
}

/**
 * Rewrite article body in original words (reduces near-duplicate body text vs RSS source).
 */
async function rewriteBodyDistinct(title, bodyText, maxChars = 2200) {
  const plain = (bodyText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1600);
  if (plain.length < 80) return null;
  const prompt = `You are an editor for NexCMS. Rewrite the following article body in your own words: same facts, new sentences and paragraph order. No markdown. No "Introduction:" label. 3–5 short paragraphs, plain text separated by blank lines. Do not copy phrases from the source.

Title: ${(title || '').slice(0, 180)}

Source-style text:
${plain}`;
  const out = await generate(prompt, { maxTokens: 500 });
  if (!out || out.length < 200) return null;
  const cleaned = out.replace(/\r\n/g, '\n').trim();
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars).replace(/\s+\S*$/, '') : cleaned;
}

module.exports = {
  getBaseUrl,
  isAvailable,
  generate,
  improveExcerpt,
  suggestTags,
  expandThinSummary,
  suggestSlugForSEO,
  uniqueSEOTitle,
  rewriteBodyDistinct,
  DEFAULT_LOCAL_URL,
  DEFAULT_MODEL,
};
