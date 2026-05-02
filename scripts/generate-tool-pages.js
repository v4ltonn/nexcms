#!/usr/bin/env node
/**
 * Generate all tool HTML pages from template
 */

const fs = require('fs');
const path = require('path');

const tools = [
  {
    slug: 'dns-lookup',
    title: 'DNS Lookup Tool',
    description: 'Lookup DNS records (A, AAAA, MX, TXT, CNAME, NS) for any domain',
    icon: 'fas fa-network-wired',
    keywords: 'DNS lookup, DNS checker, nslookup, DNS records, MX records, TXT records',
    apiEndpoint: '/api/tools/dns-lookup',
    rateLimit: '5 checks per 10 minutes',
    intensive: true
  },
  {
    slug: 'ip-lookup',
    title: 'IP Address Lookup',
    description: 'Get IP address geolocation, ISP, and network information',
    icon: 'fas fa-map-marker-alt',
    keywords: 'IP lookup, IP checker, IP geolocation, WHOIS, IP address information',
    apiEndpoint: '/api/tools/ip-lookup',
    rateLimit: '5 checks per 10 minutes',
    intensive: true
  },
  {
    slug: 'hash-generator',
    title: 'Hash Generator',
    description: 'Generate MD5, SHA1, SHA256, SHA512 hashes from text',
    icon: 'fas fa-hashtag',
    keywords: 'hash generator, MD5 generator, SHA256 generator, hash calculator, hash checker',
    apiEndpoint: '/api/tools/hash',
    rateLimit: '10 requests per 5 minutes',
    intensive: false,
    method: 'POST'
  },
  {
    slug: 'base64-encoder',
    title: 'Base64 Encoder/Decoder',
    description: 'Encode and decode text to/from Base64 format',
    icon: 'fas fa-code',
    keywords: 'base64 encode, base64 decode, base64 converter, base64 encoder decoder',
    apiEndpoint: '/api/tools/base64',
    rateLimit: '10 requests per 5 minutes',
    intensive: false,
    method: 'POST'
  },
  {
    slug: 'json-formatter',
    title: 'JSON Formatter',
    description: 'Format, validate, and minify JSON data',
    icon: 'fas fa-brackets-curly',
    keywords: 'JSON formatter, JSON validator, JSON beautifier, JSON minify, JSON prettify',
    apiEndpoint: '/api/tools/json',
    rateLimit: '10 requests per 5 minutes',
    intensive: false,
    method: 'POST'
  },
  {
    slug: 'qr-generator',
    title: 'QR Code Generator',
    description: 'Generate QR codes for URLs, text, email, and WiFi',
    icon: 'fas fa-qrcode',
    keywords: 'QR code generator, QR code maker, QR code creator, QR code',
    apiEndpoint: null, // Client-side only
    rateLimit: '10 requests per 5 minutes',
    intensive: false
  },
  {
    slug: 'uuid-generator',
    title: 'UUID Generator',
    description: 'Generate random UUIDs (v4) for your applications',
    icon: 'fas fa-fingerprint',
    keywords: 'UUID generator, GUID generator, UUID v4, random UUID',
    apiEndpoint: '/api/tools/uuid',
    rateLimit: '10 requests per 5 minutes',
    intensive: false
  },
  {
    slug: 'email-header-analyzer',
    title: 'Email Header Analyzer',
    description: 'Analyze email headers for security and authenticity',
    icon: 'fas fa-envelope-open-text',
    keywords: 'email header analyzer, email header parser, email security, SPF DKIM DMARC',
    apiEndpoint: '/api/tools/email-header',
    rateLimit: '10 requests per 5 minutes',
    intensive: false,
    method: 'POST'
  },
  {
    slug: 'text-diff',
    title: 'Text Diff Tool',
    description: 'Compare two texts and see the differences side-by-side',
    icon: 'fas fa-file-code',
    keywords: 'text diff, diff checker, text compare, diff tool, text difference',
    apiEndpoint: '/api/tools/text-diff',
    rateLimit: '10 requests per 5 minutes',
    intensive: false,
    method: 'POST'
  },
  {
    slug: 'regex-tester',
    title: 'Regex Tester',
    description: 'Test and debug regular expressions with live matching',
    icon: 'fas fa-search-plus',
    keywords: 'regex tester, regex checker, regex validator, regular expression tester',
    apiEndpoint: '/api/tools/regex',
    rateLimit: '10 requests per 5 minutes',
    intensive: false,
    method: 'POST'
  }
];

// Read SSL checker as template
const templatePath = path.join(__dirname, '..', 'public', 'ssl-checker.html');
const template = fs.readFileSync(templatePath, 'utf8');

console.log('Generating tool pages...\n');

tools.forEach(tool => {
  let page = template
    .replace(/SSL\/TLS Certificate Checker/g, tool.title)
    .replace(/SSL certificate validity, expiration, and security configuration/g, tool.description)
    .replace(/SSL checker, certificate checker, SSL test, TLS checker, certificate validator, SSL expiration/g, tool.keywords)
    .replace(/ssl-checker/g, tool.slug)
    .replace(/fas fa-lock/g, tool.icon)
    .replace(/5 checks per 10 minutes/g, tool.rateLimit)
    .replace(/\/api\/tools\/ssl-check/g, tool.apiEndpoint || '')
    .replace(/checkSSL\(\)/g, `process${tool.slug.replace(/-/g, '')}()`);
  
  // Save file
  const outputPath = path.join(__dirname, '..', 'public', `${tool.slug}.html`);
  fs.writeFileSync(outputPath, page);
  console.log(`✅ Created ${tool.slug}.html`);
});

console.log(`\n✅ Generated ${tools.length} tool pages!`);






