#!/bin/bash
# Auto-fetch Linux install/setup articles (DigitalOcean, Dev.to, Opensource.com, Linux Journal)
cd /home/nexcms/public_html
if [ -f .env ]; then export $(cat .env | grep -v "^#" | xargs); fi
LOG_FILE="/var/log/nexcms/fetch-linux-install.log"
echo "[$(date)] Starting linux-install fetch..." >> "$LOG_FILE"
node fetch-linux-install-posts.js >> "$LOG_FILE" 2>&1
EXIT=$?
echo "[$(date)] $([ $EXIT -eq 0 ] && echo "✅" || echo "❌") linux-install exit $EXIT" >> "$LOG_FILE"
exit $EXIT
