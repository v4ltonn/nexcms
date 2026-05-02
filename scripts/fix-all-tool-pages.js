#!/usr/bin/env node
/**
 * Fix all tool pages to have correct interfaces
 */

const fs = require('fs');
const path = require('path');

// Fix UUID Generator
const uuidPath = path.join(__dirname, '..', 'public', 'uuid-generator.html');
let uuidContent = fs.readFileSync(uuidPath, 'utf8');

// Fix description
uuidContent = uuidContent.replace(/Verify Generate random UUIDs/g, 'Generate random UUIDs');

// Fix the tool section HTML
uuidContent = uuidContent.replace(
  /<div class="input-group">[\s\S]*?<\/div>[\s\S]*?<div id="loadingIndicator"/,
  `<div style="text-align: center; margin-bottom: 30px;">
                <button class="check-btn" onclick="generateUUIDs()" style="padding: 20px 50px; font-size: 1.2rem;">
                    <i class="fas fa-sync-alt"></i> Generate UUIDs
                </button>
                <div style="margin-top: 15px;">
                    <label style="color: #888; margin-right: 10px;">Count:</label>
                    <input type="number" id="uuidCount" value="1" min="1" max="100" style="padding: 10px; background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #ffffff; width: 80px; text-align: center;">
                </div>
            </div>
            
            <div id="loadingIndicator"`
);

