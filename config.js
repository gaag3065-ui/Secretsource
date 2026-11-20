// ======================================================
// Secretsource - Frontend Environment Configuration
// ======================================================

// ตรวจสอบว่าหน้าเว็บกำลังทำงานอยู่ในเครื่อง Local หรือไม่
const IS_LOCAL =
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost';

// Backend สำหรับการพัฒนาในเครื่อง รองรับกำหนดพอร์ตเฉพาะการทดสอบบน localhost
const localApiPortParameter = new URLSearchParams(
    window.location.search
).get('apiPort');
const localApiPort = /^\d{4,5}$/.test(localApiPortParameter || '')
    ? localApiPortParameter
    : '43127';
const LOCAL_API_URL = `http://127.0.0.1:${localApiPort}`;



const PRODUCTION_API_URL = 'https://got-extent-movements-emotions.trycloudflare.com';



window.APP_CONFIG = {
    API_BASE_URL: IS_LOCAL ? LOCAL_API_URL : PRODUCTION_API_URL,
    ENVIRONMENT: IS_LOCAL ? 'development' : 'production'
};

console.log(
    `[APP CONFIG] Environment: ${window.APP_CONFIG.ENVIRONMENT}`
);



//ฟังก์ชันอ่าน CSRF Token
//window.getCsrfToken = function () {
//#region
window.getCsrfToken = function () {

    const storedToken =
    sessionStorage.getItem('csrfToken');

    if (storedToken) {
        return storedToken;
    }
    const cookieNames = [
        '__Host-ga_csrf',
        'ga_csrf'
    ];

    for (const name of cookieNames) {
        const prefix = `${name}=`;

        const cookie = document.cookie
            .split('; ')
            .find(item =>
                item.startsWith(prefix)
            );

        if (cookie) {
            return decodeURIComponent(
                cookie.slice(prefix.length)
            );
        }
    }

    return '';
};
//#endregion



window.authFetch = async function (url, options = {}) {
    const headers = new Headers(
        options.headers || {}
    );
    const method =
        String(options.method || 'GET').toUpperCase();
    const accessToken =
        sessionStorage.getItem('accessToken');

    if (accessToken) {
        headers.set(
            'Authorization',
            'Bearer ' + accessToken
        );
    }

    const unsafeMethods = new Set([
        'POST',
        'PUT',
        'PATCH',
        'DELETE'
    ]);

    if (unsafeMethods.has(method)) {
        // แท็บนี้ยังไม่มี CSRF Token (เช่น เปิดหน้าในแท็บใหม่) → ขอจาก /api/session ก่อน แทนที่จะส่งไม่ได้เลย
        if (!window.getCsrfToken()) {
            try {
                const sessionResponse = await fetch(
                    `${window.APP_CONFIG?.API_BASE_URL || ''}/api/session`,
                    { headers: accessToken ? { Authorization: 'Bearer ' + accessToken } : {}, credentials: 'include', cache: 'no-store' }
                );
                const sessionData = await sessionResponse.json();
                if (sessionData.csrfToken) sessionStorage.setItem('csrfToken', sessionData.csrfToken);
            } catch (error) {
                // ไม่สำเร็จก็แจ้งข้อความเดิมด้านล่าง
            }
        }

        const csrfToken =
            window.getCsrfToken();

        if (!csrfToken) {
            throw new Error(
                'ไม่พบ CSRF Token กรุณาเข้าสู่ระบบใหม่'
            );
        }

        headers.set(
            'X-CSRF-Token',
            csrfToken
        );
    }


    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });

    if (response.status === 401) {
        sessionStorage.clear();
        window.location.replace('index.html');

        throw new Error(
            'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
        );
    }

    return response;
};

// บัญชีผู้บริหาร = ไม่ใช่ ADMIN และมีสิทธิ์ "ดูแดชบอร์ดผู้บริหาร" อย่างเดียว → เข้าได้เฉพาะ exec-dashboard.html
window.isExecutiveOnly = function (permissions, role) {
    if (String(role || '').trim().toUpperCase() === 'ADMIN') return false;
    const granted = Object.entries(permissions || {}).filter(([, value]) => value === true).map(([key]) => key);
    return granted.length > 0 && granted.every(key => key === 'ViewExecutive');
};

