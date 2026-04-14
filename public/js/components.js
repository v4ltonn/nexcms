// Components JavaScript
class Component {
    constructor(element) {
        this.element = element;
        this.init();
    }
    
    init() {
        // Override in subclasses
    }
}

// Modal Component
class Modal extends Component {
    init() {
        this.overlay = this.element.querySelector('.modal-overlay');
        this.closeBtn = this.element.querySelector('.modal-close');
        this.content = this.element.querySelector('.modal-content');
        
        this.bindEvents();
    }
    
    bindEvents() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }
    
    open() {
        this.element.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.element.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    isOpen() {
        return this.element.classList.contains('active');
    }
}

// Dropdown Component
class Dropdown extends Component {
    init() {
        this.toggle = this.element.querySelector('.dropdown-toggle');
        this.menu = this.element.querySelector('.dropdown-menu');
        this.isOpen = false;
        
        this.bindEvents();
    }
    
    bindEvents() {
        if (this.toggle) {
            this.toggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleDropdown();
            });
        }
        
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target) && this.isOpen) {
                this.closeDropdown();
            }
        });
    }
    
    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    openDropdown() {
        this.menu.classList.add('active');
        this.toggle.classList.add('active');
        this.isOpen = true;
    }
    
    closeDropdown() {
        this.menu.classList.remove('active');
        this.toggle.classList.remove('active');
        this.isOpen = false;
    }
}

// Tabs Component
class Tabs extends Component {
    init() {
        this.tabs = this.element.querySelectorAll('.tab');
        this.panels = this.element.querySelectorAll('.tab-panel');
        this.activeTab = 0;
        
        this.bindEvents();
        this.showTab(0);
    }
    
    bindEvents() {
        this.tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => this.showTab(index));
        });
    }
    
    showTab(index) {
        // Remove active class from all tabs and panels
        this.tabs.forEach(tab => tab.classList.remove('active'));
        this.panels.forEach(panel => panel.classList.remove('active'));
        
        // Add active class to selected tab and panel
        this.tabs[index].classList.add('active');
        this.panels[index].classList.add('active');
        
        this.activeTab = index;
    }
}

// Accordion Component
class Accordion extends Component {
    init() {
        this.items = this.element.querySelectorAll('.accordion-item');
        this.bindEvents();
    }
    
    bindEvents() {
        this.items.forEach(item => {
            const header = item.querySelector('.accordion-header');
            if (header) {
                header.addEventListener('click', () => this.toggleItem(item));
            }
        });
    }
    
    toggleItem(item) {
        const isActive = item.classList.contains('active');
        
        // Close all items
        this.items.forEach(i => i.classList.remove('active'));
        
        // Open clicked item if it wasn't active
        if (!isActive) {
            item.classList.add('active');
        }
    }
}

// Form Component
class Form extends Component {
    init() {
        this.form = this.element;
        this.inputs = this.form.querySelectorAll('input, textarea, select');
        this.submitBtn = this.form.querySelector('button[type="submit"]');
        
        this.bindEvents();
    }
    
    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        this.inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }
    
    handleSubmit(e) {
        e.preventDefault();
        
        if (this.validateForm()) {
            this.submitForm();
        }
    }
    
    validateForm() {
        let isValid = true;
        
        this.inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    validateField(field) {
        const value = field.value.trim();
        const type = field.type;
        const required = field.hasAttribute('required');
        
        this.clearFieldError(field);
        
        if (required && !value) {
            this.showFieldError(field, 'This field is required');
            return false;
        }
        
        if (value && type === 'email' && !this.isValidEmail(value)) {
            this.showFieldError(field, 'Please enter a valid email address');
            return false;
        }
        
        if (value && type === 'password' && value.length < 6) {
            this.showFieldError(field, 'Password must be at least 6 characters');
            return false;
        }
        
        return true;
    }
    
    showFieldError(field, message) {
        field.classList.add('error');
        
        let errorElement = field.parentNode.querySelector('.field-error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'field-error';
            field.parentNode.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
    }
    
    clearFieldError(field) {
        field.classList.remove('error');
        const errorElement = field.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    async submitForm() {
        if (this.submitBtn) {
            this.submitBtn.disabled = true;
            this.submitBtn.textContent = 'Submitting...';
        }
        
        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData);
            
            const response = await fetch(this.form.action || window.location.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showSuccess(result.message || 'Form submitted successfully');
                this.form.reset();
            } else {
                this.showError(result.message || 'An error occurred');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            this.showError('An error occurred while submitting the form');
        } finally {
            if (this.submitBtn) {
                this.submitBtn.disabled = false;
                this.submitBtn.textContent = 'Submit';
            }
        }
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `form-message ${type}`;
        messageElement.textContent = message;
        
        this.form.insertBefore(messageElement, this.form.firstChild);
        
        setTimeout(() => {
            messageElement.remove();
        }, 5000);
    }
}

// Notification Component
class Notification {
    constructor() {
        this.container = this.createContainer();
    }
    
    createContainer() {
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        
        this.container.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => this.remove(notification), duration);
        
        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            this.remove(notification);
        });
    }
    
    remove(notification) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }
    
    success(message, duration) {
        this.show(message, 'success', duration);
    }
    
    error(message, duration) {
        this.show(message, 'error', duration);
    }
    
    warning(message, duration) {
        this.show(message, 'warning', duration);
    }
    
    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// Initialize components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    document.querySelectorAll('.modal').forEach(modal => {
        new Modal(modal);
    });
    
    // Initialize dropdowns
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        new Dropdown(dropdown);
    });
    
    // Initialize tabs
    document.querySelectorAll('.tabs').forEach(tabs => {
        new Tabs(tabs);
    });
    
    // Initialize accordions
    document.querySelectorAll('.accordion').forEach(accordion => {
        new Accordion(accordion);
    });
    
    // Initialize forms
    document.querySelectorAll('form').forEach(form => {
        new Form(form);
    });
});

// Global notification instance
window.notification = new Notification();