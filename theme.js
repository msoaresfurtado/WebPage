/* Dark-mode support for the site.
   No persistence: every visit starts in light mode and the visitor must
   click the toggle to switch to dark. Nothing is remembered between visits.
   The toggle button lives in header.html (injected later), so we watch for
   it and keep its icon in sync. */

// Toggle between light and dark for the current page view only.
function toggleTheme() {
    var root = document.documentElement;
    if (root.getAttribute('data-theme') === 'dark') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', 'dark');
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
