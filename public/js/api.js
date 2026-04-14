// API JavaScript
class API {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }
    
    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Posts API
class PostsAPI extends API {
    constructor() {
        super('/api/posts');
    }
    
    async getAll(params = {}) {
        return this.get('', params);
    }
    
    async getById(id) {
        return this.get(`/${id}`);
    }
    
    async getBySlug(slug) {
        return this.get(`/slug/${slug}`);
    }
    
    async getFeatured(limit = 6) {
        return this.get('/featured', { limit });
    }
    
    async getTrending(limit = 10) {
        return this.get('/trending', { limit });
    }
    
    async getRelated(id, limit = 6) {
        return this.get(`/related/${id}`, { limit });
    }
    
    async create(data) {
        return this.post('', data);
    }
    
    async update(id, data) {
        return this.put(`/${id}`, data);
    }
    
    async delete(id) {
        return this.delete(`/${id}`);
    }
}

// Categories API
class CategoriesAPI extends API {
    constructor() {
        super('/api/categories');
    }
    
    async getAll() {
        return this.get('');
    }
    
    async getBySlug(slug) {
        return this.get(`/${slug}`);
    }
    
    async create(data) {
        return this.post('', data);
    }
    
    async update(id, data) {
        return this.put(`/${id}`, data);
    }
    
    async delete(id) {
        return this.delete(`/${id}`);
    }
}

// Auth API
class AuthAPI extends API {
    constructor() {
        super('/api/auth');
    }
    
    async login(email, password) {
        return this.post('/login', { email, password });
    }
    
    async register(userData) {
        return this.post('/register', userData);
    }
    
    async logout() {
        return this.post('/logout');
    }
    
    async getCurrentUser() {
        return this.get('/me');
    }
}

// Upload API
class UploadAPI extends API {
    constructor() {
        super('/api/upload');
    }
    
    async uploadSingle(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${this.baseURL}/single`, {
            method: 'POST',
            body: formData
        });
        
        return response.json();
    }
    
    async uploadMultiple(files) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('images', file);
        });
        
        const response = await fetch(`${this.baseURL}/multiple`, {
            method: 'POST',
            body: formData
        });
        
        return response.json();
    }
}

// Search API
class SearchAPI extends API {
    constructor() {
        super('/api/search');
    }
    
    async search(query, params = {}) {
        return this.get('', { q: query, ...params });
    }
    
    async searchPosts(query, params = {}) {
        return this.get('/posts', { q: query, ...params });
    }
    
    async searchCategories(query, params = {}) {
        return this.get('/categories', { q: query, ...params });
    }
}

// Cache manager
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    }
    
    set(key, value, ttl = this.defaultTTL) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { value, expiry });
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }
    
    clear() {
        this.cache.clear();
    }
    
    delete(key) {
        this.cache.delete(key);
    }
}

// Global API instances
window.api = {
    posts: new PostsAPI(),
    categories: new CategoriesAPI(),
    auth: new AuthAPI(),
    upload: new UploadAPI(),
    search: new SearchAPI(),
    cache: new CacheManager()
};

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Error handling
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.notification) {
        window.notification.error('An unexpected error occurred');
    }
});

// Loading states
function showLoading(element) {
    if (element) {
        element.classList.add('loading');
        element.innerHTML = '<div class="spinner"></div>';
    }
}

function hideLoading(element) {
    if (element) {
        element.classList.remove('loading');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API,
        PostsAPI,
        CategoriesAPI,
        AuthAPI,
        UploadAPI,
        SearchAPI,
        CacheManager,
        debounce,
        throttle
    };
}