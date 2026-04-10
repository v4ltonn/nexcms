const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const { contentWithCodeBlocksToHtml, hasCodeBlockMarkers } = require('./lib/convertCodeBlocks');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Enforce canonical URL (HTTPS + non-www) in production
// This MUST be the first middleware to catch www requests before Cloudflare caches them
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const host = req.headers.host || '';
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || '').toString().toLowerCase();
  const isHttps = proto === 'https';
  const isWww = host && host.toLowerCase().startsWith('www.');

  // Always redirect www to non-www, and HTTP to HTTPS
  if (isWww || !isHttps) {
    const canonicalHost = host.replace(/^www\./i, '') || process.env.SITE_DOMAIN || 'localhost';
    // Set headers to prevent Cloudflare from caching the redirect response incorrectly
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Robots-Tag': 'noindex'
    });
    return res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
  }

  return next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.quilljs.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.quilljs.com"],
      imgSrc: ["'self'", "data:", "https:", "https://images.unsplash.com", "https://via.placeholder.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdn.quilljs.com", "https://www.googletagmanager.com", "https://translate.google.com", "https://translate.googleapis.com", "${process.env.ANALYTICS_URL || ''}", "https://pagead2.googlesyndication.com", "https://news.google.com", "https://static.cloudflareinsights.com"],
      connectSrc: ["'self'", "https://www.google-analytics.com", "https://stats.g.doubleclick.net", "https://translate.google.com", "https://translate.googleapis.com", "${process.env.ANALYTICS_URL || ''}"],
      frameSrc: ["'self'", "https://imasdk.googleapis.com", "https://*.googlesyndication.com", "https://translate.google.com"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      upgradeInsecureRequests: []
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? [process.env.SITE_URL || 'http://localhost:3000'] : true,
  credentials: true
}));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (much more lenient)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
// Only apply rate limiting to API routes, not static content
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration with enhanced security
app.use(session({
  secret: process.env.SESSION_SECRET || 'nexcms-session-secret-change-me-' + Math.random().toString(36).substring(2, 15),
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/nexcms',
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // CSRF protection
  },
  name: 'nexcms.sid' // Custom session name
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(async () => {
  console.log('✅ Connected to MongoDB');
  
  // ULTRA PROTECTION: Intercept collection-level operations (only after connection is stable)
  setTimeout(async () => {
    try {
      const db = mongoose.connection.db;
      if (!db) return;
      
      await db.admin().ping(); // Wait for connection to be fully ready
      
      const postsCollection = db.collection('posts');
      
      // Intercept deleteMany
      const originalDeleteMany = postsCollection.deleteMany;
      postsCollection.deleteMany = function(filter, options, callback) {
        const fs = require('fs');
        const logPath = './logs/deletion-blocks.log';
        const errorMsg = `\n[${new Date().toISOString()}] 🚨🚨🚨 CRITICAL: BLOCKED deleteMany at collection level!\nFilter: ${JSON.stringify(filter)}\nStack: ${new Error().stack}\n---\n`;
        console.error(errorMsg);
        try {
          fs.appendFileSync(logPath, errorMsg);
        } catch (e) {}
        throw new Error('deleteMany is PERMANENTLY BLOCKED at collection level. Use soft delete instead.');
      };
      
      // Intercept deleteOne
      const originalDeleteOne = postsCollection.deleteOne;
      postsCollection.deleteOne = function(filter, options, callback) {
        const fs = require('fs');
        const logPath = './logs/deletion-blocks.log';
        const errorMsg = `\n[${new Date().toISOString()}] 🚨 BLOCKED deleteOne at collection level!\nFilter: ${JSON.stringify(filter)}\nStack: ${new Error().stack}\n---\n`;
        console.error(errorMsg);
        try {
          fs.appendFileSync(logPath, errorMsg);
        } catch (e) {}
        throw new Error('deleteOne is blocked. Use soft delete via Post model.');
      };
      
      console.log('🛡️  Collection-level deletion protection ACTIVE');
    } catch (e) {
      console.error('⚠️  Protection setup error (non-critical):', e.message);
    }
  }, 2000);
})
.catch(err => console.error('❌ MongoDB connection error:', err));

// Static files - MUST be before routes to avoid conflicts
// Serve uploads directory with explicit route handler to ensure it works
const uploadsPath = path.join(__dirname, 'uploads');
const fs = require('fs');

// Explicit route for uploads to ensure it's not intercepted by other routes
app.get('/uploads/:filename', (req, res, next) => {
  const filename = req.params.filename;
  console.log(`[Uploads Route] Request received for: ${filename}`);
  
  // Security: prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    console.log(`[Uploads Route] Security check failed for: ${filename}`);
    return res.status(403).send('Forbidden');
  }
  
  const filePath = path.resolve(uploadsPath, filename);
  console.log(`[Uploads Route] Resolved path: ${filePath}`);
  
  // Additional security: ensure file is within uploads directory
  if (!filePath.startsWith(path.resolve(uploadsPath))) {
    console.log(`[Uploads Route] Path traversal detected: ${filePath}`);
    return res.status(403).send('Forbidden');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`[Uploads Route] File not found: ${filePath}`);
    return res.status(404).send('File not found');
  }
  
  console.log(`[Uploads Route] Serving file: ${filePath}`);
  
  // Determine content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Cache-Status', 'MISS'); // Help bypass Cloudflare cache
  
  // Use absolute path for sendFile with proper error handling
  try {
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`[Uploads Route] Error sending file: ${err.message}`, err);
        if (!res.headersSent) {
          res.status(500).send('Error serving file');
        } else {
          res.end();
        }
      } else {
        console.log(`[Uploads Route] File sent successfully: ${filename}`);
      }
    });
  } catch (err) {
    console.error(`[Uploads Route] Exception in sendFile: ${err.message}`, err);
    if (!res.headersSent) {
      res.status(500).send('Error serving file');
    }
  }
});

// Also use static middleware as fallback
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));

