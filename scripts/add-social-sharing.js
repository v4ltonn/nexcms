/**
 * Add Social Sharing Buttons to Post Pages
 * This script adds social sharing functionality to increase viral traffic
 */

const fs = require('fs');
const path = require('path');

const postHtmlPath = path.join(__dirname, '../public/post.html');

// Social sharing buttons HTML
const socialSharingHTML = `
    <!-- Social Sharing Buttons -->
    <div class="social-share-container" style="margin: 30px 0; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <span style="color: #cccccc; font-weight: 600; margin-right: 10px;">Share:</span>
            <a href="#" onclick="shareOnTwitter(event)" class="social-share-btn" style="background: #1DA1F2; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(29,161,242,0.3)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                <i class="fab fa-twitter"></i> Twitter
            </a>
            <a href="#" onclick="shareOnFacebook(event)" class="social-share-btn" style="background: #1877F2; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(24,119,242,0.3)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                <i class="fab fa-facebook"></i> Facebook
            </a>
            <a href="#" onclick="shareOnLinkedIn(event)" class="social-share-btn" style="background: #0077B5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,119,181,0.3)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                <i class="fab fa-linkedin"></i> LinkedIn
            </a>
            <a href="#" onclick="shareOnReddit(event)" class="social-share-btn" style="background: #FF4500; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(255,69,0,0.3)'" onmouseout="this.style.transform=''; this.style.boxShadow=''">
                <i class="fab fa-reddit"></i> Reddit
            </a>
            <button onclick="copyToClipboard()" class="social-share-btn" style="background: rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                <i class="fas fa-link"></i> Copy Link
            </button>
        </div>
    </div>

    <script>
        function shareOnTwitter(e) {
            e.preventDefault();
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            window.open(\`https://twitter.com/intent/tweet?url=\${url}&text=\${title}\`, '_blank', 'width=550,height=420');
            trackShare('twitter');
        }
        
        function shareOnFacebook(e) {
            e.preventDefault();
            const url = encodeURIComponent(window.location.href);
            window.open(\`https://www.facebook.com/sharer/sharer.php?u=\${url}\`, '_blank', 'width=550,height=420');
            trackShare('facebook');
        }
        
        function shareOnLinkedIn(e) {
            e.preventDefault();
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            window.open(\`https://www.linkedin.com/sharing/share-offsite/?url=\${url}\`, '_blank', 'width=550,height=420');
            trackShare('linkedin');
        }
        
        function shareOnReddit(e) {
            e.preventDefault();
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            window.open(\`https://reddit.com/submit?url=\${url}&title=\${title}\`, '_blank', 'width=550,height=420');
            trackShare('reddit');
        }
        
        function copyToClipboard() {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                alert('Link copied to clipboard!');
                trackShare('copy');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Link copied to clipboard!');
                trackShare('copy');
            });
        }
        
        function trackShare(platform) {
            // Track with Google Analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'share', {
                    method: platform,
                    content_type: 'article',
                    item_id: window.location.pathname
                });
            }
            
            // Track with Umami (if available)
            if (typeof umami !== 'undefined') {
                umami.track('share', { platform: platform });
            }
            
            console.log('Shared on:', platform);
        }
    </script>
`;

console.log('Social sharing buttons HTML ready to add to post.html');
console.log('Add this HTML after the post content section');



