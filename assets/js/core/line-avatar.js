// Shared LINE profile picture guard: fallback avatar + broken-URL cache.
// Expired sprofile.line-scdn.net links return 404; remember them so later page loads skip the request.
(function () {
    if (window.GA_LINE_AVATAR) return;
    var KEY = 'ga_broken_line_pics';
    var MAX = 400;
    var FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e5e7eb"/>' +
        '<circle cx="32" cy="24" r="11" fill="#9ca3af"/><path d="M10 58c2-13 11-20 22-20s20 7 22 20z" fill="#9ca3af"/></svg>');
    var broken = [];
    try { broken = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(broken)) broken = []; } catch (e) { broken = []; }
    var set = {};
    broken.forEach(function (u) { set[u] = 1; });

    function isLinePic(url) { return typeof url === 'string' && /^https?:\/\/[^/]*line-scdn\.net\//i.test(url); }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(broken.slice(-MAX))); } catch (e) { /* storage unavailable */ } }
    function remember(url) {
        if (!url || set[url]) return;
        set[url] = 1; broken.push(url);
        if (broken.length > MAX) { delete set[broken.shift()]; }
        save();
    }
    // Use before rendering: returns fallback directly for URLs already known broken (no request sent).
    function safe(url) { return !url || (isLinePic(url) && set[url]) ? FALLBACK : url; }
    function apply(img) {
        if (!img || img.tagName !== 'IMG') return;
        var src = img.getAttribute('src') || '';
        if (src === FALLBACK) return;
        if (isLinePic(src) && set[src]) { img.setAttribute('src', FALLBACK); img.dataset.gaFallback = '1'; }
    }
    function fail(img) {
        var src = img.getAttribute('src') || '';
        if (src === FALLBACK) return;
        if (isLinePic(src)) remember(src);
        img.removeAttribute('srcset');
        img.dataset.gaFallback = '1';
        img.setAttribute('src', FALLBACK);
    }

    // 404 on a LINE picture: swap to local avatar. 'error' does not bubble, so use capture on the document.
    document.addEventListener('error', function (event) {
        var img = event.target;
        if (img && img.tagName === 'IMG' && (isLinePic(img.getAttribute('src') || '') || img.dataset.gaFallback)) fail(img);
    }, true);

    // Rewrite known-broken URLs as soon as images are inserted (covers every page that renders profile pictures).
    new MutationObserver(function (records) {
        records.forEach(function (record) {
            if (record.type === 'attributes') return apply(record.target);
            record.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return;
                if (node.tagName === 'IMG') apply(node);
                else if (node.querySelectorAll) node.querySelectorAll('img').forEach(apply);
            });
        });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    window.GA_LINE_AVATAR = { safe: safe, fallback: FALLBACK, remember: remember };
})();