// Custom static middleware with cache headers
app.use((req, res, next) => {
  const path = req.path.toLowerCase();
  
  // HTML files - no cache
  if (path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  // Images - long cache
  else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Expires', new Date(Date.now() + 31536000000).toUTCString());
  }
  // CSS/JS - medium cache with revalidation
  else if (path.endsWith('.css') || path.endsWith('.js')) {
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.set('Expires', new Date(Date.now() + 86400000).toUTCString());
  }
  // Fonts - long cache
  else if (path.match(/\.(woff|woff2|ttf|eot|otf)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Expires', new Date(Date.now() + 31536000000).toUTCString());
  }
  
  next();
});

// Sitemap/SEO alias domain: e.g. albaniavpn.net (free domain) serves homepage + robots + sitemaps; rest → ${process.env.SITE_DOMAIN || 'localhost'}
const SITEMAP_ALIAS_DOMAINS = (process.env.SITEMAP_ALIAS_DOMAINS || 'albaniavpn.net').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
const SEO_PATHS = ['/robots.txt', '/sitemap.xml', '/sitemap-pages.xml', '/sitemap-categories.xml', '/feed.xml', '/feed/cve.xml'];
const SEO_PATH_PREFIX = '/sitemap-posts';
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase().split(':')[0];
  if (!SITEMAP_ALIAS_DOMAINS.includes(host)) return next();
  const path = (req.path || '/').replace(/\/$/, '') || '/';
  const isSitemapPosts = path.startsWith(SEO_PATH_PREFIX) && path.endsWith('.xml');
  const isSeoPath = SEO_PATHS.includes(path) || isSitemapPosts;
  if (path === '/' || path === '') {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    const base = `https://${host}`;
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitemaps – ${host}</title>
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${process.env.SITE_URL || 'http://localhost:3000'}/">
</head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:3rem auto;padding:0 1.5rem;line-height:1.6;background:#0a0a0a;color:#e6e6e6;">
  <h1 style="font-size:1.5rem;margin-bottom:1rem;">Sitemaps &amp; feeds</h1>
  <p>This domain is used for sitemap discovery. All content lives at the main site.</p>
  <ul style="list-style:none;padding:0;">
    <li style="margin:0.5rem 0;"><a href="${base}/sitemap.xml" style="color:#00ff88;">Sitemap index</a></li>
    <li style="margin:0.5rem 0;"><a href="${base}/sitemap-categories.xml" style="color:#00ff88;">Categories sitemap</a></li>
    <li style="margin:0.5rem 0;"><a href="${base}/feed.xml" style="color:#00ff88;">RSS feed</a></li>
    <li style="margin:0.5rem 0;"><a href="${base}/robots.txt" style="color:#00ff88;">robots.txt</a></li>
  </ul>
  <p style="margin-top:2rem;"><a href="${process.env.SITE_URL || 'http://localhost:3000'}/" style="color:#00ff88;">Go to NexCMS →</a></p>
</body>
</html>`);
  }
  if (!isSeoPath) {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.redirect(301, `${process.env.SITE_URL || 'http://localhost:3000'}${req.originalUrl || path}`);
  }
  next();
});

// SEO routes BEFORE static so /robots.txt and /sitemap.xml always come from the app (never 404 from missing static file)
app.use('/', require('./routes/sitemap'));
app.use('/', require('./routes/rss'));

// Redirect unknown single-segment URLs (e.g. Albanian/cross-site) to a real post with 301
const VALID_SINGLE_SEGMENT = new Set([
  'contact', 'privacy-policy', 'terms-of-service', 'cve-search', 'password-checker', 'security-headers',
  'sigma-to-kql-converter', 'admin', 'ssl-checker', 'dns-lookup', 'ip-lookup', 'hash-generator',
  'base64-encoder', 'json-formatter', 'qr-generator', 'uuid-generator', 'email-header-analyzer',
  'text-diff', 'regex-tester', 'tools', 'image-to-pdf'
]);
app.use(async (req, res, next) => {
  const seg = req.path.replace(/^\/|\/$/g, '').split('/');
  if (seg.length !== 1 || seg[0] === '') return next();
  const name = seg[0];
  if (VALID_SINGLE_SEGMENT.has(name) || name.includes('.')) return next();
  // Always redirect unknown single-segment (e.g. Albanian wrong-host) to real content; never 404
  const fallbackSlug = await getOnePublishedPostSlug();
  if (fallbackSlug) {
    res.set('Cache-Control', 'public, max-age=300'); // short cache so CDN picks up redirect
    return res.redirect(301, '/posts/' + fallbackSlug);
  }
  res.set('Cache-Control', 'no-cache');
  return res.redirect(302, '/'); // fallback to homepage if no post (e.g. DB blip)
});

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Additional cache headers for images
    if (filePath.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Expires', new Date(Date.now() + 31536000000).toUTCString());
    }
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/steam-deals', require('./routes/steam-deals'));
app.use('/api/crypto-prices', require('./routes/crypto-prices'));
app.use('/api/cve-search', require('./routes/cve-search'));
app.use('/api/security-headers', require('./routes/security-headers'));
app.use('/api/tools', require('./routes/tools'));

// Redirect old slugs to new slugs (301 permanent redirects for SEO)
app.get('/posts/cve-2025-61481-critical-remote-code-execution-vulnerability-in-mikrotik-routeros-and-switchos', (req, res) => {
  const queryString = Object.keys(req.query).length > 0 ? '?' + Object.entries(req.query).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&') : '';
  res.redirect(301, '/posts/cve-2025-61481-critical-remote-code-execution-vulnerability-in-mikrotik-routeros-switchos' + queryString);
});

// Redirect unknown/Albanian/wrong-host paths to a real post so crawlers never see 404
let _cachedFallbackSlug = null;
let _cachedAt = 0;
const FALLBACK_CACHE_MS = 60000; // 1 min
const HARDCODED_FALLBACK_SLUG = 'gaming-breaking-best-weapons-in-marathon'; // used when DB returns no post (e.g. Albanian paths)
async function getOnePublishedPostSlug() {
  if (_cachedFallbackSlug && Date.now() - _cachedAt < FALLBACK_CACHE_MS) return _cachedFallbackSlug;
  const Post = require('./models/Post');
  const one = await Post.findOne({ status: 'published', deleted: { $ne: true } })
    .sort({ publishedAt: -1 }).select('slug').lean();
  if (one && one.slug) {
    _cachedFallbackSlug = one.slug;
    _cachedAt = Date.now();
  } else {
    _cachedFallbackSlug = null;
  }
  return _cachedFallbackSlug || HARDCODED_FALLBACK_SLUG;
}

// Serve post pages with server-side rendering for SEO
app.get('/posts/:slug', async (req, res) => {
  try {
    const Post = require('./models/Post');
    // Extract slug from params (query parameters don't affect this)
    const slug = req.params.slug;
    console.log(`[Post Route] Requested slug: ${slug}, Query params:`, Object.keys(req.query), 'User-Agent:', req.headers['user-agent']?.substring(0, 100));
    
    let post = await Post.findOne({ slug: slug, status: 'published' })
      .populate('author', 'username')
      .populate('category', 'name slug color');
    if (!post) {
      const redirected = await Post.findOne({ previousSlugs: slug, status: 'published' })
        .select('slug');
      if (redirected && redirected.slug) {
        const qs = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
        return res.redirect(301, '/posts/' + redirected.slug + qs);
      }
    }
    if (!post) {
      // Always 301 to a real post (incl. Albanian/wrong-host slugs) so crawlers never see 404
      const fallbackSlug = await getOnePublishedPostSlug();
      return res.redirect(301, '/posts/' + fallbackSlug);
    }
    // ALWAYS render server-side for post pages to ensure ALL crawlers get proper meta tags
    // This is critical for SEO and social media previews (Reddit, Facebook, Twitter, etc.)
    // The client-side JavaScript will still enhance the page for real users who visit in browsers
    console.log(`[Post Route] Rendering server-side for: ${req.params.slug}`);
    console.log(`[Post Route] User-Agent: ${req.headers['user-agent']?.substring(0, 100) || 'none'}`);
    console.log(`[Post Route] Post title: ${post.title?.substring(0, 60)}...`);
    console.log(`[Post Route] Post thumbnail: ${post.thumbnail?.url || 'none (using fallback)'}`);
    
    // Set proper cache headers (shorter so post fixes show sooner; Cloudflare can still cache)
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // 5 min so deploys show without purge
      'X-Robots-Tag': 'index, follow'
    });
    
    return await renderServerSidePost(res, post);
  } catch (error) {
    console.error('[Post Route] Error:', error.message);
    console.error('[Post Route] Stack:', error.stack);
    
    // If it's a MongoDB connection error, render a proper error page instead of generic index.html
    if (error.name === 'MongooseServerSelectionError' || error.name === 'MongooseError') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Service Temporarily Unavailable</title>
    <meta name="description" content="The service is temporarily unavailable. Please try again later.">
    <meta property="og:title" content="Service Temporarily Unavailable">
    <meta property="og:description" content="The service is temporarily unavailable. Please try again later.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${process.env.SITE_URL || 'http://localhost:3000'}/posts/${req.params.slug}">
    <meta property="og:image" content="${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg?v=5a8f3b2c">
</head>
<body>
    <h1>Service Temporarily Unavailable</h1>
    <p>We're experiencing technical difficulties. Please try again later.</p>
</body>
</html>`;
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      return res.status(503).send(html);
    }
    
    // For other errors, still avoid serving generic index.html
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - NexCMS</title>
    <meta name="description" content="An error occurred while loading this page.">
    <meta property="og:title" content="Error - NexCMS">
    <meta property="og:description" content="An error occurred while loading this page.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${process.env.SITE_URL || 'http://localhost:3000'}/posts/${req.params.slug}">
    <meta property="og:image" content="${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg?v=5a8f3b2c">
</head>
<body>
    <h1>Error</h1>
    <p>An error occurred while loading this page.</p>
</body>
</html>`;
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.status(500).send(html);
  }
});

// Helper function to ensure image URL is absolute
function getAbsoluteImageUrl(url) {
  if (!url) return '${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg?v=5a8f3b2c';
  // If already absolute, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If relative, make it absolute
  if (url.startsWith('/')) {
    return `${process.env.SITE_URL || 'http://localhost:3000'}${url}`;
  }
  // If it's a relative path without leading slash, assume it's in uploads
  if (url.includes('uploads/') || url.includes('image-')) {
    return `${process.env.SITE_URL || 'http://localhost:3000'}/${url.startsWith('/') ? url.substring(1) : url}`;
  }
  // Default fallback
  return '${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg?v=5a8f3b2c';
}

// Helper function to normalize all image URLs in HTML content
function normalizeImageUrlsInHtml(html) {
  if (!html || typeof html !== 'string') return html;
  return html.replace(/<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi, (match, before, src, after) => {
    const absoluteSrc = getAbsoluteImageUrl(src);
    return `<img${before} src="${absoluteSrc}"${after}>`;
  });
}

// Convert markdown-style ## and ### inside HTML to real h2/h3 so long bold runs break and text under headings is normal weight
function convertMarkdownHeadersInHtml(html) {
  if (!html || typeof html !== 'string') return html;
  let out = html;
  // Do ### first so ## doesn't consume it; close any previous heading/strong and open new block heading
  out = out.replace(/\s###\s+/g, ' </h2></h3></strong></p><h3 class="post-body-h3">');
  out = out.replace(/\s##\s+/g, ' </h2></h3></strong></p><h2 class="post-body-h2">');
  return out;
}

// Strip inline style from typography elements so .post-body CSS is the only source (admin/Quill look for every post)
// Handles style="...'..." and style='...' (e.g. font-family: 'Inter')
function stripTypographyInlineStyles(html) {
  if (!html || typeof html !== 'string') return html;
  const styleAttr = /\s*style=(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi;
  return html.replace(/<(h[1-6]|p|strong|b|em|i|blockquote|li)([^>]*)>/gi, (match, tag, rest) => {
    const without = rest.replace(styleAttr, '').replace(/\s+/g, ' ').trim();
    return '<' + tag + (without ? ' ' + without : '') + '>';
  });
}

// Helper function to determine image MIME type from URL
function getImageType(url) {
  if (!url) return 'image/png';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.svg') || lowerUrl.endsWith('.svg')) return 'image/svg+xml';
  if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerUrl.includes('.png') || lowerUrl.endsWith('.png')) return 'image/png';
  if (lowerUrl.includes('.webp') || lowerUrl.endsWith('.webp')) return 'image/webp';
  if (lowerUrl.includes('.gif') || lowerUrl.endsWith('.gif')) return 'image/gif';
  // Default to PNG for unknown types
  return 'image/png';
}

// Helper function to clean title from JSON format
function cleanTitle(title) {
  if (!title) return '';
  let clean = title.toString();
  
  // Try to extract from JSON format
  const jsonMatch = clean.match(/\{[\s\S]*?"Title"\s*:\s*"([^"]+)"[\s\S]*?\}/);
  if (jsonMatch && jsonMatch[1]) {
    clean = jsonMatch[1].trim();
  } else {
    try {
      const jsonData = JSON.parse(clean);
      if (jsonData.Title) {
        clean = jsonData.Title.trim();
      }
    } catch (e) {
      // Not JSON, clean manually
      clean = clean.replace(/^\{.*?"Title"\s*:\s*"/, '');
      clean = clean.replace(/"\s*\}.*$/, '');
    }
  }
  
  clean = clean.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

// Function to render post HTML server-side for bots
async function renderServerSidePost(res, post) {
  const publishedDate = post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const modifiedDate = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : publishedDate;
  
  // Clean title to remove JSON formatting
  const cleanPostTitle = cleanTitle(post.title);
  
  // Get absolute image URL with fallback
  const imageUrl = getAbsoluteImageUrl(post.thumbnail?.url);
  const imageAlt = post.thumbnail?.alt || cleanPostTitle || 'NexCMS';
  const imageWidth = post.thumbnail?.width || 1200;
  const imageHeight = post.thumbnail?.height || 630;
  const imageType = getImageType(imageUrl);
  
  // Fetch related and trending posts (with error handling)
  let cleanRelatedPosts = [];
  let cleanTrendingPosts = [];
  
  try {
    const Post = require('./models/Post');
    const relatedPosts = await Post.find({
      category: post.category?._id || post.category,
      status: 'published',
      deleted: { $ne: true },
      _id: { $ne: post._id }
    })
      .populate('category', 'name slug color')
      .populate('author', 'username')
      .sort({ publishedAt: -1 })
      .limit(4)
      .lean(); // Use lean() for better performance
    
    const trendingPosts = await Post.find({
      trending: true,
      status: 'published',
      deleted: { $ne: true },
      _id: { $ne: post._id }
    })
      .populate('category', 'name slug color')
      .populate('author', 'username')
      .sort({ views: -1, publishedAt: -1 })
      .limit(5)
      .lean(); // Use lean() for better performance
    
    // Clean titles for related/trending posts
    cleanRelatedPosts = relatedPosts.map(p => ({ ...p, title: cleanTitle(p.title) }));
    cleanTrendingPosts = trendingPosts.map(p => ({ ...p, title: cleanTitle(p.title) }));
  } catch (dbError) {
    console.error('[Post Route] Error fetching related/trending posts:', dbError.message);
    // Continue without related/trending posts if query fails
    cleanRelatedPosts = [];
    cleanTrendingPosts = [];
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(cleanPostTitle)} - NexCMS</title>
    <meta name="description" content="${escapeHtml((post.excerpt || post.content.substring(0, 160)).replace(/\s+/g, ' ').trim())}">
    <meta name="keywords" content="${(post.tags || []).join(', ')}">
    <meta name="author" content="${post.author?.username || 'NexCMS'}">
    <meta name="robots" content="index, follow">
    
    <!-- Language and Translation -->
    <meta http-equiv="content-language" content="en">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${escapeHtml(cleanPostTitle)}">
    <meta property="og:description" content="${escapeHtml((post.excerpt || post.content.substring(0, 200)).replace(/\s+/g, ' ').trim())}">
    <meta property="og:url" content="${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="NexCMS">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:type" content="${imageType}">
    <meta property="og:image:width" content="${imageWidth}">
    <meta property="og:image:height" content="${imageHeight}">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(cleanPostTitle)}">
    <meta name="twitter:description" content="${escapeHtml((post.excerpt || post.content.substring(0, 200)).replace(/\s+/g, ' ').trim())}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=5a8f3b2c">
    <link rel="apple-touch-icon" href="/favicon.svg?v=5a8f3b2c">
    <meta name="theme-color" content="#0a0a0a">
    <script src="/js/theme.js"></script>
    <script>window.updateThemeToggle=function(){var b=document.getElementById('theme-toggle');if(!b)return;var L=document.documentElement.classList.contains('theme-light');b.innerHTML=L?'<i class=\\'fas fa-moon\\'></i>':'<i class=\\'fas fa-sun\\'></i>';b.setAttribute('title',L?'Switch to dark':'Switch to light');b.setAttribute('aria-label',L?'Switch to dark':'Switch to light');};document.addEventListener('DOMContentLoaded',function(){if(typeof updateThemeToggle==='function')updateThemeToggle();});</script>
    <!-- Google AdSense Account -->
    <meta name="google-adsense-account" content="ca-pub-8567280417220019">
    <!-- Google News Subscribe with Google (SWG) -->
    <script async type="application/javascript"
            src="https://news.google.com/swg/js/v1/swg-basic.js"></script>
    <script>
      (self.SWG_BASIC = self.SWG_BASIC || []).push( basicSubscriptions => {
        basicSubscriptions.init({
          type: "NewsArticle",
          isPartOfType: ["Product"],
          isPartOfProductId: "CAow8NTKDA:openaccess",
          clientOptions: { theme: "light", lang: "en" },
        });
      });
    </script>
    
    <!-- Enhanced robots meta -->
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    
    <!-- Article Meta Tags -->
    <meta property="article:published_time" content="${post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date().toISOString()}">
    <meta property="article:modified_time" content="${post.updatedAt ? new Date(post.updatedAt).toISOString() : new Date().toISOString()}">
    <meta property="article:author" content="${post.author?.username || 'NexCMS'}">
    <meta property="article:section" content="${post.category?.name || 'News'}">
    ${(post.tags || []).map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n    ')}
    
    <!-- Structured Data (JSON-LD) for Google -->
    <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BlogPosting",
          "headline": escapeHtml(cleanPostTitle),
          "description": escapeHtml((post.excerpt || post.content.substring(0, 200)).replace(/\s+/g, ' ').trim()),
          "image": imageUrl,
          "datePublished": post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date().toISOString(),
          "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : (post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date().toISOString()),
          "author": {
            "@type": "Person",
            "name": post.author?.username || "NexCMS Admin"
          },
          "publisher": {
            "@type": "Organization",
            "name": "NexCMS",
            "logo": {
              "@type": "ImageObject",
              "url": "${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg"
            }
          },
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`
          },
          "articleSection": post.category?.name || "Technology",
          "keywords": (post.tags || []).join(", ") || "technology, cybersecurity, news"
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "${process.env.SITE_URL || 'http://localhost:3000'}/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": post.category?.name || "News",
              "item": `${process.env.SITE_URL || 'http://localhost:3000'}/category/${post.category?.slug || 'tech'}`
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": escapeHtml(cleanPostTitle),
              "item": `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`
            }
          ]
        }
      ]
    })}
    </script>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script>
        function copyPostUrl(button) {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                const originalText = button.querySelector('span').textContent;
                button.querySelector('span').textContent = 'Copied!';
                button.classList.add('copied');
                setTimeout(() => {
                    button.querySelector('span').textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    const originalText = button.querySelector('span').textContent;
                    button.querySelector('span').textContent = 'Copied!';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.querySelector('span').textContent = originalText;
                        button.classList.remove('copied');
                    }, 2000);
                } catch (e) {
                    console.error('Copy failed:', e);
                }
                document.body.removeChild(textArea);
            });
        }
    </script>
    <style>
        :root { --bg: #000; --text: #fff; --text-muted: #999; --text-body: #e6e6e6; --border: #333; --header-bg: #0a0a0a; --accent: #00ff88; --accent-dim: rgba(0,255,136,0.1); --card: #111; }
        @media (prefers-color-scheme: light) { :root { --bg: #f8f8f8; --text: #1a1a1a; --text-muted: #555; --text-body: #1a1a1a; --border: #e0e0e0; --header-bg: #fff; --accent: #00884d; --accent-dim: rgba(0,136,77,0.08); --card: #fff; } }
        html.theme-light { --bg: #f8f8f8; --text: #1a1a1a; --text-muted: #555; --text-body: #1a1a1a; --border: #e0e0e0; --header-bg: #fff; --accent: #00884d; --accent-dim: rgba(0,136,77,0.08); --card: #fff; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; transition: background 0.2s ease, color 0.2s ease; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .header { background: var(--header-bg); padding: 15px 0; border-bottom: 2px solid var(--border); position: sticky; top: 0; z-index: 1000; transition: background 0.2s ease, border-color 0.2s ease; }
        .nav { display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.4rem; font-weight: 800; color: var(--accent); text-decoration: none; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 10px; background: var(--accent-dim); border: 1px solid var(--accent); transition: all 0.3s ease; }
        .logo:hover { background: var(--accent-dim); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0, 255, 136, 0.25); }
        .logo i { font-size: 1.6rem; filter: drop-shadow(0 0 10px rgba(0, 255, 136, 0.4)); }
        .theme-toggle { background: var(--accent-dim); border: 1px solid var(--accent); color: var(--accent); width: 42px; height: 42px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: all 0.3s ease; margin-left: 8px; }
        .theme-toggle:hover { background: var(--accent); color: #000; }
        .nav-links { display: flex; list-style: none; gap: 2px; margin: 0; padding: 4px; background: rgba(26, 26, 26, 0.9); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); }
        .nav-links a { color: var(--text); text-decoration: none; font-weight: 600; font-size: 0.75rem; padding: 6px 10px; border-radius: 8px; transition: all 0.3s ease; position: relative; overflow: hidden; white-space: nowrap; }
        .nav-links a:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3); }
        .nav-links a[href="/category/tech"] { color: #00ff88; background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.2); }
        .nav-links a[href="/category/tech"]:hover { background: rgba(0, 255, 136, 0.2); box-shadow: 0 8px 25px rgba(0, 255, 136, 0.3); }
        .nav-links a[href="/category/cyber"] { color: #00aaff; background: rgba(0, 170, 255, 0.1); border: 1px solid rgba(0, 170, 255, 0.2); }
        .nav-links a[href="/category/cyber"]:hover { background: rgba(0, 170, 255, 0.2); box-shadow: 0 8px 25px rgba(0, 170, 255, 0.3); }
        .nav-links a[href="/category/crypto"] { color: #ff4444; background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.2); }
        .nav-links a[href="/category/crypto"]:hover { background: rgba(255, 68, 68, 0.2); box-shadow: 0 8px 25px rgba(255, 68, 68, 0.3); }
        .nav-links a[href="/category/gaming"] { color: #ffaa00; background: rgba(255, 170, 0, 0.1); border: 1px solid rgba(255, 170, 0, 0.2); }
        .nav-links a[href="/category/gaming"]:hover { background: rgba(255, 170, 0, 0.2); box-shadow: 0 8px 25px rgba(255, 170, 0, 0.3); }
        .nav-links a[href="/tools"] { color: #9d4edd; background: rgba(157, 78, 221, 0.1); border: 1px solid rgba(157, 78, 221, 0.2); }
        .nav-links a[href="/tools"]:hover { background: rgba(157, 78, 221, 0.2); box-shadow: 0 8px 25px rgba(157, 78, 221, 0.3); }
        .nav-dropdown { position: relative; }
        .nav-dropdown .dropdown-menu { position: absolute; top: 100%; left: 0; background: rgba(26, 26, 26, 0.95); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px; padding: 8px 0; min-width: 200px; display: none; z-index: 1000; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); }
        .nav-dropdown:hover .dropdown-menu { display: block; }
        .dropdown-menu a { display: block; padding: 8px 16px; color: #ffffff; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: all 0.3s ease; border-radius: 6px; margin: 1px 6px; }
        .dropdown-menu a:hover { background: rgba(0, 212, 255, 0.2); color: #00aaff; transform: translateX(5px); }
        .hero-compact { text-align: center; padding: 14px 0; background: var(--card); margin-bottom: 0; border-bottom: 2px solid var(--border); }
        .hero-compact h1 { font-size: 1.25rem; font-weight: 800; margin: 0 0 6px 0; background: linear-gradient(135deg, #00ff88, #00cc6a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-compact p { font-size: 0.875rem; color: var(--text-muted); max-width: 560px; margin: 0 auto; line-height: 1.4; }
        .hamburger { display: none; flex-direction: column; gap: 5px; background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 8px; cursor: pointer; padding: 10px; transition: all 0.3s ease; }
        .hamburger:hover { background: rgba(0, 255, 136, 0.2); border-color: rgba(0, 255, 136, 0.5); transform: scale(1.05); }
        .hamburger span { width: 24px; height: 3px; background: #00ff88; border-radius: 3px; transition: all 0.3s ease; box-shadow: 0 0 8px rgba(0, 255, 136, 0.5); }
        .mobile-menu { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(10, 10, 10, 0.98), rgba(26, 26, 26, 0.98)); backdrop-filter: blur(20px); z-index: 9999; padding: 20px; overflow-y: auto; opacity: 0; transform: translateX(100%); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .mobile-menu.active { display: block; opacity: 1; transform: translateX(0); }
        .mobile-menu-header { display: flex; justify-content: space-between; align-items: center; padding: 25px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 204, 106, 0.05)); }
        .mobile-menu-close { background: rgba(0, 255, 136, 0.1); border: 2px solid rgba(0, 255, 136, 0.3); color: #00ff88; font-size: 1.8rem; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
        .mobile-menu-close:hover { background: rgba(0, 255, 136, 0.2); }
        .mobile-nav-links { list-style: none; padding: 0; margin: 0; }
        .mobile-nav-links a { display: flex; align-items: center; gap: 10px; padding: 12px 0; color: #fff; text-decoration: none; font-weight: 500; }
        .mobile-nav-links a:hover { color: #00ff88; }
        @media (max-width: 768px) {
            .nav-links { display: none; }
            .hamburger { display: flex; }
            .hero-compact h1 { font-size: 1.1rem; padding: 0 10px; }
            .hero-compact p { font-size: 0.8rem; }
        }
        body.admin-bar-visible .header { top: 32px; }
        .post-content-wrapper { padding: 40px 0; background: var(--bg); }
        .post-content { max-width: 800px; margin: 0 auto; padding: 0 20px; }
        .post-category { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 0.9rem; font-weight: 700; margin-bottom: 20px; background: ${post.category?.color || '#00ff88'}; }
        .post-title { font-size: 2.25rem; font-weight: 800; line-height: 1.25; margin-bottom: 16px; color: var(--text); letter-spacing: -0.02em; }
        .post-meta { display: flex; gap: 20px; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 28px; }
        .post-meta span { display: flex; align-items: center; gap: 5px; }
        .post-image { width: 100%; max-width: 100%; height: auto; border-radius: 12px; margin: 28px 0; }
        .post-body { font-size: 1.125rem; line-height: 1.8; max-width: 100%; margin: 0; color: var(--text-body); letter-spacing: 0.01em; }
        .post-body h1, .post-body .linux-install-article h1, .post-body .how-to-article h1 { font-size: 2em !important; font-weight: 700 !important; margin: 1em 0 0.5em !important; color: var(--text) !important; line-height: 1.3 !important; }
        .post-body h2, .post-body .linux-install-article h2, .post-body .how-to-article h2 { font-size: 1.5em !important; font-weight: 700 !important; margin: 1em 0 0.5em !important; color: var(--text) !important; line-height: 1.35 !important; }
        .post-body h3, .post-body .linux-install-article h3, .post-body .how-to-article h3 { font-size: 1.17em !important; font-weight: 700 !important; margin: 1em 0 0.4em !important; color: var(--text) !important; line-height: 1.35 !important; }
        .post-body h4, .post-body .linux-install-article h4, .post-body .how-to-article h4 { font-size: 1em !important; font-weight: 700 !important; margin: 0.9em 0 0.35em !important; color: var(--text) !important; line-height: 1.4 !important; }
        .post-body h5, .post-body .linux-install-article h5, .post-body .how-to-article h5 { font-size: 0.83em !important; font-weight: 700 !important; margin: 0.8em 0 0.3em !important; color: var(--text) !important; line-height: 1.4 !important; }
        .post-body h6, .post-body .linux-install-article h6, .post-body .how-to-article h6 { font-size: 0.67em !important; font-weight: 700 !important; margin: 0.7em 0 0.25em !important; color: var(--text) !important; line-height: 1.4 !important; }
        .post-body p, .post-body .linux-install-article p, .post-body .how-to-article p { font-size: 1.125rem !important; line-height: 1.8 !important; color: var(--text-body) !important; font-weight: 400 !important; margin-bottom: 1.5em !important; }
        .post-body strong, .post-body b, .post-body .linux-install-article strong, .post-body .how-to-article strong { font-weight: 700 !important; color: inherit !important; }
        .post-body em, .post-body i { font-style: italic !important; color: inherit !important; }
        .post-body p:first-child { font-size: 1.1875rem !important; font-weight: 400 !important; color: var(--text-body) !important; line-height: 1.75 !important; }
        .post-body ul, .post-body ol { margin: 1.35em 0; padding-left: 1.5em; }
        .post-body li { margin-bottom: 0.5em; line-height: 1.8; }
        .post-body blockquote { margin: 1.5em 0; padding: 1em 1.25em; border-left: 4px solid var(--accent); background: var(--accent-dim); border-radius: 0 8px 8px 0; color: var(--text-muted); font-style: italic; }
        .post-body img { max-width: 100% !important; height: auto !important; display: block; margin: 1.75em auto; border-radius: 8px; }
        .linux-install-article, .how-to-article { font-size: 1.125rem; line-height: 1.8; color: var(--text-body); }
        .linux-install-article p, .how-to-article p { margin-bottom: 1.35em; overflow-wrap: break-word; font-weight: 400; }
        .linux-install-article p:first-child, .how-to-article p:first-child { font-size: 1.125rem; font-weight: 500; color: var(--text-body); }
        html.theme-light .post-body, html.theme-light .post-body p, html.theme-light .post-body li, html.theme-light .post-body span, html.theme-light .post-body h1, html.theme-light .post-body h2, html.theme-light .post-body h3, html.theme-light .post-body h4, html.theme-light .post-body blockquote, html.theme-light .post-body strong, html.theme-light .post-body b { color: #1a1a1a !important; }
        .command-block-wrapper, .code-block-wrapper { margin: 20px 0 !important; }
        .command-block-content pre, .command-block-content code, .code-block-content pre, .code-block-content code { white-space: pre !important; display: block !important; font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', 'DejaVu Sans Mono', monospace !important; font-size: 13px !important; line-height: 1.5 !important; }
        .command-block-content, .code-block-content { padding: 12px 14px !important; }
        .command-block-header, .code-block-header { padding: 10px 14px !important; }
        @media (max-width: 768px) {
            .command-block-wrapper, .code-block-wrapper { margin: 18px 0 !important; }
            .command-block-header, .code-block-header { padding: 10px 12px !important; flex-direction: column !important; align-items: flex-start !important; }
            .command-block-content, .code-block-content { padding: 12px !important; }
            .command-block-content code, .code-block-content code { font-size: 12px !important; }
        }
        .social-share-section { margin: 40px 0; padding: 25px; background: linear-gradient(135deg, rgba(0, 255, 136, 0.05), rgba(0, 204, 106, 0.02)); border-radius: 12px; border: 1px solid rgba(0, 255, 136, 0.2); }
        .social-share-title { font-size: 1rem; font-weight: 600; color: #00ff88; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
        .social-share-title i { font-size: 1.1rem; }
        .social-share-buttons { display: flex; flex-wrap: wrap; gap: 12px; }
        .social-share-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: all 0.3s ease; border: 1px solid transparent; cursor: pointer; }
        .social-share-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
        .social-share-btn i { font-size: 1.1rem; }
        .share-twitter { background: #1da1f2; color: #ffffff; }
        .share-twitter:hover { background: #0d8bd9; border-color: #1da1f2; }
        .share-facebook { background: #1877f2; color: #ffffff; }
        .share-facebook:hover { background: #166fe5; border-color: #1877f2; }
        .share-linkedin { background: #0077b5; color: #ffffff; }
        .share-linkedin:hover { background: #006399; border-color: #0077b5; }
        .share-reddit { background: #ff4500; color: #ffffff; }
        .share-reddit:hover { background: #e63e00; border-color: #ff4500; }
        .share-copy { background: rgba(0, 255, 136, 0.1); color: #00ff88; border-color: rgba(0, 255, 136, 0.3); }
        .share-copy:hover { background: rgba(0, 255, 136, 0.2); border-color: #00ff88; }
        .share-copy.copied { background: rgba(0, 255, 136, 0.2); color: #00ff88; border-color: #00ff88; }
        .tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
        .tag { background: linear-gradient(135deg, #00ff88, #00cc6a); color: #000; padding: 6px 12px; border-radius: 15px; font-size: 0.9rem; font-weight: 600; }
        .related-content { display: grid; grid-template-columns: 2fr 1fr; gap: 40px; margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--border); }
        .related-section, .trending-section { background: var(--card); padding: 30px; border-radius: 12px; border: 1px solid var(--border); }
        .related-title, .trending-title { font-size: 1.5rem; color: var(--accent); margin-bottom: 25px; border-bottom: 2px solid var(--accent); padding-bottom: 10px; }
        @media (max-width: 768px) {
            .social-share-section { margin: 30px 0; padding: 20px 15px; }
            .social-share-title { font-size: 0.95rem; margin-bottom: 12px; }
            .social-share-buttons { gap: 8px; justify-content: space-between; }
            .social-share-btn { flex: 1 1 calc(50% - 4px); min-width: calc(50% - 4px); max-width: calc(50% - 4px); padding: 12px 10px; font-size: 0.85rem; justify-content: center; }
            .share-copy { flex: 1 1 100%; min-width: 100%; max-width: 100%; margin-top: 8px; }
        }
        .related-posts { display: flex; flex-direction: column; gap: 20px; }
        .related-post-item { display: flex; gap: 15px; padding: 15px; background: var(--card); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; border: 1px solid transparent; text-decoration: none; color: inherit; }
        .related-post-item:hover { background: var(--accent-dim); border-color: var(--accent); transform: translateY(-2px); }
        .related-post-item img { width: 120px; height: 80px; object-fit: cover; border-radius: 6px; }
        .related-post-content { flex: 1; }
        .related-post-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 8px; line-height: 1.3; }
        .related-post-meta { font-size: 0.9rem; color: var(--text-muted); display: flex; gap: 15px; }
        .trending-posts { display: flex; flex-direction: column; gap: 15px; }
        .trending-item { display: flex; align-items: center; gap: 15px; padding: 15px; background: var(--card); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; border: 1px solid transparent; text-decoration: none; color: inherit; }
        .trending-item:hover { background: var(--accent-dim); border-color: var(--accent); transform: translateX(5px); }
        .trending-number { background: var(--accent); color: #000; width: 25px; height: 25px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9rem; }
        .trending-content { flex: 1; }
        .trending-title-text { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 5px; line-height: 1.3; }
        .trending-meta { font-size: 0.8rem; color: var(--text-muted); }
        @media (max-width: 768px) {
            .post-title { font-size: 2rem; }
            .back-btn { padding: 8px 16px; font-size: 0.9rem; }
            .container { padding: 0 15px; }
            .related-content { grid-template-columns: 1fr; gap: 30px; }
            .related-section, .trending-section { padding: 20px; }
            .related-post-item { flex-direction: column; text-align: center; }
            .related-post-item img { width: 100%; height: 150px; }
        }
    </style>
    
    <!-- Google AdSense -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8567280417220019"
            crossorigin="anonymous"></script>
</head>
<body>
    <header class="header">
        <div class="container">
            <nav class="nav">
                <a href="/" class="logo">
                    <i class="fas fa-shield-alt"></i>
                    <span>NexCMS</span>
                </a>
                <ul class="nav-links">
                    <li><a href="/">Home</a></li>
                    <li><a href="/category/tech">Tech</a></li>
                    <li class="nav-dropdown">
                        <a href="/category/cyber">Cyber</a>
                        <div class="dropdown-menu">
                            <a href="/category/cyber">All Cyber</a>
                            <a href="/category/cyber?subcategory=data-breaches">Data Breaches</a>
                            <a href="/category/cyber?subcategory=cyber-attacks">Cyber Attacks</a>
                            <a href="/category/cyber?subcategory=vulnerabilities">Vulnerabilities</a>
                        </div>
                    </li>
                    <li><a href="/category/crypto">Crypto</a></li>
                    <li><a href="/category/gaming">Gaming</a></li>
                    <li><a href="/tools">Tools</a></li>
                    <li><a href="/contact">Contact</a></li>
                </ul>
                <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Toggle light/dark" title="Toggle light/dark" onclick="setNexCMSTheme(document.documentElement.classList.contains('theme-light') ? 'dark' : 'light'); (typeof updateThemeToggle==='function'&&updateThemeToggle());"></button>
                <button class="hamburger" type="button" onclick="var m=document.getElementById('mobileMenu'); m.classList.toggle('active');" aria-label="Menu">
                    <span></span><span></span><span></span>
                </button>
            </nav>
        </div>
    </header>
    <div class="mobile-menu" id="mobileMenu">
        <div class="mobile-menu-header">
            <span style="color: #00ff88; font-weight: 700;">Navigation</span>
            <button class="mobile-menu-close" type="button" onclick="document.getElementById('mobileMenu').classList.remove('active');">×</button>
        </div>
        <ul class="mobile-nav-links">
            <li><a href="/" onclick="document.getElementById('mobileMenu').classList.remove('active');">Home</a></li>
            <li><a href="/category/tech" onclick="document.getElementById('mobileMenu').classList.remove('active');">Tech</a></li>
            <li><a href="/category/cyber" onclick="document.getElementById('mobileMenu').classList.remove('active');">Cyber</a></li>
            <li><a href="/category/crypto" onclick="document.getElementById('mobileMenu').classList.remove('active');">Crypto</a></li>
            <li><a href="/category/gaming" onclick="document.getElementById('mobileMenu').classList.remove('active');">Gaming</a></li>
            <li><a href="/tools" onclick="document.getElementById('mobileMenu').classList.remove('active');">Tools</a></li>
            <li><a href="/contact" onclick="document.getElementById('mobileMenu').classList.remove('active');">Contact</a></li>
        </ul>
    </div>
    <section class="hero-compact">
        <div class="container">
            <h1>NexCMS - Latest Cybersecurity, Technology &amp; Gaming News</h1>
            <p>Stay ahead with breaking cybersecurity news, technology updates, cryptocurrency insights, and gaming coverage. Expert security analysis and tech innovations.</p>
        </div>
    </section>
    
    <main class="post-content-wrapper">
        <div class="container">
            <div class="post-content">
                <span class="post-category">${post.category?.name || 'News'}</span>
                <h1 class="post-title">${escapeHtml(cleanPostTitle)}</h1>
                <div class="post-meta">
                    <span><i class="fas fa-calendar"></i> ${publishedDate}</span>
                    <span><i class="fas fa-eye"></i> ${post.views || 0} views</span>
                    <span><i class="fas fa-user"></i> ${post.author?.username || 'Admin'}</span>
                </div>
                
                ${post.thumbnail?.url ? `<img src="${getAbsoluteImageUrl(post.thumbnail.url)}" alt="${escapeHtml(cleanPostTitle)}" class="post-image">` : ''}
                
                <div class="post-body">
                    ${stripTypographyInlineStyles(convertMarkdownHeadersInHtml(normalizeImageUrlsInHtml(
                      (post.content && hasCodeBlockMarkers(post.content))
                        ? contentWithCodeBlocksToHtml((post.content || '').replace(/Enter fullscreen mode/gi, '').replace(/Exit fullscreen mode/gi, '').replace(/Hide this comment/gi, '').trim())
                        : (post.contentHtml || (post.content || '').replace(/\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>'))
                    )))}
                </div>
                
                <!-- Social Sharing Buttons -->
                <div class="social-share-section">
                    <div class="social-share-title">
                        <i class="fas fa-share-alt"></i>
                        <span>Share this article</span>
                    </div>
                    <div class="social-share-buttons">
                        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(`${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`)}&text=${encodeURIComponent(cleanPostTitle)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-share-btn share-twitter"
                           onclick="window.open(this.href, 'share-twitter', 'width=550,height=420'); return false;">
                            <i class="fab fa-twitter"></i>
                            <span>Twitter</span>
                        </a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-share-btn share-facebook"
                           onclick="window.open(this.href, 'share-facebook', 'width=580,height=296'); return false;">
                            <i class="fab fa-facebook-f"></i>
                            <span>Facebook</span>
                        </a>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-share-btn share-linkedin"
                           onclick="window.open(this.href, 'share-linkedin', 'width=520,height=570'); return false;">
                            <i class="fab fa-linkedin-in"></i>
                            <span>LinkedIn</span>
                        </a>
                        <a href="https://reddit.com/submit?url=${encodeURIComponent(`${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`)}&title=${encodeURIComponent(cleanPostTitle)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="social-share-btn share-reddit"
                           onclick="window.open(this.href, 'share-reddit', 'width=700,height=500'); return false;">
                            <i class="fab fa-reddit-alien"></i>
                            <span>Reddit</span>
                        </a>
                        <button class="social-share-btn share-copy" onclick="copyPostUrl(this)">
                            <i class="fas fa-link"></i>
                            <span>Copy Link</span>
                        </button>
                    </div>
                </div>
                
                ${post.tags && post.tags.length > 0 ? `
                    <div class="post-tags-section" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #333;">
                        <h4 class="tags-title" style="font-size: 1rem; font-weight: 600; color: #00ff88; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <span>🏷️</span> Tags
                        </h4>
                        <div class="post-tags" style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${post.tags.map(tag => `<span class="tag" style="background: linear-gradient(135deg, #00ff88, #00cc6a); color: #000; padding: 4px 10px; border-radius: 15px; font-size: 0.8rem; font-weight: 500;">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Related Content Section -->
                <div class="related-content">
                    <div class="related-left">
                        <div class="related-section">
                            <h3 class="related-title">More from ${post.category?.name || 'this category'}</h3>
                            <div class="related-posts">
                                ${cleanRelatedPosts.length > 0 ? cleanRelatedPosts.map(relatedPost => `
                                    <a href="/posts/${relatedPost.slug}" class="related-post-item">
                                        <img src="${getAbsoluteImageUrl(relatedPost.thumbnail?.url)}" alt="${escapeHtml(relatedPost.title || 'Related post')}">
                                        <div class="related-post-content">
                                            <h4 class="related-post-title">${escapeHtml(relatedPost.title || 'Untitled')}</h4>
                                            <div class="related-post-meta">
                                                <span><i class="fas fa-calendar"></i> ${relatedPost.publishedAt ? new Date(relatedPost.publishedAt).toISOString().split('T')[0] : 'N/A'}</span>
                                                <span><i class="fas fa-eye"></i> ${relatedPost.views || 0}</span>
                                            </div>
                                        </div>
                                    </a>
                                `).join('') : '<div style="color: #888;">No related posts found.</div>'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="related-right">
                        <div class="trending-section">
                            <h3 class="trending-title">Trending</h3>
                            <div class="trending-posts">
                                ${cleanTrendingPosts.length > 0 ? cleanTrendingPosts.map((trendingPost, index) => `
                                    <a href="/posts/${trendingPost.slug}" class="trending-item">
                                        <div class="trending-number">${index + 1}</div>
                                        <div class="trending-content">
                                            <h4 class="trending-title-text">${escapeHtml(trendingPost.title || 'Untitled')}</h4>
                                            <div class="trending-meta">${trendingPost.publishedAt ? new Date(trendingPost.publishedAt).toISOString().split('T')[0] : 'N/A'} • ${trendingPost.views || 0} views</div>
                                        </div>
                                    </a>
                                `).join('') : '<div style="color: #888;">No trending posts found.</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </main>
    <script src="/js/admin-bar.js" defer></script>
</body>
</html>`;
  
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    // Keep HTML cacheable; aligns with route-level headers and helps crawlers.
    'Cache-Control': 'public, max-age=3600',
    'X-Robots-Tag': 'index, follow'
  });
  
  res.send(html);
}

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// Function to render category HTML server-side for bots (with post links to fix orphaned pages)
function renderServerSideCategory(res, category, posts = []) {
  const imageUrl = '${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg?v=5a8f3b2c';
  const imageType = 'image/svg+xml';
  const description = `Latest ${category.name} news, articles, and updates on NexCMS.`;
  const postLinks = (posts || []).slice(0, 100).map(p => {
    const slug = p.slug || p._id;
    const title = (p.title || '').replace(/^\{.*?"Title"\s*:\s*"/, '').replace(/"\s*\}.*$/, '').trim() || slug;
    return `<li><a href="${process.env.SITE_URL || 'http://localhost:3000'}/posts/${escapeHtml(slug)}">${escapeHtml(title)}</a></li>`;
  }).join('\n        ');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(category.name)} - NexCMS</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="${escapeHtml(category.name)}, news, articles, NexCMS">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${escapeHtml(category.name)} - NexCMS">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${process.env.SITE_URL || 'http://localhost:3000'}/category/${category.slug}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="NexCMS">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:image:secure_url" content="${imageUrl}">
    <meta property="og:image:type" content="${imageType}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(category.name)} - NexCMS">
    <meta property="og:locale" content="en_US">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(category.name)} - NexCMS">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:image:alt" content="${escapeHtml(category.name)} - NexCMS">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${process.env.SITE_URL || 'http://localhost:3000'}/category/${category.slug}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=5a8f3b2c">
    <meta name="theme-color" content="#0a0a0a">
    
    <!-- Enhanced robots meta -->
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
    
    <style>
        body { font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
        h1 { color: #00ff88; }
        .category-info { margin: 20px 0; }
        .post-list { margin-top: 20px; }
        .post-list ul { list-style: none; padding: 0; }
        .post-list a { color: #00ff88; }
    </style>
</head>
<body>
    <h1>${escapeHtml(category.name)}</h1>
    <div class="category-info">
        <p>${escapeHtml(description)}</p>
        <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/">Home</a> | <a href="${process.env.SITE_URL || 'http://localhost:3000'}/tools">Tools</a> | <a href="${process.env.SITE_URL || 'http://localhost:3000'}/category/${category.slug}">${escapeHtml(category.name)}</a> | <a href="${process.env.SITE_URL || 'http://localhost:3000'}/sitemap.xml">Sitemap</a></p>
    </div>
    <nav class="post-list" aria-label="Articles in this category">
        <h2>Articles</h2>
        <ul>${postLinks || '<li>No articles yet.</li>'}</ul>
    </nav>
</body>
</html>`;
  
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600'
  });
  res.send(html);
}

// Serve category pages
app.get('/category/:slug', async (req, res) => {
  try {
    const Category = require('./models/Category');
    const category = await Category.findOne({ slug: req.params.slug });
    
    if (!category) {
      // Redirect to a real post instead of 404 (301 so crawlers replace wrong URL)
      const fallbackSlug = await getOnePublishedPostSlug();
      if (fallbackSlug) {
        return res.redirect(301, '/posts/' + fallbackSlug);
      }
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
    
    // Check if it's a bot
    const userAgent = req.headers['user-agent'] || '';
    const isBot = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|sogou|facebot|facebookexternalhit|ia_archiver|twitterbot|linkedinbot|whatsapp|telegram|slackbot|applebot|Bytespider|SemrushBot|ahrefsbot|discordbot|Discord|redditbot|Redditbot|reddit/i.test(userAgent);
    
    // If it's a bot, render server-side HTML with post links (fixes orphaned pages in sitemap)
    if (isBot) {
      const Post = require('./models/Post');
      const categoryPosts = await Post.find({ category: category._id, status: 'published', deleted: { $ne: true } })
        .sort({ publishedAt: -1 }).limit(100).select('slug title').lean();
      console.log(`Bot detected (${userAgent}), rendering category server-side for: ${req.params.slug} (${categoryPosts.length} posts)`);
      return renderServerSideCategory(res, category, categoryPosts);
    }
    
    // For regular browsers, serve the client-side rendered page with correct canonical, title, and description
    // so crawlers (and audit tools) never see "Loading Category..." — they get the real category name
    const categoryHtmlPath = path.join(__dirname, 'public', 'category.html');
    let html = await fs.promises.readFile(categoryHtmlPath, 'utf8');
    const canonicalUrl = '${process.env.SITE_URL || 'http://localhost:3000'}/category/' + escapeHtml(req.params.slug);
    const categoryTitle = escapeHtml(category.name) + ' - NexCMS';
    const categoryDescription = 'Latest ' + escapeHtml(category.name) + ' news, articles, and updates on NexCMS.';
    html = html.replace(/(<link\s+rel="canonical"[^>]*href=")https:\/\/nexcms\.net\/"/, '$1' + canonicalUrl + '"');
    html = html.replace(/(<title[^>]*>)[^<]*<\/title>/, '$1' + categoryTitle + '</title>');
    html = html.replace(/(<meta\s+name="description"[^>]*content=")[^"]*(")/, '$1' + categoryDescription + '$2');
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
    });
    res.send(html);
  } catch (error) {
    console.error('Category page error:', error);
    const fallbackSlug = await getOnePublishedPostSlug();
    if (fallbackSlug) {
      return res.redirect(301, '/posts/' + fallbackSlug);
    }
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

// Also support the old /categories/:slug route for backward compatibility
app.get('/categories/:slug', async (req, res) => {
  res.redirect(`/category/${req.params.slug}`);
});

// Privacy Policy page
app.get('/privacy-policy', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

app.get('/terms-of-service', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'terms-of-service.html'));
});

app.get('/contact', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Tools routes
app.get('/cve-search', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'cve-search.html'));
});

app.get('/password-checker', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'password-checker.html'));
});

app.get('/security-headers', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'security-headers.html'));
});

// Tool routes
const toolRoutes = [
  'ssl-checker', 'dns-lookup', 'ip-lookup', 'hash-generator', 'base64-encoder',
  'json-formatter', 'qr-generator', 'uuid-generator', 'email-header-analyzer',
  'text-diff', 'regex-tester', 'image-to-pdf'
];

toolRoutes.forEach(route => {
  app.get(`/${route}`, (req, res) => {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.sendFile(path.join(__dirname, 'public', `${route}.html`));
  });
});

// Sigma -> KQL converter tool (separate slug for better SEO)
app.get('/sigma-to-kql-converter', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'sigma-to-kql.html'));
});

// Dedicated tools hub page (SEO; lists all utility tools, not blog posts)
app.get('/tools', (req, res) => {
  res.set({
    'Cache-Control': 'public, max-age=3600',
    'X-Robots-Tag': 'index, follow'
  });
  res.sendFile(path.join(__dirname, 'public', 'tools.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

// Server-rendered homepage for bots: post + category links so sitemap URLs are not orphaned
async function renderServerSideHomepage(res, posts = [], categories = []) {
  const categoryLinks = (categories || []).map(c => `<li><a href="${process.env.SITE_URL || 'http://localhost:3000'}/category/${escapeHtml(c.slug)}">${escapeHtml(c.name || c.slug)}</a></li>`).join('\n        ');
  const postLinks = (posts || []).slice(0, 500).map(p => {
    const slug = p.slug || p._id;
    const title = (p.title || '').replace(/^\{.*?"Title"\s*:\s*"/, '').replace(/"\s*\}.*$/, '').trim() || slug;
    return `<li><a href="${process.env.SITE_URL || 'http://localhost:3000'}/posts/${escapeHtml(slug)}">${escapeHtml(title)}</a></li>`;
  }).join('\n        ');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NexCMS - Latest Cybersecurity, Technology &amp; Gaming News</title>
    <meta name="description" content="Latest cybersecurity news, technology updates, cryptocurrency insights, and gaming coverage.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${process.env.SITE_URL || 'http://localhost:3000'}/">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=5a8f3b2c">
</head>
<body>
    <h1>NexCMS</h1>
    <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/">Home</a> | <a href="${process.env.SITE_URL || 'http://localhost:3000'}/tools">Tools</a> | <a href="${process.env.SITE_URL || 'http://localhost:3000'}/sitemap.xml">Sitemap</a></p>
    <nav aria-label="Categories">
        <h2>Categories</h2>
        <ul>${categoryLinks || '<li>None</li>'}</ul>
    </nav>
    <nav aria-label="Latest articles">
        <h2>Latest articles</h2>
        <ul>${postLinks || '<li>No articles yet.</li>'}</ul>
    </nav>
</body>
</html>`;
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
  res.send(html);
}

// Homepage route: bots get crawlable HTML; humans get index.html with embedded data (no API call)
app.get('/', async (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|sogou|facebot|facebookexternalhit|ia_archiver|twitterbot|linkedinbot|applebot|Bytespider|SemrushBot|ahrefsbot|redditbot|Redditbot|reddit/i.test(userAgent);
  if (isBot) {
    try {
      const Post = require('./models/Post');
      const Category = require('./models/Category');
      const [posts, categories] = await Promise.all([
        Post.find({ status: 'published', deleted: { $ne: true } }).sort({ publishedAt: -1 }).limit(500).select('slug title').lean(),
        Category.find({ isActive: { $ne: false } }).sort({ order: 1, name: 1 }).select('slug name').lean()
      ]);
      return renderServerSideHomepage(res, posts, categories);
    } catch (err) {
      console.error('[Homepage bot render]', err.message);
    }
  }
  try {
    const { getHomepageData } = require('./routes/posts');
    const data = await getHomepageData();
    let html = await fs.promises.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const payload = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');
    const script = `<script>window.__INITIAL_HOMEPAGE__=${payload};</script>`;
    html = html.replace('</head>', script + '\n</head>');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    res.send(html);
  } catch (err) {
    console.error('[Homepage] inject failed, falling back to static:', err.message);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.get('/admin/dashboard', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Custom 404 handler (keep after all routes)
// Redirect all page 404s to a real post (or homepage) so crawlers never see 404 for wrong-host URLs
app.use(async (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Not found' });
  }

  const fallbackSlug = await getOnePublishedPostSlug();
  if (fallbackSlug) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.redirect(301, '/posts/' + fallbackSlug);
  }
  // No post in DB (e.g. blip) – still redirect to homepage so crawlers don't get 404
  res.set('Cache-Control', 'no-cache');
  return res.redirect(302, '/');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🌐 Main site: http://localhost:${PORT}`);
});

module.exports = app;