const express = require('express');
const Post = require('../models/Post');
const Category = require('../models/Category');

const router = express.Router();

// Helper function to escape XML
// First decode any existing entities to avoid double-escaping, then escape properly
function escapeXml(unsafe) {
  if (!unsafe) return '';
  let str = String(unsafe);
  
  // First, decode any already-escaped entities to avoid double-escaping
  // This handles cases where data might already contain &amp; etc.
  str = str.replace(/&amp;/g, '&');
  str = str.replace(/&lt;/g, '<');
  str = str.replace(/&gt;/g, '>');
  str = str.replace(/&quot;/g, '"');
  str = str.replace(/&apos;/g, "'");
  
  // Now escape properly
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Main RSS feed - Latest posts
router.get('/feed.xml', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // Get latest published posts
    const posts = await Post.find({ 
      status: 'published', 
      deleted: { $ne: true } 
    })
      .populate('category', 'name slug')
      .populate('author', 'username')
      .sort({ publishedAt: -1 })
      .limit(limit);
    
    const buildDate = new Date().toUTCString();
    
    // Build RSS XML
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>NexCMS - Cyber Tech Crypto Gaming News</title>
    <link>${process.env.SITE_URL || 'http://localhost:3000'}</link>
    <description>Latest cyber security, technology, cryptocurrency, and gaming news. Stay ahead with NexCMS.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${buildDate}</pubDate>
    <ttl>60</ttl>
    <generator>NexCMS CMS</generator>
    <webMaster>nexcms@proton.me (NexCMS)</webMaster>
    <managingEditor>nexcms@proton.me (NexCMS)</managingEditor>
    <atom:link href="${process.env.SITE_URL || 'http://localhost:3000'}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg</url>
      <title>NexCMS</title>
      <link>${process.env.SITE_URL || 'http://localhost:3000'}</link>
    </image>`;

    posts.forEach(post => {
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : buildDate;
      const postUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`;
      const title = escapeXml(post.title || 'Untitled');
      
      // Description: plain text, escaped
      let description = post.excerpt || post.content || '';
      description = description.replace(/<[^>]*>/g, '').trim();
      if (!description) description = 'No description available';
      description = escapeXml(description.substring(0, 500));
      
      // Content: HTML for CDATA (don't escape, CDATA handles it, but handle CDATA end markers)
      let content = post.contentHtml || post.content || '';
      // Clean up content - remove script tags and other problematic elements
      content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      // Replace CDATA end markers to prevent breaking CDATA section
      content = content.replace(/\]\]>/g, ']]&gt;');
      // Ensure content is not empty
      if (!content || content.trim().length === 0) {
        const fallback = post.excerpt || post.content || 'No content available';
        content = `<p>${fallback.replace(/<[^>]*>/g, '').trim()}</p>`;
      }
      
      const author = post.author?.username || 'NexCMS';
      const category = post.category?.name || 'News';
      let imageUrl = '${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg';
      if (post.thumbnail) {
        if (typeof post.thumbnail === 'string') {
          imageUrl = post.thumbnail;
        } else if (post.thumbnail.url) {
          imageUrl = post.thumbnail.url;
        }
      }
      
      // Escape image URL for XML
      imageUrl = escapeXml(imageUrl);
      
      rss += `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${description}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <category>${escapeXml(category)}</category>
      <media:thumbnail url="${imageUrl}"/>
      <media:content url="${imageUrl}" type="image/jpeg"/>
      ${post.tags && post.tags.length > 0 ? post.tags.map(tag => `<category>${escapeXml(tag)}</category>`).join('\n      ') : ''}
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    
    res.send(rss);
    
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

// CVE/Vulnerabilities RSS feed (special feed) - MUST come before category route
router.get('/feed/cve.xml', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // Find vulnerabilities category
    const vulnCategory = await Category.findOne({ slug: 'vulnerabilities' });
    if (!vulnCategory) {
      return res.status(404).send('Vulnerabilities category not found');
    }
    
    // Get CVE posts
    const posts = await Post.find({ 
      status: 'published', 
      deleted: { $ne: true },
      category: vulnCategory._id
    })
      .populate('author', 'username')
      .sort({ publishedAt: -1 })
      .limit(limit);
    
    const buildDate = new Date().toUTCString();
    
    // Build RSS XML
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>CVE &amp; Security Vulnerabilities - NexCMS</title>
    <link>${process.env.SITE_URL || 'http://localhost:3000'}</link>
    <description>Latest CVE (Common Vulnerabilities and Exposures) alerts and security vulnerability news from NexCMS</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${buildDate}</pubDate>
    <ttl>30</ttl>
    <generator>NexCMS CMS</generator>
    <atom:link href="${process.env.SITE_URL || 'http://localhost:3000'}/feed/cve.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg</url>
      <title>NexCMS - CVE Feed</title>
      <link>${process.env.SITE_URL || 'http://localhost:3000'}</link>
    </image>`;

    posts.forEach(post => {
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : buildDate;
      const postUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`;
      const title = escapeXml(post.title || 'Untitled');
      
      // Description: plain text, escaped
      let description = post.excerpt || post.content || '';
      description = description.replace(/<[^>]*>/g, '').trim();
      if (!description) description = 'No description available';
      description = escapeXml(description.substring(0, 500));
      
      // Content: HTML for CDATA (don't escape, CDATA handles it, but handle CDATA end markers)
      let content = post.contentHtml || post.content || '';
      content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      content = content.replace(/\]\]>/g, ']]&gt;');
      if (!content || content.trim().length === 0) {
        const fallback = post.excerpt || post.content || 'No content available';
        content = `<p>${fallback.replace(/<[^>]*>/g, '').trim()}</p>`;
      }
      
      const author = post.author?.username || 'NexCMS';
      let imageUrl = '${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg';
      if (post.thumbnail) {
        if (typeof post.thumbnail === 'string') {
          imageUrl = post.thumbnail;
        } else if (post.thumbnail.url) {
          imageUrl = post.thumbnail.url;
        }
      }
      imageUrl = escapeXml(imageUrl);
      
      // Extract CVE ID if present
      const cveMatch = post.title.match(/CVE-\d{4}-\d+/i);
      const cveId = cveMatch ? cveMatch[0].toUpperCase() : null;
      
      rss += `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${description}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <category>CVE</category>
      <category>Security</category>
      <category>Vulnerability</category>
      ${cveId ? `<category>${cveId}</category>` : ''}
      <media:thumbnail url="${imageUrl}"/>
      <media:content url="${imageUrl}" type="image/jpeg"/>
      ${post.tags && post.tags.length > 0 ? post.tags.map(tag => `<category>${escapeXml(tag)}</category>`).join('\n      ') : ''}
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800' // Cache for 30 minutes (CVEs update frequently)
    });
    
    res.send(rss);
    
  } catch (error) {
    console.error('Error generating CVE RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

// Category-specific RSS feed
router.get('/feed/:categorySlug.xml', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Find category
    const category = await Category.findOne({ slug: categorySlug });
    if (!category) {
      return res.status(404).send('Category not found');
    }
    
    // Get posts for this category
    const posts = await Post.find({ 
      status: 'published', 
      deleted: { $ne: true },
      category: category._id
    })
      .populate('category', 'name slug')
      .populate('author', 'username')
      .sort({ publishedAt: -1 })
      .limit(limit);
    
    const buildDate = new Date().toUTCString();
    
    // Build RSS XML
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(category.name)} - NexCMS</title>
    <link>${process.env.SITE_URL || 'http://localhost:3000'}/category/${categorySlug}</link>
    <description>Latest ${escapeXml(category.name)} news from NexCMS</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${buildDate}</pubDate>
    <ttl>60</ttl>
    <generator>NexCMS CMS</generator>
    <atom:link href="${process.env.SITE_URL || 'http://localhost:3000'}/feed/${categorySlug}.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg</url>
      <title>NexCMS - ${escapeXml(category.name)}</title>
      <link>${process.env.SITE_URL || 'http://localhost:3000'}/category/${categorySlug}</link>
    </image>`;

    posts.forEach(post => {
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : buildDate;
      const postUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`;
      const title = escapeXml(post.title || 'Untitled');
      
      // Description: plain text, escaped
      let description = post.excerpt || post.content || '';
      description = description.replace(/<[^>]*>/g, '').trim();
      if (!description) description = 'No description available';
      description = escapeXml(description.substring(0, 500));
      
      // Content: HTML for CDATA (don't escape, CDATA handles it, but handle CDATA end markers)
      let content = post.contentHtml || post.content || '';
      content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      content = content.replace(/\]\]>/g, ']]&gt;');
      if (!content || content.trim().length === 0) {
        const fallback = post.excerpt || post.content || 'No content available';
        content = `<p>${fallback.replace(/<[^>]*>/g, '').trim()}</p>`;
      }
      
      const author = post.author?.username || 'NexCMS';
      let imageUrl = '${process.env.SITE_URL || 'http://localhost:3000'}/favicon.svg';
      if (post.thumbnail) {
        if (typeof post.thumbnail === 'string') {
          imageUrl = post.thumbnail;
        } else if (post.thumbnail.url) {
          imageUrl = post.thumbnail.url;
        }
      }
      imageUrl = escapeXml(imageUrl);
      
      rss += `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description>${description}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <category>${escapeXml(category.name)}</category>
      <media:thumbnail url="${imageUrl}"/>
      <media:content url="${imageUrl}" type="image/jpeg"/>
      ${post.tags && post.tags.length > 0 ? post.tags.map(tag => `<category>${escapeXml(tag)}</category>`).join('\n      ') : ''}
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    res.set({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    
    res.send(rss);
    
  } catch (error) {
    console.error('Error generating category RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

module.exports = router;

