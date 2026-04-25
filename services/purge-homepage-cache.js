/**
 * Purge Cloudflare cache for homepage and homepage API so new/updated posts show.
 * Call after: post create (published), post update (published), post soft-delete.
 * Fire-and-forget; does not block. Requires CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN.
 */
const https = require('https');

const BASE = '${process.env.SITE_URL || 'http://localhost:3000'}';
const PURGE_URLS = [`${BASE}/`, `${BASE}/api/posts/homepage`];

function purgeHomepageCache() {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!zoneId || !token) {
    return;
  }
  const body = JSON.stringify({ files: PURGE_URLS });
  const req = https.request(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    },
    (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.success) {
            console.log('[Purge] Homepage cache purged (/, /api/posts/homepage)');
          }
        } catch (_) {}
      });
    }
  );
  req.on('error', () => {});
  req.setTimeout(5000, () => req.destroy());
  req.write(body);
  req.end();
}

module.exports = { purgeHomepageCache };
