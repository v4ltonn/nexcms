#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, '..', 'public');

// Hash Generator
const hashPath = path.join(toolsDir, 'hash-generator.html');
let hash = fs.readFileSync(hashPath, 'utf8');
hash = hash.replace(/Verify Generate MD5/g, 'Generate MD5');
hash = hash.replace(/Check Certificate/g, 'Generate Hash');
hash = hash.replace(/Checking SSL certificate/g, 'Generating hash');
hash = hash.replace(/processhashgenerator\(\)/g, 'generateHash()');
hash = hash.replace(/placeholder="example.com or https:\/\/example.com"/g, 'placeholder="Enter text to hash..."');
hash = hash.replace(/id="domainInput"/g, 'id="textInput"');
hash = hash.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const text = document.getElementById('textInput').value.trim();
            const algorithm = document.getElementById('algorithmSelect')?.value || 'sha256';
            if (!text) {
                alert('Please enter text to hash');
                return;
            }`);
hash = hash.replace(/fetch\(`\/api\/tools\/hash\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `fetch('/api/tools/hash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, algorithm })
            })`);
hash = hash.replace(/<div class="input-group">/g, `<div style="margin-bottom: 15px;">
                <label style="color: #888; margin-right: 10px;">Algorithm:</label>
                <select id="algorithmSelect" style="padding: 10px; background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #ffffff; margin-right: 15px;">
                    <option value="md5">MD5</option>
                    <option value="sha1">SHA1</option>
                    <option value="sha256" selected>SHA256</option>
                    <option value="sha512">SHA512</option>
                </select>
            </div>
            <div class="input-group">`);
hash = hash.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `if (data.success) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> Hash Generated
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Algorithm:</span>
                                <span class="cert-value">\${data.algorithm.toUpperCase()}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Hash:</span>
                                <span class="cert-value" style="font-family: monospace; font-size: 0.95rem; word-break: break-all; color: #00ff88;">\${data.hash}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Length:</span>
                                <span class="cert-value">\${data.length} characters</span>
                            </div>
                            <div style="margin-top: 20px; text-align: center;">
                                <button onclick="copyToClipboard('\${data.hash}')" style="padding: 12px 24px; background: linear-gradient(135deg, #00ff88, #00cc6a); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer;">
                                    <i class="fas fa-copy"></i> Copy Hash
                                </button>
                            </div>
                        </div>
                    \`;`);
hash = hash.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, `function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => {});
        }
        document.getElementById('textInput').addEventListener`);
fs.writeFileSync(hashPath, hash);
console.log('✅ Fixed Hash Generator');

// Base64 Encoder
const base64Path = path.join(toolsDir, 'base64-encoder.html');
let base64 = fs.readFileSync(base64Path, 'utf8');
base64 = base64.replace(/Verify Encode and decode text/g, 'Encode and decode text');
base64 = base64.replace(/Check Certificate/g, 'Process');
base64 = base64.replace(/Checking SSL certificate/g, 'Processing');
base64 = base64.replace(/processbase64encoder\(\)/g, 'processBase64()');
base64 = base64.replace(/placeholder="example.com or https:\/\/example.com"/g, 'placeholder="Enter text to encode/decode..."');
base64 = base64.replace(/id="domainInput"/g, 'id="textInput"');
base64 = base64.replace(/<div class="input-group">/g, `<div style="margin-bottom: 15px;">
                <label style="color: #888; margin-right: 10px;">Operation:</label>
                <select id="operationSelect" style="padding: 10px; background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #ffffff; margin-right: 15px;">
                    <option value="encode">Encode</option>
                    <option value="decode">Decode</option>
                </select>
            </div>
            <div class="input-group">`);
base64 = base64.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const text = document.getElementById('textInput').value.trim();
            const operation = document.getElementById('operationSelect').value;
            if (!text) {
                alert('Please enter text');
                return;
            }`);
base64 = base64.replace(/fetch\(`\/api\/tools\/base64-encoder\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `fetch('/api/tools/base64', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, operation })
            })`);
