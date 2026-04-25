/**
 * Similarity checking utilities for duplicate detection
 * Uses Levenshtein distance and Jaccard similarity
 */

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate similarity between two strings (0-1, where 1 is identical)
 * Uses Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = String(str1).trim().toLowerCase();
  const s2 = String(str2).trim().toLowerCase();
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000); // Limit for performance
}

/**
 * Jaccard similarity (for content blocks)
 * Measures similarity based on shared word sets
 */
function jaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1.0;
  
  // Tokenize into words (filter out very short words)
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  // Calculate intersection and union
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Normalize content for hashing/comparison
 */
function normalizeContent(content) {
  if (!content) return '';
  
  // If HTML, extract text first
  let text = String(content);
  if (text.includes('<')) {
    text = extractTextFromHtml(text);
  }
  
  return normalizeText(text).substring(0, 5000); // Limit for performance
}

/**
 * Check if two titles are duplicates based on similarity threshold
 */
function isDuplicateTitle(title1, title2, threshold = 0.85) {
  return calculateSimilarity(title1, title2) >= threshold;
}

/**
 * Check if two content blocks are duplicates
 */
function isDuplicateContent(content1, content2, threshold = 0.75) {
  const norm1 = normalizeContent(content1);
  const norm2 = normalizeContent(content2);
  return jaccardSimilarity(norm1, norm2) >= threshold;
}

/**
 * Check if excerpt is duplicate
 */
function isDuplicateExcerpt(excerpt1, excerpt2, threshold = 0.80) {
  return calculateSimilarity(excerpt1, excerpt2) >= threshold;
}

module.exports = {
  calculateSimilarity,
  jaccardSimilarity,
  normalizeText,
  normalizeContent,
  extractTextFromHtml,
  isDuplicateTitle,
  isDuplicateContent,
  isDuplicateExcerpt,
  levenshteinDistance
};
