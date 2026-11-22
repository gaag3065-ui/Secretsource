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



// ลิงก์หลังบ้านอยู่ในไฟล์ assets/js/core/api-url.js (ระบบซ่อม Cloudflare tunnel อัตโนมัติแก้เฉพาะไฟล์นั้น) — ต้องโหลดก่อน config.js เสมอ
const PRODUCTION_API_URL = window.GA_API_URL || '';
if (!IS_LOCAL && !PRODUCTION_API_URL) console.error('[APP CONFIG] ไม่พบ GA_API_URL — ตรวจว่าโหลด assets/js/core/api-url.js ก่อน config.js');



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
        try { await Promise.race([window.ApiCache?.clearAll?.(), new Promise(resolve => setTimeout(resolve, 800))]); } catch { /* ไม่เป็นไร */ }   // เซสชันหมดอายุ → ล้างข้อมูลที่แคชไว้ของผู้ใช้ (รอไม่เกิน 0.8 วินาที)
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
            // ล้างแคชข้อมูลของผู้ใช้ (รออย่างมาก 0.8 วินาที ไม่ให้ค้างหน้า)
            try { await Promise.race([window.ApiCache?.clearAll?.(), new Promise(resolve => setTimeout(resolve, 800))]); } catch { /* ไม่เป็นไร */ }
            sessionStorage.clear();
            window.location.replace('index.html');
        }
    };
//#endregion


