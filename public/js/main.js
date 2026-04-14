// Main JavaScript file
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Initialize all components
    initNavigation();
    initSearch();
    initTheme();
    initHero();
    initFilters();
}

// Search functionality
function initSearch() {
    const searchToggle = document.getElementById('search-toggle');
    const searchOverlay = document.getElementById('search-overlay');
    const searchClose = document.getElementById('search-close');
    const searchInput = document.getElementById('search-input');
    
    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            searchOverlay.classList.add('active');
            searchInput.focus();
        });
    }
    
    if (searchClose) {
        searchClose.addEventListener('click', () => {
            searchOverlay.classList.remove('active');
        });
    }
    
    // Close search on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
            searchOverlay.classList.remove('active');
        }
    });
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                performSearch(query);
            } else {
                clearSearchResults();
            }
        });
    }
}

// Theme toggle – use theme.js as single source of truth (html.theme-light, nexcms-theme). Just sync icon.
function initTheme() {
    if (typeof window.updateThemeToggle === 'function') window.updateThemeToggle();
}

// Hero section
function initHero() {
    const exploreBtn = document.getElementById('explore-btn');
    const subscribeBtn = document.getElementById('subscribe-btn');
    
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            document.getElementById('latest-news').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }
    
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            alert('Subscribe functionality coming soon!');
        });
    }
}

// Filters
function initFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Filter posts
            const category = btn.dataset.category;
            filterPosts(category);
        });
    });
}

// Load content
async function loadContent() {
    try {
        console.log('Loading content...');
        await Promise.all([
            loadFeaturedPosts(),
            loadCategories(),
            loadLatestPosts()
        ]);
        console.log('Content loaded successfully');
    } catch (error) {
        console.error('Error loading content:', error);
        // Show fallback content if API fails
        showFallbackContent();
    }
}

function showFallbackContent() {
    const featuredGrid = document.getElementById('featured-grid');
    const categoriesGrid = document.getElementById('categories-grid');
    const postsGrid = document.getElementById('posts-grid');
    
    if (featuredGrid) {
        featuredGrid.innerHTML = '<div class="loading">Loading featured posts...</div>';
    }
    if (categoriesGrid) {
        categoriesGrid.innerHTML = '<div class="loading">Loading categories...</div>';
    }
    if (postsGrid) {
        postsGrid.innerHTML = '<div class="loading">Loading latest posts...</div>';
    }
}

async function loadFeaturedPosts() {
    try {
        console.log('Loading featured posts...');
        const response = await fetch('/api/posts/featured?limit=6');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const posts = await response.json();
        console.log('Featured posts loaded:', posts.length);
        
        const featuredGrid = document.getElementById('featured-grid');
        if (featuredGrid && posts.length > 0) {
            featuredGrid.innerHTML = posts.map(post => createFeaturedPostHTML(post)).join('');
            console.log('Featured posts rendered');
        } else {
            console.log('Featured grid not found or no posts');
            if (featuredGrid) {
                featuredGrid.innerHTML = '<div class="no-content">No featured posts available</div>';
            }
        }
    } catch (error) {
        console.error('Error loading featured posts:', error);
        const featuredGrid = document.getElementById('featured-grid');
        if (featuredGrid) {
            featuredGrid.innerHTML = '<div class="error">Error loading featured posts</div>';
        }
    }
}

async function loadCategories() {
    try {
        console.log('Loading categories...');
        const response = await fetch('/api/categories');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const categories = await response.json();
        console.log('Categories loaded:', categories.length);
        
        const categoriesGrid = document.getElementById('categories-grid');
        if (categoriesGrid && categories.length > 0) {
            categoriesGrid.innerHTML = categories.map(category => createCategoryHTML(category)).join('');
            console.log('Categories rendered');
        } else {
            console.log('Categories grid not found or no categories');
            if (categoriesGrid) {
                categoriesGrid.innerHTML = '<div class="no-content">No categories available</div>';
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        const categoriesGrid = document.getElementById('categories-grid');
        if (categoriesGrid) {
            categoriesGrid.innerHTML = '<div class="error">Error loading categories</div>';
        }
    }
}

async function loadLatestPosts() {
    try {
        console.log('Loading latest posts...');
        const response = await fetch('/api/posts?limit=12');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const posts = data.posts || data; // Handle different response formats
        console.log('Latest posts loaded:', posts.length);
        
        const postsGrid = document.getElementById('posts-grid');
        if (postsGrid && posts.length > 0) {
            postsGrid.innerHTML = posts.map(post => createPostHTML(post)).join('');
            console.log('Latest posts rendered');
        } else {
            console.log('Posts grid not found or no posts');
            if (postsGrid) {
                postsGrid.innerHTML = '<div class="no-content">No posts available</div>';
            }
        }
    } catch (error) {
        console.error('Error loading latest posts:', error);
        const postsGrid = document.getElementById('posts-grid');
        if (postsGrid) {
            postsGrid.innerHTML = '<div class="error">Error loading latest posts</div>';
        }
    }
}

function getOptimizedImageUrl(url, width, height) {
    if (!url) {
        return `/images/placeholder.jpg`;
    }

    try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.hostname.includes('images.unsplash.com')) {
            parsed.searchParams.set('auto', 'format');
            parsed.searchParams.set('fit', 'crop');
            parsed.searchParams.set('w', String(width));
            parsed.searchParams.set('h', String(height));
            parsed.searchParams.set('q', '70');
            return parsed.toString();
        }
        return parsed.toString();
    } catch (error) {
        return url;
    }
}

