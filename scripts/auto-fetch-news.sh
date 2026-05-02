#!/bin/bash
# Auto-fetch latest SEO-optimized news for all categories
# This script is run by cronjob. Works from any deploy path (uses script dir).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${INFINITSEC_APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
cd "$APP_DIR" || exit 1

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Log file
LOG_FILE="/var/log/nexcms/fetch-news.log"
mkdir -p /var/log/nexcms

# Run the quality news fetcher (~20 posts/day, quality gate + optional local LLM)
echo "[$(date)] Starting auto-fetch of latest news (quality fetcher)..." >> "$LOG_FILE"
node fetch-quality-news-all-categories.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "[$(date)] ✅ News fetch completed successfully" >> "$LOG_FILE"
else
    echo "[$(date)] ❌ News fetch failed with exit code $EXIT_CODE" >> "$LOG_FILE"
fi

exit $EXIT_CODE


