#!/bin/bash
# Auto-fetch how-to articles from legitimate sources (DigitalOcean, etc.)
# This script is run by cronjob (runs daily to get new how-to articles)

# Set working directory
cd /home/nexcms/public_html

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Log file
LOG_FILE="/var/log/nexcms/fetch-howto.log"
mkdir -p /var/log/nexcms

# Run the how-to fetch script (only fetches newest, skips duplicates)
echo "[$(date)] Starting how-to article fetch..." >> "$LOG_FILE"
node fetch-howto-articles.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] ✅ How-to article fetch completed successfully" >> "$LOG_FILE"
else
    echo "[$(date)] ❌ How-to article fetch failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

exit $EXIT_CODE

