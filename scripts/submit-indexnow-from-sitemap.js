require('dotenv').config();
const https = require('https');
const { submitUrl } = require('../services/indexnow');

// Parse XML and extract URLs
function parseSitemap(xml) {
  const urls = [];
  const urlPattern = /<loc>(.*?)<\/loc>/g;
  let match;
  
  while ((match = urlPattern.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
}

// Fetch sitemap from live site
function fetchSitemap(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const sitemapUrl = process.env.SITEMAP_URL || '${process.env.SITE_URL || 'http://localhost:3000'}/sitemap.xml';
  
  console.log(`Fetching sitemap from ${sitemapUrl}...`);
  
  try {
    const sitemapXml = await fetchSitemap(sitemapUrl);
    const urls = parseSitemap(sitemapXml);
    
    console.log(`Found ${urls.length} URLs in sitemap`);
    console.log(`Submitting to IndexNow...`);
    
    let success = 0;
    let failed = 0;
    
    for (const url of urls) {
      try {
        const res = await submitUrl(url);
        if (res.ok) {
          success += 1;
          console.log(`✓ ${url}`);
        } else {
          failed += 1;
          console.log(`✗ ${url} - ${res.error || 'failed'}`);
        }
        // Gentle pacing to avoid overwhelming the API
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        failed += 1;
        console.log(`✗ ${url} - ${e.message}`);
      }
    }
    
    console.log(`\nDone! Submitted: ${success}/${urls.length} successful, ${failed} failed`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});




