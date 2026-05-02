require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Category = require('../models/Category');
const User = require('../models/User');

async function createNextcloudPost() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Get admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    // Get Tools category
    const toolsCategory = await Category.findOne({ slug: 'tools' });
    if (!toolsCategory) {
      console.log('❌ Tools category not found. Please run add-tools-category.js first');
      process.exit(1);
    }
    
    // Check if Nextcloud post already exists
    const existing = await Post.findOne({
      $or: [
        { title: { $regex: /nextcloud/i } },
        { slug: { $regex: /nextcloud/i } }
      ]
    });
    
    if (existing) {
      console.log('✅ Nextcloud post already exists!');
      console.log(`   Title: ${existing.title}`);
      console.log(`   Slug: ${existing.slug}`);
      await mongoose.disconnect();
      return;
    }
    
    // Create Nextcloud post
    const postData = {
      title: 'Nextcloud: Open Source Cloud Storage and Collaboration Platform',
      slug: 'nextcloud-open-source-cloud-storage-collaboration-platform',
      excerpt: 'Nextcloud is a powerful, open-source self-hosted cloud storage and collaboration platform that gives you complete control over your data. Features include file sync, calendar, contacts, video calls, and more.',
      content: `Nextcloud is a comprehensive open-source platform that provides secure cloud storage and collaboration tools, giving you complete control over your data.

## What is Nextcloud?

Nextcloud is a self-hosted cloud storage and collaboration platform that allows you to store, sync, and share files from your own server. It's a powerful alternative to proprietary cloud services like Dropbox, Google Drive, or OneDrive, with the added benefit of complete data privacy and control.

## Key Features

### File Storage & Sync
- **File Synchronization**: Sync files across all your devices - desktop, mobile, and web
- **Secure Storage**: All data stored on your own server with full encryption support
- **Version Control**: Automatic file versioning and recovery
- **Large File Support**: No file size limitations

### Collaboration Tools
- **Real-time Collaboration**: Edit documents together with Collabora Online integration
- **Calendar & Contacts**: Full calendar and contact management with CalDAV/CardDAV support
- **Video Calls**: Built-in video conferencing with Nextcloud Talk
- **Chat**: Team messaging and communication
- **Task Management**: Create and manage tasks with the Tasks app

### Security & Privacy
- **End-to-End Encryption**: Optional E2EE for maximum security
- **Two-Factor Authentication**: Enhanced account security
- **GDPR Compliant**: Designed with privacy regulations in mind
- **Self-Hosted**: Your data stays on your servers

### Extensibility
- **App Store**: Hundreds of apps available to extend functionality
- **REST API**: Full API for custom integrations
- **Webhooks**: Automation and integration support
- **Open Source**: Fully open source with active community

## Use Cases

- **Personal Cloud**: Replace Dropbox/Google Drive with your own private cloud
- **Business Collaboration**: Team file sharing and collaboration for businesses
- **Education**: Secure file sharing for schools and universities
- **Healthcare**: HIPAA-compliant data storage and sharing
- **Developer Tools**: Code repository hosting and collaboration

## Getting Started

### Installation Options
1. **Self-Hosted**: Install on your own server (Linux, Docker, or snap)
2. **Cloud Providers**: Use Nextcloud hosting providers
3. **Pre-installed Devices**: Buy hardware with Nextcloud pre-installed
4. **All-in-One**: Easy deployment with Nextcloud All-in-One

### Requirements
- PHP 7.4+ or 8.0+
- MySQL/MariaDB or PostgreSQL
- Web server (Apache/Nginx)
- HTTPS certificate (recommended)

## Why Choose Nextcloud?

✅ **Complete Control**: Your data, your servers, your rules
✅ **Open Source**: Free, transparent, and community-driven
✅ **Privacy First**: GDPR compliant, no data mining, no tracking
✅ **Extensible**: Hundreds of apps in the app store
✅ **Secure**: Enterprise-grade security features
✅ **Active Community**: 8.8k+ GitHub stars, active development

## GitHub Repository

Nextcloud is actively developed on GitHub with over 33,000 stars and thousands of contributors. The project is maintained by Nextcloud GmbH and a vibrant open-source community.

**GitHub**: https://github.com/nextcloud

Whether you're looking for a private cloud solution, team collaboration tools, or a self-hosted alternative to proprietary services, Nextcloud offers a powerful, secure, and privacy-focused solution.

Get started today and take control of your data!`,
      contentHtml: `<h2>What is Nextcloud?</h2>
<p>Nextcloud is a self-hosted cloud storage and collaboration platform that allows you to store, sync, and share files from your own server. It's a powerful alternative to proprietary cloud services like Dropbox, Google Drive, or OneDrive, with the added benefit of complete data privacy and control.</p>

<h2>Key Features</h2>

<h3>File Storage & Sync</h3>
<ul>
<li><strong>File Synchronization</strong>: Sync files across all your devices - desktop, mobile, and web</li>
<li><strong>Secure Storage</strong>: All data stored on your own server with full encryption support</li>
<li><strong>Version Control</strong>: Automatic file versioning and recovery</li>
<li><strong>Large File Support</strong>: No file size limitations</li>
</ul>

<h3>Collaboration Tools</h3>
<ul>
<li><strong>Real-time Collaboration</strong>: Edit documents together with Collabora Online integration</li>
<li><strong>Calendar & Contacts</strong>: Full calendar and contact management with CalDAV/CardDAV support</li>
<li><strong>Video Calls</strong>: Built-in video conferencing with Nextcloud Talk</li>
<li><strong>Chat</strong>: Team messaging and communication</li>
<li><strong>Task Management</strong>: Create and manage tasks with the Tasks app</li>
</ul>

<h3>Security & Privacy</h3>
<ul>
<li><strong>End-to-End Encryption</strong>: Optional E2EE for maximum security</li>
<li><strong>Two-Factor Authentication</strong>: Enhanced account security</li>
<li><strong>GDPR Compliant</strong>: Designed with privacy regulations in mind</li>
<li><strong>Self-Hosted</strong>: Your data stays on your servers</li>
</ul>

<h3>Extensibility</h3>
<ul>
<li><strong>App Store</strong>: Hundreds of apps available to extend functionality</li>
<li><strong>REST API</strong>: Full API for custom integrations</li>
<li><strong>Webhooks</strong>: Automation and integration support</li>
<li><strong>Open Source</strong>: Fully open source with active community</li>
</ul>

<h2>Use Cases</h2>
<ul>
<li><strong>Personal Cloud</strong>: Replace Dropbox/Google Drive with your own private cloud</li>
<li><strong>Business Collaboration</strong>: Team file sharing and collaboration for businesses</li>
<li><strong>Education</strong>: Secure file sharing for schools and universities</li>
<li><strong>Healthcare</strong>: HIPAA-compliant data storage and sharing</li>
<li><strong>Developer Tools</strong>: Code repository hosting and collaboration</li>
</ul>

<h2>Getting Started</h2>

<h3>Installation Options</h3>
<ol>
<li><strong>Self-Hosted</strong>: Install on your own server (Linux, Docker, or snap)</li>
<li><strong>Cloud Providers</strong>: Use Nextcloud hosting providers</li>
<li><strong>Pre-installed Devices</strong>: Buy hardware with Nextcloud pre-installed</li>
<li><strong>All-in-One</strong>: Easy deployment with Nextcloud All-in-One</li>
</ol>

<h2>Why Choose Nextcloud?</h2>
<p>✅ <strong>Complete Control</strong>: Your data, your servers, your rules</p>
<p>✅ <strong>Open Source</strong>: Free, transparent, and community-driven</p>
<p>✅ <strong>Privacy First</strong>: GDPR compliant, no data mining, no tracking</p>
<p>✅ <strong>Extensible</strong>: Hundreds of apps in the app store</p>
<p>✅ <strong>Secure</strong>: Enterprise-grade security features</p>
<p>✅ <strong>Active Community</strong>: 8.8k+ GitHub stars, active development</p>

<h2>GitHub Repository</h2>
<p>Nextcloud is actively developed on GitHub with over 33,000 stars and thousands of contributors. The project is maintained by Nextcloud GmbH and a vibrant open-source community.</p>

<p><strong>GitHub</strong>: <a href="https://github.com/nextcloud" target="_blank" rel="noopener noreferrer">https://github.com/nextcloud</a></p>

<p>Whether you're looking for a private cloud solution, team collaboration tools, or a self-hosted alternative to proprietary services, Nextcloud offers a powerful, secure, and privacy-focused solution.</p>

<p><strong>Get started today and take control of your data!</strong></p>

<p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #333; color: #888; font-size: 14px;">
<strong>Source:</strong> <a href="https://github.com/nextcloud" target="_blank" rel="noopener noreferrer">Nextcloud GitHub Repository</a>
</p>`,
      author: admin._id,
      category: toolsCategory._id,
      tags: ['nextcloud', 'open source', 'cloud storage', 'self-hosted', 'privacy', 'collaboration', 'github'],
      thumbnail: {
        url: 'https://raw.githubusercontent.com/nextcloud/server/master/core/img/logo/logo.png',
        alt: 'Nextcloud Logo - Open Source Cloud Storage'
      },
      status: 'published',
      publishedAt: new Date(),
      views: 0,
      featured: true,
      trending: false
    };
    
    const post = new Post(postData);
    await post.save();
    
    console.log('✅ Successfully created Nextcloud post!');
    console.log(`   Title: ${post.title}`);
    console.log(`   Slug: ${post.slug}`);
    console.log(`   Category: ${toolsCategory.name}`);
    console.log(`   URL: ${process.env.SITE_URL || 'http://localhost:3000'}/posts/${post.slug}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createNextcloudPost();







