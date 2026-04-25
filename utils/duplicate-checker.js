/**
 * Enhanced duplicate checker for posts
 * Checks against existing posts in database using similarity algorithms
 */

const { 
  calculateSimilarity, 
  jaccardSimilarity, 
  normalizeContent,
  isDuplicateTitle,
  isDuplicateContent,
  isDuplicateExcerpt
} = require('./similarity-checker');

// Similarity thresholds
const THRESHOLDS = {
  title: 0.85,      // 85%+ similarity = duplicate
  excerpt: 0.80,   // 80%+ similarity = duplicate
  content: 0.75     // 75%+ similarity = duplicate
};

/**
 * Check if a new post would be a duplicate of existing posts
 * @param {Model} Post - Mongoose Post model
 * @param {Object} newPost - New post data { title, excerpt?, content?, contentHtml? }
 * @param {Object} options - Options { daysToCheck, thresholds }
 * @returns {Object} { duplicate: boolean, reason?: string, similarity?: number, existing?: Object }
 */
async function checkForDuplicates(Post, newPost, options = {}) {
  const {
    daysToCheck = 30,  // Check last 30 days
    thresholds = THRESHOLDS,
    excludeDeleted = true
  } = options;
  
  if (!newPost.title) {
    return { duplicate: false, error: 'Title is required' };
  }
  
  // Build query
  const query = {
    status: 'published'
  };
  
  if (excludeDeleted) {
    query.deleted = { $ne: true };
  }
  
  // Check recent posts (within specified days)
  if (daysToCheck > 0) {
    const cutoffDate = new Date(Date.now() - daysToCheck * 24 * 60 * 60 * 1000);
    query.publishedAt = { $gte: cutoffDate };
  }
  
  // Fetch recent posts
  const recentPosts = await Post.find(query)
    .select('title excerpt content contentHtml slug publishedAt')
    .lean()
    .limit(1000); // Limit for performance
  
  // Check each existing post
  for (const existing of recentPosts) {
    // 1. Check title similarity
    const titleSim = calculateSimilarity(existing.title, newPost.title);
    if (titleSim >= thresholds.title) {
      return {
        duplicate: true,
        reason: 'title',
        similarity: titleSim,
        existing: {
          id: existing._id.toString(),
          title: existing.title,
          slug: existing.slug,
          publishedAt: existing.publishedAt
        }
      };
    }
    
    // 2. Check excerpt similarity (if both have excerpts)
    if (newPost.excerpt && existing.excerpt) {
      const excerptSim = calculateSimilarity(existing.excerpt, newPost.excerpt);
      if (excerptSim >= thresholds.excerpt) {
        return {
          duplicate: true,
          reason: 'excerpt',
          similarity: excerptSim,
          existing: {
            id: existing._id.toString(),
            title: existing.title,
            slug: existing.slug,
            excerpt: existing.excerpt,
            publishedAt: existing.publishedAt
          }
        };
      }
    }
    
    // 3. Check content similarity (if both have content)
    if (newPost.content || newPost.contentHtml) {
      const newContent = normalizeContent(newPost.content || newPost.contentHtml);
      const existingContent = normalizeContent(existing.content || existing.contentHtml);
      
      if (newContent.length > 100 && existingContent.length > 100) {
        const contentSim = jaccardSimilarity(newContent, existingContent);
        if (contentSim >= thresholds.content) {
          return {
            duplicate: true,
            reason: 'content',
            similarity: contentSim,
            existing: {
              id: existing._id.toString(),
              title: existing.title,
              slug: existing.slug,
              publishedAt: existing.publishedAt
            }
          };
        }
      }
    }
  }
  
  return { duplicate: false };
}

/**
 * Quick check for title duplicates only (faster)
 */
async function checkTitleDuplicate(Post, title, options = {}) {
  const {
    daysToCheck = 30,
    threshold = THRESHOLDS.title,
    excludeDeleted = true
  } = options;
  
  const query = {
    status: 'published'
  };
  
  if (excludeDeleted) {
    query.deleted = { $ne: true };
  }
  
  if (daysToCheck > 0) {
    const cutoffDate = new Date(Date.now() - daysToCheck * 24 * 60 * 60 * 1000);
    query.publishedAt = { $gte: cutoffDate };
  }
  
  const recentPosts = await Post.find(query)
    .select('title slug publishedAt')
    .lean()
    .limit(500);
  
  for (const existing of recentPosts) {
    const similarity = calculateSimilarity(existing.title, title);
    if (similarity >= threshold) {
      return {
        duplicate: true,
        similarity,
        existing: {
          id: existing._id.toString(),
          title: existing.title,
          slug: existing.slug,
          publishedAt: existing.publishedAt
        }
      };
    }
  }
  
  return { duplicate: false };
}

/**
 * Find all duplicates of a given post
 */
async function findDuplicates(Post, postId, options = {}) {
  const post = await Post.findById(postId)
    .select('title excerpt content contentHtml publishedAt')
    .lean();
  
  if (!post) {
    return { error: 'Post not found' };
  }
  
  const duplicates = await checkForDuplicates(Post, post, {
    ...options,
    daysToCheck: 365 // Check last year
  });
  
  // This would need to be enhanced to return all matches, not just first
  return duplicates;
}

module.exports = {
  checkForDuplicates,
  checkTitleDuplicate,
  findDuplicates,
  THRESHOLDS
};
