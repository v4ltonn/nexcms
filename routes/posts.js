const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const Category = require('../models/Category');
const User = require('../models/User');
const { contentWithCodeBlocksToHtml, hasCodeBlockMarkers } = require('../lib/convertCodeBlocks');

const router = express.Router();

// Function to extract tags from post content
function extractTagsFromContent(title, content) {
    // Common tech/crypto/gaming keywords to look for
    const keywordMap = {
        // People
        'elon musk': 'Elon Musk',
        'musk': 'Elon Musk',
        'jeff bezos': 'Jeff Bezos',
        'bezos': 'Jeff Bezos',
        'tim cook': 'Tim Cook',
        'cook': 'Tim Cook',
        'mark zuckerberg': 'Mark Zuckerberg',
        'zuckerberg': 'Mark Zuckerberg',
        'sundar pichai': 'Sundar Pichai',
        'pichai': 'Sundar Pichai',
        'satya nadella': 'Satya Nadella',
        'nadella': 'Satya Nadella',
        'arthur hayes': 'Arthur Hayes',
        'hayes': 'Arthur Hayes',
        
        // Companies
        'tesla': 'Tesla',
        'apple': 'Apple',
        'microsoft': 'Microsoft',
        'google': 'Google',
        'meta': 'Meta',
        'facebook': 'Facebook',
        'amazon': 'Amazon',
        'netflix': 'Netflix',
        'nvidia': 'NVIDIA',
        'amd': 'AMD',
        'intel': 'Intel',
        'samsung': 'Samsung',
        'sony': 'Sony',
        'playstation': 'PlayStation',
        'xbox': 'Xbox',
        'nintendo': 'Nintendo',
        'steam': 'Steam',
        'epic games': 'Epic Games',
        'activision': 'Activision',
        'blizzard': 'Blizzard',
        'ea': 'Electronic Arts',
        'electronic arts': 'Electronic Arts',
        
        // Cryptocurrency
        'bitcoin': 'Bitcoin',
        'btc': 'Bitcoin',
        'ethereum': 'Ethereum',
        'eth': 'Ethereum',
        'cryptocurrency': 'Cryptocurrency',
        'crypto': 'Cryptocurrency',
        'blockchain': 'Blockchain',
        'defi': 'DeFi',
        'nft': 'NFT',
        'web3': 'Web3',
        'binance': 'Binance',
        'coinbase': 'Coinbase',
        'solana': 'Solana',
        'cardano': 'Cardano',
        'polkadot': 'Polkadot',
        'chainlink': 'Chainlink',
        'uniswap': 'Uniswap',
        'opensea': 'OpenSea',
        
        // Technology
        'artificial intelligence': 'AI',
        'ai': 'AI',
        'machine learning': 'Machine Learning',
        'ml': 'Machine Learning',
        'deep learning': 'Deep Learning',
        'neural network': 'Neural Networks',
        'chatgpt': 'ChatGPT',
        'openai': 'OpenAI',
        'gpt': 'GPT',
        'robotics': 'Robotics',
        'robot': 'Robotics',
        'automation': 'Automation',
        'iot': 'IoT',
        'internet of things': 'IoT',
        '5g': '5G',
        '6g': '6G',
        'quantum computing': 'Quantum Computing',
        'quantum': 'Quantum Computing',
        'cloud computing': 'Cloud Computing',
        'cloud': 'Cloud Computing',
        'aws': 'AWS',
        'azure': 'Azure',
        'kubernetes': 'Kubernetes',
        'docker': 'Docker',
        
        // Cybersecurity
        'cybersecurity': 'Cybersecurity',
        'cyber security': 'Cybersecurity',
        'hacking': 'Hacking',
        'hacker': 'Hacking',
        'malware': 'Malware',
        'ransomware': 'Ransomware',
        'phishing': 'Phishing',
        'data breach': 'Data Breaches',
        'breach': 'Data Breaches',
        'data breaches': 'Data Breaches',
        'cyber attack': 'Cyber Attacks',
        'cyber attacks': 'Cyber Attacks',
        'cyberattack': 'Cyber Attacks',
        'cyberattacks': 'Cyber Attacks',
        'ddos': 'Cyber Attacks',
        'sql injection': 'Cyber Attacks',
        'cross-site scripting': 'Cyber Attacks',
        'xss': 'Cyber Attacks',
        'vulnerability': 'Vulnerabilities',
        'vulnerabilities': 'Vulnerabilities',
        'cve': 'Vulnerabilities',
        'security flaw': 'Vulnerabilities',
        'security flaws': 'Vulnerabilities',
        'exploit': 'Vulnerabilities',
        'exploits': 'Vulnerabilities',
        'zero day': 'Vulnerabilities',
        'zero-day': 'Vulnerabilities',
        'privacy': 'Privacy',
        'encryption': 'Encryption',
        'vpn': 'VPN',
        'firewall': 'Firewall',
        'antivirus': 'Antivirus',
        'penetration testing': 'Penetration Testing',
        'pentesting': 'Penetration Testing',
        
        // Gaming
        'gaming': 'Gaming',
        'video game': 'Video Games',
        'esports': 'Esports',
        'streaming': 'Streaming',
        'twitch': 'Twitch',
        'youtube gaming': 'YouTube Gaming',
        'discord': 'Discord',
        'steam': 'Steam',
        'vr': 'VR',
        'virtual reality': 'VR',
        'ar': 'AR',
        'augmented reality': 'AR',
        'metaverse': 'Metaverse',
        'mobile gaming': 'Mobile Gaming',
        'pc gaming': 'PC Gaming',
        'console gaming': 'Console Gaming',
        'indie games': 'Indie Games',
        'game development': 'Game Development',
        'unity': 'Unity',
        'unreal engine': 'Unreal Engine',
        
        // Tech Products
        'iphone': 'iPhone',
        'ipad': 'iPad',
        'macbook': 'MacBook',
        'mac': 'Mac',
        'android': 'Android',
        'windows': 'Windows',
        'linux': 'Linux',
        'chrome': 'Chrome',
        'firefox': 'Firefox',
        'safari': 'Safari',
        'edge': 'Edge',
        'github': 'GitHub',
        'git': 'Git',
        'docker': 'Docker',
        'kubernetes': 'Kubernetes',
        'jenkins': 'Jenkins',
        'ci/cd': 'CI/CD',
        'devops': 'DevOps',
        'agile': 'Agile',
        'scrum': 'Scrum',
        
        // Emerging Tech
        'self driving': 'Self-Driving',
        'autonomous': 'Autonomous Vehicles',
        'electric vehicle': 'Electric Vehicles',
        'ev': 'Electric Vehicles',
        'solar': 'Solar Energy',
        'renewable energy': 'Renewable Energy',
        'spacex': 'SpaceX',
        'space': 'Space',
        'satellite': 'Satellites',
        'starlink': 'Starlink',
        'mars': 'Mars',
        'moon': 'Moon',
        'asteroid': 'Asteroids',
        'space exploration': 'Space Exploration'
    };
    
    // Combine title and content for analysis
    const text = (title + ' ' + content).toLowerCase();
    const extractedTags = [];
    
    // Extract tags based on keywords
    for (const [keyword, tag] of Object.entries(keywordMap)) {
        if (text.includes(keyword.toLowerCase()) && !extractedTags.includes(tag)) {
            extractedTags.push(tag);
        }
    }
    
    // Limit to 8 tags maximum
    return extractedTags.slice(0, 8);
}

