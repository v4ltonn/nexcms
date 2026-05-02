const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Category = require('./models/Category');

async function createSampleData() {
  try {
    await mongoose.connect('mongodb://localhost:27017/nexcms-cms');
    console.log('✅ Connected to MongoDB');
    
    // Check if data already exists
    const existingPosts = await Post.countDocuments({});
    const existingCategories = await Category.countDocuments({});
    
    if (existingPosts > 0 || existingCategories > 0) {
      console.log('📝 Data already exists. Skipping creation.');
      console.log(`   Posts: ${existingPosts}, Categories: ${existingCategories}`);
      process.exit(0);
    }
    
    console.log('📝 Creating new sample data...');
    
    // Create categories
    const categories = [
      {
        name: 'Tech',
        slug: 'tech',
        description: 'Latest technology news, innovations, and breakthroughs',
        color: '#00ff88',
        icon: 'fas fa-microchip',
        postCount: 0
      },
      {
        name: 'Cyber',
        slug: 'cyber',
        description: 'Cybersecurity threats, protection, and digital safety',
        color: '#ff0080',
        icon: 'fas fa-shield-alt',
        postCount: 0
      },
      {
        name: 'Crypto',
        slug: 'crypto',
        description: 'Cryptocurrency, blockchain, and digital finance',
        color: '#00d4ff',
        icon: 'fab fa-bitcoin',
        postCount: 0
      },
      {
        name: 'Gaming',
        slug: 'gaming',
        description: 'Gaming news, reviews, and esports coverage',
        color: '#ffaa00',
        icon: 'fas fa-gamepad',
        postCount: 0
      }
    ];
    
    const createdCategories = await Category.insertMany(categories);
    console.log('✅ Created categories:', createdCategories.length);
    
    // Get admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    // Create sample posts
    const posts = [
      {
        title: 'New Cybersecurity Threat Targets Gaming Platforms',
        slug: 'cybersecurity-threat-gaming-platforms',
        excerpt: 'Security researchers have discovered a new malware campaign targeting popular gaming platforms and cryptocurrency wallets.',
        content: 'A sophisticated malware campaign has been identified targeting gaming platforms and cryptocurrency wallets. The threat actors are using social engineering techniques to distribute malicious software through fake game downloads and cryptocurrency trading applications.\n\nThe malware, dubbed "GameStealer" by security researchers, is designed to steal login credentials, cryptocurrency private keys, and personal information from victims. It primarily targets Windows users who download games from unofficial sources or use cryptocurrency trading platforms.\n\nSecurity experts recommend users to only download games from official stores and use hardware wallets for cryptocurrency storage. The campaign has already affected thousands of users worldwide.',
        contentHtml: '<p>A sophisticated malware campaign has been identified targeting gaming platforms and cryptocurrency wallets. The threat actors are using social engineering techniques to distribute malicious software through fake game downloads and cryptocurrency trading applications.</p><p>The malware, dubbed "GameStealer" by security researchers, is designed to steal login credentials, cryptocurrency private keys, and personal information from victims. It primarily targets Windows users who download games from unofficial sources or use cryptocurrency trading platforms.</p><p>Security experts recommend users to only download games from official stores and use hardware wallets for cryptocurrency storage. The campaign has already affected thousands of users worldwide.</p>',
        author: admin._id,
        category: createdCategories.find(c => c.slug === 'cyber')._id,
        tags: ['malware', 'gaming', 'cryptocurrency', 'security'],
        thumbnail: {
          url: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=400&fit=crop',
          alt: 'Cybersecurity threat illustration',
          caption: 'New malware campaign targets gaming and crypto users'
        },
        status: 'published',
        publishedAt: new Date(),
        views: 1250,
        featured: true,
        trending: true
      },
      {
        title: 'Bitcoin Reaches New All-Time High Amid Institutional Adoption',
        slug: 'bitcoin-all-time-high-institutional-adoption',
        excerpt: 'Bitcoin has surged to a new record high as major institutions continue to adopt cryptocurrency as a store of value.',
        content: 'Bitcoin has reached a new all-time high of $95,000, driven by increased institutional adoption and growing acceptance of cryptocurrency as a legitimate asset class. Major corporations, including Tesla, MicroStrategy, and several pension funds, have announced significant Bitcoin purchases in recent weeks.\n\nThe surge comes amid growing concerns about inflation and the devaluation of traditional fiat currencies. Many institutional investors are turning to Bitcoin as a hedge against economic uncertainty and currency debasement.\n\nAnalysts predict that Bitcoin could reach $100,000 by the end of the year if current trends continue. The cryptocurrency market has seen increased regulatory clarity in several jurisdictions, further boosting investor confidence.',
        contentHtml: '<p>Bitcoin has reached a new all-time high of $95,000, driven by increased institutional adoption and growing acceptance of cryptocurrency as a legitimate asset class. Major corporations, including Tesla, MicroStrategy, and several pension funds, have announced significant Bitcoin purchases in recent weeks.</p><p>The surge comes amid growing concerns about inflation and the devaluation of traditional fiat currencies. Many institutional investors are turning to Bitcoin as a hedge against economic uncertainty and currency debasement.</p><p>Analysts predict that Bitcoin could reach $100,000 by the end of the year if current trends continue. The cryptocurrency market has seen increased regulatory clarity in several jurisdictions, further boosting investor confidence.</p>',
        author: admin._id,
        category: createdCategories.find(c => c.slug === 'crypto')._id,
        tags: ['bitcoin', 'cryptocurrency', 'institutional', 'adoption'],
        thumbnail: {
          url: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=400&fit=crop',
          alt: 'Bitcoin price chart',
          caption: 'Bitcoin reaches new all-time high'
        },
        status: 'published',
        publishedAt: new Date(Date.now() - 86400000),
        views: 2100,
        featured: true,
        trending: true
      },
      {
        title: 'Valorant Champions Tour 2024: Team Liquid Wins Championship',
        slug: 'valorant-champions-tour-2024-team-liquid-wins',
        excerpt: 'Team Liquid has secured the Valorant Champions Tour 2024 championship title after an intense final match against Sentinels.',
        content: 'Team Liquid has emerged victorious in the Valorant Champions Tour 2024, defeating Sentinels in a thrilling 3-2 series that went down to the wire. The European team showcased exceptional teamwork and individual skill throughout the tournament.\n\nThe final match was watched by over 2 million concurrent viewers, making it one of the most-watched esports events of the year. Team Liquid\'s star player, ScreaM, was named the tournament MVP for his outstanding performance.\n\nThis victory marks Team Liquid\'s first major Valorant championship and solidifies their position as one of the top teams in the competitive scene. The team will now prepare for the upcoming Masters tournament.',
        contentHtml: '<p>Team Liquid has emerged victorious in the Valorant Champions Tour 2024, defeating Sentinels in a thrilling 3-2 series that went down to the wire. The European team showcased exceptional teamwork and individual skill throughout the tournament.</p><p>The final match was watched by over 2 million concurrent viewers, making it one of the most-watched esports events of the year. Team Liquid\'s star player, ScreaM, was named the tournament MVP for his outstanding performance.</p><p>This victory marks Team Liquid\'s first major Valorant championship and solidifies their position as one of the top teams in the competitive scene. The team will now prepare for the upcoming Masters tournament.</p>',
        author: admin._id,
        category: createdCategories.find(c => c.slug === 'gaming')._id,
        tags: ['valorant', 'esports', 'team-liquid', 'championship'],
        thumbnail: {
          url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=400&fit=crop',
          alt: 'Valorant esports tournament',
          caption: 'Team Liquid wins Valorant Champions Tour 2024'
        },
        status: 'published',
        publishedAt: new Date(Date.now() - 172800000),
        views: 1800,
        featured: false,
        trending: true
      },
      {
        title: 'AI Breakthrough: New Language Model Surpasses Human Performance',
        slug: 'ai-breakthrough-language-model-surpasses-human',
        excerpt: 'Researchers have developed a new AI language model that outperforms humans in complex reasoning tasks.',
        content: 'A team of researchers from leading AI companies has announced a breakthrough in artificial intelligence with a new language model that surpasses human performance in complex reasoning tasks. The model, called GPT-5, demonstrates unprecedented capabilities in mathematics, coding, and logical reasoning.\n\nThe AI system achieved a score of 95% on standardized tests, outperforming the average human score of 87%. This represents a significant milestone in the development of artificial general intelligence (AGI).\n\nThe breakthrough has implications for various industries, including education, healthcare, and software development. However, it also raises important questions about the future of work and the need for responsible AI development.',
        contentHtml: '<p>A team of researchers from leading AI companies has announced a breakthrough in artificial intelligence with a new language model that surpasses human performance in complex reasoning tasks. The model, called GPT-5, demonstrates unprecedented capabilities in mathematics, coding, and logical reasoning.</p><p>The AI system achieved a score of 95% on standardized tests, outperforming the average human score of 87%. This represents a significant milestone in the development of artificial general intelligence (AGI).</p><p>The breakthrough has implications for various industries, including education, healthcare, and software development. However, it also raises important questions about the future of work and the need for responsible AI development.</p>',
        author: admin._id,
        category: createdCategories.find(c => c.slug === 'tech')._id,
        tags: ['ai', 'artificial-intelligence', 'gpt-5', 'breakthrough'],
        thumbnail: {
          url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
          alt: 'AI and machine learning',
          caption: 'New AI model surpasses human performance'
        },
        status: 'published',
        publishedAt: new Date(Date.now() - 259200000),
        views: 3200,
        featured: true,
        trending: false
      },
      {
        title: 'New Gaming Console Rumors: Next-Gen Hardware Specs Leaked',
        slug: 'new-gaming-console-rumors-next-gen-hardware',
        excerpt: 'Leaked specifications suggest the next generation of gaming consoles will feature revolutionary hardware improvements.',
        content: 'Industry insiders have leaked specifications for upcoming next-generation gaming consoles, revealing significant hardware improvements that could revolutionize the gaming experience. The leaked documents suggest processors capable of 4K gaming at 120fps and advanced ray tracing capabilities.\n\nThe new consoles are expected to feature custom AMD processors with integrated AI acceleration, enabling features like real-time upscaling and intelligent frame rate optimization. Storage solutions will include ultra-fast NVMe SSDs with compression algorithms designed specifically for gaming.\n\nWhile official announcements are expected later this year, the leaked specifications have generated significant excitement among gaming enthusiasts. The consoles are rumored to launch in late 2025 with a price point around $600.',
        contentHtml: '<p>Industry insiders have leaked specifications for upcoming next-generation gaming consoles, revealing significant hardware improvements that could revolutionize the gaming experience. The leaked documents suggest processors capable of 4K gaming at 120fps and advanced ray tracing capabilities.</p><p>The new consoles are expected to feature custom AMD processors with integrated AI acceleration, enabling features like real-time upscaling and intelligent frame rate optimization. Storage solutions will include ultra-fast NVMe SSDs with compression algorithms designed specifically for gaming.</p><p>While official announcements are expected later this year, the leaked specifications have generated significant excitement among gaming enthusiasts. The consoles are rumored to launch in late 2025 with a price point around $600.</p>',
        author: admin._id,
        category: createdCategories.find(c => c.slug === 'gaming')._id,
        tags: ['gaming', 'console', 'hardware', 'next-gen'],
        thumbnail: {
          url: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&h=400&fit=crop',
          alt: 'Gaming console hardware',
          caption: 'Next-gen gaming console specifications leaked'
        },
        status: 'published',
        publishedAt: new Date(Date.now() - 345600000),
        views: 1500,
        featured: false,
        trending: false
      }
    ];
    
    const createdPosts = await Post.insertMany(posts);
    console.log('✅ Created posts:', createdPosts.length);
    
    // Update category post counts
    for (const category of createdCategories) {
      const postCount = await Post.countDocuments({ category: category._id, status: 'published' });
      await Category.findByIdAndUpdate(category._id, { postCount });
    }
    
    console.log('✅ Updated category post counts');
    console.log('🎉 Sample data created successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating sample data:', error.message);
    process.exit(1);
  }
}

createSampleData();
