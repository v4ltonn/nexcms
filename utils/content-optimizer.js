/**
 * Content optimization utilities for better SEO and user experience
 */

/**
 * Generate SEO-optimized excerpt from content
 * @param {string} content - Raw content
 * @param {number} maxLength - Maximum length (default 160 for meta description)
 * @returns {string} Optimized excerpt
 */
function generateExcerpt(content, maxLength = 160) {
  if (!content) return '';
  
  // Remove HTML tags
  let text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Remove common prefixes that don't add value
  text = text.replace(/^(BREAKING|URGENT|NEWS|UPDATE|ALERT):\s*/i, '');
  
  // If content is short enough, return it
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to find a good breaking point (sentence end)
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.6) {
    // Good sentence break found
    return truncated.substring(0, lastSentenceEnd + 1);
  }
  
  // Try word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Fallback: hard cut
  return truncated.substring(0, maxLength - 3) + '...';
}

/**
 * Extract and generate relevant tags from content
 * @param {string} title - Post title
 * @param {string} content - Post content
 * @param {string} categorySlug - Category slug
 * @returns {string[]} Array of tags
 */
function extractTags(title, content, categorySlug) {
  const tags = new Set();
  
  // Category-based tags
  const categoryTags = {
    tech: ['technology', 'tech news', 'innovation', 'software', 'hardware', 'ai', 'machine learning'],
    cyber: ['cybersecurity', 'security', 'infosec', 'vulnerability', 'threat', 'malware', 'ransomware', 'breach'],
    crypto: ['cryptocurrency', 'bitcoin', 'blockchain', 'crypto', 'defi', 'nft', 'ethereum'],
    gaming: ['gaming', 'video games', 'esports', 'console', 'pc gaming', 'mobile gaming'],
    tools: ['tools', 'utilities', 'security tools', 'developer tools', 'productivity']
  };
  
  // Add category-specific tags
  if (categoryTags[categorySlug]) {
    categoryTags[categorySlug].slice(0, 3).forEach(tag => tags.add(tag));
  }
  
  // Extract keywords from title (words 5+ chars, not common words)
  const commonWords = new Set(['the', 'this', 'that', 'with', 'from', 'have', 'been', 'will', 'what', 'when', 'where', 'which', 'about', 'their', 'there', 'these', 'those']);
  const titleWords = (title || '').toLowerCase().match(/\b\w{5,}\b/g) || [];
  titleWords.forEach(word => {
    if (!commonWords.has(word) && word.length >= 5) {
      tags.add(word);
    }
  });
  
  // Extract from content (first 500 chars)
  const contentText = (content || '').replace(/<[^>]*>/g, ' ').substring(0, 500);
  const contentWords = contentText.toLowerCase().match(/\b\w{6,}\b/g) || [];
  contentWords.forEach(word => {
    if (!commonWords.has(word) && word.length >= 6 && tags.size < 8) {
      tags.add(word);
    }
  });
  
  // Special handling for security terms
  const securityTerms = ['cve', 'xss', 'sql injection', 'rce', 'ddos', 'apt', 'siem', 'edr', 'xdr', 'soar', 'osint'];
  const combinedText = (title + ' ' + contentText).toLowerCase();
  securityTerms.forEach(term => {
    if (combinedText.includes(term) && !tags.has(term)) {
      tags.add(term);
    }
  });
  
  // Limit to 10 tags max
  return Array.from(tags).slice(0, 10);
}

/**
 * Enhance content with internal linking opportunities
 * @param {string} contentHtml - HTML content
 * @param {string} categorySlug - Category slug for related links
 * @returns {string} Enhanced HTML with internal links
 */
function addInternalLinks(contentHtml, categorySlug) {
  if (!contentHtml) return contentHtml;
  
  // For now, return as-is. Internal linking can be added later
  // when we have a better system for finding related posts
  return contentHtml;
}

/**
 * Generate SEO-friendly meta description
 * @param {string} title - Post title
 * @param {string} excerpt - Post excerpt
 * @param {string[]} tags - Post tags
 * @returns {string} Meta description (150-160 chars)
 */
function generateMetaDescription(title, excerpt, tags) {
  // Use excerpt if it's good
  if (excerpt && excerpt.length >= 120 && excerpt.length <= 160) {
    return excerpt;
  }
  
  // Build from title + tags
  let description = title;
  
  // Add relevant tags if space allows
  if (tags && tags.length > 0) {
    const relevantTags = tags.slice(0, 2).join(', ');
    const candidate = `${title} - ${relevantTags}`;
    if (candidate.length <= 160) {
      description = candidate;
    }
  }
  
  // Ensure proper length
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  } else if (description.length < 120 && excerpt) {
    // Use excerpt if description is too short
    description = excerpt.substring(0, 160);
  }
  
  return description;
}

/**
 * Clean and optimize content HTML
 * @param {string} contentHtml - Raw HTML content
 * @returns {string} Cleaned HTML
 */
function cleanContentHtml(contentHtml) {
  if (!contentHtml) return '';
  
  // Remove script tags
  let cleaned = contentHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  
  // Remove style tags (keep inline styles)
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Ensure proper paragraph tags
  cleaned = cleaned.replace(/\n\n+/g, '</p><p>');
  
  // Add paragraph tags if missing
  if (!cleaned.includes('<p>') && !cleaned.includes('<div>')) {
    cleaned = `<p>${cleaned}</p>`;
  }
  
  return cleaned;
}

/**
 * Generate content with source attribution
 * @param {string} contentHtml - Main content HTML
 * @param {string} sourceUrl - Source URL
 * @param {string} sourceName - Source name
 * @returns {string} Content with attribution
 */
function addSourceAttribution(contentHtml, sourceUrl, sourceName) {
  if (!sourceUrl) return contentHtml;
  
  const attribution = `
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); padding: 20px; border-radius: 12px; margin: 30px 0; border-left: 5px solid #00ff88;">
      <p style="color: #888; font-size: 14px; margin: 0;">
        <strong style="color: #00ff88;">Source:</strong> 
        <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: #00ff88; text-decoration: none;">
          ${sourceName || 'Original Article'}
        </a>
      </p>
    </div>
  `;
  
  return contentHtml + attribution;
}

module.exports = {
  generateExcerpt,
  extractTags,
  addInternalLinks,
  generateMetaDescription,
  cleanContentHtml,
  addSourceAttribution
};
