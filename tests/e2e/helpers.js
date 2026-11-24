// ตัวช่วยทดสอบรันจริง (Runtime & Integration) ด้วย playwright-core + Microsoft Edge ที่มีในเครื่อง — ไม่ต้องโหลดเบราว์เซอร์เพิ่ม
// หน้าเว็บเสิร์ฟจากโฟลเดอร์โปรเจกต์ผ่านเซิร์ฟเวอร์ static เล็กๆ · คำขอ /api/... ถูกดักด้วย page.route() แล้วตอบ JSON จำลอง (ไม่แตะ Google/หลังบ้านจริง)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..', '..');
const API_ORIGIN = 'http://127.0.0.1:43127';   // ตรงกับ config.js ตอนเปิดบน localhost/127.0.0.1 (ไม่ใส่ ?apiPort)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const EDGE_PATHS = [process.env.EDGE_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/microsoft-edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'].filter(Boolean);
const edgePath = () => EDGE_PATHS.find(p => fs.existsSync(p)) || '';

function startStaticServer() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const url = decodeURIComponent(req.url.split('?')[0]);
            const file = path.join(ROOT, url === '/' ? 'index.html' : url);
            if (!file.startsWith(ROOT) || /[\\/](node_modules|tests|\.git)[\\/]/.test(file)) { res.statusCode = 403; return res.end('forbidden'); }
            fs.readFile(file, (err, data) => {
                if (err) { res.statusCode = 404; return res.end('not found'); }
                res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
                res.end(data);
            });
        }).listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
    });
}

// ผู้ใช้จำลอง: ADMIN (ทุกสิทธิ์) · STAFF (สิทธิ์ต่ำ — ไม่มีสิทธิ์แอดมิน/ผู้บริหาร) · EXEC (ดูแดชบอร์ดผู้บริหารเท่านั้น)
const USERS = {
    ADMIN: { user: { username: 'admin', name: 'ผู้ดูแลทดสอบ', role: 'ADMIN' }, permissions: { ManageAccommodation: true, EditAccommodation: true, ManageStaff: true, ManageWorkflow: true, ViewExecutive: true, ViewAssets: true, ViewMonitoring: true, SearchData: true } },
    STAFF: { user: { username: 'staff1', name: 'พนักงานทดสอบ', role: 'STAFF' }, permissions: { SearchData: true, ViewHistory: true } },
    EXEC: { user: { username: 'exec1', name: 'ผู้บริหารทดสอบ', role: 'STAFF' }, permissions: { ViewExecutive: true } }
};
const CATALOG = ['SearchData', 'ViewHistory', 'ManageAccommodation', 'EditAccommodation', 'AccommodationFlow', 'AccommodationExpenses', 'AccommodationStatusNote', 'AccommodationPayments', 'ManageStaff', 'ManageWorkflow', 'GaHolidays', 'ViewExecutive', 'ViewAssets']
    .map(key => ({ key, title: key, description: 'สิทธิ์ทดสอบ ' + key }));

const CORS = origin => ({ 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });

/** ดักทุกคำขอไปหลังบ้าน: as = 'ADMIN' | 'STAFF' | 'EXEC' | null (ไม่ล็อกอิน → /api/session ตอบ 401) · extra = { '/api/path': json | fn(req) } */
async function mockApi(context, pageOrigin, { as = null, extra = {} } = {}) {
    const calls = [];
    await context.route(`${API_ORIGIN}/**`, async route => {
        const req = route.request(), url = new URL(req.url()), headers = CORS(pageOrigin);
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        calls.push(`${req.method()} ${url.pathname}`);
        const json = (status, body) => route.fulfill({ status, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (url.pathname === '/api/session') return as ? json(200, { success: true, ...USERS[as], csrfToken: 'test-csrf' }) : json(401, { success: false, message: 'unauthorized' });
        if (url.pathname === '/api/admin/users') return as === 'ADMIN' ? json(200, { success: true, catalog: CATALOG, users: [{ username: 'staff1', name: 'พนักงานทดสอบ', role: 'STAFF', permissions: { SearchData: true }, observer: [] }] }) : json(403, { success: false, message: 'forbidden' });
        const hit = extra[url.pathname];
        if (hit !== undefined) return json(200, typeof hit === 'function' ? hit(req) : hit);
        if (!as) return json(401, { success: false, message: 'unauthorized' });
        return json(200, { success: true });   // ค่าเริ่มต้นสำหรับ endpoint อื่น
    });
    return calls;
}

/** เปิด Edge + context ตามขนาดจอ + เก็บ console error / page error */
async function newSession(browser, { width, height, mobile = false }) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, serviceWorkers: 'block' });
    const page = await context.newPage();
    const problems = [];
    // เฉพาะข้อผิดพลาดที่เป็นบั๊กโค้ด (ข้ามรูป/ฟอนต์/PWA/คำขอที่เราตั้งใจให้ 401-403)
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|ERR_|service ?worker|\[PWA\]|401|403|404/i.test(m.text())) problems.push('console.error: ' + m.text().slice(0, 200)); });
    return { context, page, problems };
}

// ตรวจหน้าจอ: ไม่ล้นแนวนอน + ไม่มีปุ่ม/ลิงก์/ช่องกรอกที่มองเห็นแล้วซ้อนทับกัน (ข้ามคู่ที่เป็นพ่อ-ลูก, ส่วนซ้อนเล็กกว่า 6px และของที่อยู่ใน dialog ที่ปิด)
async function layoutProblems(page, { overflow = true } = {}) {
    return page.evaluate(({ overflow }) => {
        const out = [];
        if (overflow) { const sw = document.documentElement.scrollWidth, iw = window.innerWidth; if (sw > iw + 2) out.push(`หน้าล้นแนวนอน: scrollWidth ${sw} > ${iw}`); }
        // ส่วนที่ถูกตัดซ่อนอยู่ในกล่องเลื่อน (overflow auto/scroll/hidden) ผู้ใช้มองไม่เห็น → ไม่นับว่าซ้อนทับ
        const shown = el => { let { left, right, top, bottom } = el.getBoundingClientRect(); for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(o.overflowX + o.overflowY)) { const c = p.getBoundingClientRect(); left = Math.max(left, c.left); right = Math.min(right, c.right); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); } } return { left, right, top, bottom }; };
        const clipped = el => { const s = shown(el); return s.right - s.left <= 1 || s.bottom - s.top <= 1; };
        const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return !clipped(el) && r.width > 6 && r.height > 6 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' && !el.closest('[hidden],dialog:not([open])') && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight * 3; };
        const els = [...document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=button]')].filter(vis);
        const label = el => (el.id ? '#' + el.id : '') + ' ' + (el.textContent || el.getAttribute('aria-label') || el.placeholder || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24);
        const seen = new Set();
        for (let i = 0; i < els.length && out.length < 8; i++) for (let j = i + 1; j < els.length && out.length < 8; j++) {
            const a = els[i], b = els[j];
            if (a.contains(b) || b.contains(a)) continue;
            const ra = shown(a), rb = shown(b);
            const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (ox > 6 && oy > 6) { const key = label(a) + '|' + label(b); if (!seen.has(key)) { seen.add(key); out.push(`ซ้อนทับกัน: [${label(a)}] กับ [${label(b)}] (${Math.round(ox)}×${Math.round(oy)}px)`); } }
        }
        return out;
    }, { overflow });
}

module.exports = { chromium, startStaticServer, mockApi, newSession, layoutProblems, edgePath, USERS, CATALOG, API_ORIGIN };
