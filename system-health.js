// แถบแจ้งเตือนสถานะระบบ: ดึงผลเฝ้าดูจาก /api/system/health ทุก 2 นาที
// ถ้าบริการใดมีปัญหา (เช่น สิทธิ์ Google Drive หมดอายุ, เซิร์ฟเวอร์ออฟไลน์) จะแสดงแถบด้านบนว่าฟังก์ชันไหนใช้ไม่ได้
// ผู้ดูแลระบบจะเห็นปุ่มแก้ไขทันที (เชื่อมต่อ Google Drive ใหม่ / ตรวจสอบอีกครั้ง)
(function () {
    'use strict';
    const POLL_MS = 2 * 60 * 1000;
    const apiBase = () => window.APP_CONFIG?.API_BASE_URL || '';
    let isAdmin = false;
    let timer = null;
    let dismissedSignature = '';

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

    function ensureStyles() {
        if (document.getElementById('systemHealthStyles')) return;
        const style = document.createElement('style');
        style.id = 'systemHealthStyles';
        style.textContent = `
#systemHealthBanner{position:fixed;top:0;left:0;right:0;z-index:9999;font-family:inherit;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.15)}
#systemHealthBanner[hidden]{display:none}
#systemHealthBanner .shb-inner{display:flex;align-items:flex-start;gap:12px;padding:10px 16px;max-width:1400px;margin:0 auto}
#systemHealthBanner.is-error{background:#fdecea;color:#7a1c12;border-bottom:2px solid #d93025}
#systemHealthBanner.is-warning{background:#fff7e0;color:#6b4e00;border-bottom:2px solid #f2a600}
#systemHealthBanner .shb-body{flex:1;min-width:0}
#systemHealthBanner b{display:block;margin-bottom:3px}
#systemHealthBanner ul{margin:0;padding-left:18px}
#systemHealthBanner li{margin:2px 0}
#systemHealthBanner small{opacity:.8}
#systemHealthBanner .shb-actions{display:flex;gap:6px;flex-wrap:wrap;flex:none}
#systemHealthBanner button{border:1px solid currentColor;background:#fff;color:inherit;border-radius:7px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}
#systemHealthBanner button.shb-primary{background:#d93025;border-color:#d93025;color:#fff}
@media(max-width:720px){#systemHealthBanner .shb-inner{flex-direction:column}}`;
        document.head.appendChild(style);
    }

    function banner() {
        let node = document.getElementById('systemHealthBanner');
        if (!node) {
            ensureStyles();
            node = document.createElement('div');
            node.id = 'systemHealthBanner';
            node.setAttribute('role', 'alert');
            node.hidden = true;
            document.body.appendChild(node);
            node.addEventListener('click', onAction);
        }
        return node;
    }

    function render(problems, level) {
        const node = banner();
        const signature = problems.map(item => `${item.key}:${item.status}`).join('|');
        if (!problems.length || signature === dismissedSignature) { node.hidden = true; return; }
        const needsDrive = problems.some(item => item.key === 'googleDrive' && item.status === 'auth_required');
        node.className = level === 'warning' ? 'is-warning' : 'is-error';
        node.dataset.signature = signature;
        node.innerHTML = `<div class="shb-inner"><div class="shb-body"><b>${level === 'warning' ? '⚠️ ระบบบางส่วนต้องได้รับการดูแล' : '⛔ ระบบบางส่วนใช้งานไม่ได้ในขณะนี้'}</b><ul>${problems.map(item => `<li><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.message)}${item.affects?.length ? `<br><small>กระทบ: ${escapeHtml(item.affects.join(', '))}</small>` : ''}</li>`).join('')}</ul></div><div class="shb-actions">${isAdmin && needsDrive ? '<button type="button" class="shb-primary" data-shb="drive">เชื่อมต่อ Google Drive ใหม่</button>' : ''}${isAdmin ? '<button type="button" data-shb="recheck">ตรวจสอบอีกครั้ง</button>' : ''}<button type="button" data-shb="dismiss">ซ่อน</button></div></div>`;
        node.hidden = false;
    }

    async function onAction(event) {
        const action = event.target.closest('[data-shb]')?.dataset.shb;
        if (!action) return;
        if (action === 'dismiss') { dismissedSignature = banner().dataset.signature || ''; banner().hidden = true; return; }
        if (action === 'recheck') { await check(true); return; }
        if (action === 'drive') {
            // เปิดแท็บไว้ก่อน (กัน popup blocker) แล้วค่อยใส่ลิงก์ที่ได้จากเซิร์ฟเวอร์
            const popup = window.open('', '_blank');
            try {
                const response = await window.authFetch(`${apiBase()}/api/system/google-drive/auth-url`, { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok || !data.authUrl) throw new Error(data.message || 'สร้างลิงก์ไม่สำเร็จ');
                if (popup) popup.location.href = data.authUrl; else window.location.href = data.authUrl;
                alert('ล็อกอิน Google ด้วยบัญชีที่เป็นเจ้าของโฟลเดอร์ Drive แล้วกดอนุญาต\n\nหมายเหตุ: ต้องทำบนเครื่องที่รันเซิร์ฟเวอร์ (localhost) เท่านั้น\nเสร็จแล้วกลับมากด "ตรวจสอบอีกครั้ง"');
            } catch (error) { popup?.close(); alert(error.message); }
        }
    }

    async function check(forceRefresh = false) {
        try {
            const ping = await fetch(`${apiBase()}/api/system/ping`, { cache: 'no-store' }).catch(() => null);
            if (!ping || !ping.ok) {
                render([{ key: 'server', status: 'error', label: 'เซิร์ฟเวอร์', message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ระบบจะลองใหม่อัตโนมัติ หากยังไม่หายให้แจ้งผู้ดูแลเปิดโปรแกรมเซิร์ฟเวอร์', affects: ['ทุกฟังก์ชัน'] }], 'error');
                return;
            }
            if (!sessionStorage.getItem('accessToken') && !document.cookie) return; // ยังไม่ล็อกอิน
            const response = await window.authFetch(`${apiBase()}/api/system/health${forceRefresh && isAdmin ? '/refresh' : ''}`, { method: forceRefresh && isAdmin ? 'POST' : 'GET', cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            const problems = (data.components || []).filter(item => item.status !== 'ok');
            if (forceRefresh) dismissedSignature = '';
            render(problems, data.status === 'warning' ? 'warning' : 'error');
        } catch { /* ไม่ให้การเฝ้าดูรบกวนการใช้งานหน้าเว็บ */ }
    }

    async function init() {
        if (typeof window.authFetch !== 'function') return;
        try {
            const response = await window.authFetch(`${apiBase()}/api/session`, { cache: 'no-store' });
            const data = await response.json();
            isAdmin = String(data.user?.role || '').trim().toUpperCase() === 'ADMIN';
        } catch { /* ใช้สิทธิ์ผู้ใช้ทั่วไป */ }
        check();
        timer = setInterval(check, POLL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        window.addEventListener('pagehide', () => clearInterval(timer));
    }

    window.SystemHealth = { check };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
