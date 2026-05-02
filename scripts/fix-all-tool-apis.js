#!/usr/bin/env node
/**
 * Fix all tool API calls to match backend routes
 */

const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, '..', 'public');

// Fix Base64 Encoder
console.log('Fixing Base64 Encoder...');
const base64Path = path.join(toolsDir, 'base64-encoder.html');
let base64 = fs.readFileSync(base64Path, 'utf8');

// Fix the function to get text and operation, use POST
base64 = base64.replace(
  /const text = document\.getElementById\('textInput'\)\.value\.trim\(\);\s*const operation = document\.getElementById\('operationSelect'\)\.value;\s*if \(!text\) \{\s*alert\('Please enter text'\);\s*return;\s*\}\s*const loading = document\.getElementById\('loadingIndicator'\);\s*const results = document\.getElementById\('resultsContainer'\);\s*const checkBtn = document\.querySelector\('\.check-btn'\);\s*loading\.style\.display = 'block';\s*results\.innerHTML = '';\s*checkBtn\.disabled = true;\s*try \{\s*const response = await fetch\(`\/api\/tools\/base64\?domain=\$\{encodeURIComponent\(domain\)\}`\);/g,
  `const text = document.getElementById('textInput').value.trim();
            const operation = document.getElementById('operationSelect').value;
            if (!text) {
                alert('Please enter text');
                return;
            }
            
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch('/api/tools/base64', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, operation })
                });`
);

// Remove any leftover domain checks
base64 = base64.replace(/if \(!domain\) \{[\s\S]*?alert\('Please enter a domain name'\);[\s\S]*?return;[\s\S]*?\}/g, '');
base64 = base64.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, '');

fs.writeFileSync(base64Path, base64);
console.log('✅ Fixed Base64 Encoder');

// Fix JSON Formatter
console.log('Fixing JSON Formatter...');
const jsonPath = path.join(toolsDir, 'json-formatter.html');
let json = fs.readFileSync(jsonPath, 'utf8');

// Fix the function to get json and operation, use POST
json = json.replace(
  /const jsonText = document\.getElementById\('jsonInput'\)\.value\.trim\(\);\s*const operation = document\.getElementById\('operationSelect'\)\.value;\s*if \(!jsonText\) \{\s*alert\('Please enter JSON'\);\s*return;\s*\}\s*const loading = document\.getElementById\('loadingIndicator'\);\s*const results = document\.getElementById\('resultsContainer'\);\s*const checkBtn = document\.querySelector\('\.check-btn'\);\s*loading\.style\.display = 'block';\s*results\.innerHTML = '';\s*checkBtn\.disabled = true;\s*try \{\s*const response = await fetch\(`\/api\/tools\/json\?domain=\$\{encodeURIComponent\(domain\)\}`\);/g,
  `const jsonText = document.getElementById('jsonInput').value.trim();
            const operation = document.getElementById('operationSelect').value;
            if (!jsonText) {
                alert('Please enter JSON');
                return;
            }
            
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch('/api/tools/json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ json: jsonText, operation })
                });`
);

// Remove any leftover domain checks
json = json.replace(/if \(!domain\) \{[\s\S]*?alert\('Please enter a domain name'\);[\s\S]*?return;[\s\S]*?\}/g, '');
json = json.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, '');

fs.writeFileSync(jsonPath, json);
console.log('✅ Fixed JSON Formatter');

// Fix Email Header Analyzer
console.log('Fixing Email Header Analyzer...');
const emailPath = path.join(toolsDir, 'email-header-analyzer.html');
let email = fs.readFileSync(emailPath, 'utf8');

