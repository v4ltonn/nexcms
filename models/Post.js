const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  previousSlugs: {
    type: [String],
    default: [],
    lowercase: true
  },
  excerpt: {
    type: String,
    maxlength: 500,
    default: ''
  },
  content: {
    type: String,
    required: true
  },
  contentHtml: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  thumbnail: {
    url: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: ''
    },
    caption: {
      type: String,
      default: ''
    },
    width: {
      type: Number,
      default: 0
    },
    height: {
      type: Number,
      default: 0
    }
  },
  images: [{
    url: String,
    alt: String,
    caption: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'soft-deleted'],
    default: 'draft'
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  seo: {
    title: String,
    description: String,
    keywords: [String],
    ogImage: String
  },
  featured: {
    type: Boolean,
    default: false
  },
  trending: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 0
  },
  socialShares: {
    twitter: { type: Number, default: 0 },
    facebook: { type: Number, default: 0 },
    linkedin: { type: Number, default: 0 },
    reddit: { type: Number, default: 0 }
  },
  staticPath: {
    type: String,
    unique: true,
    sparse: true
  },
  lastStaticGenerated: {
    type: Date,
    default: null
  },
  needsRegeneration: {
    type: Boolean,
    default: true
  },
  telegramSent: {
    type: Boolean,
    default: false
  },
  telegramSentAt: {
    type: Date,
    default: null
  },
  xSent: {
    type: Boolean,
    default: false
  },
  xSentAt: {
    type: Date,
    default: null
  },
  xTweetId: {
    type: String,
    default: null
  },
  redditSent: {
    type: Boolean,
    default: false
  },
  redditSentAt: {
    type: Date,
    default: null
  },
  redditPostId: {
    type: String,
    default: null
  },
  redditUrl: {
    type: String,
    default: null
  },
  redditDuplicate: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
postSchema.index({ slug: 1 });
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ category: 1, status: 1 });
postSchema.index({ author: 1, status: 1 });
postSchema.index({ tags: 1 });
postSchema.index({ featured: 1, status: 1 });
postSchema.index({ trending: 1, status: 1 });
postSchema.index({ views: -1 });
postSchema.index({ staticPath: 1 });
postSchema.index({ deleted: 1 }); // For soft delete queries

// Generate slug from title
postSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    const slugify = require('slugify');
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// ULTRA-STRONG DELETION PROTECTION
// Intercept at multiple levels to catch ALL deletion attempts

// Level 1: Mongoose middleware hooks
postSchema.pre('remove', function(next) {
  console.error('🚨 BLOCKED: Attempted hard delete of post:', this.slug || this._id);
  console.error('   Stack:', new Error().stack);
  
  // Log to file
  const fs = require('fs');
  try {
    fs.appendFileSync('/home/nexcms/public_html/logs/deletion-blocks.log', 
      `\n[${new Date().toISOString()}] BLOCKED remove\nPost: ${this.slug || this._id}\nStack: ${new Error().stack}\n---\n`);
  } catch (e) {}
  
  next(new Error('Hard deletes are disabled. Use soft delete instead.'));
});

postSchema.pre('deleteMany', function(next) {
  console.error('🚨🚨🚨 BLOCKED: Attempted deleteMany operation');
  console.error('   Query:', JSON.stringify(this.getQuery()));
  console.error('   Stack:', new Error().stack);
  
  // Log to file
  const fs = require('fs');
  try {
    fs.appendFileSync('/home/nexcms/public_html/logs/deletion-blocks.log', 
      `\n[${new Date().toISOString()}] BLOCKED deleteMany\nQuery: ${JSON.stringify(this.getQuery())}\nStack: ${new Error().stack}\n---\n`);
  } catch (e) {}
  
  next(new Error('deleteMany is PERMANENTLY disabled. Contact admin if needed.'));
});

postSchema.pre('findOneAndDelete', function(next) {
  console.error('🚨 BLOCKED: Attempted findOneAndDelete operation');
  console.error('   Stack:', new Error().stack);
  
  const fs = require('fs');
  try {
    fs.appendFileSync('/home/nexcms/public_html/logs/deletion-blocks.log', 
      `\n[${new Date().toISOString()}] BLOCKED findOneAndDelete\nStack: ${new Error().stack}\n---\n`);
  } catch (e) {}
  
  next(new Error('findOneAndDelete is disabled. Use soft delete instead.'));
});

// Level 2: Intercept at model level (catches Post.deleteMany())
postSchema.statics.deleteMany = function(...args) {
  console.error('🚨🚨🚨 BLOCKED: Static deleteMany called');
  console.error('   Args:', args);
  console.error('   Stack:', new Error().stack);
  
  const fs = require('fs');
  try {
    fs.appendFileSync('/home/nexcms/public_html/logs/deletion-blocks.log', 
      `\n[${new Date().toISOString()}] BLOCKED static deleteMany\nStack: ${new Error().stack}\n---\n`);
  } catch (e) {}
  
  throw new Error('deleteMany is PERMANENTLY BLOCKED at model level');
};

postSchema.statics.deleteOne = function(...args) {
  console.error('🚨 BLOCKED: Static deleteOne called');
  console.error('   Stack:', new Error().stack);
  
  throw new Error('deleteOne is BLOCKED. Use soft delete.');
};

postSchema.statics.findOneAndDelete = function(...args) {
  console.error('🚨 BLOCKED: Static findOneAndDelete called');
  console.error('   Stack:', new Error().stack);
  
  throw new Error('findOneAndDelete is BLOCKED. Use soft delete.');
};

// Soft delete methods
postSchema.methods.softDelete = function() {
  this.deleted = true;
  this.deletedAt = new Date();
  this.status = 'soft-deleted';
  return this.save();
};

postSchema.methods.restore = function() {
  this.deleted = false;
  this.deletedAt = null;
  if (this.status === 'soft-deleted') {
    this.status = 'published';
  }
  return this.save();
};

// Generate static path
postSchema.methods.generateStaticPath = function() {
  const date = new Date(this.publishedAt || this.createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `/posts/${year}/${month}/${day}/${this.slug}`;
};

// Mark for regeneration
postSchema.methods.markForRegeneration = function() {
  this.needsRegeneration = true;
  return this.save();
};

// Mark as generated
postSchema.methods.markAsGenerated = function() {
  this.needsRegeneration = false;
  this.lastStaticGenerated = new Date();
  this.staticPath = this.generateStaticPath();
  return this.save();
};

// Static methods
postSchema.statics.getPostsForStaticGeneration = function(limit = 100) {
  return this.find({
    status: 'published',
    deleted: { $ne: true },
    $or: [
      { needsRegeneration: true },
      { lastStaticGenerated: { $exists: false } }
    ]
  })
  .populate('author', 'username')
  .populate('category', 'name slug')
  .sort({ publishedAt: -1 })
  .limit(limit);
};

postSchema.statics.getFeaturedPosts = function(limit = 6) {
  return this.find({
    status: 'published',
    deleted: { $ne: true },
    featured: true
  })
  .populate('author', 'username')
  .populate('category', 'name slug color')
  .sort({ publishedAt: -1 })
  .limit(limit);
};

postSchema.statics.getTrendingPosts = function(limit = 10) {
  return this.find({
    status: 'published',
    deleted: { $ne: true },
    trending: true
  })
  .populate('author', 'username')
  .populate('category', 'name slug color')
  .sort({ views: -1, publishedAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Post', postSchema);