base64 = base64.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `if (data.success) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> \${data.operation === 'encode' ? 'Encoded' : 'Decoded'}
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Result:</span>
                                <span class="cert-value" style="font-family: monospace; font-size: 0.95rem; word-break: break-all; color: #00ff88; background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; margin-top: 10px; display: block;">\${data.result}</span>
                            </div>
                            <div style="margin-top: 20px; text-align: center;">
                                <button onclick="copyToClipboard('\${data.result}')" style="padding: 12px 24px; background: linear-gradient(135deg, #00ff88, #00cc6a); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer;">
                                    <i class="fas fa-copy"></i> Copy Result
                                </button>
                            </div>
                        </div>
                    \`;`);
base64 = base64.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, `function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => {});
        }
        document.getElementById('textInput').addEventListener`);
fs.writeFileSync(base64Path, base64);
console.log('✅ Fixed Base64 Encoder');

// JSON Formatter
const jsonPath = path.join(toolsDir, 'json-formatter.html');
let json = fs.readFileSync(jsonPath, 'utf8');
json = json.replace(/Verify Format, validate, and minify JSON data/g, 'Format, validate, and minify JSON data');
json = json.replace(/Check Certificate/g, 'Process JSON');
json = json.replace(/Checking SSL certificate/g, 'Processing JSON');
json = json.replace(/processjsonformatter\(\)/g, 'processJSON()');
json = json.replace(/<div class="input-group">[\s\S]*?<\/div>/g, `<div style="margin-bottom: 15px;">
                <label style="color: #888; margin-right: 10px;">Operation:</label>
                <select id="operationSelect" style="padding: 10px; background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; color: #ffffff; margin-right: 15px;">
                    <option value="format">Format</option>
                    <option value="validate">Validate</option>
                    <option value="minify">Minify</option>
                </select>
            </div>
            <div style="margin-bottom: 20px;">
                <textarea id="jsonInput" style="width: 100%; min-height: 200px; padding: 15px; background: #0a0a0a; border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; color: #ffffff; font-family: monospace; font-size: 0.95rem;" placeholder="Paste your JSON here..."></textarea>
            </div>
            <div style="text-align: center;">
                <button class="check-btn" onclick="processJSON()">
                    <i class="fas fa-code"></i> Process JSON
                </button>
            </div>`);
json = json.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const jsonText = document.getElementById('jsonInput').value.trim();
            const operation = document.getElementById('operationSelect').value;
            if (!jsonText) {
                alert('Please enter JSON');
                return;
            }`);
json = json.replace(/fetch\(`\/api\/tools\/json-formatter\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `fetch('/api/tools/json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ json: jsonText, operation })
            })`);
json = json.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `if (data.success && data.valid) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> Valid JSON - \${data.operation}
                            </div>
                            <div style="margin-top: 20px;">
                                <pre style="background: rgba(0, 0, 0, 0.3); padding: 20px; border-radius: 8px; overflow-x: auto; color: #00ff88; font-family: monospace; font-size: 0.9rem; white-space: pre-wrap; word-wrap: break-word;">\${data.result}</pre>
                            </div>
                            <div style="margin-top: 20px; text-align: center;">
                                <button onclick="copyToClipboard('\${data.result.replace(/'/g, "\\\\'")}')" style="padding: 12px 24px; background: linear-gradient(135deg, #00ff88, #00cc6a); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer;">
                                    <i class="fas fa-copy"></i> Copy Result
                                </button>
                            </div>
                        </div>
                    \`;
                } else {
                    results.innerHTML = \`<div class="cert-card expired">
                        <div class="status-badge status-expired">
                            <i class="fas fa-times-circle"></i> Invalid JSON
                        </div>
                        <div style="color: #ff0000; margin-top: 15px;">\${data.error || 'Invalid JSON format'}</div>
                    </div>\`;
                }`);
json = json.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, `function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => alert('Copied!')).catch(() => {});
        }`);
fs.writeFileSync(jsonPath, json);
console.log('✅ Fixed JSON Formatter');

console.log('\n✅ Fixed Hash Generator, Base64 Encoder, JSON Formatter');
console.log('Still need: QR Generator, Email Header Analyzer, Text Diff, Regex Tester');






