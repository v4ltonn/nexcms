// GDPR Cookie Consent with Google Consent Mode v2 Compliance
(function() {
    'use strict';
    
    // Cookie management
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    function setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        // Use protocol-relative cookie settings (works with both HTTP and HTTPS)
        const isSecure = window.location.protocol === 'https:';
        const secureFlag = isSecure ? ';Secure' : '';
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict${secureFlag}`;
    }
    
    // Google Consent Mode v2 Update Function
    function updateConsentState(analytics, adPersonalization, adUserData, functionality, personalization) {
        window.dataLayer = window.dataLayer || [];
        
        window.dataLayer.push({
            'event': 'consent_update',
            'consent': {
                'analytics_storage': analytics ? 'granted' : 'denied',
                'ad_storage': (adPersonalization || adUserData) ? 'granted' : 'denied',
                'ad_personalization': adPersonalization ? 'granted' : 'denied',
                'ad_user_data': adUserData ? 'granted' : 'denied',
                'functionality_storage': functionality ? 'granted' : 'denied',
                'personalization_storage': personalization ? 'granted' : 'denied'
            }
        });
        
        // Also set cookie for persistence
        const consentData = {
            analytics: analytics,
            adPersonalization: adPersonalization,
            adUserData: adUserData,
            functionality: functionality,
            personalization: personalization,
            timestamp: new Date().toISOString()
        };
        setCookie('cookieConsentData', JSON.stringify(consentData), 365);
    }
    
    // Check and apply saved consent state
    function checkCookieConsent() {
        const consentData = getCookie('cookieConsentData');
        
        if (!consentData) {
            // No consent given - show banner
            document.getElementById('cookieConsent').classList.add('active');
            // Set default state to 'denied' for all non-essential purposes
            updateConsentState(false, false, false, true, false);
        } else {
            // Apply saved consent
            try {
                const data = JSON.parse(consentData);
                updateConsentState(
                    data.analytics,
                    data.adPersonalization,
                    data.adUserData,
                    data.functionality,
                    data.personalization
                );
            } catch (e) {
                console.error('Error parsing consent data:', e);
            }
        }
    }
    
    // Accept all cookies
    window.acceptCookies = function() {
        document.getElementById('cookieConsent').classList.remove('active');
        
        // Grant all consent
        updateConsentState(true, true, true, true, true);
        
        // Track consent acceptance
        if (typeof gtag !== 'undefined') {
            gtag('event', 'cookie_consent', {
                event_category: 'Consent',
                event_label: 'Accepted All',
                value: 1
            });
        }
        
        // Save simple consent flag
        setCookie('cookieConsent', 'accepted', 365);
    };
    
    // Reject non-essential cookies
    window.rejectCookies = function() {
        document.getElementById('cookieConsent').classList.remove('active');
        
        // Deny all except essential
        updateConsentState(false, false, false, true, false);
        
        // Track consent rejection
        if (typeof gtag !== 'undefined') {
            gtag('event', 'cookie_consent', {
                event_category: 'Consent',
                event_label: 'Rejected All',
                value: 0
            });
        }
        
        // Save simple consent flag
        setCookie('cookieConsent', 'rejected', 365);
    };
    
    // Open settings
    window.openCookieSettings = function() {
        alert('Cookie Settings\n\nThis website uses cookies to:\n\n✓ Essential cookies (required for site functionality)\n• Analytics cookies (Google Analytics - website usage statistics)\n• Advertising cookies (for personalized ads if applicable)\n• Functional cookies (for enhanced features)\n• Personalization cookies (for custom user experience)\n\nManage your preferences by accepting or rejecting cookies.\n\nFor more information, see our Privacy Policy.');
    };
    
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        checkCookieConsent();
    });
})();

