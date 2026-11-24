// หน้า "จัดการห้องพักพนักงาน": ต้องไม่มีกล่องพับ 00–05 (ทะเบียนที่พัก) อีกต่อไป และส่วนที่เหลือต้องทำงานปกติ ไม่มี error ใน Console
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium, startStaticServer, newSession, edgePath, API_ORIGIN } = require('./helpers');

const EDGE = edgePath();
const skip = EDGE ? false : 'ไม่พบ Microsoft Edge (ตั้ง EDGE_PATH ได้) — ข้ามการทดสอบรันจริง';
const perms = ['SearchData', 'ManageAccommodation', 'EditAccommodation', 'AccommodationFlow', 'AccommodationExpenses', 'AccommodationStatusNote', 'AccommodationPayments'];

test('จัดการห้องพักพนักงาน: ไม่มีกล่อง 00–05 · แท็บ/สรุปรายตึกยังใช้ได้ · ไม่มี error', { skip }, async () => {
    const { server, origin } = await startStaticServer();
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    try {
        const { context, page, problems } = await newSession(browser, { width: 1440, height: 900 });
        const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
        const paths = [];
        const notFound = [];
        page.on('response', r => { if (r.status() === 404 && r.url().startsWith(origin)) notFound.push(r.url()); });
        await context.route(`${API_ORIGIN}/**`, route => {
            const req = route.request(), url = new URL(req.url());
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
            paths.push(url.pathname);
            const json = body => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
            if (url.pathname === '/api/session') return json({ success: true, user: { username: 'admin', name: 'ผู้ดูแล', role: 'ADMIN' }, permissions: Object.fromEntries(perms.map(p => [p, true])), csrfToken: 't' });
            return json({ success: true });
        });
        await page.goto(origin + '/accommodation.html');
        await page.waitForSelector('.dx-tab', { timeout: 25000 });
        await page.waitForTimeout(1500);

        const dom = await page.evaluate(() => ({
            ledgerHost: !!document.getElementById('accommodationLedger'),
            folds: document.querySelectorAll('.lg-fold, .lg-sec, .lg-rule, details[data-sec]').length,
            lgDialog: !!document.querySelector('dialog.lg-dialog'),
            tabs: [...document.querySelectorAll('.dx-tab')].map(b => b.textContent.trim()),
            summaryFold: !!document.querySelector('details.dx-fold'),
            flowHost: !!document.getElementById('accommodationFlow')
        }));
        assert.equal(dom.ledgerHost, false, 'ต้องไม่มี #accommodationLedger');
        assert.equal(dom.folds, 0, 'ต้องไม่มีกล่องพับ 00–05');
        assert.equal(dom.lgDialog, false, 'ต้องไม่มีหน้าต่าง ดูห้องพัก ของโมดูลเดิม');
        assert.equal(dom.tabs.length, 4);
        assert.ok(dom.summaryFold && dom.flowHost, 'ส่วนสรุปรายตึกและขั้นตอนที่พักใหม่ต้องยังอยู่');
        assert.ok(!paths.includes('/api/accommodation-ledger'), 'ต้องไม่เรียก /api/accommodation-ledger อีก');
        assert.deepEqual(notFound, [], 'ไม่ควรมีไฟล์ของหน้าเว็บที่โหลดไม่เจอ');

        // แท็บทุกแท็บเปิดได้ (รวมแท็บ "ติดตามขั้นตอนการดำเนินงานที่พักใหม่") และเปิด/พับสรุปรายตึกได้
        for (let i = 0; i < 4; i++) {
            await page.locator('.dx-tab').nth(i).click();
            const visible = await page.evaluate(() => [...document.querySelectorAll('.dx-pane')].filter(p => !p.hidden).length);
            assert.equal(visible, 1, `แท็บที่ ${i + 1} ต้องแสดงเนื้อหา 1 ส่วน`);
        }
        await page.locator('details.dx-fold > summary').click();
        assert.equal(await page.evaluate(() => document.querySelector('details.dx-fold').open), true);
        // เลื่อนหน้าจอได้จริง (ทุกแท็บ): ตัวเลื่อนคือ .page-main (fixed) หรือ window ก็ได้ ขอแค่ scroll แล้วตำแหน่งขยับ
        for (let i = 0; i < 4; i++) {
            await page.locator('.dx-tab').nth(i).click();
            // เลื่อนด้วยล้อเมาส์จริง (ไม่ใช่ scrollTo ที่ทะลุ overflow:hidden ได้) แล้ววัดว่าหน้าขยับ
            const sel = () => page.evaluate(() => { const els = [document.scrollingElement, document.querySelector('.page-main')]; return els.map(e => (e ? e.scrollTop : 0)).concat(window.scrollY); });
            await page.evaluate(() => { [document.scrollingElement, document.querySelector('.page-main')].forEach(e => e && e.scrollTo(0, 0)); });
            const before = await sel();
            await page.mouse.move(700, 500);
            await page.mouse.wheel(0, 500);
            await page.waitForTimeout(250);
            const after = await sel();
            const r = await page.evaluate(() => ({
                scrollable: [document.scrollingElement, document.querySelector('.page-main')].some(el => el && el.scrollHeight > el.clientHeight + 5),
                overlays: [...document.querySelectorAll('.sk, .rx-loading')].filter(e => e.offsetParent !== null && getComputedStyle(e).position === 'fixed').length
            }));
            r.moved = after.some((v, k) => v > before[k]);
            assert.ok(r.scrollable, `แท็บที่ ${i + 1}: เนื้อหายาวกว่าจอ ต้องเลื่อนได้`);
            assert.ok(r.moved, `แท็บที่ ${i + 1}: เลื่อนแล้วตำแหน่งต้องขยับ`);
            assert.equal(r.overlays, 0, `แท็บที่ ${i + 1}: ต้องไม่มี overlay โหลดค้างบังหน้า`);
        }
        await page.screenshot({ path: process.env.ACC_SHOT || undefined, fullPage: true }).catch(() => {});
        assert.deepEqual(problems, [], 'ต้องไม่มี error ใน Console: ' + problems.join(' | '));
        await context.close();
    } finally { await browser.close(); server.close(); }
});