// บัญชี HR = ไม่ใช่ ADMIN และมีเฉพาะสิทธิ์หน้า HR ที่พัก → เข้าได้เฉพาะ hr-housing.html
window.isHrOnly = function (permissions, role) {
    if (String(role || '').trim().toUpperCase() === 'ADMIN') return false;
    const granted = Object.entries(permissions || {}).filter(([, value]) => value === true).map(([key]) => key);
    return granted.length > 0 && granted.every(key => key === 'AccommodationHr' || key === 'AccommodationHrEdit');
};

window.requirePagePermission = async function (
    permissionKey
) {
    const response = await window.authFetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/session`,
        {
            method: 'GET',
            cache: 'no-store'
        }
    );

    const data = await response.json();

    const isAdmin =
        String(data.user?.role || '')
            .trim()
            .toUpperCase() === 'ADMIN';

    if (data.csrfToken) {
    sessionStorage.setItem(
        'csrfToken',
        data.csrfToken
    );
        }

    if (
        !response.ok ||
        !data.success ||
        (
            !isAdmin &&
            data.permissions?.[permissionKey] !== true
        )
    ) {
        if (response.ok && window.isExecutiveOnly(data.permissions, data.user?.role)) {
            window.location.replace('exec-dashboard.html');
            throw new Error('PERMISSION_DENIED');
        }
        if (response.ok && window.isHrOnly(data.permissions, data.user?.role)) {
            window.location.replace('hr-housing.html');
            throw new Error('PERMISSION_DENIED');
        }
        alert('บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.replace('portal.html');
        throw new Error('PERMISSION_DENIED');
    }

    window.USER_PERMISSIONS =
        data.permissions || {};

    window.CURRENT_SESSION_USER = data.user || {};
    window.isCurrentUserAdmin = isAdmin;

    return data;
};

//ฟังก์ชัน Logout กลาง
//window.performSecureLogout =
//#region
window.performSecureLogout =
    async function () {
        try {
            const headers = {
                'X-CSRF-Token':
                    window.getCsrfToken()
            };
            const accessToken =
                sessionStorage.getItem('accessToken');

            if (accessToken) {
                headers.Authorization =
                    'Bearer ' + accessToken;
            }

            await fetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/logout`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers
                }
            );
        } catch (error) {
            console.error(
                'Logout request error:',
                error
            );
        } finally {
            sessionStorage.clear();
            window.location.replace('index.html');
        }
    };
//#endregion


