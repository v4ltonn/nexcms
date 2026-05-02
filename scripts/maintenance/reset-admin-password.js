require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function resetAdminPassword() {
  try {
    const newPassword = process.argv[2] || 'mRww%O7pzR703&';
    
    if (!newPassword) {
      console.log('❌ Please provide a password');
      console.log('Usage: node reset-admin-password.js <password>');
      process.exit(1);
    }
    
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexcms';
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed');
    
    // Find admin user
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      // Create admin if doesn't exist
      const newAdmin = new User({
        username: 'admin',
        email: 'admin@${process.env.SITE_DOMAIN || 'localhost'}',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      await newAdmin.save();
      console.log('✅ Admin user created');
    } else {
      // Update existing admin password
      admin.password = hashedPassword;
      await admin.save();
      console.log('✅ Admin password updated');
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email: ${admin.email}`);
    }
    
    console.log(`\n✅ Password reset successful!`);
    console.log(`   New password: ${newPassword}`);
    console.log(`\n🔗 Login at: ${process.env.SITE_URL || 'http://localhost:3000'}/admin/login.html`);
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

resetAdminPassword();

