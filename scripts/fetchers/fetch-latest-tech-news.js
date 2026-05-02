const mongoose = require('mongoose');
const Post = require('./models/Post');
const Category = require('./models/Category');
const User = require('./models/User');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const { varyTitle } = require('./utils/vary-title');
const { ensureUniqueTitle } = require('./utils/ensure-unique-title');
const { makeDistinctTitle } = require('./utils/distinct-title');
const { generateExcerpt, extractTags, addSourceAttribution, cleanContentHtml } = require('./utils/content-optimizer');
const { getExcerpt, getTags, ensureMinimumContent } = require('./utils/llm-content-enhancer');
const { cleanSlugFromTitle } = require('./utils/content-quality-gate');
const useLocalLlm = process.env.USE_LOCAL_LLM === '1' || process.env.USE_LOCAL_LLM === 'true';

// Translation function using LibreTranslate (optional - can be disabled if not needed)
async function translateText(text, targetLang = 'en') {
  try {
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text'
      })
    });
    const data = await response.json();
    return data.translatedText || text;
  } catch (error) {
    console.log('Translation failed, using original:', error.message);
    return text;
  }
}

// Extract image from article or use fallback
async function extractImageFromArticle(url, title) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    let dom;
    try {
      dom = new JSDOM(html, {
        url: url,
        pretendToBeVisual: true,
        resources: 'usable',
        runScripts: 'outside-only'
      });
    } catch (err) {
      // Suppress CSS parsing errors - non-critical
      dom = new JSDOM(html, {
        url: url,
        pretendToBeVisual: false,
        resources: 'usable',
        runScripts: 'outside-only'
      });
    }
    const doc = dom.window.document;
    
    // Try to find article image
    let imageUrl = null;
    
    // Check for Open Graph image
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) {
      imageUrl = ogImage.content;
    }
    
    // Check for article image
    if (!imageUrl) {
      const articleImg = doc.querySelector('article img, .article-image img, .post-image img, .featured-image img');
      if (articleImg && articleImg.src) {
        imageUrl = articleImg.src;
      }
    }
    
    // Check for first large image
    if (!imageUrl) {
      const images = doc.querySelectorAll('img');
      for (const img of images) {
        const src = img.src || img.getAttribute('data-src');
        if (src && (src.includes('jpg') || src.includes('png') || src.includes('jpeg')) && 
            !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
          // Make absolute URL if relative
          if (src.startsWith('//')) {
            imageUrl = 'https:' + src;
          } else if (src.startsWith('/')) {
            const urlObj = new URL(url);
            imageUrl = urlObj.origin + src;
          } else if (src.startsWith('http')) {
            imageUrl = src;
          }
          if (imageUrl) break;
        }
      }
    }
    
    return imageUrl;
  } catch (error) {
    console.log(`Could not extract image from ${url}:`, error.message);
    return null;
  }
}

// Generate fallback image URL based on category
function getFallbackImage(categorySlug) {
  const photos = {
    'tech': ['1677442136019-21780ecad995', '1485827404703-89b55fcc595e', '1451187580459-2f537d8b7c4e', '1550751827-4bd374c3fb58', '1518770660359-4b2d8b8d4f93'],
    'cyber': ['1555949963-aa79dcee981c', '1563013544-824ae1b704d3', '1516321318-c94a5b444d60', '1550751827-4bd374c3fb58', '1516321497447-c8f7f3e4b5b0'],
    'cyber-security': ['1555949963-aa79dcee981c', '1563013544-824ae1b704d3', '1516321318-c94a5b444d60'],
    'gaming': ['1542751371-adc38448a05e', '1606144042614-b2417e99c4e3', '1511510337158-816998e37139', '1550751827-4bd374c3fb58']
  };
  const pool = photos[categorySlug] || photos['tech'];
  const photoId = pool[Math.floor(Math.random() * pool.length)];
  return `https://images.unsplash.com/photo-${photoId}?w=800&h=400&fit=crop`;
}

