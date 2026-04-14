// WordPress-style Admin Bar
(function() {
    'use strict';
    
    // Check if user is admin
    function isAdmin() {
        const token = localStorage.getItem('adminToken');
        const user = localStorage.getItem('adminUser');
        if (!token || !user) return false;
        
        try {
            const userData = JSON.parse(user);
            return userData.role === 'admin' || userData.role === 'editor';
        } catch (e) {
            return false;
        }
    }
    
    // Get current post ID from URL or window object
    function getCurrentPostId() {
        // Check if post data is available
        if (window.currentPost && window.currentPost._id) {
            return window.currentPost._id;
        }
        
        // Try to extract from URL
        const path = window.location.pathname;
        const slugMatch = path.match(/\/posts\/([^\/]+)/);
        if (slugMatch) {
            return slugMatch[1];
        }
        
        return null;
    }
    
    // Create admin bar
    function createAdminBar() {
        if (!isAdmin()) return;
        
        const adminBar = document.createElement('div');
        adminBar.id = 'wp-admin-bar';
        adminBar.innerHTML = `
            <div class="admin-bar-container">
                <div class="admin-bar-left">
                    <a href="/" class="admin-bar-logo">
                        <i class="fas fa-shield-alt"></i>
                        <span>NexCMS</span>
                    </a>
                    <a href="/admin/dashboard" class="admin-bar-link">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </a>
                    ${getCurrentPostId() ? `
                        <a href="/admin/dashboard?page=posts&edit=${getCurrentPostId()}" class="admin-bar-link admin-bar-edit">
                            <i class="fas fa-edit"></i> Edit Post
                        </a>
                    ` : ''}
                    <a href="/admin/dashboard?page=posts&action=new" class="admin-bar-link">
                        <i class="fas fa-plus"></i> New Post
                    </a>
                </div>
                <div class="admin-bar-right">
                    <span class="admin-bar-user">
                        <i class="fas fa-user-circle"></i>
                        ${JSON.parse(localStorage.getItem('adminUser') || '{}').username || 'Admin'}
                    </span>
                    <a href="#" class="admin-bar-link" onclick="adminBarLogout(); return false;">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </a>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #wp-admin-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #23282d;
                color: #fff;
                font-size: 13px;
                line-height: 32px;
                height: 32px;
                z-index: 999999;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            }
            
            .admin-bar-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                max-width: 100%;
                padding: 0 10px;
            }
            
            .admin-bar-left,
            .admin-bar-right {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .admin-bar-logo {
                color: #fff;
                text-decoration: none;
                font-weight: 600;
                padding: 0 10px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .admin-bar-logo:hover {
                background: rgba(255,255,255,0.1);
            }
            
            .admin-bar-logo i {
                color: #00ff88;
            }
            
            .admin-bar-link {
                color: #b4b9be;
                text-decoration: none;
                padding: 0 10px;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s;
                border-radius: 2px;
            }
            
            .admin-bar-link:hover {
                color: #00ff88;
                background: rgba(255,255,255,0.1);
            }
            
            .admin-bar-link.admin-bar-edit {
                color: #00ff88;
                font-weight: 500;
            }
            
            .admin-bar-user {
                color: #b4b9be;
                padding: 0 10px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .admin-bar-user i {
                color: #00ff88;
            }
            
            /* Add padding to body when admin bar is visible */
            body.admin-bar-visible {
                padding-top: 32px;
            }
            
            /* Mobile responsive */
            @media (max-width: 768px) {
                #wp-admin-bar {
                    height: auto;
                    min-height: 32px;
                }
                
                .admin-bar-container {
                    flex-wrap: wrap;
                    padding: 5px;
                }
                
                .admin-bar-left,
                .admin-bar-right {
                    flex-wrap: wrap;
                }
                
                .admin-bar-link {
                    font-size: 12px;
                    padding: 2px 8px;
                }
                
                body.admin-bar-visible {
                    padding-top: 60px;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.insertBefore(adminBar, document.body.firstChild);
        document.body.classList.add('admin-bar-visible');
    }
    
    // Logout function
    window.adminBarLogout = function() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.reload();
        }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createAdminBar);
    } else {
        createAdminBar();
    }
})();

