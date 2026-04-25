const CATEGORY_PREFIXES = {
  tech: 'Tech',
  cyber: 'Cyber',
  crypto: 'Crypto',
  gaming: 'Gaming',
  tools: 'Tools',
  default: 'Report'
};

function makeDistinctTitle(title, categorySlug) {
  const base = (title || '').trim();
  if (!base) return title;

  const prefix = CATEGORY_PREFIXES[categorySlug] || CATEGORY_PREFIXES.default;
  const lowerBase = base.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();

  if (
    lowerBase.startsWith(`${lowerPrefix}:`) ||
    lowerBase.startsWith(`${lowerPrefix} -`) ||
    lowerBase.startsWith('nexcms')
  ) {
    return base;
  }

  const candidate = `${prefix}: ${base}`;
  if (candidate.length > 200) {
    return `${candidate.substring(0, 197)}...`;
  }

  return candidate;
}

module.exports = { makeDistinctTitle };
