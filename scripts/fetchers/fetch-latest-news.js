const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const Post = require('./models/Post');
const Category = require('./models/Category');
const User = require('./models/User');
const { ensureUniqueTitle } = require('./utils/ensure-unique-title');
const { makeDistinctTitle } = require('./utils/distinct-title');
const { generateExcerpt, extractTags, addSourceAttribution, cleanContentHtml } = require('./utils/content-optimizer');
const { getExcerpt, getTags, ensureMinimumContent } = require('./utils/llm-content-enhancer');
const useLocalLlm = process.env.USE_LOCAL_LLM === '1' || process.env.USE_LOCAL_LLM === 'true';

async function fetchAndCreatePosts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexcms');
    console.log('✅ Connected to MongoDB');
    
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    const tech = await Category.findOne({ slug: 'tech' });
    const cyber = await Category.findOne({ slug: 'cyber' });
    const crypto = await Category.findOne({ slug: 'crypto' });
    const gaming = await Category.findOne({ slug: 'gaming' });
    
    const categories = { tech, cyber, crypto, gaming };
    
    console.log('📰 Fetching latest news from Hacker News...');
    const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topStoryIds = await response.json();
    
    const postsToCreate = [];
    
    for (let i = 0; i < Math.min(30, topStoryIds.length); i++) {
      try {
        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${topStoryIds[i]}.json`);
        const story = await storyResponse.json();
        
        if (!story || !story.title || !story.url) continue;
        
        // Determine category based on keywords in title
        let category = categories.tech; // default
        const titleLower = story.title.toLowerCase();
        
        if (titleLower.includes('bitcoin') || titleLower.includes('ethereum') || titleLower.includes('crypto') || titleLower.includes('blockchain')) {
          category = categories.crypto;
        } else if (titleLower.includes('security') || titleLower.includes('hack') || titleLower.includes('breach') || titleLower.includes('vulnerability')) {
          category = categories.cyber;
        } else if (titleLower.includes('game') || titleLower.includes('console') || titleLower.includes('esports')) {
          category = categories.gaming;
        }
        
        const slug = story.title.toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim('-') + '-' + story.id;
        
        // Check if post already exists
        const existing = await Post.findOne({ slug });
        if (existing) continue;
        
        const distinctTitle = makeDistinctTitle(story.title, category.slug);
        const uniqueTitle = await ensureUniqueTitle(Post, distinctTitle);
        
        // Generate better content
        let contentText = story.title + (story.text ? '\n\n' + story.text.substring(0, 500) : '');
        if (useLocalLlm) {
          const expanded = await ensureMinimumContent(story.title, contentText, 400);
          if (expanded !== contentText) contentText = expanded;
        }
        const excerpt = useLocalLlm
          ? (await getExcerpt(contentText, 160)) || generateExcerpt(contentText, 160)
          : generateExcerpt(contentText, 160);
        
        // Build content HTML with source attribution
        let contentHtml = `<p><strong>${story.title}</strong></p>`;
        if (story.text) {
          contentHtml += `<p>${story.text.substring(0, 1000).replace(/\n\n/g, '</p><p>')}</p>`;
        }
        contentHtml = addSourceAttribution(contentHtml, story.url, 'Hacker News');
        contentHtml = cleanContentHtml(contentHtml);
        
        const tags = useLocalLlm
          ? (await getTags(uniqueTitle, contentText, category.slug)) || extractTags(uniqueTitle, contentText, category.slug)
          : extractTags(uniqueTitle, contentText, category.slug);

        const postData = {
          title: uniqueTitle,
          slug: slug,
          excerpt: excerpt,
          content: contentText,
          contentHtml: contentHtml,
          author: admin._id,
          category: category._id,
          tags: tags,
          thumbnail: {
            url: `https://images.unsplash.com/photo-${getRandomPhoto(category.slug)}?w=800&h=400&fit=crop&auto=format`,
            alt: uniqueTitle,
            width: 800,
            height: 400
          },
          status: 'published',
          publishedAt: new Date(Date.now() - i * 3600000), // Stagger times
          views: Math.floor(Math.random() * 5000),
          featured: i < 4,
          trending: i < 10
        };
        
        postsToCreate.push(postData);
      } catch (err) {
        console.error(`Error processing story ${topStoryIds[i]}:`, err.message);
      }
    }
    
    if (postsToCreate.length > 0) {
      await Post.insertMany(postsToCreate);
      console.log(`✅ Created ${postsToCreate.length} posts from Hacker News`);
    }
    
    // Update category counts
    for (const [slug, category] of Object.entries(categories)) {
      const count = await Post.countDocuments({ category: category._id, status: 'published' });
      await Category.findByIdAndUpdate(category._id, { postCount: count });
    }
    
    console.log('🎉 Done fetching latest news!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Removed - now using extractTags from content-optimizer

function getRandomPhoto(category) {
  const photos = {
    tech: ['1677442136019-21780ecad995', '1485827404703-89b55fcc595e', '1451187580459-2f537d8b7c4e', '1550751827-4bd374c3fb58', '1518770660359-4b2d8b8d4f93'],
    cyber: ['1555949963-aa79dcee981c', '1563013544-824ae1b704d3', '1516321318-c94a5b444d60', '1550751827-4bd374c3fb58', '1516321497447-c8f7f3e4b5b0'],
    crypto: ['1621761191319-c6fb62004040', '1592899677977-9c10ca588bbd', '1639762681485-074b7f938ba0', '1550751827-4bd374c3fb58', '1516321497447-c8f7f3e4b5b0'],
    gaming: ['1542751371-adc38448a05e', '1606144042614-b2417e99c4e3', '1511510337158-816998e37139', '1550751827-4bd374c3fb58', '1516321497447-c8f7f3e4b5b0']
  };
  const pool = photos[category] || photos.tech;
  return pool[Math.floor(Math.random() * pool.length)];
}

fetchAndCreatePosts();
