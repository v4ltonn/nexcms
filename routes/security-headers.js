const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const { URL } = require('url');

router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL parameter is required'
      });
    }
    
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const headers = {};
    let score = 0;
    
    return new Promise((resolve) => {
      const request = protocol.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NexCMS Security Headers Checker)'
        },
        timeout: 10000
      }, (response) => {
        // Check HTTPS
        if (parsedUrl.protocol === 'https:') {
          score += 20;
        }
        
        // Extract security headers
        headers.strictTransportSecurity = response.headers['strict-transport-security'] || 'not-set';
        headers.contentSecurityPolicy = response.headers['content-security-policy'] || 'not-set';
        headers.xFrameOptions = response.headers['x-frame-options'] || 'not-set';
        headers.xContentTypeOptions = response.headers['x-content-type-options'] || 'not-set';
        headers.xXssProtection = response.headers['x-xss-protection'] || 'not-set';
        headers.referrerPolicy = response.headers['referrer-policy'] || 'not-set';
        headers.permissionsPolicy = response.headers['permissions-policy'] || 'not-set';
        headers.publicKeyPins = response.headers['public-key-pins'] || 'not-set';
        
        // Calculate score
        if (headers.strictTransportSecurity !== 'not-set') score += 20;
        if (headers.contentSecurityPolicy !== 'not-set') score += 20;
        if (headers.xFrameOptions !== 'not-set') score += 10;
        if (headers.xContentTypeOptions !== 'not-set') score += 10;
        if (headers.referrerPolicy !== 'not-set') score += 10;
        if (headers.permissionsPolicy !== 'not-set') score += 10;
        
        response.on('data', () => {});
        response.on('end', () => {
          res.json({
            success: true,
            url: targetUrl,
            headers,
            score: Math.min(score, 100)
          });
          resolve();
        });
      });
      
      request.on('error', (error) => {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to fetch headers'
        });
        resolve();
      });
      
      request.on('timeout', () => {
        request.destroy();
        res.status(500).json({
          success: false,
          message: 'Request timeout'
        });
        resolve();
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error checking security headers'
    });
  }
});

module.exports = router;