// Post navigation functions
function openPost(postId) {
    console.log('Opening post:', postId);
    // First try to get the post slug, then redirect
    fetch(`/api/posts/${postId}`)
        .then(response => response.json())
        .then(post => {
            if (post.slug) {
                window.location.href = `/posts/${post.slug}`;
            } else {
                window.location.href = `/posts/${postId}`;
            }
        })
        .catch(() => {
            window.location.href = `/posts/${postId}`;
        });
}

function openCategory(categorySlug) {
    console.log('Opening category:', categorySlug);
    window.location.href = `/categories/${categorySlug}`;
}

// HTML generators
function createFeaturedPostHTML(post) {
    return `
        <div class="featured-post" onclick="openPost('${post._id}')" style="cursor: pointer;">
            <img src="${getOptimizedImageUrl(post.thumbnail?.url, 1200, 600)}"
                 alt="${post.thumbnail?.alt || post.title}"
                 class="featured-post-image" loading="lazy" decoding="async" width="1200" height="600">
            <div class="featured-post-content">
                <div class="featured-post-meta">
                    <span class="featured-post-category" style="background: ${post.category?.color || '#00ff88'}">${post.category?.name || 'Uncategorized'}</span>
                    <span>${formatDate(post.publishedAt)}</span>
                    <span>${post.views || 0} views</span>
                </div>
                <h3 class="featured-post-title">${post.title}</h3>
                <p class="featured-post-excerpt">${post.excerpt || 'No excerpt available.'}</p>
            </div>
        </div>
    `;
}

function createCategoryHTML(category) {
    return `
        <div class="category-card" onclick="openCategory('${category.slug}')" style="cursor: pointer;">
            <div class="category-icon" style="background: ${category.color}">
                <i class="${category.icon}"></i>
            </div>
            <h3 class="category-name">${category.name}</h3>
            <p class="category-description">${category.description}</p>
            <div class="category-count">${category.postCount || 0} posts</div>
        </div>
    `;
}

function createPostHTML(post) {
    return `
        <div class="post-card" data-category="${post.category?.slug || 'uncategorized'}" onclick="openPost('${post._id}')" style="cursor: pointer;">
            <img src="${getOptimizedImageUrl(post.thumbnail?.url, 400, 200)}"
                 alt="${post.thumbnail?.alt || post.title}"
                 class="post-image" loading="lazy" decoding="async" width="400" height="200">
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-category" style="background: ${post.category?.color || '#00ff88'}">${post.category?.name || 'Uncategorized'}</span>
                    <span>${formatDate(post.publishedAt)}</span>
                    <span>${post.views || 0} views</span>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-excerpt">${post.excerpt || 'No excerpt available.'}</p>
            </div>
        </div>
    `;
}

// Search functionality
async function performSearch(query) {
    try {
        const response = await fetch(`/api/posts?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        const posts = data.posts || data;
        
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            if (posts.length > 0) {
                resultsContainer.innerHTML = posts.map(post => `
                    <div class="search-result" onclick="openPost('${post._id}')">
                        <h4>${post.title}</h4>
                        <p>${post.excerpt}</p>
                        <span class="search-category">${post.category?.name || 'Uncategorized'}</span>
                    </div>
                `).join('');
            } else {
                resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
            }
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

function clearSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
}

// Filter posts by category
function filterPosts(category) {
    const postCards = document.querySelectorAll('.post-card');
    
    postCards.forEach(card => {
        if (category === 'all' || card.dataset.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    const now = new Date();
    
    // Calculate days difference based on actual calendar days, not hours
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowStart - dateStart) / (1000 * 60 * 60 * 24));
    
    // Same day
    if (diffDays === 0) {
        const hours = Math.floor((now - date) / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    }
    
    // Yesterday
    if (diffDays === 1) return 'Yesterday';
    
    // Days ago
    if (diffDays < 7) return `${diffDays} days ago`;
    
    // Weeks ago
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    // Months ago
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString();
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Loading animation
function showLoading(element) {
    element.innerHTML = '<div class="loading">Loading...</div>';
}

function hideLoading(element) {
    const loading = element.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}