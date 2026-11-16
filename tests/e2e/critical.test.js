// จุดตายสำคัญ (Critical Paths) — รัน: npm run test:e2e   (ใช้ Edge ที่ติดตั้งในเครื่อง · API ทั้งหมดจำลองด้วย page.route)
//  1) หน้าหลัก/หน้าเข้าสู่ระบบ เปิดบนจอคอมและมือถือ: ไม่มี error ใน console, ไม่ล้นจอ, ปุ่มไม่ซ้อนทับ
//  2) สิทธิ์/ล็อกอิน: ไม่ล็อกอิน หรือสิทธิ์ต่ำเข้าหน้าแอดมิน/ผู้บริหาร ต้องถูกดีดออกหรือถูกล็อกจริง · ADMIN เข้าได้และเห็นสิทธิ์ใหม่ครบ
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium, startStaticServer, mockApi, newSession, layoutProblems, edgePath } = require('./helpers');

const DESKTOP = { width: 1366, height: 800 }, MOBILE = { width: 390, height: 844, mobile: true };
const EDGE = edgePath();
const skip = EDGE ? false : 'ไม่พบ Microsoft Edge (ตั้ง EDGE_PATH ได้) — ข้ามการทดสอบรันจริง';
let browser, site;

test.before(async () => {
    if (skip) return;
    site = await startStaticServer();
    browser = await chromium.launch({ executablePath: EDGE, headless: true });
});
test.after(async () => { await browser?.close(); site?.server.close(); });

const settle = page => page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}).then(() => page.waitForTimeout(400));
async function open(size, as, pagePath, extra) {
    const s = await newSession(browser, size);
    s.calls = await mockApi(s.context, site.origin, { as, extra });
    await s.page.goto(`${site.origin}/${pagePath}`, { waitUntil: 'domcontentloaded' });
    await settle(s.page);
    return s;
}

// ---------------------------------------------------------------- 1) หน้าจอ: คอม + มือถือ
for (const [name, size] of [['คอมพิวเตอร์', DESKTOP], ['มือถือ', MOBILE]]) {
    test(`หน้าเข้าสู่ระบบ (index.html) บน${name}: ไม่มี error · ไม่ล้นจอ · ปุ่มไม่ซ้อนกัน`, { skip }, async () => {
        const s = await open(size, null, 'index.html');
        try {
            assert.deepEqual(s.problems, [], 'ข้อผิดพลาดในหน้า:\n' + s.problems.join('\n'));
            assert.deepEqual(await layoutProblems(s.page), [], 'หน้าจอมีปัญหา');
            assert.ok(await s.page.locator('input').first().isVisible(), 'ไม่เห็นช่องกรอกล็อกอิน');
        } finally { await s.context.close(); }
    });

    test(`หน้าหลัก (portal.html) ผู้ดูแลระบบบน${name}: โหลดสำเร็จ · ไม่มี error · ไม่ล้นจอ · ปุ่มไม่ซ้อนกัน`, { skip }, async () => {
        const s = await open(size, 'ADMIN', 'portal.html');
        try {
            assert.ok(!/index\.html/.test(s.page.url()), 'ถูกดีดไปหน้าล็อกอินทั้งที่ล็อกอินอยู่: ' + s.page.url());
            assert.ok(s.calls.some(c => c.endsWith('/api/session')), 'หน้าหลักไม่ได้เรียก /api/session');
            assert.deepEqual(s.problems, [], 'ข้อผิดพลาดในหน้า:\n' + s.problems.join('\n'));
            assert.deepEqual(await layoutProblems(s.page), [], 'หน้าจอมีปัญหา');
            assert.ok(await s.page.locator('button, a[href]').first().isVisible(), 'หน้าหลักไม่แสดงปุ่ม/ลิงก์ใดเลย');
        } finally { await s.context.close(); }
    });
}

// ---------------------------------------------------------------- 2) สิทธิ์และล็อกอิน
const redirected = (url, to) => new RegExp(to.replace('.', '\\.')).test(url);

test('ไม่ล็อกอิน: เปิดหน้าหลักแล้วต้องถูกดีดไป index.html', { skip }, async () => {
    const s = await open(DESKTOP, null, 'portal.html');
    try { assert.ok(redirected(s.page.url(), 'index.html'), 'ไม่ถูกดีดออก — URL: ' + s.page.url()); } finally { await s.context.close(); }
});

test('ไม่ล็อกอิน: เปิดหน้าแอดมิน (admin.html) ต้องถูกดีดไป index.html', { skip }, async () => {
    const s = await open(DESKTOP, null, 'admin.html');
    try { assert.ok(redirected(s.page.url(), 'index.html'), 'ไม่ถูกดีดออก — URL: ' + s.page.url()); } finally { await s.context.close(); }
});

