#!/bin/bash
# Auto-fetch latest CVEs from Telegram and CVE databases
# This script is run by cronjob (runs every 6 hours to get newest CVEs)

# Set working directory
cd /home/nexcms/public_html

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Log file
LOG_FILE="/var/log/nexcms/fetch-cve.log"
mkdir -p /var/log/nexcms

# Run the CVE fetch script (only fetches newest, skips duplicates)
echo "[$(date)] Starting CVE fetch (newest only)..." >> "$LOG_FILE"
node fetch-cve-telegram.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] ✅ CVE fetch completed successfully" >> "$LOG_FILE"
    
    # Submit new posts to IndexNow
    echo "[$(date)] Submitting new CVEs to IndexNow..." >> "$LOG_FILE"
    node scripts/submit-all-to-all-search-engines.js >> "$LOG_FILE" 2>&1
else
    echo "[$(date)] ❌ CVE fetch failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

exit $EXIT_CODE

