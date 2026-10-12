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
    let lastCheckedText = '';

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
#systemRestartOverlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(10,14,18,.55)}
#systemRestartOverlay .sro-card{width:min(420px,calc(100vw - 32px));display:grid;justify-items:center;gap:8px;padding:26px;border-radius:16px;background:#fff;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25)}
#systemRestartOverlay p{margin:0;font-size:14px}
#systemRestartOverlay small{color:#667085}
#systemRestartOverlay .sro-spinner{width:36px;height:36px;border:4px solid #e4e7ec;border-top-color:#635bff;border-radius:50%;animation:sro-spin 1s linear infinite}
#systemRestartOverlay.is-done .sro-spinner{display:none}
@keyframes sro-spin{to{transform:rotate(360deg)}}
.system-restart-button{margin-left:8px;border:1px solid #d0d5dd;background:#fff;color:#344054;border-radius:999px;padding:5px 12px;font:inherit;font-size:12px;cursor:pointer}
.system-restart-button:hover{border-color:#635bff;color:#635bff}
#systemHealthBanner .shb-checked{flex-basis:100%;text-align:right;font-size:11px;opacity:.75}
#systemHealthBanner button:disabled{opacity:.6;cursor:wait}
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
        // แสดงปุ่มเชื่อมต่อใหม่ทั้งตอนหมดอายุแล้ว (auth_required) และตอนใกล้หมดอายุ (warning)
        const needsDrive = problems.some(item => item.key === 'googleDrive' && item.status !== 'ok');
        node.className = level === 'warning' ? 'is-warning' : 'is-error';
        node.dataset.signature = signature;
        node.innerHTML = `<div class="shb-inner"><div class="shb-body"><b>${level === 'warning' ? '⚠️ ระบบบางส่วนต้องได้รับการดูแล' : '⛔ ระบบบางส่วนใช้งานไม่ได้ในขณะนี้'}</b><ul>${problems.map(item => `<li><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.message)}${item.affects?.length ? `<br><small>กระทบ: ${escapeHtml(item.affects.join(', '))}</small>` : ''}</li>`).join('')}</ul></div><div class="shb-actions">${isAdmin && needsDrive ? '<button type="button" class="shb-primary" data-shb="drive">เชื่อมต่อ Google Drive ใหม่</button>' : ''}${isAdmin ? '<button type="button" data-shb="recheck">ตรวจสอบอีกครั้ง</button>' : ''}<button type="button" data-shb="dismiss">ซ่อน</button>${lastCheckedText ? `<small class="shb-checked">${escapeHtml(lastCheckedText)}</small>` : ''}</div></div>`;
        node.hidden = false;
    }

    async function onAction(event) {
        const action = event.target.closest('[data-shb]')?.dataset.shb;
        if (!action) return;
        if (action === 'dismiss') { dismissedSignature = banner().dataset.signature || ''; banner().hidden = true; return; }
        if (action === 'recheck') {
            // แสดงให้เห็นว่ากำลังตรวจจริง และบอกผลทุกครั้ง (เดิมไม่มีการตอบสนอง ดูเหมือนกดไม่ได้)
            const button = event.target.closest('[data-shb]');
            button.disabled = true; button.textContent = 'กำลังตรวจสอบ...';
            const result = await check(true);
            if (button.isConnected) { button.disabled = false; button.textContent = 'ตรวจสอบอีกครั้ง'; }
            if (result?.error) alert(`ตรวจสอบไม่สำเร็จ: ${result.error}`);
            else if (result && !result.problems) alert('ตรวจสอบแล้ว: ทุกระบบทำงานปกติ');
            return;
        }
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
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return forceRefresh ? { error: data.message || `เซิร์ฟเวอร์ตอบกลับ ${response.status}` } : null;
            const problems = (data.components || []).filter(item => item.status !== 'ok');
            if (forceRefresh) dismissedSignature = '';
            lastCheckedText = data.checkedAt ? `ตรวจล่าสุด ${new Date(data.checkedAt).toLocaleTimeString('th-TH')}` : '';
            render(problems, data.status === 'warning' ? 'warning' : 'error');
            return { problems: problems.length };
        } catch (error) {
            /* ไม่ให้การเฝ้าดูรบกวนการใช้งานหน้าเว็บ — แจ้งเฉพาะตอนผู้ดูแลกดตรวจเอง */
            if (forceRefresh) {
                const button = document.querySelector('#systemHealthBanner [data-shb="recheck"]');
                if (button) { button.disabled = false; button.textContent = 'ตรวจสอบอีกครั้ง'; }
                return { error: error.message };
            }
            return null;
        }
    }

    // ---------------------------------------------------------------- ปุ่ม "รีสตาร์ตระบบ" (เฉพาะผู้ดูแล)
    // สั่งให้เซิร์ฟเวอร์รีสตาร์ตทั้งหมด (backend + tunnel ใหม่ + LINE OA + push ลิงก์ใหม่ขึ้น GitHub)
    // แล้วรอจนหน้าเว็บบน GitHub ได้ลิงก์ใหม่และเซิร์ฟเวอร์ตอบได้ จากนั้นโหลดหน้าใหม่ให้อัตโนมัติ
    function ensureRestartButton() {
        if (!isAdmin || document.getElementById('systemRestartButton')) return;
        const anchor = document.querySelector('.topbar-actions .system-status');
        if (!anchor) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'systemRestartButton';
        button.className = 'system-restart-button';
        button.textContent = 'รีสตาร์ตระบบ';
        button.title = 'เปิดระบบใหม่ทั้งหมด (backend, ลิงก์สาธารณะ, LINE OA)';
        button.addEventListener('click', restartSystem);
        anchor.insertAdjacentElement('afterend', button);
    }

    function showRestartOverlay(message, done = false) {
        let overlay = document.getElementById('systemRestartOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'systemRestartOverlay';
            overlay.innerHTML = '<div class="sro-card"><div class="sro-spinner"></div><b>กำลังรีสตาร์ตระบบ</b><p></p><small>ใช้เวลาประมาณ 2-4 นาที — ไม่ต้องปิดหน้านี้ หน้าเว็บจะโหลดใหม่เองเมื่อพร้อม</small></div>';
            document.body.appendChild(overlay);
        }
        overlay.querySelector('p').textContent = message;
        overlay.classList.toggle('is-done', done);
    }

    const readDeployedApiUrl = async () => {
        const text = await fetch(`config.js?ts=${Date.now()}`, { cache: 'no-store' }).then(r => r.text());
        return (text.match(/const PRODUCTION_API_URL\s*=\s*'([^']+)'/) || [])[1] || '';
    };

    async function restartSystem() {
        if (!window.confirm('รีสตาร์ตระบบทั้งหมดตอนนี้?\n\n• ผู้ใช้ทุกคนต้องเข้าสู่ระบบใหม่\n• ระหว่างรีสตาร์ต (2-4 นาที) ระบบจะใช้งานไม่ได้')) return;
        let previousUrl = '';
        try {
            const response = await window.authFetch(`${apiBase()}/api/system/restart`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || `เซิร์ฟเวอร์ตอบกลับ ${response.status}`);
            previousUrl = data.previousUrl || apiBase();
        } catch (error) { alert(`สั่งรีสตาร์ตไม่สำเร็จ: ${error.message}`); return; }

        clearInterval(timer); // หยุดเฝ้าดูระหว่างรีสตาร์ต ไม่ให้แถบเตือนเด้ง
        showRestartOverlay('1/3 กำลังปิดและเปิด backend ใหม่...');
        const startedAt = Date.now();
        const poll = async () => {
            const elapsed = Date.now() - startedAt;
            if (elapsed > 8 * 60 * 1000) { showRestartOverlay('ใช้เวลานานกว่าปกติ — ลองกด Ctrl+F5 หรือใช้ปุ่ม "เปิดระบบ GA East ใหม่" บนเครื่องเซิร์ฟเวอร์', true); return; }
            try {
                const deployedUrl = await readDeployedApiUrl();
                if (!deployedUrl || deployedUrl === previousUrl) {
                    showRestartOverlay(elapsed < 60000 ? '1/3 กำลังปิดและเปิด backend ใหม่...' : '2/3 กำลังเปิดลิงก์สาธารณะใหม่และอัปเดตหน้าเว็บบน GitHub...');
                } else {
                    showRestartOverlay('3/3 ได้ลิงก์ใหม่แล้ว กำลังตรวจว่าเซิร์ฟเวอร์พร้อม...');
                    const ping = await fetch(`${deployedUrl}/api/system/ping`, { cache: 'no-store' }).catch(() => null);
                    if (ping?.ok) {
                        showRestartOverlay('ระบบพร้อมใช้งานแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...', true);
                        setTimeout(() => window.location.replace(`index.html?restarted=${Date.now()}`), 1500);
                        return;
                    }
                }
            } catch { /* ยังไม่พร้อม ลองใหม่รอบหน้า */ }
            setTimeout(poll, 5000);
        };
        setTimeout(poll, 8000);
    }

    async function init() {
        if (typeof window.authFetch !== 'function') return;
        try {
            const response = await window.authFetch(`${apiBase()}/api/session`, { cache: 'no-store' });
            const data = await response.json();
            isAdmin = String(data.user?.role || '').trim().toUpperCase() === 'ADMIN';
        } catch { /* ใช้สิทธิ์ผู้ใช้ทั่วไป */ }
        ensureRestartButton();
        check();
        timer = setInterval(check, POLL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        window.addEventListener('pagehide', () => clearInterval(timer));
    }

    window.SystemHealth = { check };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
