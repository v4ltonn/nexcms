const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function backup() {
  try {
    await mongoose.connect('mongodb://localhost:27017/nexcms');
    const Post = require('./models/Post');
    const posts = await Post.find({ deleted: { $ne: true } }).lean();
    
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(backupsDir, `hourly-backup-${timestamp}.json`);
    
    const backup = {
      timestamp: new Date().toISOString(),
      postCount: posts.length,
      posts: posts
    };
    
    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
    
    console.log(`Backup created: ${filename} (${posts.length} posts)`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Backup error:', error);
    process.exit(1);
  }
}

backup();
