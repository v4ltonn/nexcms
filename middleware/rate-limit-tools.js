const rateLimit = require('express-rate-limit');

// Rate limiter for tools - 10 requests per 5 minutes per IP
const toolsRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: 'Too many requests. Please wait 5 minutes before trying again.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    return process.env.NODE_ENV !== 'production' && req.ip === '::1';
  }
});

// Stricter rate limiter for resource-intensive tools (SSL, DNS, IP lookup)
const intensiveToolsRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many requests. Please wait 10 minutes before trying again.',
    retryAfter: 600
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV !== 'production' && req.ip === '::1';
  }
});

module.exports = {
  toolsRateLimiter,
  intensiveToolsRateLimiter
};






