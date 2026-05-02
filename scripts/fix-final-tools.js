#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, '..', 'public');

// QR Generator (client-side only, using CDN)
const qrPath = path.join(toolsDir, 'qr-generator.html');
let qr = fs.readFileSync(qrPath, 'utf8');
qr = qr.replace(/Verify Generate QR codes/g, 'Generate QR codes');
qr = qr.replace(/Check Certificate/g, 'Generate QR Code');
qr = qr.replace(/Checking SSL certificate/g, 'Generating QR code');
qr = qr.replace(/processqrgenerator\(\)/g, 'generateQR()');
qr = qr.replace(/placeholder="example.com or https:\/\/example.com"/g, 'placeholder="Enter text, URL, or data..."');
qr = qr.replace(/id="domainInput"/g, 'id="qrInput"');
qr = qr.replace(/<div class="input-group">[\s\S]*?<\/div>/g, `<div style="margin-bottom: 20px;">
                <textarea id="qrInput" style="width: 100%; min-height: 100px; padding: 15px; background: #0a0a0a; border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; color: #ffffff; font-size: 1rem;" placeholder="Enter text, URL, email, or WiFi info..."></textarea>
            </div>
            <div style="text-align: center;">
                <button class="check-btn" onclick="generateQR()">
                    <i class="fas fa-qrcode"></i> Generate QR Code
                </button>
            </div>`);
qr = qr.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const text = document.getElementById('qrInput').value.trim();
            if (!text) {
                alert('Please enter text or URL');
                return;
            }`);
qr = qr.replace(/fetch\(`\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `// Client-side QR generation using API`);
// Add QR code library and generation
qr = qr.replace(/<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.4\.0\/css\/all\.min\.css">/g, `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>`);
qr = qr.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `// Generate QR code client-side
                const canvas = document.createElement('canvas');
                QRCode.toCanvas(canvas, text, { width: 300, margin: 2, color: { dark: '#00ff88', light: '#0a0a0a' } }, (err) => {
                    if (err) {
                        results.innerHTML = \`<div style="text-align: center; color: #ff0000; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                            <p>Error generating QR code: \${err.message}</p>
                        </div>\`;
                        return;
                    }
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> QR Code Generated
                            </div>
                            <div style="text-align: center; margin: 30px 0;">
                                \${canvas.outerHTML}
                            </div>
                            <div style="text-align: center;">
                                <button onclick="downloadQR()" style="padding: 12px 24px; background: linear-gradient(135deg, #00ff88, #00cc6a); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer; margin-right: 10px;">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button onclick="copyQRImage()" style="padding: 12px 24px; background: rgba(0, 255, 136, 0.2); border: 1px solid #00ff88; border-radius: 8px; color: #00ff88; font-weight: 700; cursor: pointer;">
                                    <i class="fas fa-copy"></i> Copy Image
                                </button>
                            </div>
                        </div>
                    \`;
                    window.qrCanvas = canvas;
                });`);
qr = qr.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, `function downloadQR() {
            if (window.qrCanvas) {
                const link = document.createElement('a');
                link.download = 'qrcode.png';
                link.href = window.qrCanvas.toDataURL();
                link.click();
            }
        }
        function copyQRImage() {
            if (window.qrCanvas) {
                window.qrCanvas.toBlob(blob => {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    alert('QR code copied to clipboard!');
                });
            }
        }
        document.getElementById('qrInput').addEventListener`);
fs.writeFileSync(qrPath, qr);
console.log('✅ Fixed QR Generator');

// Email Header Analyzer
const emailPath = path.join(toolsDir, 'email-header-analyzer.html');
let email = fs.readFileSync(emailPath, 'utf8');
email = email.replace(/Verify Analyze email headers/g, 'Analyze email headers');
email = email.replace(/Check Certificate/g, 'Analyze Headers');
email = email.replace(/Checking SSL certificate/g, 'Analyzing email headers');
email = email.replace(/processemailheaderanalyzer\(\)/g, 'analyzeHeaders()');
email = email.replace(/<div class="input-group">[\s\S]*?<\/div>/g, `<div style="margin-bottom: 20px;">
                <textarea id="headerInput" style="width: 100%; min-height: 300px; padding: 15px; background: #0a0a0a; border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; color: #ffffff; font-family: monospace; font-size: 0.9rem;" placeholder="Paste email headers here..."></textarea>
            </div>
            <div style="text-align: center;">
                <button class="check-btn" onclick="analyzeHeaders()">
                    <i class="fas fa-search"></i> Analyze Headers
                </button>
            </div>`);
email = email.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const headers = document.getElementById('headerInput').value.trim();
            if (!headers) {
                alert('Please paste email headers');
                return;
            }`);
email = email.replace(/fetch\(`\/api\/tools\/email-header-analyzer\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `fetch('/api/tools/email-header', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ headers })
            })`);
