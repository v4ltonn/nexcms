const express = require('express');
const path = require('path');
const Post = require('../models/Post');
const Category = require('../models/Category');

const router = express.Router();

// Helper function to escape XML entities in URLs
function escapeXmlUrl(url) {
  if (!url) return '';
  return String(url)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// lastmod in full ISO format with timezone (indeksonline/WordPress style)
function lastmodIso(d) {
  const date = d ? new Date(d) : new Date();
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

// generated-on comment (indeksonline style)
function generatedOnComment() {
  const now = new Date();
  const str = now.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  return `<!-- generated-on='${str}' -->`;
}

// Posts per sitemap file (indeksonline-style rotation; spec allows up to 50,000)
const POSTS_PER_SITEMAP = 2000;

// WordPress-style: sitemap.xml is the sitemap INDEX – lists all child sitemaps (rotated post sitemaps when many posts)
// Format matches indeksonline.net; index updates dynamically so new post sitemaps appear as content grows
router.get('/sitemap.xml', async (req, res) => {
  try {
    const lastmod = lastmodIso();
    const postCount = await Post.countDocuments({ status: 'published', deleted: { $ne: true } });
    const numPostSitemaps = Math.max(1, Math.ceil(postCount / POSTS_PER_SITEMAP));

    let sitemapIndex = `<?xml version='1.0' encoding='UTF-8'?>
${generatedOnComment()}
<sitemapindex xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/siteindex.xsd' xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>\t<sitemap>
\t\t<loc>${escapeXmlUrl(canonicalBase + '/sitemap-pages.xml')}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t</sitemap>
\t<sitemap>
\t\t<loc>${escapeXmlUrl(canonicalBase + '/sitemap-categories.xml')}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t</sitemap>`;

    for (let i = 1; i <= numPostSitemaps; i++) {
      const filename = i === 1 ? 'sitemap-posts.xml' : `sitemap-posts${i}.xml`;
      sitemapIndex += `
\t<sitemap>
\t\t<loc>${escapeXmlUrl(canonicalBase + '/' + filename)}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t</sitemap>`;
    }
    sitemapIndex += `
</sitemapindex>`;

    res.set({
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600'
    });
    res.send(sitemapIndex);
  } catch (err) {
    console.error('Error generating sitemap index:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// Static pages only (home, tools, image-to-pdf) – like WordPress "pages" sitemap
router.get('/sitemap-pages.xml', (req, res) => {
  const lastmod = lastmodIso();
  const sitemap = `<?xml version='1.0' encoding='UTF-8'?>
${generatedOnComment()}
<urlset xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd' xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>\t<url>
\t\t<loc>${escapeXmlUrl(canonicalBase + '/')}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t\t<changefreq>daily</changefreq>
\t\t<priority>1.0</priority>
\t</url>
\t<url>
\t\t<loc>${escapeXmlUrl(canonicalBase + '/tools')}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t\t<changefreq>weekly</changefreq>
\t\t<priority>0.9</priority>
\t</url>
\t<url>
\t\t<loc>${escapeXmlUrl(canonicalBase + '/image-to-pdf')}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t\t<changefreq>monthly</changefreq>
\t\t<priority>0.8</priority>
\t</url>
</urlset>`;

  res.set({
    'Content-Type': 'application/xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600'
  });
  res.send(sitemap);
});

// Canonical domain for <loc> URLs in sitemaps (all point to main site)
const CANONICAL_DOMAIN = process.env.CANONICAL_DOMAIN || '${process.env.SITE_DOMAIN || 'localhost'}';
const canonicalBase = `https://${CANONICAL_DOMAIN}`;

// When served from an alias domain (e.g. albaniavpn.net), point Sitemap to this host so crawlers fetch sitemap here
function getSitemapBaseUrl(req) {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  const aliasDomains = (process.env.SITEMAP_ALIAS_DOMAINS || 'albaniavpn.net').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  if (aliasDomains.includes(host)) return `https://${host}`;
  return canonicalBase;
}

// Generate robots.txt
// Note: Cloudflare may inject Content-signal directives. Disable this in Cloudflare dashboard:
// Rules → Transform Rules → Disable robots.txt modification
router.get('/robots.txt', (req, res) => {
  const base = getSitemapBaseUrl(req);
  const robots = `User-agent: *
Allow: /

User-agent: AdsBot-Google
Allow: /

User-agent: Googlebot-Image
Allow: /

# Sitemaps (sitemap.xml is the index; it lists pages, categories, posts)
Sitemap: ${base}/sitemap.xml

# RSS Feeds
Sitemap: ${canonicalBase}/feed.xml
Sitemap: ${canonicalBase}/feed/cve.xml

# Allow all crawlers to access content and API
Allow: /
Allow: /posts/
Allow: /category/
Allow: /tools
Allow: /image-to-pdf
Allow: /ssl-checker
Allow: /qr-generator
Allow: /cve-search
Allow: /sigma-to-kql-converter
Allow: /css/
Allow: /js/
Allow: /favicon.ico
Allow: /uploads/
Allow: /api/posts/

# Only disallow admin areas
Disallow: /admin/
Disallow: /api/admin/`;

  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=300',
    'X-Served-By': 'app'  // so we can confirm response is from Node, not nginx/static
  });

  res.send(robots);
});

// Generate category-specific sitemaps
router.get('/sitemap-categories.xml', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: { $ne: false } });
    const lastmod = lastmodIso();
    const total = categories.length;
    let sitemap = `<?xml version='1.0' encoding='UTF-8'?>
${generatedOnComment()}
<urlset xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd' xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>`;

    categories.forEach(category => {
      const categoryUrl = `${canonicalBase}/category/${category.slug}`;
      sitemap += `
\t<url>
\t\t<loc>${escapeXmlUrl(categoryUrl)}</loc>
\t\t<lastmod>${lastmod}</lastmod>
\t\t<changefreq>daily</changefreq>
\t\t<priority>0.8</priority>
\t</url>`;
    });

    sitemap += `
</urlset>`;

    res.set({
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600'
    });
    
    res.send(sitemap);
    
  } catch (error) {
    console.error('Error generating category sitemap:', error);
    res.status(500).send('Error generating category sitemap');
  }
});

