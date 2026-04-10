/**
 * Converts raw post content containing CODE_BLOCK: and COMMAND_BLOCK: markers
 * into proper HTML with .code-block-wrapper and .command-block-wrapper.
 * Used at runtime by server + API and by fix-new-posts-rendering.js.
 */

function cleanBlockCode(code) {
  if (!code || typeof code !== 'string') return code;
  return code.split('\n').map(line => line.replace(/\s*COMMAND_BLOCK:\s*$/i, '').replace(/\s*CODE_BLOCK:\s*$/i, '').trimEnd()).join('\n').trim();
}

/** If code is one long line (e.g. newlines lost in DB), insert line breaks so it displays readably */
function ensureCodeLineBreaks(code) {
  if (!code || typeof code !== 'string') return code;
  const lines = code.split('\n');
  if (lines.length > 5) return code; // already multi-line
  let out = code
    .replace(/\s*↓\s*/g, '\n↓ ')
    .replace(/\s+\[processes\./g, '\n[processes.')
    .replace(/\s+(-\s+[A-Z])/g, '\n$1')
    // Config-style: put each "key: value" on its own line (max_restarts:, endpoint:, command:, etc.)
    .replace(/\s+(max_restarts|restart_delay|endpoint|interval|command|processes|script|instances|restart_on_exit|health_check)\s*([:=])/gi, '\n$1$2')
    .replace(/\s+\[([a-zA-Z_][a-zA-Z0-9_.]*)\]/g, '\n[$1]') // [processes.api] on new line
    // Double space often separates config pairs when newlines were lost
    .replace(/\s{2,}(?=[a-zA-Z_][a-zA-Z0-9_]*\s*[:=])/g, '\n');
  return out.trim();
}

function stripStrayCssLines(code) {
  if (!code || typeof code !== 'string') return code;
  const cssLike = /^\s*((-weight|font-weight|font-size|line-height|letter-spacing|margin|padding):\s*[\d.]+\s*;?)\s*$/i;
  return code.split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      if (cssLike.test(t)) return false;
      if (/^-weight:\s*\d+\s*;?\s*$/i.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasCodeBlockMarkers(text) {
  return typeof text === 'string' && /CODE_BLOCK:|COMMAND_BLOCK:/.test(text);
}

/**
 * @param {string} cleanedContent - Raw content (with Enter/Exit fullscreen already stripped)
 * @returns {string} HTML with .linux-install-article wrapper and code/command blocks
 */
function contentWithCodeBlocksToHtml(cleanedContent) {
  if (!cleanedContent || typeof cleanedContent !== 'string') return '<div class="linux-install-article"></div>';
  let contentHtml = `<div class="linux-install-article">`;
  const lines = cleanedContent.split(/\n/);
  const paragraphs = [];
  let currentPara = '';
  let i = 0;
  const isBlockStart = (s) => s.startsWith('COMMAND_BLOCK:') || s.startsWith('CODE_BLOCK:');
  const isBlockOrHeading = (s) => {
    const t = s.trim();
    return t === '' || t.startsWith('## ') || t.startsWith('### ') || isBlockStart(t);
  };
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (isBlockStart(trimmed)) {
      if (currentPara.trim()) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
      let block = trimmed;
      i++;
      while (i < lines.length && !isBlockOrHeading(lines[i].trim())) {
        block += '\n' + lines[i];
        i++;
      }
      paragraphs.push(block);
      continue;
    }
    const cmdIdx = trimmed.indexOf('COMMAND_BLOCK:');
    const codeIdx = trimmed.indexOf('CODE_BLOCK:');
    let midIdx = -1;
    if (cmdIdx >= 0 && (codeIdx < 0 || cmdIdx <= codeIdx)) midIdx = cmdIdx;
    if (codeIdx >= 0 && (cmdIdx < 0 || codeIdx < cmdIdx)) midIdx = codeIdx;
    if (midIdx >= 0) {
      if (currentPara.trim()) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
      const before = trimmed.substring(0, midIdx).trim();
      if (before.length > 0) paragraphs.push(before);
      let block = trimmed.substring(midIdx).trim();
      i++;
      while (i < lines.length && !isBlockOrHeading(lines[i].trim())) {
        block += '\n' + lines[i];
        i++;
      }
      paragraphs.push(block);
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      if (currentPara.trim()) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
      paragraphs.push(trimmed);
    } else if (trimmed.length === 0) {
      if (currentPara.trim()) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
    } else {
      currentPara += (currentPara ? '\n' : '') + line;
    }
    i++;
  }
  if (currentPara.trim()) paragraphs.push(currentPara.trim());

  const filteredParagraphs = paragraphs.filter(p => {
    const t = p.trim();
    return t.length > 0 &&
      !t.toLowerCase().includes('enter fullscreen') &&
      !t.toLowerCase().includes('exit fullscreen') &&
      !t.toLowerCase().includes('hide this comment');
  });

  filteredParagraphs.forEach(para => {
    let trimmed = para.trim();
    if (!trimmed.startsWith('COMMAND_BLOCK:') && !trimmed.startsWith('CODE_BLOCK:')) {
      const cmdIdx = trimmed.indexOf('COMMAND_BLOCK:');
      const codeIdx = trimmed.indexOf('CODE_BLOCK:');
      let splitAt = -1;
      if (cmdIdx >= 0 && (codeIdx < 0 || cmdIdx <= codeIdx)) splitAt = cmdIdx;
      if (codeIdx >= 0 && (cmdIdx < 0 || codeIdx < cmdIdx)) splitAt = codeIdx;
      if (splitAt >= 0) {
        const before = trimmed.substring(0, splitAt).trim();
        if (before.length > 0) {
          const escapedText = before.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          contentHtml += `<p style="font-size: 1.0625rem; line-height: 1.85; margin-bottom: 1.25em; color: #e8e8e8; font-weight: 400; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">${escapedText.replace(/\n/g, '<br>')}</p>`;
        }
        trimmed = trimmed.substring(splitAt).trim();
      }
    }

    if (trimmed.startsWith('COMMAND_BLOCK:')) {
      let code = trimmed.replace(/^COMMAND_BLOCK:\s*/, '').trim();
      code = cleanBlockCode(code);
      code = stripStrayCssLines(code);
      const codeForCopy = code.replace(/^[\$#>\s]+/, '').trim();
      const escapedCodeForButton = codeForCopy.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\$/g, '&#36;');
      contentHtml += `<div class="command-block-wrapper" style="margin: 20px 0; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05); background: #0d1117; border: 1px solid rgba(255, 255, 255, 0.08);">`;
      contentHtml += `<div class="command-block-header" style="background: linear-gradient(180deg, rgba(22, 33, 62, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%); backdrop-filter: blur(10px); padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">`;
      contentHtml += `<div style="display: flex; align-items: center; gap: 12px;">`;
      contentHtml += `<div style="display: flex; gap: 6px; align-items: center;">`;
      contentHtml += `<div style="width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); box-shadow: 0 0 12px rgba(0, 255, 136, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.2);"></div>`;
      contentHtml += `<div style="width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%); box-shadow: 0 0 12px rgba(255, 215, 0, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.2);"></div>`;
      contentHtml += `<div style="width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #ff6b6b 0%, #ff4444 100%); box-shadow: 0 0 12px rgba(255, 107, 107, 0.6), inset 0 0 8px rgba(255, 255, 255, 0.2);"></div>`;
      contentHtml += `</div>`;
      contentHtml += `<span style="color: #c9d1d9; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-left: 4px;">Command</span>`;
      contentHtml += `</div>`;
      contentHtml += `<button class="copy-command-btn" data-code="${escapedCodeForButton}" style="background: linear-gradient(135deg, #6a5acd 0%, #5a4abd 100%); color: #fff; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(106, 90, 205, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1); position: relative; overflow: hidden;">`;
      contentHtml += `<span style="position: relative; z-index: 1; display: flex; align-items: center; gap: 8px;">`;
      contentHtml += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      contentHtml += `<span class="copy-text">Copy</span>`;
      contentHtml += `</span>`;
      contentHtml += `</button>`;
      contentHtml += `</div>`;
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let highlightedCode = escapedCode;
      highlightedCode = highlightedCode.replace(/\b(sudo)\b/g, '<span style="color: #ff9800; font-weight: 600;">$1</span>');
      const commands = ['apt', 'yum', 'dnf', 'pacman', 'apk', 'systemctl', 'service', 'docker', 'kubectl', 'git', 'npm', 'pip', 'curl', 'wget', 'brew'];
      commands.forEach(cmd => {
        highlightedCode = highlightedCode.replace(new RegExp(`\\b(${cmd})\\b`, 'g'), '<span style="color: #00d4ff; font-weight: 500;">$1</span>');
      });
      const actionCommands = ['install', 'update', 'upgrade', 'remove', 'start', 'stop', 'restart', 'enable', 'disable', 'status'];
      actionCommands.forEach(cmd => {
        highlightedCode = highlightedCode.replace(new RegExp(`\\b(${cmd})\\b`, 'g'), '<span style="color: #00ff88; font-weight: 500;">$1</span>');
      });
      highlightedCode = highlightedCode.replace(/(-\w+|--[\w-]+)/g, '<span style="color: #9d4edd; font-weight: 500;">$1</span>');
      const promptMatch = code.match(/^([\$#>\s]+)/);
      const prompt = promptMatch ? promptMatch[1] : '$ ';
      contentHtml += `<div class="command-block-content" style="background: #0d1117; padding: 12px 14px; position: relative; overflow-x: auto; min-height: 50px;">`;
      contentHtml += `<pre style="margin: 0; padding: 0; background: transparent; border: none; overflow: visible;"><code style="font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', 'DejaVu Sans Mono', monospace; font-size: 13px; line-height: 1.5; color: #c9d1d9; white-space: pre; display: block; overflow-x: auto; font-weight: 400;">`;
      contentHtml += `<span style="color: #7d8590; user-select: none; font-weight: 500;">${prompt}</span>`;
      contentHtml += `<span style="color: #c9d1d9;">${highlightedCode.replace(/^[\$#>\s]+/, '')}</span>`;
      contentHtml += `</code></pre>`;
      contentHtml += `</div>`;
      contentHtml += `</div>`;
    } else if (trimmed.startsWith('CODE_BLOCK:')) {
      let code = trimmed.replace(/^CODE_BLOCK:\s*/, '').trim();
      code = cleanBlockCode(code);
      code = stripStrayCssLines(code);
      code = ensureCodeLineBreaks(code);
      const escapedCodeForCopy = code.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      contentHtml += `<div class="code-block-wrapper" style="margin: 20px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.1);">`;
      contentHtml += `<div class="code-block-header" style="background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%); padding: 10px 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">`;
      contentHtml += `<div style="display: flex; align-items: center; gap: 10px;">`;
      contentHtml += `<div style="width: 8px; height: 8px; border-radius: 50%; background: #9d4edd; box-shadow: 0 0 8px rgba(157, 77, 221, 0.5);"></div>`;
      contentHtml += `<span style="color: #b0b0b0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Code Block</span>`;
      contentHtml += `</div>`;
      contentHtml += `<button class="copy-code-btn" data-code="${escapedCodeForCopy}" style="background: linear-gradient(135deg, #9d4edd 0%, #8d3ecd 100%); color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s ease; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(157, 77, 221, 0.3);">`;
      contentHtml += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      contentHtml += `<span class="copy-text">Copy</span>`;
      contentHtml += `</button>`;
      contentHtml += `</div>`;
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      contentHtml += `<div class="code-block-content" style="background: #0d1117; padding: 12px 14px; position: relative; overflow-x: auto;">`;
      contentHtml += `<pre style="margin: 0; padding: 0; background: transparent; border: none; white-space: pre;"><code style="font-family: 'Courier New', 'Monaco', 'Menlo', 'Consolas', 'Liberation Mono', 'DejaVu Sans Mono', monospace; font-size: 13px; line-height: 1.5; color: #e6edf3; white-space: pre; display: block; overflow-x: auto;">${escapedCode}</code></pre>`;
      contentHtml += `</div>`;
      contentHtml += `</div>`;
    } else if (trimmed.startsWith('## ')) {
      const headingText = trimmed.replace(/^##\s+/, '').replace(/Enter fullscreen mode/gi, '').replace(/Exit fullscreen mode/gi, '').trim();
      if (headingText.length > 0) {
        const escapedHeading = headingText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        contentHtml += `<h2 style="margin: 1.5em 0 0.5em; font-size: 1.25rem; font-weight: 500; line-height: 1.35; color: #ffffff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">${escapedHeading}</h2>`;
      }
    } else if (trimmed.startsWith('### ')) {
      const headingText = trimmed.replace(/^###\s+/, '').replace(/Enter fullscreen mode/gi, '').replace(/Exit fullscreen mode/gi, '').trim();
      if (headingText.length > 0) {
        const escapedHeading = headingText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        contentHtml += `<h3 style="margin: 1.25em 0 0.4em; font-size: 1.125rem; font-weight: 500; color: #f0f0f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">${escapedHeading}</h3>`;
      }
    } else if (trimmed.length > 10) {
      if (trimmed.toLowerCase().includes('enter fullscreen') || trimmed.toLowerCase().includes('exit fullscreen') || trimmed.toLowerCase().includes('hide this comment')) return;
      const escapedText = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      contentHtml += `<p style="font-size: 1.0625rem; line-height: 1.85; margin-bottom: 1.25em; color: #e8e8e8; font-weight: 400; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">${escapedText.replace(/\n/g, '<br>')}</p>`;
    }
  });

  contentHtml += `</div>`;
  contentHtml += `<script>
    (function() {
      if (window.linuxCopyButtonsInitialized) return;
      window.linuxCopyButtonsInitialized = true;
      function initCopyButtons() {
        document.querySelectorAll('.copy-command-btn, .copy-code-btn').forEach(btn => {
          if (btn.dataset.initialized) return;
          btn.dataset.initialized = 'true';
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            let code = this.getAttribute('data-code').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#36;/g, '$');
            if (this.classList.contains('copy-command-btn')) {
              code = code.replace(/^[\$#>\s]+/, '');
            }
            const copyText = this.querySelector('.copy-text') || this;
            const originalText = copyText.textContent;
            navigator.clipboard.writeText(code).then(() => {
              copyText.textContent = 'Copied!';
              this.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)';
              this.style.transform = 'scale(0.98)';
              setTimeout(() => {
                copyText.textContent = originalText;
                if (this.classList.contains('copy-command-btn')) {
                  this.style.background = 'linear-gradient(135deg, #6a5acd 0%, #5a4abd 100%)';
                } else {
                  this.style.background = 'linear-gradient(135deg, #9d4edd 0%, #8d3ecd 100%)';
                }
                this.style.transform = 'scale(1)';
              }, 2000);
            });
          });
        });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCopyButtons);
      } else {
        initCopyButtons();
      }
    })();
  </script>`;
  return contentHtml;
}

module.exports = {
  contentWithCodeBlocksToHtml,
  hasCodeBlockMarkers,
  cleanBlockCode,
  stripStrayCssLines
};
