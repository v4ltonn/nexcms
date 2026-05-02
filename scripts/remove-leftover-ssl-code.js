#!/usr/bin/env node
/**
 * Remove leftover SSL checker code from all tools
 */

const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, '..', 'public');

const tools = [
    'hash-generator.html',
    'email-header-analyzer.html',
    'regex-tester.html',
    'ip-lookup.html',
    'dns-lookup.html',
    'text-diff.html'
];

tools.forEach(toolFile => {
    const toolPath = path.join(toolsDir, toolFile);
    if (!fs.existsSync(toolPath)) {
        console.log(`⚠️  ${toolFile} not found, skipping...`);
        return;
    }
    
    let content = fs.readFileSync(toolPath, 'utf8');
    const originalLength = content.length;
    
    // Remove leftover SSL checker code block
    const sslCodePattern = /let statusClass = 'valid';\s*let statusText = 'Valid';\s*let statusBadge = 'status-valid';\s*if \(cert\.isExpired\) \{[\s\S]*?\} else \{\s*results\.innerHTML = `<div style="text-align: center; color: #ff0000; padding: 40px;">[\s\S]*?Please wait \$\{Math\.ceil\(data\.retryAfter \/ 60\)\} minutes before trying again\.<\/p>` : ''\}\s*<\/div>`;\s*\}\s*\} catch \(error\) \{/;
    
    content = content.replace(sslCodePattern, '} catch (error) {');
    
    // Also remove any standalone leftover blocks
    content = content.replace(/let statusClass = 'valid';\s*let statusText = 'Valid';\s*let statusBadge = 'status-valid';\s*if \(cert\.isExpired\) \{[\s\S]*?cert\.algorithm[\s\S]*?<\/div>\s*`;\s*\}/g, '');
    
    // Remove references to cert and data.domain in results.innerHTML after the main success block
    content = content.replace(/\$\{cert\.isExpired\}/g, 'false');
    content = content.replace(/\$\{cert\.isExpiringSoon\}/g, 'false');
    content = content.replace(/\$\{cert\.issuer\}/g, 'N/A');
    content = content.replace(/\$\{cert\.subject\}/g, 'N/A');
    content = content.replace(/\$\{new Date\(cert\.validFrom\)\.toLocaleString\(\)\}/g, 'N/A');
    content = content.replace(/\$\{new Date\(cert\.validTo\)\.toLocaleString\(\)\}/g, 'N/A');
    content = content.replace(/\$\{cert\.daysUntilExpiry\}/g, '0');
    content = content.replace(/\$\{cert\.serialNumber\}/g, 'N/A');
    content = content.replace(/\$\{cert\.fingerprint\}/g, 'N/A');
    content = content.replace(/\$\{cert\.algorithm\}/g, 'N/A');
    content = content.replace(/\$\{data\.domain\}/g, 'N/A');
    
    // Remove duplicate error messages that reference certificates
    content = content.replace(/Error: \$\{data\.error \|\| 'Failed to check certificate'\}/g, 'Error: ${data.error || \'Operation failed\'}');
    content = content.replace(/\$\{data\.retryAfter \? `<p style="color: #888; margin-top: 10px;">Please wait \$\{Math\.ceil\(data\.retryAfter \/ 60\)\} minutes before trying again\.<\/p>` : ''\}/g, '');
    
    if (content.length !== originalLength) {
        fs.writeFileSync(toolPath, content);
        console.log(`✅ Fixed ${toolFile}`);
    } else {
        console.log(`✓ ${toolFile} - no changes needed`);
    }
});

console.log('\n✅ All leftover SSL code removed!');






