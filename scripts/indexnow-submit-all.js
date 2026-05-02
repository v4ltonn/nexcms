require("dotenv").config();
const mongoose = require("mongoose");
const https = require("https");
const fs = require("fs");
const path = require("path");

const Post = require("../models/Post");

const ENGINES = ["https://www.bing.com", "https://yandex.com"];

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

(async () => {
  const mongoUrl = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nexcms";
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000 });

  // Ensure key file exists
  const key = process.env.INDEXNOW_KEY || Math.random().toString(36).slice(2) + Date.now().toString(36);
  const pub = path.join(__dirname, "..", "public");
  const keyPath = path.join(pub, `${key}.txt`);
  try { fs.mkdirSync(pub, { recursive: true }); if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, key); } catch(e) {}

  const posts = await Post.find({ status: "published", deleted: { $ne: true } }).select("slug");
  console.log(`Submitting ${posts.length} posts via IndexNow...`);
  for (const p of posts) {
    const url = `${process.env.SITE_URL || 'http://localhost:3000'}/posts/${p.slug}`;
    for (const engine of ENGINES) {
      const endpoint = `${engine}/indexnow?url=${encodeURIComponent(url)}&key=${encodeURIComponent(key)}`;
      try { const code = await get(endpoint); console.log(engine, code, url); } catch (e) { console.log(engine, "ERR", url); }
      await new Promise(r => setTimeout(r, 150));
    }
  }

  await mongoose.disconnect();
  console.log("Done");
})();
