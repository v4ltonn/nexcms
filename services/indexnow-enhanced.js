const fs = require('fs');
const path = require('path');
const https = require('https');

// All search engines that support IndexNow protocol
// Note: indexnow.org is not a search engine, it's the protocol spec site
// Seznam.cz may require registration or have different requirements
const SEARCH_ENGINES = [
  'https://www.bing.com',      // ✅ Active - Microsoft Bing
  'https://yandex.com',        // ✅ Active - Yandex
  // 'https://www.seznam.cz',  // ⚠️ May require registration
  // 'https://indexnow.org'    // Not a search engine (protocol spec only)
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const { statusCode } = res;
      // Drain and ignore body
      res.resume();
      resolve({ statusCode, headers: res.headers });
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
      results.push({ 
        engine: engine.replace('https://', '').replace('www.', ''), 
        statusCode: res.statusCode,
        success: res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 204
      });
    } catch (error) {
      results.push({ 
        engine: engine.replace('https://', '').replace('www.', ''), 
        error: error.message || 'request_failed',
        success: false
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  return { 
    ok: successCount > 0, 
    results,
    successCount,
    totalEngines: SEARCH_ENGINES.length
  };
}

// Submit multiple URLs at once (batch submission)
async function submitUrls(urls) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { ok: false, error: 'INDEXNOW_KEY missing' };
  ensureKeyFile();

  const results = [];
  
  // IndexNow supports batch submission via POST with JSON
  const batchData = {
    host: process.env.SITE_HOST || '${process.env.SITE_DOMAIN || 'localhost'}',
    key: key,
    urlList: urls
  };

  for (const engine of SEARCH_ENGINES) {
    const endpoint = `${engine}/indexnow`;
    try {
      const data = JSON.stringify(batchData);
      const url = new URL(endpoint);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        },
        timeout: 30000
      };

      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            resolve({ 
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseData
            });
          });
        });
        
        req.on('error', reject);
        req.setTimeout(30000, () => {
          req.destroy(new Error('timeout'));
        });
        
        req.write(data);
        req.end();
      });

      results.push({
        engine: engine.replace('https://', '').replace('www.', ''),
        statusCode: result.statusCode,
        success: result.statusCode === 200 || result.statusCode === 202 || result.statusCode === 204,
        urlsSubmitted: urls.length
      });
    } catch (error) {
      results.push({
        engine: engine.replace('https://', '').replace('www.', ''),
        error: error.message || 'request_failed',
        success: false,
        urlsSubmitted: 0
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  return {
    ok: successCount > 0,
    results,
    successCount,
    totalEngines: SEARCH_ENGINES.length,
    urlsSubmitted: urls.length
  };
}

module.exports = {
  submitUrl,
  submitUrls,
  SEARCH_ENGINES
};


