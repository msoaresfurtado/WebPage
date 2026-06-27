/* Dark-mode support for the site.
   Loaded in <head> so the saved theme is applied before the page paints
   (no flash). The toggle button lives in header.html (injected later), so
   we also watch for it and keep its icon in sync. */

// Apply the saved theme immediately (runs as the script loads).
(function () {
    try {
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    } catch (e) { /* localStorage unavailable; default to light */ }
})();

// Toggle between light and dark, remembering the choice.
function toggleTheme() {
    var root = document.documentElement;
    var isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
        root.removeAttribute('data-theme');
        try { localStorage.setItem('theme', 'light'); } catch (e) {}
    } else {
        root.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    }
    updateThemeIcon();
}

// Show a moon in light mode (click to go dark) and a sun in dark mode.
function updateThemeIcon() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀︎' : '☾';
    btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

// The header (with the button) is injected asynchronously via fetch(),
// so update the icon as soon as it appears.
document.addEventListener('DOMContentLoaded', function () {
    updateThemeIcon();
    var hc = document.getElementById('header-container');
    if (hc && window.MutationObserver) {
        new MutationObserver(updateThemeIcon).observe(hc, { childList: true, subtree: true });
    }
});