// Fix the JavaScript function
uuidContent = uuidContent.replace(
  /async function processuuidgenerator\(\) \{[\s\S]*?document\.getElementById\('domainInput'\)\.addEventListener\('keypress'/,
  `async function generateUUIDs() {
            const count = parseInt(document.getElementById('uuidCount').value) || 1;
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch(\`/api/tools/uuid?count=\${count}\`);
                const data = await response.json();
                
                loading.style.display = 'none';
                checkBtn.disabled = false;
                
                if (data.success && data.uuids) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> Generated \${data.count} UUID\${data.count > 1 ? 's' : ''}
                            </div>
                            <div style="margin-top: 20px;">
                                \${data.uuids.map((uuid, index) => \`
                                    <div class="cert-item" style="padding: 15px; background: rgba(0, 255, 136, 0.05); border-radius: 8px; margin-bottom: 10px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-family: monospace; font-size: 1.1rem; color: #00ff88; word-break: break-all; flex: 1; margin-right: 15px;">\${uuid}</span>
                                            <button onclick="copyToClipboard('\${uuid}')" style="padding: 8px 16px; background: rgba(0, 255, 136, 0.2); border: 1px solid #00ff88; border-radius: 6px; color: #00ff88; cursor: pointer; font-size: 0.9rem;">
                                                <i class="fas fa-copy"></i> Copy
                                            </button>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                            <div style="margin-top: 20px; text-align: center;">
                                <button onclick="copyAllUUIDs()" style="padding: 12px 24px; background: linear-gradient(135deg, #00ff88, #00cc6a); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer;">
                                    <i class="fas fa-copy"></i> Copy All
                                </button>
                            </div>
                        </div>
                    \`;
                    window.generatedUUIDs = data.uuids;
                } else {
                    results.innerHTML = \`<div style="text-align: center; color: #ff0000; padding: 40px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                        <p>Error: \${data.error || 'Failed to generate UUIDs'}</p>
                    </div>\`;
                }
            } catch (error) {
                loading.style.display = 'none';
                checkBtn.disabled = false;
                results.innerHTML = \`<div style="text-align: center; color: #ff0000; padding: 40px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                    <p>Error: \${error.message}</p>
                </div>\`;
            }
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
        
        function copyAllUUIDs() {
            if (window.generatedUUIDs) {
                const allUUIDs = window.generatedUUIDs.join('\\n');
                navigator.clipboard.writeText(allUUIDs).then(() => {
                    alert('All UUIDs copied to clipboard!');
                }).catch(err => {
                    console.error('Failed to copy:', err);
                });
            }
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            generateUUIDs();
        });`
);

fs.writeFileSync(uuidPath, uuidContent);
console.log('✅ Fixed UUID Generator');

// Fix DNS Lookup
const dnsPath = path.join(__dirname, '..', 'public', 'dns-lookup.html');
let dnsContent = fs.readFileSync(dnsPath, 'utf8');

dnsContent = dnsContent.replace(/Verify Lookup DNS records/g, 'Lookup DNS records');
dnsContent = dnsContent.replace(/Check Certificate/g, 'Lookup DNS');
dnsContent = dnsContent.replace(/Checking SSL certificate/g, 'Looking up DNS records');
dnsContent = dnsContent.replace(/processdnslookup\(\)/g, 'lookupDNS()');
dnsContent = dnsContent.replace(/placeholder="example.com or https:\/\/example.com"/g, 'placeholder="example.com"');

// Fix DNS JavaScript
dnsContent = dnsContent.replace(
  /async function processdnslookup\(\) \{[\s\S]*?const response = await fetch\(`\/api\/tools\/dns-lookup\?domain=\$\{encodeURIComponent\(domain\)\}`\);/,
  `async function lookupDNS() {
            const domain = document.getElementById('domainInput').value.trim();
            const recordType = document.getElementById('recordType')?.value || 'A';
            
            if (!domain) {
                alert('Please enter a domain name');
                return;
            }
            
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch(\`/api/tools/dns-lookup?domain=\${encodeURIComponent(domain)}&type=\${recordType}\`);`
);

// Add record type selector before the input
dnsContent = dnsContent.replace(
  /<div class="input-group">/,
  `<div style="margin-bottom: 15px;">
                <label style="color: #888; margin-right: 10px;">Record Type:</label>
                <select id="recordType" style="padding: 10px; background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #ffffff; margin-right: 15px;">
                    <option value="A">A</option>
                    <option value="AAAA">AAAA</option>
                    <option value="MX">MX</option>
                    <option value="TXT">TXT</option>
                    <option value="CNAME">CNAME</option>
                    <option value="NS">NS</option>
                </select>
            </div>
            <div class="input-group">`
);

// Fix DNS results display
dnsContent = dnsContent.replace(
  /if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/,
  `if (data.success) {
                    const records = Array.isArray(data.records) ? data.records : [data.records];
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> DNS Lookup Results
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Domain:</span>
                                <span class="cert-value">\${data.domain}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Record Type:</span>
                                <span class="cert-value">\${data.type}</span>
                            </div>
                            <div style="margin-top: 20px;">
                                <div class="cert-label" style="margin-bottom: 10px;">Records:</div>
                                \${records.map((record, index) => {
                                    const recordValue = typeof record === 'object' && record.exchange ? record.exchange : (typeof record === 'object' && record.value ? record.value : record);
                                    return \`<div class="cert-item" style="padding: 12px; background: rgba(0, 255, 136, 0.05); border-radius: 8px; margin-bottom: 8px; font-family: monospace; color: #00ff88;">\${recordValue}</div>\`;
                                }).join('')}
                            </div>
                        </div>
                    \`;`
);

fs.writeFileSync(dnsPath, dnsContent);
console.log('✅ Fixed DNS Lookup');

// Fix IP Lookup
const ipPath = path.join(__dirname, '..', 'public', 'ip-lookup.html');
let ipContent = fs.readFileSync(ipPath, 'utf8');

ipContent = ipContent.replace(/Verify Get IP address geolocation/g, 'Get IP address geolocation');
ipContent = ipContent.replace(/Check Certificate/g, 'Lookup IP');
ipContent = ipContent.replace(/Checking SSL certificate/g, 'Looking up IP address');
ipContent = ipContent.replace(/processiplookup\(\)/g, 'lookupIP()');
ipContent = ipContent.replace(/placeholder="example.com or https:\/\/example.com"/g, 'placeholder="8.8.8.8 or 2001:4860:4860::8888"');

// Fix IP JavaScript
ipContent = ipContent.replace(
  /async function processiplookup\(\) \{[\s\S]*?const response = await fetch\(`\/api\/tools\/ip-lookup\?domain=\$\{encodeURIComponent\(domain\)\}`\);/,
  `async function lookupIP() {
            const ip = document.getElementById('domainInput').value.trim();
            
            if (!ip) {
                alert('Please enter an IP address');
                return;
            }
            
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch(\`/api/tools/ip-lookup?ip=\${encodeURIComponent(ip)}\`);`
);

// Fix IP results
ipContent = ipContent.replace(
  /if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/,
  `if (data.success) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> IP Lookup Results
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">IP Address:</span>
                                <span class="cert-value">\${data.ip}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Country:</span>
                                <span class="cert-value">\${data.location.country} (\${data.location.countryCode})</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Region:</span>
                                <span class="cert-value">\${data.location.region}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">City:</span>
                                <span class="cert-value">\${data.location.city}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">ISP:</span>
                                <span class="cert-value">\${data.network.isp}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Organization:</span>
                                <span class="cert-value">\${data.network.organization || 'N/A'}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">ASN:</span>
                                <span class="cert-value">\${data.network.asn || 'N/A'}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Timezone:</span>
                                <span class="cert-value">\${data.location.timezone}</span>
                            </div>
                        </div>
                    \`;`
);

fs.writeFileSync(ipPath, ipContent);
console.log('✅ Fixed IP Lookup');

console.log('\n✅ Fixed 3 tool pages. Remaining tools need manual fixes.');
console.log('Tools fixed: UUID Generator, DNS Lookup, IP Lookup');
console.log('Still need fixes: Hash Generator, Base64, JSON, QR, Email Header, Text Diff, Regex');






