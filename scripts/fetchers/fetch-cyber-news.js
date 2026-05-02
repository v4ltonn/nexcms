const mongoose = require('mongoose');
const https = require('https');
const http = require('http');

async function fetchHackerNewsTop() {
    return new Promise((resolve, reject) => {
        https.get('https://hacker-news.firebaseio.com/v0/topstories.json', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function fetchHackerNewsItem(id) {
    return new Promise((resolve, reject) => {
        https.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function generateTechContent(title, summary) {
    const introTexts = [
        `In a recent development that has captured the attention of the tech community, ${title.toLowerCase()} represents a significant shift in the industry landscape.`,
        `The latest news about ${title.toLowerCase()} highlights the rapid evolution of technology and its impact on businesses and consumers worldwide.`,
        `Breaking developments in ${title.toLowerCase()} showcase the innovative approaches being taken by industry leaders to address current challenges and opportunities.`
    ];
    
    const detailTexts = [
        `Experts in the field have been analyzing the implications of this development, noting its potential to reshape how we approach technology and security in the coming years.`,
        `This development comes at a critical time when organizations are increasingly focused on digital transformation and security measures.`,
        `Industry analysts predict that this will have far-reaching effects on both enterprise and consumer markets.`,
        `The technological implications are significant, with potential benefits for businesses looking to modernize their infrastructure.`,
        `Security professionals are particularly interested in how this addresses current threat landscapes and defense mechanisms.`
    ];
    
    const content = `${introTexts[Math.floor(Math.random() * introTexts.length)]}\n\n${summary}\n\n${detailTexts[Math.floor(Math.random() * detailTexts.length)]}\n\n${detailTexts[Math.floor(Math.random() * detailTexts.length)]}\n\nAs the technology sector continues to evolve at a rapid pace, developments like this underscore the importance of staying informed about the latest trends and innovations.`;
    
    return content;
}

function generateCyberContent(title, summary) {
    const introTexts = [
        `Cybersecurity experts are closely monitoring recent developments in ${title.toLowerCase()}, which highlight critical vulnerabilities and emerging threats.`,
        `A new cybersecurity alert regarding ${title.toLowerCase()} has raised concerns among security professionals and organizations worldwide.`,
        `The cybersecurity landscape continues to evolve, with ${title.toLowerCase()} representing one of the most pressing threats of the current year.`
    ];
    
    const detailTexts = [
        `This security issue affects organizations across multiple industries, requiring immediate attention and remediation measures.`,
        `Security researchers have identified several attack vectors associated with this threat, emphasizing the need for comprehensive defense strategies.`,
        `Organizations should review their current security posture and implement additional safeguards to protect against potential exploitation.`,
        `The security community is actively working on developing patches and mitigation strategies to address these vulnerabilities.`,
        `Incident response teams are being briefed on how to detect, respond to, and recover from potential attacks related to this threat.`
    ];
    
    const content = `${introTexts[Math.floor(Math.random() * introTexts.length)]}\n\n${summary}\n\n${detailTexts[Math.floor(Math.random() * detailTexts.length)]}\n\n${detailTexts[Math.floor(Math.random() * detailTexts.length)]}\n\n${detailTexts[Math.floor(Math.random() * detailTexts.length)]}\n\nStaying informed about cybersecurity threats is essential for maintaining robust defenses in an increasingly interconnected digital world.`;
    
    return content;
}

async function fetchAndCreatePosts() {
    try {
        await mongoose.connect('mongodb://localhost:27017/nexcms-cms');
        console.log('✅ Connected to MongoDB');

        const Post = require('./models/Post');
        const Category = require('./models/Category');
        const User = require('./models/User');

        const techCategory = await Category.findOne({ slug: 'tech' });
        const cyberCategory = await Category.findOne({ slug: 'cyber' });
        const adminUser = await User.findOne({ role: 'admin' });

        if (!techCategory || !cyberCategory || !adminUser) {
            console.error('❌ Required categories or admin user not found');
            process.exit(1);
        }

        console.log('📰 Fetching latest news from Hacker News...');
        const topStoryIds = await fetchHackerNewsTop();
        const postsToCreate = [];

        for (let i = 0; i < 50; i++) {
            const story = await fetchHackerNewsItem(topStoryIds[i]);
            if (!story || !story.title || !story.url) continue;

            // Skip Ask HN and Show HN
            if (story.title.toLowerCase().startsWith('ask hn') || story.title.toLowerCase().startsWith('show hn')) {
                continue;
            }

            const title = story.title;
            const slug = title.toLowerCase()
                .replace(/[^a-z0-9 -]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim('-');
            
            // Determine category based on keywords
            const isCyber = /security|cyber|hack|breach|vulnerability|exploit|malware|ransomware|virus|threat|attack|infosec/i.test(title);
            const category = isCyber ? cyberCategory : techCategory;
            
            // Generate proper content
            const rawText = story.text || '';
            const summary = story.text ? story.text.substring(0, 300) : `Recent developments in ${title.toLowerCase()} have been making headlines in the tech industry.`;
            const content = isCyber ? generateCyberContent(title, summary) : generateTechContent(title, summary);
            const contentHtml = content.split('\n\n').map(p => `<p>${p}</p>`).join('\n');

            // Use stock images based on category
            const imagePools = {
                cyber: [
                    'photo-1555949963-aa79dcee981c',
                    'photo-1563013544-824ae1b704d3',
                    'photo-1516321497447-c8f7f3e4b5b0',
                    'photo-1589829085413-56de8ae18c73'
                ],
                tech: [
                    'photo-1485827404703-89b55fcc595e',
                    'photo-1550751827-4bd374c3fb58',
                    'photo-1551650975-87deedd944c3',
                    'photo-1518770660359-4b2d8b8d4f93'
                ]
            };
            
            const pool = imagePools[isCyber ? 'cyber' : 'tech'];
            const photoId = pool[Math.floor(Math.random() * pool.length)];
            
            const post = {
                title,
                slug,
                content,
                contentHtml,
                excerpt: content.substring(0, 200) + '...',
                author: adminUser._id,
                category: category._id,
                tags: isCyber ? ['cybersecurity', 'security', 'tech'] : ['technology', 'tech', 'innovation'],
                thumbnail: {
                    url: `https://images.unsplash.com/photo-${photoId}?w=800&h=400&fit=crop`,
                    alt: title
                },
                status: 'published',
                publishedAt: new Date(story.time * 1000),
                views: Math.floor(Math.random() * 5000) + 100,
                featured: Math.random() > 0.85,
                trending: Math.random() > 0.6
            };

            postsToCreate.push(post);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (postsToCreate.length >= 30) break;
        }

        if (postsToCreate.length > 0) {
            await Post.insertMany(postsToCreate);
            console.log(`✅ Created ${postsToCreate.length} posts with full content`);
        }

        // Update category post counts
        const cyberCount = await Post.countDocuments({ category: cyberCategory._id, status: 'published' });
        const techCount = await Post.countDocuments({ category: techCategory._id, status: 'published' });
        await Category.findByIdAndUpdate(cyberCategory._id, { postCount: cyberCount });
        await Category.findByIdAndUpdate(techCategory._id, { postCount: techCount });
        
        console.log('✅ Category post counts updated');
        console.log('🎉 Done fetching latest news!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fetchAndCreatePosts();