// Shared: get homepage data (used by GET /homepage API and by GET / for server-injected payload)
async function getHomepageData() {
  const Category = require('../models/Category');
  const vulnCategory = await Category.findOne({ slug: 'vulnerabilities' });
  const vulnCategoryId = vulnCategory ? vulnCategory._id : null;

  const filterVulnerabilities = (postList) => {
    return postList.filter(post => {
      if (!post || !post.title) return false;
      if (post.category) {
        const categoryId = post.category._id || post.category;
        const categorySlug = post.category.slug || (typeof post.category === 'string' ? post.category : '');
        if (categoryId && vulnCategoryId && String(categoryId) === String(vulnCategoryId)) return false;
        if (categorySlug === 'vulnerabilities' || categorySlug === 'vulnerability') return false;
      }
      const title = String(post.title).trim();
      const isCVE = /^CVE-\d{4}-\d+/i.test(title);
      const hasJSON = title.includes('{"Source"') || (title.startsWith('{') && title.includes('"Title"'));
      return !isCVE && !hasJSON;
    });
  };

  const cleanTitles = (postList) => {
    return postList.map(post => {
      if (post.title && (post.title.includes('{"Source"') || post.title.startsWith('{'))) {
        let cleanTitle = post.title;
        const jsonMatch = cleanTitle.match(/\{[\s\S]*?"Title"\s*:\s*"([^"]+)"[\s\S]*?\}/);
        if (jsonMatch && jsonMatch[1]) cleanTitle = jsonMatch[1].trim();
        else {
          try {
            const jsonData = JSON.parse(cleanTitle);
            if (jsonData.Title) cleanTitle = jsonData.Title.trim();
          } catch (e) {
            cleanTitle = cleanTitle.replace(/^\{.*?"Title"\s*:\s*"/, '').replace(/"\s*\}.*$/, '');
          }
        }
        cleanTitle = cleanTitle.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
        post.title = cleanTitle;
      }
      return post;
    });
  };

  const [allPosts, allFeatured, allTrending, allCategories] = await Promise.all([
    Post.find({ status: 'published', deleted: { $ne: true }, ...(vulnCategoryId ? { category: { $ne: vulnCategoryId } } : {}) })
      .populate('category', 'name slug color icon').populate('author', 'username')
      .sort({ publishedAt: -1, createdAt: -1 }).limit(100),
    Post.find({ status: 'published', deleted: { $ne: true }, featured: true, ...(vulnCategoryId ? { category: { $ne: vulnCategoryId } } : {}) })
      .populate('category', 'name slug color').populate('author', 'username').sort({ publishedAt: -1 }).limit(20),
    Post.find({ status: 'published', deleted: { $ne: true }, trending: true, ...(vulnCategoryId ? { category: { $ne: vulnCategoryId } } : {}) })
      .populate('category', 'name slug color').populate('author', 'username').sort({ views: -1, publishedAt: -1 }).limit(30),
    Category.find({ isActive: { $ne: false } }).sort({ order: 1, name: 1 })
  ]);

  const posts = cleanTitles(filterVulnerabilities(allPosts)).slice(0, 50);
  const featured = cleanTitles(filterVulnerabilities(allFeatured)).slice(0, 6);
  const trending = cleanTitles(filterVulnerabilities(allTrending)).slice(0, 10);

  const categoriesWithPosts = await Promise.all(
    allCategories.map(async (category) => {
      const categoryPosts = await Post.find({ status: 'published', deleted: { $ne: true }, category: category._id })
        .populate('category', 'name slug color icon').populate('author', 'username')
        .sort({ publishedAt: -1 }).limit(100);
      const filteredPosts = category.slug === 'vulnerabilities'
        ? cleanTitles(categoryPosts)
        : cleanTitles(filterVulnerabilities(categoryPosts));
      return { ...category.toObject(), posts: filteredPosts.slice(0, 4), totalPosts: filteredPosts.length };
    })
  );

  return { posts, featured, trending, categories: categoriesWithPosts };
}