// Extract article content
async function extractArticleContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await response.text();
    let dom;
    try {
      dom = new JSDOM(html, {
        url: url,
        pretendToBeVisual: true,
        resources: 'usable',
        runScripts: 'outside-only'
      });
    } catch (err) {
      // Suppress CSS parsing errors - non-critical
      dom = new JSDOM(html, {
        url: url,
        pretendToBeVisual: false,
        resources: 'usable',
        runScripts: 'outside-only'
      });
    }
    const doc = dom.window.document;
    
    // Remove scripts and styles
    doc.querySelectorAll('script, style, nav, footer, aside, .advertisement, .ads').forEach(el => el.remove());
    
    // Try to find article content
    let content = '';
    const article = doc.querySelector('article, .article-content, .post-content, .entry-content, .story-body, main');
    if (article) {
      // Get all paragraphs
      const paragraphs = article.querySelectorAll('p');
      content = Array.from(paragraphs)
        .map(p => p.textContent.trim())
        .filter(p => p.length > 20)
        .slice(0, 10)
        .join('\n\n');
    }
    
    // Fallback: get first few paragraphs from body
    if (!content || content.length < 100) {
      const paragraphs = doc.querySelectorAll('p');
      content = Array.from(paragraphs)
        .map(p => p.textContent.trim())
        .filter(p => p.length > 50 && !p.includes('cookie') && !p.includes('privacy'))
        .slice(0, 5)
        .join('\n\n');
    }
    
    return content.substring(0, 2000); // Limit to 2000 chars
  } catch (error) {
    console.log(`Could not extract content from ${url}:`, error.message);
    return null;
  }
}

