#!/bin/bash
# Auto-fetch cybersecurity news into Cyber category (slug: cyber)
# Run via cron so /category/cyber gets fresh posts even if main news job fails

cd /home/nexcms/public_html

if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

LOG_FILE="/var/log/nexcms/fetch-cyber.log"
mkdir -p /var/log/nexcms

echo "[$(date)] Starting Cyber news fetch..." >> "$LOG_FILE"
node fetch-cyber-news-seo.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] ✅ Cyber fetch completed" >> "$LOG_FILE"
else
    echo "[$(date)] ❌ Cyber fetch failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

exit $EXIT_CODE
