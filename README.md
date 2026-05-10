# NexCMS

A self-hosted, open-source Node.js CMS built for speed, simplicity, and full control over your content.

Built on Express + MongoDB. No paid plans, no vendor lock-in, no tracking.

---

## Features

- **Rich post editor** with Quill WYSIWYG, code block support, and Markdown
- **Admin panel** — create, edit, publish, and manage posts with categories and tags
- **User management** — roles, authentication, session-based login
- **RSS feed** and **auto-generated sitemap** out of the box
- **Built-in security tools** — 13 browser-based utilities (DNS lookup, SSL checker, hash generator, regex tester, and more)
- **Content scripts** — optional fetchers for CVE feeds, tech news, and how-to articles
- **Local LLM support** via Ollama for AI-assisted content enhancement (optional, no cloud)
- **IndexNow** support for instant search engine notification on publish
- **Docker-ready** with a single `docker compose up`
- Rate limiting, Helmet security headers, CORS, and session hardening built in

---

## Quick Start

### Requirements

- Node.js 18+
- MongoDB 6+

### 1. Clone and install

```bash
git clone https://github.com/yourname/nexcms.git
cd nexcms
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env — at minimum set MONGODB_URI, SESSION_SECRET, and SITE_URL
```

Generate secure secrets:

```bash
openssl rand -hex 64   # run twice — SESSION_SECRET and JWT_SECRET
```

### 3. Run

```bash
npm run dev    # development (nodemon)
npm start      # production
```

Visit `http://localhost:3000` for the site and `http://localhost:3000/admin` for the panel.

### 4. Create your admin account

```bash
node scripts/maintenance/reset-admin-password.js
```

---

## Docker

```bash
cp .env.example .env
docker compose up -d
```

---

## Project Structure

```
nexcms/
├── server.js              # Express app entry point
├── models/                # Mongoose schemas (Post, Category, User)
├── routes/                # Express route handlers
│   ├── posts.js           # Post CRUD API
│   ├── admin.js           # Admin API
│   ├── auth.js            # Auth / session
│   ├── rss.js             # RSS feed
│   ├── sitemap.js         # XML sitemap
│   └── tools.js           # Security tools API
├── services/              # Integrations (IndexNow, LLM, cache purge)
├── utils/                 # Content helpers (dedup, quality, optimizer)
├── lib/                   # Core utilities
├── middleware/            # Express middleware
├── public/
│   ├── admin/             # Admin panel (Quill editor, post manager)
│   ├── css/
│   ├── js/
│   └── tools/             # Browser-based security tools
└── scripts/
    ├── fetchers/          # News / CVE content fetchers
    └── maintenance/       # Admin reset, backup
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `SESSION_SECRET` | Yes | 64-byte random hex |
| `SITE_URL` | Yes | `https://yourdomain.com` |
| `SITE_DOMAIN` | Yes | `yourdomain.com` |
| `ANALYTICS_URL` | No | Self-hosted analytics base URL |
| `TELEGRAM_CHANNEL` | No | Telegram channel for notifications |
| `USE_LOCAL_LLM` | No | `1` to enable Ollama content enhancement |

---

## Content Scripts

```bash
node scripts/fetchers/fetch-cyber-news.js    # pull latest security news
node scripts/create-cve-post.js CVE-2024-X   # create a post from NVD
node scripts/create-sample-data.js           # seed the database
```

---

## Security

- Sessions stored in MongoDB with connect-mongo
- Passwords hashed with bcryptjs (no plaintext storage)
- Helmet CSP, rate limiting, CORS — all on by default
- Admin panel behind session auth; optionally add nginx basic auth in front

---

## License

MIT
