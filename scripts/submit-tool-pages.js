#!/usr/bin/env node
/**
 * Submit tool pages to Google Indexing API and IndexNow
 */

require('dotenv').config();
const { submitUrl } = require('../services/indexnow-enhanced');

const SITE_URL = process.env.SITE_URL || '${process.env.SITE_URL || 'http://localhost:3000'}';

// Tool pages to submit
const toolPages = [
  '/cve-search',
  '/password-checker',
  '/security-headers',
  '/ssl-checker',
  '/dns-lookup',
  '/ip-lookup',
  '/hash-generator',
  '/base64-encoder',
  '/json-formatter',
  '/qr-generator',
  '/uuid-generator',
  '/email-header-analyzer',
  '/text-diff',
  '/regex-tester'
];

async function submitToolPages() {
  try {
    console.log('🚀 Submitting tool pages to search engines...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Try to use Google Indexing API if available
    let submitToGoogleIndexing;
    try {
      const googleIndexing = require('../services/google-indexing');
      submitToGoogleIndexing = googleIndexing.submitToGoogleIndexing;
    } catch (e) {
      console.log('ℹ️  Google Indexing API service not available, using IndexNow only\n');
      submitToGoogleIndexing = null;
    }
    
    for (let i = 0; i < toolPages.length; i++) {
      const path = toolPages[i];
      const url = `${SITE_URL}${path}`;
      
      try {
        console.log(`[${i + 1}/${toolPages.length}] Submitting: ${url}`);
        
        // Submit to Google Indexing API (if available)
        if (submitToGoogleIndexing) {
          try {
            const googleResult = await submitToGoogleIndexing(url, 'URL_UPDATED');
            if (googleResult && googleResult.success) {
              console.log(`   ✅ Google Indexing API: Success`);
            } else {
              console.log(`   ⚠️  Google Indexing API: ${googleResult?.error || 'Failed'}`);
            }
          } catch (e) {
            console.log(`   ⚠️  Google Indexing API: ${e.message}`);
          }
        }
        
        // Submit to IndexNow (Bing, Yandex, etc.)
        try {
          const indexNowResult = await submitUrl(url);
          if (indexNowResult && indexNowResult.ok) {
            console.log(`   ✅ IndexNow: Submitted to ${indexNowResult.successCount} search engines`);
            successCount++;
          } else {
            console.log(`   ⚠️  IndexNow: ${indexNowResult?.error || 'Failed'}`);
            errorCount++;
          }
        } catch (e) {
          console.log(`   ⚠️  IndexNow: ${e.message}`);
          errorCount++;
        }
        
        // Rate limiting: wait 1 second between requests
        if (i < toolPages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully submitted: ${successCount}/${toolPages.length}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run script
submitToolPages();

