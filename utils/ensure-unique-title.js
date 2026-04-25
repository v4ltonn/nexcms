const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function ensureUniqueTitle(Post, title, options = {}) {
  const baseTitle = (title || '').trim();
  if (!baseTitle) return title;

  const maxAttempts = options.maxAttempts || 20;
  const suffixLabel = options.suffixLabel || 'Update';

  let candidate = baseTitle;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    const exists = await Post.exists({
      title: new RegExp(`^${escapeRegex(candidate)}$`, 'i')
    });

    if (!exists) {
      return candidate;
    }

    attempt += 1;
    candidate = `${baseTitle} (${suffixLabel} ${attempt})`;
  }

  return `${baseTitle} (${suffixLabel} ${Date.now()})`;
}

module.exports = { ensureUniqueTitle };
