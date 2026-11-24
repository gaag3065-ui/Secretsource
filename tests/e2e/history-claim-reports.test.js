// คลังประวัติรายงานเคลม (history-claim-reports.js): ปุ่มสะสม X ฉบับ · รายการ/รายชื่อพนักงาน · เปลี่ยนสถานะ · Rollback (ยืนยัน/เคสที่สถานะเปลี่ยนแล้ว) · Modal เลื่อนได้ ไม่ล้น ไม่ใช้ absolute
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { chromium, edgePath, newSession, layoutProblems } = require('./helpers');

const mk = (no, status, extra = {}) => ({ reportNo: no, createdAt: '2026-11-24T08:00:00.000Z', creator: 'สมชาย', company: 'A', area: 'SL', type: 'opd', caseCount: 2, total: 750, status, statusAt: '', statusBy: '', log: `2026-11-24 สร้างฉบับโดย สมชาย`,
    cases: Array.from({ length: 40 }, (_, i) => ({ caseKey: String(100 + i), name: `พนักงาน ${i + 1} นามสกุลยาวมากสำหรับทดสอบการตัดบรรทัด`, insuranceId: `IC${i}`, team: 'A', date: '24/11/2026', symptom: 'ปวดหลัง', opd: 100, ipd: 0, dental: 0 })), ...extra });

async function open(t, width) {
    const browser = await chromium.launch({ executablePath: edgePath(), headless: true });
    t.after(() => browser.close());
    const s = await newSession(browser, { width, height: 800 });
    await s.page.setContent('<button id="createHistoryReportButton" class="btn">ทำรายงาน</button>');
    await s.page.evaluate(batches => {
        window.APP_CONFIG = { API_BASE_URL: 'http://test.invalid' }; window.calls = []; window.messages = []; window.confirms = [];
        window.confirm = text => { confirms.push(text); return true; };
        window.loadFilteredAllHistory = async () => { window.refreshed = (window.refreshed || 0) + 1; };
        window.db = batches; window.rollbackMode = 'ok';
        const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
        window.authFetch = async (url, options = {}) => {
            const u = new URL(url), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : {}; calls.push({ method, path: u.pathname, body });
            const m = /claim-reports\/([^/]+)(?:\/(status|rollback))?$/.exec(u.pathname);
            if (!m) return json({ success: true, total: db.length, active: db.filter(b => b.status !== 'ยกเลิก / ย้อนกลับแล้ว').length, reports: db.map(({ cases, ...b }) => b).reverse() });
            const batch = db.find(b => b.reportNo === decodeURIComponent(m[1]));
            if (!m[2]) return json({ success: true, report: batch });
            if (m[2] === 'status') { batch.status = body.status; return json({ success: true }); }
            if (rollbackMode === 'changed' && !body.force) return json({ success: false, message: 'บางเคสถูกเปลี่ยนสถานะหลังออกรายงานแล้ว', changed: [{ caseKey: '105', status: 'ปิดเคส' }] }, 409);
            batch.status = 'ยกเลิก / ย้อนกลับแล้ว'; return json({ success: true, reverted: 39, skipped: [] });
        };
    }, [mk('REP-202611-001', 'ส่งรายงานแล้ว'), mk('REP-202611-002', 'กำลังทำรายงาน')]);
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/history-claim-reports.js') });
    await s.page.addStyleTag({ path: path.resolve(__dirname, '../../assets/css/history-claim-reports.css') });
    return s;
}