// Post sitemap: /sitemap-posts.xml (page 1) and /sitemap-posts2.xml, /sitemap-posts3.xml, ... (indeksonline-style rotation)
// lastmod = most recent of publishedAt/updatedAt so edits trigger updates
router.get(/^\/sitemap-posts(\d*)\.xml$/, async (req, res) => {
  try {
    const page = (req.params[0] === '' || req.params[0] === '1') ? 1 : Math.max(1, parseInt(req.params[0], 10));
    const skip = (page - 1) * POSTS_PER_SITEMAP;

    const posts = await Post.find({ status: 'published', deleted: { $ne: true } })
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(POSTS_PER_SITEMAP)
      .select('slug publishedAt updatedAt featured trending')
      .lean();

    const lastmodDefault = lastmodIso();
    const total = posts.filter(p => p.slug).length;
    let sitemap = `<?xml version='1.0' encoding='UTF-8'?>
${generatedOnComment()}
<urlset xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd' xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'>`;

    posts.forEach(post => {
      if (!post.slug) return;
      const lastChange = [post.publishedAt, post.updatedAt].filter(Boolean).map(d => new Date(d).getTime());
      const postLastmod = lastChange.length ? lastmodIso(new Date(Math.max(...lastChange))) : lastmodDefault;
      const priority = post.featured ? '0.9' : '0.7';
      const safeSlug = String(post.slug).replace(/[\x00-\x1F\x7F]/g, '').trim();
      const postUrl = `${canonicalBase}/posts/${safeSlug}`;
      sitemap += `
\t<url>
\t\t<loc>${escapeXmlUrl(postUrl)}</loc>
\t\t<lastmod>${postLastmod}</lastmod>
\t\t<changefreq>monthly</changefreq>
\t\t<priority>${priority}</priority>
\t</url>`;
    });

    sitemap += `
</urlset>`;

    res.set({
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600'
    });
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating posts sitemap:', error);
    res.status(500).send('Error generating posts sitemap');
  }
});

// Redirect old index URL to canonical sitemap.xml (WordPress-style: one index URL)
router.get('/sitemap-index.xml', (req, res) => {
  res.redirect(301, '/sitemap.xml');
});

module.exports = router;
