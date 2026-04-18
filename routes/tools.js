const express = require('express');
const router = express.Router();
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { toolsRateLimiter, intensiveToolsRateLimiter } = require('../middleware/rate-limit-tools');
const dns = require('dns').promises;
const QRCode = require('qrcode');
const { execFile } = require('child_process');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype);
    cb(null, !!ok);
  }
});

// SSL/TLS Certificate Checker
router.get('/ssl-check', intensiveToolsRateLimiter, async (req, res) => {
  try {
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain parameter is required'
      });
    }
    
    let targetDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    const certInfo = await new Promise((resolve, reject) => {
      const options = {
        hostname: targetDomain,
        port: 443,
        method: 'GET',
        rejectUnauthorized: false
      };
      
      const req = https.request(options, (response) => {
        const cert = response.socket.getPeerCertificate(true);
        resolve(cert);
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });
      
      req.end();
    });
    
    if (!certInfo || !certInfo.valid_to) {
      return res.status(400).json({
        success: false,
        error: 'Could not retrieve certificate information'
      });
    }
    
    const validFrom = new Date(certInfo.valid_from);
    const validTo = new Date(certInfo.valid_to);
    const now = new Date();
    const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
    const isExpired = validTo < now;
    const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    
    res.json({
      success: true,
      domain: targetDomain,
      certificate: {
        issuer: certInfo.issuer?.CN || 'Unknown',
        subject: certInfo.subject?.CN || targetDomain,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysUntilExpiry: daysUntilExpiry,
        isExpired: isExpired,
        isExpiringSoon: isExpiringSoon,
        serialNumber: certInfo.serialNumber,
        fingerprint: certInfo.fingerprint,
        algorithm: certInfo.signature || 'Unknown'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error checking SSL certificate'
    });
  }
});