// Fix the function to get headers, use POST
email = email.replace(
  /const headers = document\.getElementById\('headerInput'\)\.value\.trim\(\);\s*if \(!headers\) \{\s*alert\('Please paste email headers'\);\s*return;\s*\}\s*const loading = document\.getElementById\('loadingIndicator'\);\s*const results = document\.getElementById\('resultsContainer'\);\s*const checkBtn = document\.querySelector\('\.check-btn'\);\s*loading\.style\.display = 'block';\s*results\.innerHTML = '';\s*checkBtn\.disabled = true;\s*try \{\s*const response = await fetch\(`\/api\/tools\/email-header\?domain=\$\{encodeURIComponent\(domain\)\}`\);/g,
  `const headers = document.getElementById('headerInput').value.trim();
            if (!headers) {
                alert('Please paste email headers');
                return;
            }
            
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch('/api/tools/email-header', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ headers })
                });`
);

// Remove any leftover domain checks
email = email.replace(/if \(!domain\) \{[\s\S]*?alert\('Please enter a domain name'\);[\s\S]*?return;[\s\S]*?\}/g, '');
email = email.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, '');

fs.writeFileSync(emailPath, email);
console.log('✅ Fixed Email Header Analyzer');

// Fix Regex Tester
console.log('Fixing Regex Tester...');
const regexPath = path.join(toolsDir, 'regex-tester.html');
let regex = fs.readFileSync(regexPath, 'utf8');

// Fix the function to get pattern, text, flags, use POST
regex = regex.replace(
  /const pattern = document\.getElementById\('patternInput'\)\.value\.trim\(\);\s*const testText = document\.getElementById\('testInput'\)\.value;\s*let flags = '';\s*if \(document\.getElementById\('flagG'\)\.checked\) flags \+= 'g';\s*if \(document\.getElementById\('flagI'\)\.checked\) flags \+= 'i';\s*if \(document\.getElementById\('flagM'\)\.checked\) flags \+= 'm';\s*if \(!pattern\) \{\s*alert\('Please enter a regex pattern'\);\s*return;\s*\}\s*const loading = document\.getElementById\('loadingIndicator'\);\s*const results = document\.getElementById\('resultsContainer'\);\s*const checkBtn = document\.querySelector\('\.check-btn'\);\s*loading\.style\.display = 'block';\s*results\.innerHTML = '';\s*checkBtn\.disabled = true;\s*try \{\s*const response = await fetch\(`\/api\/tools\/regex\?domain=\$\{encodeURIComponent\(domain\)\}`\);/g,
  `const pattern = document.getElementById('patternInput').value.trim();
            const testText = document.getElementById('testInput').value;
            let flags = '';
            if (document.getElementById('flagG').checked) flags += 'g';
            if (document.getElementById('flagI').checked) flags += 'i';
            if (document.getElementById('flagM').checked) flags += 'm';
            if (!pattern) {
                alert('Please enter a regex pattern');
                return;
            }
            
            const loading = document.getElementById('loadingIndicator');
            const results = document.getElementById('resultsContainer');
            const checkBtn = document.querySelector('.check-btn');
            
            loading.style.display = 'block';
            results.innerHTML = '';
            checkBtn.disabled = true;
            
            try {
                const response = await fetch('/api/tools/regex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pattern, text: testText, flags })
                });`
);

// Remove any leftover domain checks
regex = regex.replace(/if \(!domain\) \{[\s\S]*?alert\('Please enter a domain name'\);[\s\S]*?return;[\s\S]*?\}/g, '');
regex = regex.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, '');

fs.writeFileSync(regexPath, regex);
console.log('✅ Fixed Regex Tester');

// Fix IP Lookup
console.log('Fixing IP Lookup...');
const ipPath = path.join(toolsDir, 'ip-lookup.html');
let ip = fs.readFileSync(ipPath, 'utf8');

// Fix to use 'ip' parameter instead of 'domain'
ip = ip.replace(/const response = await fetch\(`\/api\/tools\/ip-lookup\?domain=\$\{encodeURIComponent\(domain\)\}`\);/g, 
  `const response = await fetch(\`/api/tools/ip-lookup?ip=\${encodeURIComponent(ip)}\`);`);

// Make sure variable is named 'ip' not 'domain'
ip = ip.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, 
  `const ip = document.getElementById('domainInput').value.trim();`);

ip = ip.replace(/if \(!domain\) \{[\s\S]*?alert\('Please enter a domain name'\);/g,
  `if (!ip) {
                alert('Please enter an IP address');`);

fs.writeFileSync(ipPath, ip);
console.log('✅ Fixed IP Lookup');

console.log('\n✅ All tool API calls fixed!');