test('สิทธิ์ต่ำ (STAFF): เปิดหน้าแอดมินต้องถูกดีดออก และต้องไม่มีการดึงรายชื่อบัญชีมาแสดง', { skip }, async () => {
    const s = await open(DESKTOP, 'STAFF', 'admin.html');
    try {
        assert.ok(redirected(s.page.url(), 'index.html'), 'STAFF เข้าหน้าแอดมินได้! URL: ' + s.page.url());
        const body = await s.page.locator('body').innerText();
        assert.ok(!/ผู้ดูแลทดสอบ|staff1/.test(body), 'พบข้อมูลบัญชีบนหน้าทั้งที่สิทธิ์ต่ำ');
    } finally { await s.context.close(); }
});

test('ผู้ดูแล (ADMIN): เข้าหน้าแอดมินได้ · เห็นรายชื่อบัญชี · มีสิทธิ์ใหม่ (ตั้งเบิก/Flow/วันหยุด) ให้ติ๊ก · ไม่มี error', { skip }, async () => {
    const s = await open(DESKTOP, 'ADMIN', 'admin.html');
    try {
        assert.ok(!redirected(s.page.url(), 'index.html'), 'ADMIN ถูกดีดออก — URL: ' + s.page.url());
        assert.deepEqual(s.problems, [], 'ข้อผิดพลาดในหน้า:\n' + s.problems.join('\n'));
        await s.page.selectOption('#staffUser', 'staff1');
        await s.page.waitForTimeout(300);
        const boxes = await s.page.locator('#permissions input[type=checkbox]').evaluateAll(list => list.map(x => x.value));
        for (const key of ['AccommodationPayments', 'AccommodationFlow', 'GaHolidays']) assert.ok(boxes.includes(key), `ไม่พบช่องสิทธิ์ ${key} ในหน้าจัดการสิทธิ์`);
        assert.deepEqual(await layoutProblems(s.page), [], 'หน้าจัดการสิทธิ์มีปัญหา');
    } finally { await s.context.close(); }
});

test('แดชบอร์ดผู้บริหาร: บัญชีไม่มีสิทธิ์ ViewExecutive ต้องเจอหน้าล็อก (ไม่เห็นข้อมูล) · ผู้มีสิทธิ์เข้าได้', { skip }, async () => {
    const a = await open(DESKTOP, 'STAFF', 'exec-dashboard.html');
    try {
        const locked = await a.page.evaluate(() => document.body.classList.contains('is-locked') && !document.getElementById('exLock').hidden);
        assert.ok(locked, 'STAFF ไม่มีสิทธิ์แต่ไม่เจอหน้าล็อกแดชบอร์ดผู้บริหาร');
    } finally { await a.context.close(); }
    // ข้อมูลจำลองรูปแบบเดียวกับ /api/exec/summary จริง (ถ้าหลังบ้านเปลี่ยนโครงสร้าง ต้องแก้ที่นี่และหน้าบ้านให้ตรงกัน)
    const summary = { success: true, generated_at: new Date().toISOString(), range: { from: '2026-10-17', to: '2026-11-15' }, sla_hours: 72, sources: [],
        areas: [{ key: 'welfare', title: 'งานสวัสดิการ', color: '#db2777', total: 2, done: 0, open: 2, overdue: 1, doneRate: 0, onTimeRate: null, avgHours: null, trend: [], people: [], categories: [] }],
        overall: { total: 2, done: 0, open: 2, overdue: 1, doneRate: 0, onTimeRate: null, avgHours: null }, people: [], items: [] };
    const b = await open(DESKTOP, 'EXEC', 'exec-dashboard.html', { '/api/exec/summary': summary, '/api/exec/workflows': { success: true, projects: [] } });
    try {
        const unlocked = await b.page.evaluate(() => !document.body.classList.contains('is-locked'));
        assert.ok(unlocked, 'ผู้มีสิทธิ์ ViewExecutive ยังเจอหน้าล็อก');
        assert.deepEqual(b.problems, [], 'ข้อผิดพลาดในหน้า:\n' + b.problems.join('\n'));
        assert.ok(b.calls.some(c => c.endsWith('/api/exec/summary')), 'แดชบอร์ดไม่ได้เรียก /api/exec/summary');
        assert.deepEqual(await layoutProblems(b.page), [], 'แดชบอร์ดผู้บริหารมีปัญหาหน้าจอ');
    } finally { await b.context.close(); }
});