email = email.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `if (data.success) {
                    const analysis = data.analysis;
                    results.innerHTML = \`
                        <div class="cert-card \${data.security.potentialSpoofing ? 'expired' : 'valid'}">
                            <div class="status-badge \${data.security.potentialSpoofing ? 'status-expired' : 'status-valid'}">
                                <i class="fas \${data.security.potentialSpoofing ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                                \${data.security.potentialSpoofing ? 'Potential Issues Found' : 'Headers Analyzed'}
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">From:</span>
                                <span class="cert-value">\${analysis.from}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">To:</span>
                                <span class="cert-value">\${analysis.to}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Subject:</span>
                                <span class="cert-value">\${analysis.subject}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Date:</span>
                                <span class="cert-value">\${analysis.date}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">DKIM:</span>
                                <span class="cert-value">\${analysis.dkim}</span>
                            </div>
                            \${data.security.warnings.length > 0 ? \`
                                <div style="margin-top: 20px; padding: 15px; background: rgba(255, 0, 0, 0.1); border-radius: 8px; border: 1px solid rgba(255, 0, 0, 0.3);">
                                    <div class="cert-label" style="color: #ff0000; margin-bottom: 10px;">Warnings:</div>
                                    \${data.security.warnings.map(w => \`<div style="color: #ff0000; margin: 5px 0;">• \${w}</div>\`).join('')}
                                </div>
                            \` : ''}
                        </div>
                    \`;`);
email = email.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, '');
fs.writeFileSync(emailPath, email);
console.log('✅ Fixed Email Header Analyzer');

// Text Diff
const diffPath = path.join(toolsDir, 'text-diff.html');
let diff = fs.readFileSync(diffPath, 'utf8');
diff = diff.replace(/Verify Compare two texts/g, 'Compare two texts');
diff = diff.replace(/Check Certificate/g, 'Compare Texts');
diff = diff.replace(/Checking SSL certificate/g, 'Comparing texts');
diff = diff.replace(/processtextdiff\(\)/g, 'compareTexts()');
diff = diff.replace(/<div class="input-group">[\s\S]*?<\/div>/g, `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                    <label style="color: #888; display: block; margin-bottom: 10px;">Text 1:</label>
                    <textarea id="text1Input" style="width: 100%; min-height: 200px; padding: 15px; background: #0a0a0a; border: 2px solid rgba(255, 0, 0, 0.3); border-radius: 12px; color: #ffffff; font-family: monospace; font-size: 0.9rem;" placeholder="First text..."></textarea>
                </div>
                <div>
                    <label style="color: #888; display: block; margin-bottom: 10px;">Text 2:</label>
                    <textarea id="text2Input" style="width: 100%; min-height: 200px; padding: 15px; background: #0a0a0a; border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; color: #ffffff; font-family: monospace; font-size: 0.9rem;" placeholder="Second text..."></textarea>
                </div>
            </div>
            <div style="text-align: center;">
                <button class="check-btn" onclick="compareTexts()">
                    <i class="fas fa-code"></i> Compare Texts
                </button>
            </div>`);
diff = diff.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const text1 = document.getElementById('text1Input').value;
            const text2 = document.getElementById('text2Input').value;
            if (!text1 || !text2) {
                alert('Please enter both texts');
                return;
            }`);
diff = diff.replace(/fetch\(`\/api\/tools\/text-diff\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `fetch('/api/tools/text-diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text1, text2 })
            })`);
diff = diff.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `if (data.success) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> Comparison Results
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Total Lines:</span>
                                <span class="cert-value">\${data.stats.totalLines}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Equal:</span>
                                <span class="cert-value" style="color: #00ff88;">\${data.stats.equal}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Added:</span>
                                <span class="cert-value" style="color: #00ff88;">\${data.stats.added}</span>
                            </div>
                            <div class="cert-item">
                                <span class="cert-label">Removed:</span>
                                <span class="cert-value" style="color: #ff0000;">\${data.stats.removed}</span>
                            </div>
                            <div style="margin-top: 30px;">
                                <div class="cert-label" style="margin-bottom: 15px;">Differences:</div>
                                \${data.diff.map(d => {
                                    const color = d.type === 'equal' ? '#888' : d.type === 'added' ? '#00ff88' : '#ff0000';
                                    const icon = d.type === 'equal' ? '=' : d.type === 'added' ? '+' : '-';
                                    return \`<div style="padding: 8px; margin: 5px 0; background: rgba(0, 0, 0, 0.3); border-left: 3px solid \${color}; font-family: monospace; font-size: 0.9rem;">
                                        <span style="color: \${color}; margin-right: 10px;">\${icon}</span>
                                        <span style="color: #ffffff;">\${d.line}</span>
                                    </div>\`;
                                }).join('')}
                            </div>
                        </div>
                    \`;`);