for (const width of [1440, 390]) test(`คลังประวัติรายงาน ${width}: ปุ่มสะสม · รายการ · รายชื่อ · เปลี่ยนสถานะ · Modal เลื่อนได้/ไม่ล้น/ไม่ absolute`, { skip: !edgePath() }, async t => {
    const s = await open(t, width), { page } = s;
    await page.waitForFunction(() => document.getElementById('openClaimReportsButton')?.textContent.includes('2 ฉบับ'));
    await page.click('#openClaimReportsButton');
    await page.waitForSelector('.hcl[open] .hcl-list li');
    assert.equal(await page.locator('.hcl-list > li').count(), 2);
    assert.match(await page.locator('.hcl-count').innerText(), /สะสม 2 ฉบับ/);
    // ฉบับใหม่สุดอยู่บนสุด · เปิดดูรายชื่อพนักงานย้อนหลัง
    assert.equal(await page.locator('.hcl-list > li').first().locator('.hcl-no').innerText(), 'REP-202611-002');
    await page.locator('.hcl-list > li').first().locator('.hcl-row').click();
    await page.waitForSelector('.hcl-detail tbody tr');
    assert.equal(await page.locator('.hcl-detail tbody tr').count(), 40);
    // Modal: z-index 50, เลื่อนขึ้นลงในตัวเองได้, ไม่ล้นแนวนอน, ไม่มี absolute/margin ติดลบ
    const info = await page.evaluate(() => {
        const d = document.querySelector('.hcl'), cs = getComputedStyle(d);
        const bad = [...d.querySelectorAll('*')].filter(e => { const c = getComputedStyle(e); return c.position === 'absolute' || c.position === 'fixed' || [c.marginLeft, c.marginTop, c.marginRight, c.marginBottom].some(v => parseFloat(v) < 0); }).length;
        return { z: cs.zIndex, oy: cs.overflowY, scrollable: d.scrollHeight > d.clientHeight, hOver: d.scrollWidth > d.clientWidth + 2, bad };
    });
    assert.deepEqual({ z: info.z, oy: info.oy, hOver: info.hOver, bad: info.bad }, { z: '50', oy: 'auto', hOver: false, bad: 0 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), true);
    assert.deepEqual(await layoutProblems(page, { overflow: true }), []);
    // เปลี่ยนสถานะฉบับ
    // ฉบับที่เปิดอยู่ (002) เดิมเป็น 'กำลังทำรายงาน' → เปลี่ยนเป็น 'รับเงินคืนครบแล้ว'
    await page.locator('.hcl-detail select').selectOption('รับเงินคืนครบแล้ว');
    await page.waitForFunction(() => calls.some(c => c.method === 'PATCH' && c.body.status === 'รับเงินคืนครบแล้ว'));
    assert.deepEqual(s.problems, []);
});

test('Rollback: ต้องยืนยัน · ฉบับเป็นยกเลิก/ย้อนกลับแล้ว (ปุ่ม/สถานะถูกล็อก) · รีเฟรชตาราง · เคสที่สถานะเปลี่ยนแล้วมีคำเตือน+ย้อนเฉพาะที่ยังไม่เปลี่ยน', { skip: !edgePath() }, async t => {
    const s = await open(t, 1440), { page } = s;
    await page.waitForFunction(() => document.getElementById('openClaimReportsButton'));
    await page.click('#openClaimReportsButton');
    await page.locator('.hcl-list > li').nth(1).locator('.hcl-row').click();     // 001 (ส่งรายงานแล้ว)
    await page.waitForSelector('.hcl-rollback');
    // 409: มีเคสสถานะเปลี่ยน → แสดงคำเตือน ไม่ย้อน
    await page.evaluate(() => { rollbackMode = 'changed'; });
    await page.click('.hcl-rollback');
    await page.waitForSelector('.hcl-warn');
    assert.match(await page.locator('.hcl-warn').innerText(), /#105/);
    assert.equal(await page.evaluate(() => db[0].status), 'ส่งรายงานแล้ว');
    // บังคับย้อนเฉพาะเคสที่ยังไม่เปลี่ยน
    await page.click('[data-force]');
    await page.waitForFunction(() => db[0].status === 'ยกเลิก / ย้อนกลับแล้ว');
    assert.equal(await page.evaluate(() => calls.filter(c => c.path.endsWith('/rollback')).pop().body.force), true);
    assert.equal(await page.evaluate(() => confirms.length), 1, 'ต้องมีกล่องยืนยันก่อนย้อนกลับ');
    assert.match(await page.evaluate(() => confirms[0]), /REP-202611-001/);
    await page.waitForSelector('.hcl-rollback[disabled]');
    assert.equal(await page.locator('.hcl-detail select').isDisabled(), true);
    assert.equal(await page.evaluate(() => refreshed >= 1), true, 'ต้องรีเฟรชตารางประวัติให้สถานะ/ป้ายฉบับตรงล่าสุด');
    // ฉบับที่ 2: ย้อนกลับปกติ
    await page.evaluate(() => { rollbackMode = 'ok'; });
    await page.locator('.hcl-list > li').first().locator('.hcl-row').click();
    await page.waitForSelector('.hcl-rollback:not([disabled])');
    await page.click('.hcl-rollback');
    await page.waitForFunction(() => db[1].status === 'ยกเลิก / ย้อนกลับแล้ว');
    assert.equal(await page.evaluate(() => confirms.length), 2);
    assert.deepEqual(s.problems, []);
});
