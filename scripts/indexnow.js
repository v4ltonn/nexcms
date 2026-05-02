const fs = require('fs');
const path = require('path');
const https = require('https');

// Engines that support IndexNow
const SEARCH_ENGINES = [
  'https://www.bing.com',
  'https://yandex.com'
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const { statusCode } = res;
      // Drain and ignore body
      res.resume();
      resolve({ statusCode });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

function ensureKeyFile() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    throw new Error('INDEXNOW_KEY is not set');
  }
  const publicDir = path.join(__dirname, '..', 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const keyFile = path.join(publicDir, `${key}.txt`);
  try {
    if (!fs.existsSync(keyFile)) {
      fs.writeFileSync(keyFile, key, { encoding: 'utf8' });
    }
  } catch (e) {
    // Best-effort; do not throw so submit can proceed
  }
  return keyFile;
}

async function submitUrl(url) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { ok: false, error: 'INDEXNOW_KEY missing' };
  ensureKeyFile();

  const results = [];
  for (const engine of SEARCH_ENGINES) {
    const endpoint = `${engine}/indexnow?url=${encodeURIComponent(url)}&key=${encodeURIComponent(key)}`;
    try {
      const res = await httpGet(endpoint);
      results.push({ engine, statusCode: res.statusCode });
    } catch (error) {
      results.push({ engine, error: error.message || 'request_failed' });
    }
  }
  return { ok: true, results };
}

module.exports = {
  submitUrl
};