diff = diff.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, '');
fs.writeFileSync(diffPath, diff);
console.log('✅ Fixed Text Diff');

// Regex Tester
const regexPath = path.join(toolsDir, 'regex-tester.html');
let regex = fs.readFileSync(regexPath, 'utf8');
regex = regex.replace(/Verify Test and debug regular expressions/g, 'Test and debug regular expressions');
regex = regex.replace(/Check Certificate/g, 'Test Regex');
regex = regex.replace(/Checking SSL certificate/g, 'Testing regex');
regex = regex.replace(/processregextester\(\)/g, 'testRegex()');
regex = regex.replace(/<div class="input-group">[\s\S]*?<\/div>/g, `<div style="margin-bottom: 20px;">
                <label style="color: #888; display: block; margin-bottom: 10px;">Regular Expression:</label>
                <input type="text" id="patternInput" style="width: 100%; padding: 15px; background: #0a0a0a; border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; color: #ffffff; font-family: monospace; font-size: 1rem;" placeholder="/pattern/flags or just pattern">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="color: #888; margin-right: 10px;">Flags:</label>
                <label style="color: #888; margin-right: 15px;"><input type="checkbox" id="flagG" checked style="margin-right: 5px;">g (global)</label>
                <label style="color: #888; margin-right: 15px;"><input type="checkbox" id="flagI" style="margin-right: 5px;">i (ignore case)</label>
                <label style="color: #888; margin-right: 15px;"><input type="checkbox" id="flagM" style="margin-right: 5px;">m (multiline)</label>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="color: #888; display: block; margin-bottom: 10px;">Test Text:</label>
                <textarea id="testInput" style="width: 100%; min-height: 150px; padding: 15px; background: #0a0a0a; border: 2px solid rgba(0, 255, 136, 0.3); border-radius: 12px; color: #ffffff; font-family: monospace; font-size: 0.95rem;" placeholder="Enter text to test against the regex pattern..."></textarea>
            </div>
            <div style="text-align: center;">
                <button class="check-btn" onclick="testRegex()">
                    <i class="fas fa-search"></i> Test Regex
                </button>
            </div>`);
regex = regex.replace(/const domain = document\.getElementById\('domainInput'\)\.value\.trim\(\);/g, `const pattern = document.getElementById('patternInput').value.trim();
            const testText = document.getElementById('testInput').value;
            let flags = '';
            if (document.getElementById('flagG').checked) flags += 'g';
            if (document.getElementById('flagI').checked) flags += 'i';
            if (document.getElementById('flagM').checked) flags += 'm';
            if (!pattern) {
                alert('Please enter a regex pattern');
                return;
            }`);
regex = regex.replace(/fetch\(`\/api\/tools\/regex-tester\?domain=\$\{encodeURIComponent\(domain\)\}`\)/g, `fetch('/api/tools/regex', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pattern, text: testText, flags })
            })`);
regex = regex.replace(/if \(data\.success\) \{[\s\S]*?const cert = data\.certificate;/g, `if (data.success && data.isValid) {
                    results.innerHTML = \`
                        <div class="cert-card valid">
                            <div class="status-badge status-valid">
                                <i class="fas fa-check-circle"></i> Valid Regex - \${data.matchCount} match\${data.matchCount !== 1 ? 'es' : ''} found
                            </div>
                            \${data.matches.length > 0 ? \`
                                <div style="margin-top: 20px;">
                                    <div class="cert-label" style="margin-bottom: 10px;">Matches:</div>
                                    \${data.matches.map((match, index) => \`
                                        <div style="padding: 12px; margin: 8px 0; background: rgba(0, 255, 136, 0.1); border-radius: 8px; border-left: 3px solid #00ff88;">
                                            <div style="color: #00ff88; font-weight: 600; margin-bottom: 5px;">Match \${index + 1} (position \${match.index}):</div>
                                            <div style="font-family: monospace; color: #ffffff; background: rgba(0, 0, 0, 0.3); padding: 8px; border-radius: 5px;">\${match.match}</div>
                                        </div>
                                    \`).join('')}
                                </div>
                            \` : '<div style="text-align: center; color: #888; margin-top: 20px; padding: 20px;">No matches found</div>'}
                        </div>
                    \`;
                } else {
                    results.innerHTML = \`<div class="cert-card expired">
                        <div class="status-badge status-expired">
                            <i class="fas fa-times-circle"></i> Invalid Regex
                        </div>
                        <div style="color: #ff0000; margin-top: 15px;">\${data.error || 'Invalid regex pattern'}</div>
                    </div>\`;
                }`);
regex = regex.replace(/document\.getElementById\('domainInput'\)\.addEventListener/g, '');
fs.writeFileSync(regexPath, regex);
console.log('✅ Fixed Regex Tester');

console.log('\n✅ All tool pages fixed!');