// DNS Lookup
router.get('/dns-lookup', intensiveToolsRateLimiter, async (req, res) => {
  try {
    const { domain, type = 'A' } = req.query;
    
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain parameter is required'
      });
    }
    
    const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const recordType = type.toUpperCase();
    
    const validTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'PTR'];
    if (!validTypes.includes(recordType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid record type. Valid types: ${validTypes.join(', ')}`
      });
    }
    
    let records;
    try {
      if (recordType === 'A') {
        records = await dns.resolve4(cleanDomain);
      } else if (recordType === 'AAAA') {
        records = await dns.resolve6(cleanDomain);
      } else if (recordType === 'MX') {
        records = await dns.resolveMx(cleanDomain);
      } else if (recordType === 'TXT') {
        records = await dns.resolveTxt(cleanDomain);
      } else if (recordType === 'CNAME') {
        records = await dns.resolveCname(cleanDomain);
      } else if (recordType === 'NS') {
        records = await dns.resolveNs(cleanDomain);
      } else if (recordType === 'SOA') {
        records = await dns.resolveSoa(cleanDomain);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Record type not yet supported'
        });
      }
    } catch (dnsError) {
      return res.status(400).json({
        success: false,
        error: dnsError.message || 'DNS lookup failed'
      });
    }
    
    res.json({
      success: true,
      domain: cleanDomain,
      type: recordType,
      records: Array.isArray(records) ? records : [records],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error performing DNS lookup'
    });
  }
});

// IP Lookup / WHOIS (simplified - using IP geolocation API)
router.get('/ip-lookup', intensiveToolsRateLimiter, async (req, res) => {
  try {
    const { ip } = req.query;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        error: 'IP address parameter is required'
      });
    }
    
    // Validate IP address
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format'
      });
    }
    
    // Use ip-api.com (free, no API key required)
    const ipApiUrl = `http://ip-api.com/json/${ip.trim()}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
    
    const ipInfo = await new Promise((resolve, reject) => {
      http.get(ipApiUrl, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    if (ipInfo.status === 'fail') {
      return res.status(400).json({
        success: false,
        error: ipInfo.message || 'IP lookup failed'
      });
    }
    
    res.json({
      success: true,
      ip: ipInfo.query,
      location: {
        country: ipInfo.country,
        countryCode: ipInfo.countryCode,
        region: ipInfo.regionName,
        city: ipInfo.city,
        zip: ipInfo.zip,
        coordinates: {
          latitude: ipInfo.lat,
          longitude: ipInfo.lon
        },
        timezone: ipInfo.timezone
      },
      network: {
        isp: ipInfo.isp,
        organization: ipInfo.org,
        asn: ipInfo.as
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error looking up IP address'
    });
  }
});

// Hash Generator
router.post('/hash', toolsRateLimiter, (req, res) => {
  try {
    const { text, algorithm = 'sha256' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required'
      });
    }
    
    const validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!validAlgorithms.includes(algorithm.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid algorithm. Valid algorithms: ${validAlgorithms.join(', ')}`
      });
    }
    
    const hash = crypto.createHash(algorithm.toLowerCase()).update(text).digest('hex');
    
    res.json({
      success: true,
      text: text,
      algorithm: algorithm.toLowerCase(),
      hash: hash,
      length: hash.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error generating hash'
    });
  }
});

// Base64 Encode/Decode
router.post('/base64', toolsRateLimiter, (req, res) => {
  try {
    const { text, operation = 'encode' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required'
      });
    }
    
    if (operation !== 'encode' && operation !== 'decode') {
      return res.status(400).json({
        success: false,
        error: 'Operation must be "encode" or "decode"'
      });
    }
    
    let result;
    try {
      if (operation === 'encode') {
        result = Buffer.from(text, 'utf8').toString('base64');
      } else {
        result = Buffer.from(text, 'base64').toString('utf8');
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: operation === 'decode' ? 'Invalid base64 string' : 'Encoding failed'
      });
    }
    
    res.json({
      success: true,
      input: text,
      operation: operation,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error processing base64'
    });
  }
});

// JSON Formatter/Validator
router.post('/json', toolsRateLimiter, (req, res) => {
  try {
    const { json, operation = 'format' } = req.body;
    
    if (!json) {
      return res.status(400).json({
        success: false,
        error: 'JSON parameter is required'
      });
    }
    
    const validOperations = ['format', 'validate', 'minify'];
    if (!validOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        error: `Invalid operation. Valid operations: ${validOperations.join(', ')}`
      });
    }
    
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return res.json({
        success: false,
        valid: false,
        error: e.message || 'Invalid JSON'
      });
    }
    
    let result;
    if (operation === 'format') {
      result = JSON.stringify(parsed, null, 2);
    } else if (operation === 'minify') {
      result = JSON.stringify(parsed);
    } else {
      result = JSON.stringify(parsed, null, 2);
    }
    
    res.json({
      success: true,
      valid: true,
      operation: operation,
      result: result,
      size: {
        original: json.length,
        processed: result.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error processing JSON'
    });
  }
});

// UUID Generator
router.get('/uuid', toolsRateLimiter, (req, res) => {
  try {
    const { count = 1 } = req.query;
    const num = Math.min(parseInt(count) || 1, 100); // Max 100 at a time
    
    const uuids = [];
    for (let i = 0; i < num; i++) {
      uuids.push(crypto.randomUUID());
    }
    
    res.json({
      success: true,
      count: uuids.length,
      uuids: uuids
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error generating UUID'
    });
  }
});

// Email Header Analyzer
router.post('/email-header', toolsRateLimiter, (req, res) => {
  try {
    const { headers } = req.body;
    
    if (!headers) {
      return res.status(400).json({
        success: false,
        error: 'Email headers parameter is required'
      });
    }
    
    const headerLines = headers.split('\n').filter(line => line.trim());
    const parsedHeaders = {};
    
    headerLines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toLowerCase();
        const value = match[2].trim();
        parsedHeaders[key] = value;
      }
    });
    
    // Extract key information
    const analysis = {
      from: parsedHeaders.from || 'Unknown',
      to: parsedHeaders.to || 'Unknown',
      subject: parsedHeaders.subject || 'No subject',
      date: parsedHeaders.date || 'Unknown',
      received: parsedHeaders.received ? parsedHeaders.received.split(',').map(r => r.trim()) : [],
      returnPath: parsedHeaders['return-path'] || parsedHeaders['return-path'] || null,
      messageId: parsedHeaders['message-id'] || null,
      spf: parsedHeaders['received-spf'] || null,
      dkim: parsedHeaders['dkim-signature'] ? 'Present' : 'Not present',
      dmarc: parsedHeaders['authentication-results'] || null
    };
    
    // Detect potential spoofing
    const potentialSpoofing = [];
    if (analysis.from && analysis.returnPath && !analysis.from.includes(analysis.returnPath)) {
      potentialSpoofing.push('From and Return-Path mismatch');
    }
    if (!analysis.dkim || analysis.dkim === 'Not present') {
      potentialSpoofing.push('No DKIM signature found');
    }
    
    res.json({
      success: true,
      headers: parsedHeaders,
      analysis: analysis,
      security: {
        potentialSpoofing: potentialSpoofing.length > 0,
        warnings: potentialSpoofing
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error analyzing email headers'
    });
  }
});

// Text Diff
router.post('/text-diff', toolsRateLimiter, (req, res) => {
  try {
    const { text1, text2 } = req.body;
    
    if (!text1 || !text2) {
      return res.status(400).json({
        success: false,
        error: 'Both text1 and text2 parameters are required'
      });
    }
    
    // Simple diff algorithm
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const diff = [];
    
    const maxLen = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLen; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      
      if (line1 === line2) {
        diff.push({ type: 'equal', line: line1, lineNumber: i + 1 });
      } else {
        if (line1) {
          diff.push({ type: 'removed', line: line1, lineNumber: i + 1 });
        }
        if (line2) {
          diff.push({ type: 'added', line: line2, lineNumber: i + 1 });
        }
      }
    }
    
    const stats = {
      totalLines: maxLen,
      equal: diff.filter(d => d.type === 'equal').length,
      added: diff.filter(d => d.type === 'added').length,
      removed: diff.filter(d => d.type === 'removed').length
    };
    
    res.json({
      success: true,
      diff: diff,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error comparing texts'
    });
  }
});

// Regex Tester
router.post('/regex', toolsRateLimiter, (req, res) => {
  try {
    const { pattern, text, flags = 'g' } = req.body;
    
    if (!pattern) {
      return res.status(400).json({
        success: false,
        error: 'Pattern parameter is required'
      });
    }
    
    if (text === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required'
      });
    }
    
    let regex;
    try {
      regex = new RegExp(pattern, flags);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: `Invalid regex pattern: ${e.message}`
      });
    }
    
    const matches = [];
    let match;
    const testText = text || '';
    
    if (flags.includes('g')) {
      while ((match = regex.exec(testText)) !== null) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1),
          fullMatch: match
        });
        if (!regex.global) break;
      }
    } else {
      match = regex.exec(testText);
      if (match) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1),
          fullMatch: match
        });
      }
    }
    
    res.json({
      success: true,
      pattern: pattern,
      flags: flags,
      testText: testText,
      matches: matches,
      matchCount: matches.length,
      isValid: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error testing regex'
    });
  }
});

// QR Code Generator
router.post('/qr-generate', toolsRateLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text parameter is required'
      });
    }
    
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#00ff88',
        light: '#0a0a0a'
      }
    });
    
    res.json({
      success: true,
      text: text,
      qrCode: qrDataUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error generating QR code'
    });
  }
});

// Sigma -> KQL Converter (Microsoft Defender / M365 Defender)
router.post('/sigma-to-kql', intensiveToolsRateLimiter, async (req, res) => {
  try {
    const sigma = (req.body && req.body.sigma) || '';
    const target = (req.body && req.body.target) || 'kusto';

    if (typeof sigma !== 'string' || !sigma.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Sigma rule is required.'
      });
    }

    // Hard size limit for safety and performance
    if (sigma.length > 50000) {
      return res.status(400).json({
        success: false,
        error: 'Sigma rule is too large. Please keep it below ~50 KB.'
      });
    }

    // Prefer dedicated virtualenv Python; fall back to env var; last resort system python
    const pythonBin = process.env.SIGMA_KQL_PYTHON || '/opt/sigma-kql-venv/bin/python3';
    const scriptPath = path.join(__dirname, '..', 'scripts', 'convert_sigma_to_kql.py');

    // Call the dedicated Python helper in a bounded subprocess
    const child = execFile(
      pythonBin,
      [scriptPath],
      {
        timeout: 7000,           // 7 seconds max
        maxBuffer: 256 * 1024    // 256 KB stdout/stderr
      },
      (error, stdout, stderr) => {
        if (error) {
          // Timeout or execution error
          const isTimeout = error.killed || /timed out/i.test(String(error.message || ''));
          return res.status(500).json({
            success: false,
            error: isTimeout
              ? 'Conversion timed out. Please simplify the rule or try again later.'
              : 'Conversion backend failed. Please try again later.'
          });
        }

        try {
          const out = JSON.parse(stdout || '{}');
          if (out && typeof out === 'object') {
            // Ensure we never leak extremely large strings back
            if (out.kql && typeof out.kql === 'string' && out.kql.length > 50000) {
              out.kql = out.kql.slice(0, 49920) + '\n\n// [truncated output]';
            }
            return res.json(out);
          }
        } catch (parseErr) {
          // Fall through to generic error below
        }

        return res.status(500).json({
          success: false,
          error: 'Unexpected converter output. Please verify your Sigma rule.'
        });
      }
    );

    // Send payload to the helper via stdin
    try {
      child.stdin.write(JSON.stringify({ sigma, target }));
      child.stdin.end();
    } catch (streamErr) {
      return res.status(500).json({
        success: false,
        error: 'Failed to send data to conversion backend.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error running Sigma-to-KQL conversion.'
    });
  }
});

// Image to PDF – convert JPEG, PNG, WebP, GIF to a single PDF
router.post('/image-to-pdf', toolsRateLimiter, imageUpload.array('images', 20), async (req, res) => {
  try {
    const files = req.files && req.files.length ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please upload at least one image (JPEG, PNG, WebP, or GIF).'
      });
    }
    const doc = await PDFDocument.create();
    for (const file of files) {
      let buf = file.buffer;
      let mime = (file.mimetype || '').toLowerCase();
      if (mime === 'image/webp' || mime === 'image/gif') {
        buf = await sharp(buf).png().toBuffer();
        mime = 'image/png';
      }
      const page = doc.addPage();
      const dims = page.getSize();
      const pageW = dims.width;
      const pageH = dims.height;
      let image;
      if (mime === 'image/jpeg' || mime === 'image/jpg') {
        image = await doc.embedJpg(buf);
      } else {
        image = await doc.embedPng(buf);
      }
      const imgW = image.width;
      const imgH = image.height;
      const scale = Math.min(pageW / imgW, pageH / imgH, 1);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = (pageW - drawW) / 2;
      const y = (pageH - drawH) / 2;
      page.drawImage(image, {
        x,
        y,
        width: drawW,
        height: drawH
      });
    }
    const pdfBytes = await doc.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="images.pdf"',
      'Content-Length': pdfBytes.length
    });
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create PDF from images.'
    });
  }
});

module.exports = router;