// ======================================================
// ตัวแสดง "กำลังโหลด…" กลาง — ทุกหน้าที่ใช้ config.js
//   ทุกครั้งที่ผู้ใช้กดปุ่ม/ส่งฟอร์ม แล้วมีคำขอไปหลังบ้านค้างอยู่ จะขึ้นหน้าต่าง "กำลังโหลด…" ทับหน้าและกันกดซ้ำ
//   อยู่จนกว่าคำขอทั้งหมดจะเสร็จจริง (ไม่มีเวลาตัด) แสดงเวลาที่รอมา · รีเฟรชเบื้องหลังอัตโนมัติ (ไม่ได้เกิดจากการกด) จะไม่ขึ้น
//   ใช้เองได้: GA_LOADING.run('ข้อความ', promise) · ไม่ต้องการให้ขึ้น: fetch(url, { gaSilent: true })
// ======================================================
(function () {
    if (window.GA_LOADING || typeof document === 'undefined') return;
    const API = String(window.APP_CONFIG?.API_BASE_URL || '');
    const SHOW_AFTER_MS = 120;        // เร็วกว่านี้ไม่ต้องขึ้น (กันกะพริบ)
    const MIN_SHOW_MS = 700;          // ขึ้นแล้วอยู่อย่างน้อยเท่านี้ ให้เห็นชัดทุกครั้ง
    const USER_WINDOW_MS = 1500;      // คำขอที่เริ่มภายในเวลานี้หลังผู้ใช้กด/พิมพ์ ถือว่ามาจากผู้ใช้
    let lastUser = 0, lastEnd = 0, pending = 0, shownAt = 0, startedAt = 0, showTimer = 0, hideTimer = 0, ticker = 0, label = '';
    let box = null, dismissed = false;

    // นับเฉพาะการกระทำจริง: คลิก/แตะ · Enter/Space · ส่งฟอร์ม · เปลี่ยนค่าช่องเลือก (พิมพ์ตัวอักษรเฉยๆ ไม่นับ)
    ['pointerdown', 'submit', 'change'].forEach(type => document.addEventListener(type, () => { lastUser = Date.now(); }, true));
    document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') lastUser = Date.now(); }, true);

    function build() {
        if (box) return box;
        box = document.createElement('dialog');
        box.id = 'gaLoading';
        box.setAttribute('role', 'alertdialog');
        box.setAttribute('aria-live', 'assertive');
        box.setAttribute('aria-label', 'กำลังโหลด');
        box.innerHTML = '<style>#gaLoading{border:0;padding:0;background:transparent;max-width:none;max-height:none;width:100vw;height:100vh;outline:0}#gaLoading::backdrop{background:rgba(15,23,42,.38)}#gaLoading .gl{position:fixed;inset:0;display:grid;place-items:center}#gaLoading .gl-card{background:#fff;color:#172033;border-radius:16px;padding:22px 28px;min-width:260px;max-width:min(92vw,380px);text-align:center;box-shadow:0 18px 50px rgba(15,23,42,.35);font-family:inherit}#gaLoading .gl-spin{width:38px;height:38px;margin:0 auto 12px;border:4px solid #dbe5ff;border-top-color:#1d4ed8;border-radius:50%;animation:glspin .8s linear infinite}#gaLoading b{display:block;font-size:16px}#gaLoading small{display:block;margin-top:6px;color:#667085;font-size:13px;line-height:1.5}@keyframes glspin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){#gaLoading .gl-spin{animation-duration:2.4s}}</style><div class="gl"><div class="gl-card"><div class="gl-spin"></div><b class="gl-title">กำลังโหลด…</b><small class="gl-sub"></small></div></div>';
        box.addEventListener('cancel', event => event.preventDefault());   // กัน Esc ปิดทิ้งระหว่างรอ
        box.addEventListener('close', () => { if (pending && !dismissed) setTimeout(show, 0); });   // ถูกปิดทั้งที่ยังรออยู่ (เช่น กด Esc ซ้ำ) → เปิดกลับ
        document.body.append(box);
        return box;
    }
    function paint() {
        if (!box || !box.open) return;
        const sec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
        box.querySelector('.gl-title').textContent = label || domLabel() || 'กำลังโหลดข้อมูล…';
        let hide = box.querySelector('.gl-hide');
        if (sec >= 45 && !hide) { hide = document.createElement('button'); hide.type = 'button'; hide.className = 'gl-hide'; hide.textContent = 'ซ่อนไว้ก่อน (ระบบยังรออยู่เบื้องหลัง)'; hide.style.cssText = 'margin-top:10px;border:0;background:none;color:#1d4ed8;cursor:pointer;font:inherit;font-size:13px;text-decoration:underline'; hide.addEventListener('click', () => { dismissed = true; if (box.open) box.close(); }); box.querySelector('.gl-card').append(hide); }
        box.querySelector('.gl-sub').textContent = (sec >= 3 ? `รอมา ${sec} วินาที · ` : '') + (sec >= 20 ? 'ระบบยังทำงานอยู่ ข้อมูลที่ใหญ่หรือเครือข่ายช้าอาจใช้เวลานาน — ' : '') + 'กรุณารอจนกว่าจะเสร็จ ห้ามปิดหน้านี้';
    }
    function show() {
        showTimer = 0;
        if (!pending || dismissed || !document.body) return;
        const el = build();
        if (!el.open) { try { el.showModal(); } catch { return; } shownAt = Date.now(); ticker = setInterval(paint, 500); }
        paint();
    }
    function hide() {
        hideTimer = 0;
        if (pending) return;
        clearInterval(ticker); ticker = 0;
        if (box?.open) box.close();
    }
    function begin(text) {
        if (!pending) { startedAt = Date.now(); label = ''; dismissed = false; box?.querySelector('.gl-hide')?.remove(); }
        pending += 1;
        if (text) label = text;
        clearTimeout(hideTimer); hideTimer = 0;
        if (!box?.open && !showTimer) showTimer = setTimeout(show, SHOW_AFTER_MS);
        else paint();
    }
    function end() {
        pending = Math.max(0, pending - 1);
        lastEnd = Date.now();
        if (pending) return;
        clearTimeout(showTimer); showTimer = 0;
        if (box?.open) hideTimer = setTimeout(hide, Math.max(0, MIN_SHOW_MS - (Date.now() - shownAt)));
    }
    function track(promise, text) {
        begin(text);
        return Promise.resolve(promise).finally(end);
    }
    const fromUser = () => pending > 0 || Date.now() - lastUser < USER_WINDOW_MS || Date.now() - lastEnd < 600;
    const isApi = url => { const u = String(url || ''); return API ? u.startsWith(API) : u.startsWith('/api/'); };

    // ครอบ fetch: เฉพาะคำขอไป API หลังบ้านที่เริ่มจากการกดของผู้ใช้ · รวมช่วงอ่านเนื้อหาตอบกลับ (json/blob/…) ด้วย
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, options) {
        const url = typeof input === 'string' ? input : input?.url;
        if (options?.gaSilent || !isApi(url) || !fromUser()) return nativeFetch(input, options);
        begin();
        let released = false;
        const release = () => { if (!released) { released = true; end(); } };
        return nativeFetch(input, options).then(response => {
            for (const method of ['json', 'text', 'blob', 'arrayBuffer', 'formData']) {
                const original = response[method]?.bind(response);
                if (!original) continue;
                response[method] = () => { begin(); return original().finally(end); };
            }
            release();
            return response;
        }, error => { release(); throw error; });
    };


    // ---- ข้อความ "กำลัง…" ที่หน้าแสดงเอง (เช่น ปุ่ม "กำลังบันทึก…", แถบสถานะ, "กำลังโหลด…") → ถือว่ากำลังรอ แล้วขึ้นป็อปอัปเดียวกัน
    //      นับเฉพาะที่เกิดจากการกดของผู้ใช้ หรือช่วง 15 วินาทีแรกของการเปิดหน้า (รีเฟรชเบื้องหลังที่ขึ้นข้อความเองไม่นับ) · ค้างเกิน 2 นาทีปล่อยเอง กันหน้าล็อกถาวรกรณีข้อความค้าง
    const WAIT_RE = /^\s*กำลัง[\s\S]{0,100}?(…|\.\.\.)\s*$/;
    const waiting = new Map(), ignored = new WeakMap();   // ignored: element → ข้อความที่ปล่อยแล้ว (ข้อความเดิมไม่นับซ้ำ)
    let domToken = false, domSince = 0;
    const visible = el => el.getClientRects().length > 0;
    const isWaitText = el => el.isConnected && ignored.get(el) !== el.textContent && !(box && box.contains(el)) && el.children.length === 0 && (el.textContent || '').length < 120 && WAIT_RE.test(el.textContent || '') && visible(el);
    function consider(el) {
        if (!el || el.nodeType !== 1 || waiting.has(el)) return;
        if (isWaitText(el) && (fromUser() || performance.now() < 15000)) waiting.set(el, Date.now());
    }
    function scanTree(root) {
        if (!root || root.nodeType !== 1 || !(root.textContent || '').includes('กำลัง')) return;
        if (root.children.length === 0) return consider(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.nodeValue.includes('กำลัง')) consider(node.parentElement);
    }
    function syncDom() {
        for (const el of [...waiting.keys()]) if (!isWaitText(el)) waiting.delete(el);
        if (domToken && Date.now() - domSince > 120000) { waiting.forEach((_, el) => ignored.set(el, el.textContent)); waiting.clear(); }
        if (waiting.size && !domToken) { domToken = true; domSince = Date.now(); begin(); }
        else if (!waiting.size && domToken) { domToken = false; end(); }
    }
    function domLabel() { const el = [...waiting.keys()][0]; return el ? el.textContent.trim() : ''; }
    function watchDom() {
        new MutationObserver(records => {
            for (const r of records) {
                const target = r.type === 'characterData' ? r.target.parentElement : r.target;
                if (target && target.children.length === 0) consider(target);
                r.addedNodes.forEach(node => scanTree(node.nodeType === 3 ? node.parentElement : node));
            }
            syncDom();
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        setInterval(syncDom, 700);
        scanTree(document.body); syncDom();
    }
    if (document.body) watchDom(); else document.addEventListener('DOMContentLoaded', watchDom, { once: true });

    window.GA_LOADING = { run: (text, promise) => track(promise, text), begin, end, wrap: track };
})();