// Generate slug from title
function slugify(title) {
  return title.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

// Fetch from HackerNews
async function fetchHackerNewsStories(limit = 20) {
  const stories = [];
  try {
    const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topStoryIds = await response.json();
    
    for (let i = 0; i < Math.min(limit, topStoryIds.length); i++) {
      try {
        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${topStoryIds[i]}.json`);
        const story = await storyResponse.json();
        
        if (!story || !story.title || !story.url) continue;
        
        stories.push({
          title: story.title,
          url: story.url,
          source: 'HackerNews',
          sourceUrl: `https://news.ycombinator.com/item?id=${story.id}`,
          score: story.score || 0,
          publishedAt: new Date(story.time * 1000)
        });
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error fetching HackerNews story ${topStoryIds[i]}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Error fetching HackerNews:', error.message);
  }
  
  return stories;
}

// Fetch from TechCrunch RSS
async function fetchTechCrunchNews(limit = 15) {
  const stories = [];
  try {
    // TechCrunch RSS feed
    const response = await fetch('https://techcrunch.com/feed/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const xml = await response.text();
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const doc = dom.window.document;
    
    const items = doc.querySelectorAll('item');
    for (let i = 0; i < Math.min(limit, items.length); i++) {
      const item = items[i];
      const title = item.querySelector('title')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const pubDate = item.querySelector('pubDate')?.textContent;
      
      if (title && link) {
        stories.push({
          title: title.trim(),
          url: link.trim(),
          source: 'TechCrunch',
          sourceUrl: 'https://techcrunch.com',
          publishedAt: pubDate ? new Date(pubDate) : new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error fetching TechCrunch:', error.message);
  }
  
  return stories;
}

// Fetch from The Verge RSS
async function fetchTheVergeNews(limit = 15) {
  const stories = [];
  try {
    const response = await fetch('https://www.theverge.com/rss/index.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const xml = await response.text();
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const doc = dom.window.document;
    
    const items = doc.querySelectorAll('item');
    for (let i = 0; i < Math.min(limit, items.length); i++) {
      const item = items[i];
      const title = item.querySelector('title')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const pubDate = item.querySelector('pubDate')?.textContent;
      
      if (title && link) {
        stories.push({
          title: title.trim(),
          url: link.trim(),
          source: 'The Verge',
          sourceUrl: 'https://www.theverge.com',
          publishedAt: pubDate ? new Date(pubDate) : new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error fetching The Verge:', error.message);
  }
  
  return stories;
}

// Fetch from BleepingComputer (Cybersecurity)
async function fetchBleepingComputerNews(limit = 15) {
  const stories = [];
  try {
    const response = await fetch('https://www.bleepingcomputer.com/feed/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const xml = await response.text();
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const doc = dom.window.document;
    
    const items = doc.querySelectorAll('item');
    for (let i = 0; i < Math.min(limit, items.length); i++) {
      const item = items[i];
      const title = item.querySelector('title')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const pubDate = item.querySelector('pubDate')?.textContent;
      
      if (title && link) {
        stories.push({
          title: title.trim(),
          url: link.trim(),
          source: 'BleepingComputer',
          sourceUrl: 'https://www.bleepingcomputer.com',
          publishedAt: pubDate ? new Date(pubDate) : new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error fetching BleepingComputer:', error.message);
  }
  
  return stories;
}

// Fetch from PC Gamer RSS
async function fetchPCGamerNews(limit = 15) {
  const stories = [];
  try {
    const response = await fetch('https://www.pcgamer.com/rss/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const xml = await response.text();
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const doc = dom.window.document;
    
    const items = doc.querySelectorAll('item');
    for (let i = 0; i < Math.min(limit, items.length); i++) {
      const item = items[i];
      const title = item.querySelector('title')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const pubDate = item.querySelector('pubDate')?.textContent;
      
      if (title && link) {
        stories.push({
          title: title.trim(),
          url: link.trim(),
          source: 'PC Gamer',
          sourceUrl: 'https://www.pcgamer.com',
          publishedAt: pubDate ? new Date(pubDate) : new Date()
        });
      }
    }
  } catch (error) {
    console.error('Error fetching PC Gamer:', error.message);
  }
  
  return stories;
}

// Determine category from title/keywords
function determineCategory(title, categories) {
  const titleLower = title.toLowerCase();
  
  // Cybersecurity keywords
  if (titleLower.match(/hack|breach|vulnerability|cyber|security|cve|malware|ransomware|attack|exploit|phishing|data breach/i)) {
    return categories.cyber || categories['cyber-security'];
  }
  
  // Gaming keywords
  if (titleLower.match(/game|gaming|console|playstation|xbox|nintendo|steam|esports|gpu|graphics card|pc gaming/i)) {
    return categories.gaming;
  }
  
  // Crypto keywords
  if (titleLower.match(/bitcoin|crypto|blockchain|ethereum|btc|eth|defi|nft|web3/i)) {
    return categories.crypto;
  }
  
  // Default to tech
  return categories.tech || categories['tech'];
}

async function fetchAndCreatePosts() {
  try {
    await mongoose.connect('mongodb://localhost:27017/nexcms');
    console.log('✅ Connected to MongoDB');
    
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    // Get categories
    const techCategory = await Category.findOne({ $or: [{ slug: 'tech' }, { slug: 'technology' }] });
    const cyberCategory = await Category.findOne({ $or: [{ slug: 'cyber' }, { slug: 'cyber-security' }, { slug: 'cybersecurity' }] });
    const cryptoCategory = await Category.findOne({ slug: 'crypto' });
    const gamingCategory = await Category.findOne({ slug: 'gaming' });
    
    const categories = {
      tech: techCategory,
      cyber: cyberCategory,
      'cyber-security': cyberCategory,
      crypto: cryptoCategory,
      gaming: gamingCategory
    };
    
    console.log('📰 Fetching latest news from multiple sources...\n');
    
    // Fetch from all sources
    const [hnStories, tcStories, vergeStories, bcStories, pcgStories] = await Promise.all([
      fetchHackerNewsStories(20),
      fetchTechCrunchNews(15),
      fetchTheVergeNews(15),
      fetchBleepingComputerNews(15),
      fetchPCGamerNews(15)
    ]);
    
    const allStories = [
      ...hnStories,
      ...tcStories,
      ...vergeStories,
      ...bcStories,
      ...pcgStories
    ];
    
    console.log(`📊 Fetched ${allStories.length} stories total:\n  - HackerNews: ${hnStories.length}\n  - TechCrunch: ${tcStories.length}\n  - The Verge: ${vergeStories.length}\n  - BleepingComputer: ${bcStories.length}\n  - PC Gamer: ${pcgStories.length}\n`);
    
    const postsToCreate = [];
    let processed = 0;
    
    for (const story of allStories) {
      try {
        processed++;
        
        // Check if post already exists (by URL or similar title)
        const existing = await Post.findOne({
          $or: [
            { 'thumbnail.url': { $regex: story.url, $options: 'i' } },
            { title: { $regex: story.title.substring(0, 50), $options: 'i' } }
          ]
        });
        
        if (existing) {
          console.log(`⏭️  Skipping duplicate: ${story.title.substring(0, 50)}...`);
          continue;
        }
        
        // Determine category
        const category = determineCategory(story.title, categories);
        if (!category) {
          console.log(`⚠️  No category found for: ${story.title}`);
          continue;
        }
        
        console.log(`\n[${processed}/${allStories.length}] Processing: ${story.title.substring(0, 60)}...`);
        console.log(`   Source: ${story.source}`);
        console.log(`   Category: ${category.name || category.slug}`);
        
        // Extract content
        let content = await extractArticleContent(story.url);
        
        // Extract image
        let imageUrl = await extractImageFromArticle(story.url, story.title);
        if (!imageUrl) {
          imageUrl = getFallbackImage(category.slug);
          console.log(`   Using fallback image`);
        } else {
          console.log(`   Found image: ${imageUrl.substring(0, 60)}...`);
        }
        
        // Build content HTML with source credit
        const sourceCredit = `<p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #333; color: #888; font-size: 14px;"><strong>Source:</strong> <a href="${story.url}" target="_blank" rel="noopener noreferrer">${story.source}</a>${story.sourceUrl !== story.url ? ` (<a href="${story.sourceUrl}" target="_blank" rel="noopener noreferrer">${story.sourceUrl}</a>)` : ''}</p>`;
        
        // Generate better content HTML
        let contentHtml = '';
        if (content) {
          const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
          contentHtml = paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
        } else {
          contentHtml = `<p>${story.title}</p><p><a href="${story.url}" target="_blank" rel="noopener noreferrer">Read full article →</a></p>`;
        }
        contentHtml = cleanContentHtml(contentHtml);
        contentHtml = addSourceAttribution(contentHtml, story.url, story.source || 'Original Source');
        
        // Create post data - vary title slightly and truncate to 200 chars
        const variedTitle = varyTitle(story.title);
        const distinctTitle = makeDistinctTitle(variedTitle, category.slug || 'tech');
        const uniqueTitle = await ensureUniqueTitle(Post, distinctTitle);
        const truncatedTitle = uniqueTitle.length > 200 ? uniqueTitle.substring(0, 197) + '...' : uniqueTitle;
        let slug = cleanSlugFromTitle(truncatedTitle);
        let slugSuffix = 0;
        while (await Post.exists({ slug })) {
          slugSuffix++;
          slug = cleanSlugFromTitle(truncatedTitle).replace(/-+$/, '') + '-' + slugSuffix;
        }
        let finalContent = content || story.title;
        if (useLocalLlm) {
          const expanded = await ensureMinimumContent(story.title, finalContent, 400);
          if (expanded !== finalContent) finalContent = expanded;
        }
        const excerpt = useLocalLlm
          ? (await getExcerpt(finalContent || story.title, 160)) || generateExcerpt(finalContent || story.title, 160)
          : generateExcerpt(finalContent || story.title, 160);
        const tags = useLocalLlm
          ? (await getTags(truncatedTitle, finalContent, category.slug || 'tech')) || extractTags(truncatedTitle, finalContent, category.slug || 'tech')
          : extractTags(truncatedTitle, finalContent, category.slug || 'tech');
        
        const postData = {
          title: truncatedTitle,
          slug: slug,
          excerpt: excerpt,
          content: finalContent,
          contentHtml: contentHtml,
          author: admin._id,
          category: category._id,
          tags: tags,
          thumbnail: {
            url: imageUrl,
            alt: truncatedTitle.substring(0, 100),
            width: 1200,
            height: 630
          },
          status: 'published',
          publishedAt: story.publishedAt || new Date(),
          views: 0,
          featured: false,
          trending: false
        };
        
        postsToCreate.push(postData);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`❌ Error processing story:`, err.message);
      }
    }
    
    if (postsToCreate.length > 0) {
      console.log(`\n💾 Inserting ${postsToCreate.length} new posts...`);
      await Post.insertMany(postsToCreate);
      console.log(`✅ Created ${postsToCreate.length} posts successfully!`);
    } else {
      console.log('\n⚠️  No new posts to create (all may be duplicates)');
    }
    
    // Update category counts
    for (const [slug, category] of Object.entries(categories)) {
      if (category) {
        const count = await Post.countDocuments({ category: category._id, status: 'published', deleted: { $ne: true } });
        await Category.findByIdAndUpdate(category._id, { postCount: count });
      }
    }
    
    // Create backup
    const posts = await Post.find({ status: 'published', deleted: { $ne: true } }).lean();
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, `posts-backup-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(posts, null, 2));
    console.log(`💾 Backup created: ${backupFile}`);
    
    console.log('\n🎉 Done fetching latest news!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fetchAndCreatePosts();

