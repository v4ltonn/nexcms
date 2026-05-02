#!/bin/bash
# Auto-fetch Linux installation guides (DigitalOcean, Dev.to, TecMint)
cd /home/nexcms/public_html
if [ -f .env ]; then export $(cat .env | grep -v "^#" | xargs); fi
LOG_FILE="/var/log/nexcms/fetch-install-guides.log"
echo "[$(date)] Starting install-guides fetch..." >> "$LOG_FILE"
node fetch-install-guides.js >> "$LOG_FILE" 2>&1
EXIT=$?
echo "[$(date)] $([ $EXIT -eq 0 ] && echo "✅" || echo "❌") install-guides exit $EXIT" >> "$LOG_FILE"
exit $EXIT
