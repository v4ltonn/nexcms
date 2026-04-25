/**
 * Google Indexing API Service
 * For instant indexing of new/updated content
 * 
 * Setup required:
 * 1. Create Google Cloud Project
 * 2. Enable Indexing API
 * 3. Create Service Account or OAuth 2.0 credentials
 * 4. Set GOOGLE_INDEXING_CLIENT_EMAIL and GOOGLE_INDEXING_PRIVATE_KEY in .env
 */

const https = require('https');

// Try to load googleapis (optional dependency)
let google = null;
try {
  google = require('googleapis').google;
} catch (e) {
  // googleapis not installed - will use HTTP method only
}

// Initialize Google Auth
let authClient = null;

async function getAuthClient() {
  if (!google) {
    throw new Error('googleapis package not installed. Run: npm install googleapis');
  }
  
  if (authClient) return authClient;

  const clientEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  // Handle both escaped \n and actual newlines in the private key
  let privateKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  if (privateKey) {
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  if (!clientEmail || !privateKey) {
    throw new Error('Google Indexing API credentials not configured. Set GOOGLE_INDEXING_CLIENT_EMAIL and GOOGLE_INDEXING_PRIVATE_KEY in .env');
  }

  try {
    authClient = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    await authClient.authorize();
    return authClient;
  } catch (error) {
    console.error('❌ Google Auth error:', error.message);
    // Reset authClient so we can retry
    authClient = null;
    throw error;
  }
}

/**
 * Submit URL to Google Indexing API for instant indexing
 * @param {string} url - Full URL to index
 * @param {string} type - 'URL_UPDATED' or 'URL_DELETED'
 */
async function submitToGoogleIndexing(url, type = 'URL_UPDATED') {
  if (!google) {
    // Fallback to HTTP method if googleapis not installed
    return await submitViaPing(url);
  }
  
  try {
    const auth = await getAuthClient();
    const indexing = google.indexing({ version: 'v3', auth });

    const request = {
      url: url,
      type: type,
    };

    const response = await indexing.urlNotifications.publish({
      requestBody: request,
    });

    console.log(`✅ Google Indexing API: Submitted ${url} (${type})`);
    return { success: true, response };
  } catch (error) {
    // Don't fall back to ping method for these errors - they're real API errors
    if (error.code === 403) {
      console.error('❌ Google Indexing API: Permission denied. Check credentials and API access.');
      return { success: false, error: 'Permission denied. Check credentials and API access.' };
    } else if (error.code === 429) {
      console.error('❌ Google Indexing API: Rate limit exceeded. Too many requests.');
      return { success: false, error: 'Rate limit exceeded. Please wait before submitting more URLs.' };
    } else if (error.message && error.message.includes('DECODER')) {
      console.error('❌ Google Indexing API: Invalid private key format. Check GOOGLE_INDEXING_PRIVATE_KEY in .env');
      return { success: false, error: 'Invalid private key format. Check credentials.' };
    } else {
      console.error('❌ Google Indexing API error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

/**
 * Submit multiple URLs in batch
 * @param {Array<string>} urls - Array of URLs to index
 */
async function submitUrlsToGoogleIndexing(urls) {
  const results = [];
  
  for (const url of urls) {
    try {
      const result = await submitToGoogleIndexing(url, 'URL_UPDATED');
      results.push({ url, ...result });
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({ url, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Simple HTTP-based submission (alternative method)
 * Note: This method requires OAuth token, not just API key
 * For now, this is a placeholder - use OAuth method for real indexing
 */
async function submitViaPing(url) {
  // This method requires OAuth token in Authorization header
  // For now, return false to indicate it needs proper setup
  return { success: false, error: 'OAuth token required. Use submitToGoogleIndexing with service account credentials.' };
}

module.exports = {
  submitToGoogleIndexing,
  submitUrlsToGoogleIndexing,
  submitViaPing
};