// ======================================================
// ตัวแสดงสถานะ "กำลังโหลด…" กลาง — แถบบางด้านบนจอ ไม่ล็อกหน้าจอ ไม่ขัดการคลิก — ทุกหน้าที่ใช้ config.js
//   ทุกครั้งที่ผู้ใช้กดปุ่ม/ส่งฟอร์ม แล้วมีคำขอไปหลังบ้านค้างอยู่ จะขึ้นแถบบางๆ ด้านบนจอ ("กำลังโหลด…" / "กำลังบันทึก…")
//   จนกว่าคำขอจะเสร็จ — ไม่บังหน้าจอและไม่ขัดการคลิก · ปุ่มบันทึก/อัปโหลดต้องปิดตัวเองระหว่างส่ง (disabled) เพื่อกันกดซ้ำ · รีเฟรชเบื้องหลังอัตโนมัติ (ไม่ได้เกิดจากการกด) จะไม่ขึ้น
//   ใช้เองได้: GA_LOADING.run('ข้อความ', promise) · ไม่ต้องการให้ขึ้น: fetch(url, { gaSilent: true })
// ======================================================
(function () {
    if (window.GA_LOADING || typeof document === 'undefined') return;
    const API = String(window.APP_CONFIG?.API_BASE_URL || '');
    const SHOW_AFTER_MS = 300;        // เร็วกว่านี้ไม่ต้องขึ้น (กันกะพริบ)
    const USER_WINDOW_MS = 1500;      // คำขอที่เริ่มภายในเวลานี้หลังผู้ใช้กด/พิมพ์ ถือว่ามาจากผู้ใช้
    let lastUser = 0, lastBlockEnd = 0, pending = 0, blockers = 0, startedAt = 0, label = '', barTimer = 0;
    let bar = null;

    // นับเฉพาะการกระทำจริง: คลิก/แตะ · Enter/Space · ส่งฟอร์ม · เปลี่ยนค่าช่องเลือก
    ['pointerdown', 'submit', 'change'].forEach(type => document.addEventListener(type, () => { lastUser = Date.now(); }, true));
    document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') lastUser = Date.now(); }, true);

    // ---- กันกดบันทึกซ้ำ (ใช้แทนป๊อปอัปล็อกจอเดิม): ปุ่มที่ผู้ใช้เพิ่งกด/ปุ่มส่งฟอร์ม ถูกล็อก (disabled + "กำลังบันทึก...")
    //      ตลอดที่คำขอเขียน (POST/PUT/PATCH/DELETE) ยังค้างอยู่ แล้วคืนค่าเดิมให้อัตโนมัติ · ฟอร์มที่กำลังส่งอยู่จะไม่รับการส่งซ้ำ
    //      ไม่ทำกับคำขอ gaSilent (งานเบื้องหลัง) · ปุ่มที่ไม่ต้องการ: ใส่ data-ga-noguard
    const GUARD_WINDOW_MS = 2500, GUARD_TEXT = 'กำลังบันทึก...', GUARD_HOLD_MS = 350;
    const BTN_SEL = 'button, input[type="submit"], input[type="button"], [role="button"]';
    let actionBtn = null, actionForm = null, actionAt = 0;
    const markAction = (btn, form) => { actionBtn = btn || null; actionForm = form || btn?.form || btn?.closest?.('form') || null; actionAt = Date.now(); };
    document.addEventListener('pointerdown', event => markAction(event.target.closest?.(BTN_SEL), null), true);
    document.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') markAction(event.target.closest?.(BTN_SEL), event.target.closest?.('form'));
    }, true);
    document.addEventListener('submit', event => {
        const form = event.target;
        if (!form?.dataset) return;
        if (form.dataset.gaBusy === '1') { event.preventDefault(); event.stopImmediatePropagation(); return; }   // กำลังส่งอยู่ — ไม่รับซ้ำ
        markAction(event.submitter || (actionForm === form ? actionBtn : null), form);
        form.dataset.gaBusy = '1';   // กันกดซ้ำช่วงเตรียมข้อมูล (ก่อนยิงคำขอ) — ถ้าไม่มีคำขอเขียนตามมา ปลดเองใน 1.5 วินาที
        clearTimeout(form.__gaBusyTimer);
        form.__gaBusyTimer = setTimeout(() => { if (!form.__gaGuards) delete form.dataset.gaBusy; }, 1500);
    }, true);
    function guardStart() {
        if (Date.now() - actionAt > GUARD_WINDOW_MS) return null;
        const btn = actionBtn, form = actionForm;
        const token = { btn: null, form: null };
        if (form?.dataset) {
            form.__gaGuards = (form.__gaGuards || 0) + 1;
            form.dataset.gaBusy = '1';
            token.form = form;
        }
        if (btn && btn.isConnected && !btn.hasAttribute('data-ga-noguard')) {
            if (btn.dataset.gaGuard === '1') { btn.__gaCount += 1; token.btn = btn; }
            else if (!btn.disabled) {
                btn.dataset.gaGuard = '1'; btn.__gaCount = 1;
                btn.dataset.gaOrig = btn.tagName === 'INPUT' ? btn.value : btn.innerHTML;
                if (btn.tagName === 'INPUT') btn.value = GUARD_TEXT; else btn.textContent = GUARD_TEXT;
                btn.disabled = true;
                token.btn = btn;
            }
        }
        return token;
    }
    function guardEnd(token) {
        if (!token) return;
        setTimeout(() => {   // รอสั้นๆ ให้คำขอถัดไปของขั้นตอนเดียวกัน (เช่น จองเลข → อัปโหลด → บันทึก) ต่อกันได้ ไม่ให้ปุ่มกะพริบ
            const { btn, form } = token;
            if (form && --form.__gaGuards <= 0) { form.__gaGuards = 0; delete form.dataset.gaBusy; }
            if (btn && --btn.__gaCount <= 0 && btn.dataset.gaGuard === '1') {
                delete btn.dataset.gaGuard;
                const current = btn.tagName === 'INPUT' ? btn.value : btn.textContent;
                if (current === GUARD_TEXT) {   // หน้าเปลี่ยนข้อความ/สถานะปุ่มเองแล้ว = ไม่ทับ ไม่แตะ
                    if (btn.tagName === 'INPUT') btn.value = btn.dataset.gaOrig; else btn.innerHTML = btn.dataset.gaOrig;
                    btn.disabled = false;
                }
                delete btn.dataset.gaOrig;
            }
        }, GUARD_HOLD_MS);
    }

    // แถบสถานะบางๆ ด้านบนจอ (ไม่บังและไม่รับคลิก) — ใช้แทนป๊อปอัปกลางจอและป้ายมุมขวาล่าง
    function ensureBar() {
        if (bar || !document.body) return bar;
        bar = document.createElement('div');
        bar.id = 'gaTopBar';
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-live', 'polite');
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;pointer-events:none;display:none';
        bar.innerHTML = '<style>#gaTopBar .gb-line{height:3px;background:linear-gradient(90deg,transparent,#2563eb,transparent);background-size:40% 100%;background-repeat:no-repeat;animation:gbSlide 1.1s ease-in-out infinite}'
            + '#gaTopBar .gb-text{width:max-content;max-width:90vw;margin:4px auto 0;padding:3px 12px;border-radius:0 0 10px 10px;background:rgba(15,23,42,.88);color:#fff;font:600 12px/1.5 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
            + '@keyframes gbSlide{0%{background-position:-60% 0}100%{background-position:160% 0}}@media (prefers-reduced-motion:reduce){#gaTopBar .gb-line{animation:none;background:#2563eb}}</style>'
            + '<div class="gb-line"></div><div class="gb-text"></div>';
        document.body.append(bar);
        return bar;
    }
    const barText = () => label || domLabel() || (blockers ? 'กำลังบันทึก…' : 'กำลังโหลด…');
    function sync() {
        if (pending <= 0) {
            clearTimeout(barTimer); barTimer = 0;
            if (bar) bar.style.display = 'none';
            return;
        }
        if (bar && bar.style.display === 'block') { bar.querySelector('.gb-text').textContent = barText(); return; }
        if (barTimer || !document.body) return;
        barTimer = setTimeout(() => {
            barTimer = 0;
            if (pending <= 0) return;
            const el = ensureBar(); if (!el) return;
            el.querySelector('.gb-text').textContent = barText();
            el.style.display = 'block';
        }, SHOW_AFTER_MS);
    }
    // blocking ยังนับไว้เพื่อแยกว่าเป็นการกดของผู้ใช้ — แต่ไม่ล็อกหน้าจออีกแล้ว (ปุ่มที่ต้องกันกดซ้ำปิดตัวเองตอนกำลังส่ง)
    function begin(text, blocking = false) {
        if (!pending) { startedAt = Date.now(); label = ''; }
        pending += 1; if (blocking) blockers += 1;
        if (text) label = text;
        sync();
    }
    function end(blocking = false) {
        pending = Math.max(0, pending - 1); if (blocking) blockers = Math.max(0, blockers - 1);
        if (blocking) lastBlockEnd = Date.now();
        sync();
    }
    function track(promise, text) {
        begin(text, true);
        const guard = guardStart();
        return Promise.resolve(promise).finally(() => { end(true); guardEnd(guard); });
    }
    const fromUser = () => blockers > 0 || Date.now() - lastUser < USER_WINDOW_MS || Date.now() - lastBlockEnd < 800;
    const isApi = url => { const u = String(url || ''); return API ? u.startsWith(API) : u.startsWith('/api/'); };

    // ครอบ fetch: เฉพาะคำขอไป API หลังบ้านที่เริ่มจากการกดของผู้ใช้ · ไม่ต้องการให้ขึ้น: fetch(url, { gaSilent: true })
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, options) {
        const url = typeof input === 'string' ? input : input?.url;
        if (options?.gaSilent || !isApi(url) || !fromUser()) return nativeFetch(input, options);
        const verb = String(options?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
        const blocking = !['GET', 'HEAD', 'OPTIONS'].includes(verb);
        begin('', blocking);
        const guard = blocking ? guardStart() : null;   // คำขอเขียน: ล็อกปุ่มที่เพิ่งกดจนกว่าจะเสร็จ
        let released = false;
        const release = () => { if (!released) { released = true; end(blocking); guardEnd(guard); } };
        return nativeFetch(input, options).then(response => {
            for (const method of ['json', 'text', 'blob', 'arrayBuffer', 'formData']) {
                const original = response[method]?.bind(response);
                if (!original) continue;
                response[method] = () => { begin('', blocking); return original().finally(() => end(blocking)); };
            }
            release();
            return response;
        }, error => { release(); throw error; });
    };


    // ---- ข้อความ "กำลัง…" ที่หน้าแสดงเอง (เช่น ปุ่ม "กำลังบันทึก…") → แสดงที่แถบบนด้วย
    //      นับเฉพาะที่เกิดจากการกดของผู้ใช้ หรือช่วง 15 วินาทีแรกของการเปิดหน้า
    const WAIT_RE = /^\s*กำลัง[\s\S]{0,100}?(…|\.\.\.)\s*$/;
    const waiting = new Map(), ignored = new WeakMap();   // ignored: element → ข้อความที่ปล่อยแล้ว (ข้อความเดิมไม่นับซ้ำ)
    let domToken = false, domSince = 0;
    const isWaitText = el => el.isConnected && ignored.get(el) !== el.textContent && !(bar && bar.contains(el)) && el.children.length === 0 && (el.textContent || '').length < 120 && WAIT_RE.test(el.textContent || '') && el.getClientRects().length > 0;
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