// Get homepage data - API route (also cached via Cache-Control)
router.get('/homepage', async (req, res) => {
  try {
    const data = await getHomepageData();
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=300');
    res.json(data);
  } catch (error) {
    console.error('Homepage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, category, status, author } = req.query;
    const query = {};

    // Always exclude deleted posts
    query.deleted = { $ne: true };
    
    // Get Vulnerabilities category to exclude it
    const Category = require('../models/Category');
    const vulnCategory = await Category.findOne({ slug: 'vulnerabilities' });
    
    // Validate and sanitize query parameters
    if (category && category !== 'undefined') {
      // Validate ObjectId format
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        // Allow Vulnerabilities category to be accessed directly (for its own page)
        // But it's still excluded from homepage and category listings
        query.category = category;
      } else {
        return res.status(400).json({ message: 'Invalid category ID format' });
      }
    } else {
      // If no specific category requested, exclude Vulnerabilities category
      if (vulnCategory) {
        query.category = { $ne: vulnCategory._id };
      } else {
        // Fallback: exclude by title pattern if category doesn't exist yet
        query.title = { $not: /^CVE-\d{4}-\d+/i };
      }
    }
    
    // Default to published posts if no status specified, but allow 'all' to see all posts
    if (!status || status === '' || status === 'all') {
      // Don't filter by status if 'all' is specified
      if (status !== 'all') {
        query.status = 'published';
      }
    } else {
      query.status = status;
    }
    
    if (author && author !== 'undefined' && author.match(/^[0-9a-fA-F]{24}$/)) {
      query.author = author;
    }

    console.log('Query:', query);
    console.log('Post model:', Post ? 'LOADED' : 'NOT LOADED');
    
    // Get posts with populated categories - sort by publishedAt for newest first
    console.log('About to query Post.find with:', JSON.stringify(query));
    let posts = await Post.find(query)
      .populate('category', 'name slug color icon')
      .populate('author', 'username')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Clean titles - remove JSON artifacts
    posts = posts.map(post => {
      if (post.title && post.title.includes('{"Source"')) {
        let cleanTitle = post.title;
        const jsonMatch = cleanTitle.match(/\{[\s\S]*?"Title"\s*:\s*"([^"]+)"[\s\S]*?\}/);
        if (jsonMatch && jsonMatch[1]) {
          cleanTitle = jsonMatch[1].trim();
        } else {
          try {
            const jsonData = JSON.parse(cleanTitle);
            if (jsonData.Title) {
              cleanTitle = jsonData.Title.trim();
            }
          } catch (e) {
            cleanTitle = cleanTitle.replace(/^\{.*?"Title"\s*:\s*"/, '').replace(/"\s*\}.*$/, '');
          }
        }
        cleanTitle = cleanTitle.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
        post.title = cleanTitle;
      }
      return post;
    });

    console.log('Posts found:', posts.length);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured posts
router.get('/featured', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const posts = await Post.find({ featured: true, status: 'published', deleted: { $ne: true } })
      .populate('author', 'username')
      .populate('category', 'name slug color')
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit));

    res.json(posts);
  } catch (error) {
    console.error('Get featured posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending posts
router.get('/trending', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const posts = await Post.find({ trending: true, status: 'published', deleted: { $ne: true } })
      .populate('author', 'username')
      .populate('category', 'name slug color')
      .sort({ views: -1 })
      .limit(parseInt(limit));

    res.json(posts);
  } catch (error) {
    console.error('Get trending posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get cybersecurity subcategory posts
router.get('/cyber/:subcategory', async (req, res) => {
  try {
    const { subcategory } = req.params;
    const { limit = 10 } = req.query;
    
    // Map subcategory names to tag patterns
    const subcategoryMap = {
      'data-breaches': ['Data Breaches', 'Breach'],
      'cyber-attacks': ['Cyber Attacks', 'DDoS', 'Malware', 'Ransomware'],
      'vulnerabilities': ['Vulnerabilities', 'CVE', 'Zero Day', 'Exploit']
    };
    
    const tags = subcategoryMap[subcategory] || [];
    const query = { 
      status: 'published',
      tags: { $in: tags }
    };
    
    const posts = await Post.find(query)
      .populate('category', 'name slug color')
      .populate('author', 'username')
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit));

    res.json(posts);
  } catch (error) {
    console.error('Get cyber subcategory posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// OPTIMIZED: Get post with related and trending posts in ONE call
// IMPORTANT: This route MUST be defined BEFORE /slug/:slug to work correctly
router.get('/slug/:slug/full', async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await Post.findOne({ slug, status: 'published', deleted: { $ne: true } })
      .populate('category', 'name slug color icon')
      .populate('author', 'username email');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Increment view count
    post.views = (post.views || 0) + 1;
    await post.save();

    // Get related posts (same category, exclude current post)
    const relatedPosts = await Post.find({
      category: post.category?._id || post.category,
      status: 'published',
      deleted: { $ne: true },
      _id: { $ne: post._id }
    })
      .populate('category', 'name slug color')
      .populate('author', 'username')
      .sort({ publishedAt: -1 })
      .limit(4);

    // Get trending posts
    const trendingPosts = await Post.find({
      trending: true,
      status: 'published',
      deleted: { $ne: true },
      _id: { $ne: post._id }
    })
      .populate('category', 'name slug color')
      .populate('author', 'username')
      .sort({ views: -1, publishedAt: -1 })
      .limit(5);

    // Clean titles
    const cleanTitles = (postList) => {
      return postList.map(p => {
        if (p.title && (p.title.includes('{"Source"') || p.title.startsWith('{'))) {
          let cleanTitle = p.title;
          const jsonMatch = cleanTitle.match(/\{[\s\S]*?"Title"\s*:\s*"([^"]+)"[\s\S]*?\}/);
          if (jsonMatch && jsonMatch[1]) {
            cleanTitle = jsonMatch[1].trim();
          } else {
            try {
              const jsonData = JSON.parse(cleanTitle);
              if (jsonData.Title) cleanTitle = jsonData.Title.trim();
            } catch (e) {
              cleanTitle = cleanTitle.replace(/^\{.*?"Title"\s*:\s*"/, '').replace(/"\s*\}.*$/, '');
            }
          }
          cleanTitle = cleanTitle.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
          p.title = cleanTitle;
        }
        return p;
      });
    };

    // Clean post title
    let postTitle = post.title;
    if (postTitle && (postTitle.includes('{"Source"') || postTitle.startsWith('{'))) {
      const jsonMatch = postTitle.match(/\{[\s\S]*?"Title"\s*:\s*"([^"]+)"[\s\S]*?\}/);
      if (jsonMatch && jsonMatch[1]) {
        postTitle = jsonMatch[1].trim();
      } else {
        try {
          const jsonData = JSON.parse(postTitle);
          if (jsonData.Title) postTitle = jsonData.Title.trim();
        } catch (e) {
          postTitle = postTitle.replace(/^\{.*?"Title"\s*:\s*"/, '').replace(/"\s*\}.*$/, '');
        }
      }
      postTitle = postTitle.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      post.title = postTitle;
    }

    // If post has raw CODE_BLOCK/COMMAND_BLOCK in content, convert for response so client gets rendered blocks
    if (post.content && hasCodeBlockMarkers(post.content)) {
      const cleaned = (post.content || '').replace(/Enter fullscreen mode/gi, '').replace(/Exit fullscreen mode/gi, '').replace(/Hide this comment/gi, '').trim();
      post.contentHtml = contentWithCodeBlocksToHtml(cleaned);
    }

    res.json({
      post,
      related: cleanTitles(relatedPosts),
      trending: cleanTitles(trendingPosts)
    });
  } catch (error) {
    console.error('Get post full error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published' })
      .populate('author', 'username email')
      .populate('category', 'name slug color');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Increment views
    post.views += 1;
    await post.save();

    res.json(post);
  } catch (error) {
    console.error('Get post by slug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single post
router.get('/:id', async (req, res) => {
  try {
    let post;
    
    // Check if it's a valid ObjectId
    if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      // It's an ObjectId, find by ID
      post = await Post.findById(req.params.id)
        .populate('author', 'username email')
        .populate('category', 'name slug color');
    } else {
      // It's a slug, find by slug
      post = await Post.findOne({ slug: req.params.id })
        .populate('author', 'username email')
        .populate('category', 'name slug color');
    }

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Increment views
    post.views += 1;
    await post.save();

    res.json(post);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured posts
router.get('/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const posts = await Post.getFeaturedPosts(limit);
    res.json(posts);
  } catch (error) {
    console.error('Get featured posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending posts
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const posts = await Post.getTrendingPosts(limit);
    res.json(posts);
  } catch (error) {
    console.error('Get trending posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get related posts
router.get('/related/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const relatedPosts = await Post.find({
      _id: { $ne: post._id },
      status: 'published',
      $or: [
        { category: post.category },
        { tags: { $in: post.tags } }
      ]
    })
    .populate('author', 'username')
    .populate('category', 'name slug color')
    .sort({ publishedAt: -1 })
    .limit(6);

    res.json(relatedPosts);
  } catch (error) {
    console.error('Get related posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new post
router.post('/', [
  body('title').notEmpty().trim(),
  body('content').notEmpty().trim(),
  body('category').isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, contentHtml, excerpt, slug: customSlug, category, thumbnail, tags, status = 'draft', featured = false, trending = false } = req.body;

    // Slug: use custom if provided and valid, else generate from title
    const slugifyStr = (s) => String(s || '').toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const slug = (customSlug && slugifyStr(customSlug)) || slugifyStr(title) || 'post';

    // Extract tags from content automatically
    const extractedTags = extractTagsFromContent(title, content);
    const existingTags = tags || [];
    const allTags = [...new Set([...existingTags, ...extractedTags])].slice(0, 10);

    const post = new Post({
      title,
      slug,
      content,
      contentHtml: (contentHtml && contentHtml.trim()) ? contentHtml : `<p>${String(content).replace(/\n/g, '</p><p>')}</p>`,
      excerpt: excerpt || content.substring(0, 150) + '...',
      category,
      thumbnail,
      tags: allTags,
      status,
      featured,
      trending,
      author: req.user?.userId || '68fd4e14e7234f3408e4d67f', // Default admin user
      publishedAt: status === 'published' ? new Date() : null
    });

    await post.save();
    await post.populate('author', 'username');
    await post.populate('category', 'name slug color');

    // Purge homepage cache so new post shows (Cloudflare + browser cache)
    if (status === 'published') {
      try { require('../services/purge-homepage-cache').purgeHomepageCache(); } catch (e) {}
      setTimeout(async () => {
        try {
          const postUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`;
          
          // INSTANT INDEXING: Submit to Google Indexing API (if configured)
          try {
            const { submitToGoogleIndexing, submitViaPing } = require('../services/google-indexing');
            
            // Try OAuth method first, fallback to ping method
            const result = await submitToGoogleIndexing(postUrl, 'URL_UPDATED').catch(async () => {
              return await submitViaPing(postUrl);
            });
            
            if (result && result.success) {
              console.log(`🚀 Google Indexing API: Instant indexing requested for ${post.slug}`);
            }
          } catch (e) {
            // Google Indexing API not configured - that's okay, use fallback methods
            console.log('ℹ️  Google Indexing API not configured, using ping methods');
          }
          
          // FALLBACK: Notify Google via sitemap (slower but works)
          const { notifyGoogle } = require('../notify-google');
          await notifyGoogle('${process.env.SITE_URL || 'http://localhost:3000'}/sitemap.xml');
          
          // IndexNow notify - submit to ALL supported search engines
          try {
            const { submitUrl } = require('../services/indexnow-enhanced');
            const result = await submitUrl(postUrl);
            if (result && result.ok) {
              console.log(`✅ IndexNow: Submitted ${post.slug} to ${result.successCount} search engines`);
            }
          } catch (e) {
            console.error('IndexNow submission error:', e.message);
          }
        } catch (error) {
          // Silent fail - notification is not critical
          console.error('Search engine notification error:', error.message);
        }
      }, 2000);
    }

    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update post
router.put('/:id', [
  body('title').optional().notEmpty().trim(),
  body('content').optional().notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, contentHtml, excerpt, slug: customSlug, category, thumbnail, tags, status, featured, trending } = req.body;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const slugifyStr = (s) => String(s || '').toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Update fields
    if (title) post.title = title;
    if (customSlug !== undefined) {
      post.slug = (customSlug && slugifyStr(customSlug)) || slugifyStr(post.title) || post.slug;
    } else if (title) {
      post.slug = slugifyStr(post.title) || post.slug;
    }
    if (content) {
      post.content = content;
      post.contentHtml = (contentHtml && contentHtml.trim()) ? contentHtml : `<p>${String(content).replace(/\n/g, '</p><p>')}</p>`;

      // Re-extract tags if content changed
      const extractedTags = extractTagsFromContent(post.title, content);
      const existingTags = tags || post.tags || [];
      post.tags = [...new Set([...existingTags, ...extractedTags])].slice(0, 10);
    } else if (contentHtml && contentHtml.trim()) {
      post.contentHtml = contentHtml;
    }
    if (excerpt !== undefined) post.excerpt = excerpt;
    if (category) post.category = category;
    if (thumbnail) post.thumbnail = thumbnail;
    if (tags && !content) post.tags = tags; // Only update tags if content didn't change
    if (status !== undefined) {
      post.status = status;
      if (status === 'published' && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }
    if (featured !== undefined) post.featured = featured;
    if (trending !== undefined) post.trending = trending;

    await post.save();
    await post.populate('author', 'username');
    await post.populate('category', 'name slug color');

    // Purge homepage cache so updated post shows
    if (post.status === 'published') {
      try { require('../services/purge-homepage-cache').purgeHomepageCache(); } catch (e) {}
      setTimeout(async () => {
        try {
          const postUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`;
          
          // INSTANT INDEXING: Submit to Google Indexing API (if configured)
          try {
            const { submitToGoogleIndexing, submitViaPing } = require('../services/google-indexing');
            
            // Try OAuth method first, fallback to ping method
            const result = await submitToGoogleIndexing(postUrl, 'URL_UPDATED').catch(async () => {
              return await submitViaPing(postUrl);
            });
            
            if (result && result.success) {
              console.log(`🚀 Google Indexing API: Instant indexing requested for updated ${post.slug}`);
            }
          } catch (e) {
            // Google Indexing API not configured - that's okay, use fallback methods
            console.log('ℹ️  Google Indexing API not configured, using ping methods');
          }
          
          // FALLBACK: Notify Google via sitemap (slower but works)
          const { notifyGoogle } = require('../notify-google');
          await notifyGoogle('${process.env.SITE_URL || 'http://localhost:3000'}/sitemap.xml');
          
          // IndexNow notify - submit to ALL supported search engines
          try {
            const { submitUrl } = require('../services/indexnow-enhanced');
            const result = await submitUrl(postUrl);
            if (result && result.ok) {
              console.log(`✅ IndexNow: Submitted updated ${post.slug} to ${result.successCount} search engines`);
            }
          } catch (e) {
            console.error('IndexNow submission error:', e.message);
          }
        } catch (error) {
          // Silent fail - notification is not critical
          console.error('Search engine notification error:', error.message);
        }
      }, 2000);
    }

    res.json(post);
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete post
router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // SAFETY CHECK: Prevent deletion when there are 10 or fewer posts
    const totalPosts = await Post.countDocuments({ status: 'published', deleted: { $ne: true } });
    if (totalPosts <= 20) {
      return res.status(403).json({ 
        message: 'CRITICAL: Cannot delete posts! Only 20 or fewer posts remain. Contact admin.',
        requiresConfirmation: true,
        safetyFeature: true
      });
    }

    // SOFT DELETE instead of hard delete
    console.log(`🔒 SOFT DELETING post: ${post.title} (${post.slug})`);
    post.deleted = true;
    post.deletedAt = new Date();
    post.status = 'soft-deleted';
    await post.save();
    try { require('../services/purge-homepage-cache').purgeHomepageCache(); } catch (e) {}
    res.json({ message: 'Post soft-deleted successfully (can be restored)' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
module.exports.getHomepageData = getHomepageData;