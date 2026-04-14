/**
 * NexCMS dark/light theme – default dark, no system auto-switch. User choice stored in localStorage.
 * Call setNexCMSTheme('light'|'dark') to switch.
 */
(function() {
    'use strict';
    var STORAGE_KEY = 'nexcms-theme';
    var meta = document.querySelector('meta[name=theme-color]');

    function applyTheme(useLight) {
        document.documentElement.classList.toggle('theme-light', !!useLight);
        if (meta) meta.setAttribute('content', useLight ? '#f8f8f8' : '#0a0a0a');
    }

    function getPreferredTheme() {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored === 'light';
        return false; /* default dark – no system preference */
    }

    applyTheme(getPreferredTheme());

    window.setNexCMSTheme = function(mode) {
        if (mode === 'light' || mode === 'dark') localStorage.setItem(STORAGE_KEY, mode);
        else localStorage.removeItem(STORAGE_KEY);
        var useLight = mode === 'light';
        applyTheme(useLight);
        if (typeof window.updateThemeToggle === 'function') window.updateThemeToggle();
    };
})();
