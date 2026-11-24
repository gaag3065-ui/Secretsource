// ประวัติการรักษา (มุมมองกระชับ): 1 แถว = 1 เคส · ซ่อนยอดที่เป็น 0/- · หน้าต่างสรุปกว้างไม่เกิน 900px 4 โซน · รูปตัวอย่าง 100×100 · ไม่ล้นจอทั้งคอมและมือถือ
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium, startStaticServer, newSession, layoutProblems, edgePath } = require('./helpers');

const EDGE = edgePath();
const skip = EDGE ? false : 'ไม่พบ Microsoft Edge (ตั้ง EDGE_PATH ได้) — ข้ามการทดสอบรันจริง';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const drive = id => `https://drive.google.com/file/d/${id}/view`;
const base = { treatmentDateTime: '20/11/2026 09:30', symptoms: 'ปวดท้อง', workLocation: 'PP', area: 'PP', company: 'GA East', hospital: 'King Hospital', employeeName: 'อั้ม นิษฐา', insuranceId: 'IC1', DentalOPD: '0', PPUsageOPD: '0', PPUsageIPD: '0', SLKUsageOpdThB: '0', SLKUsageIpdThB: '0', SLKUsageOpdLkr: '0', SLKUsageIpdLkr: '0', OverLimitCreditInsThB: '0', OverLimitCreditInsLkr: '0', ExchangeRatesIns: '1', ExchangeRatesInt: '1', OtherUsage: '0', ClinicianReportedOutcomes: '-', DocumentsAttached: '-', notes: '-', autoDateTime: '20 พ.ย. 2569', adminName: 'GA' };
let row = 3;
const ev = (id, over) => ({ ...base, CaseIdNew: String(id), statusText: 'เปิดเคสและแจ้งประกันแล้ว รอเข้ารับการรักษา', targetRowNumber: row++, ...over });
const docs = 'OPEN_CASE|' + drive('openCaseFileId1234567890abcdef') + '\nRECEIPT|' + drive('receiptFileId1234567890abcdefgh');
const history = [
    ev(1001, {}), ev(1001, { statusText: 'ปิดเคส เอกสารและบัญชีครบถ้วน', PPUsageOPD: '519', DocumentsAttached: docs }),
    ev(1002, {}), ev(1002, { statusText: 'รักษาเสร็จแล้ว รอส่งเอกสารเคลม', PPUsageIPD: '12500', SLKUsageOpdThB: '1200', SLKUsageOpdLkr: '9000', ExchangeRatesIns: '0.12' }),
    ev(1003, { symptoms: 'ไข้สูง ไอ' }), ev(1004, { symptoms: 'อุบัติเหตุ แผลฉีกขาดที่แขนซ้าย ต้องเย็บ 6 เข็ม', hospital: 'โรงพยาบาลกรุงเทพ พัทยา' })
];
const perms = ['SearchData', 'ViewHistory', 'CreateTreatment', 'EditTreatment', 'DeleteTreatment', 'UploadFiles'];

async function open(browser, size) {
    const { server, origin } = await startStaticServer();
    const session = await newSession(browser, size);
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    await session.context.route('http://127.0.0.1:43127/**', route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const json = body => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (url.pathname === '/api/session') return json({ success: true, user: { username: 'admin', name: 'ผู้ดูแล', role: 'ADMIN' }, permissions: Object.fromEntries(perms.map(p => [p, true])), csrfToken: 't' });
        if (url.pathname.startsWith('/api/case-evidence/file/')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: PNG });
        if (url.pathname.startsWith('/api/case-evidence/')) return json({ success: true, documents: docs });
        return json({ success: true });
    });
    await session.page.goto(origin + '/search.html#all');
    await session.page.waitForFunction(() => typeof window.renderHistoryTable === 'function' && document.getElementById('hcRoot'), null, { timeout: 25000 });
    await session.page.evaluate(h => { window.historyDisplayMode = 'individual'; window.renderHistoryTable(h); }, history);
    await session.page.waitForSelector('#hcBody tr.hc-row', { state: 'visible', timeout: 8000 });
    return { ...session, server };
}

for (const [name, size] of [['คอมพิวเตอร์', { width: 1440, height: 900 }], ['มือถือ', { width: 390, height: 844, mobile: true }]]) {
    test(`ประวัติการรักษากระชับบน${name}: 1 แถว/เคส · ไม่แสดงยอดที่เป็น 0 · ไม่ล้นจอ · หน้าต่างสรุป 4 โซน`, { skip }, async () => {
        const browser = await chromium.launch({ executablePath: EDGE, headless: true });
        let s;
        try {
            s = await open(browser, size);
            const { page } = s;
            const info = await page.evaluate(() => ({
                cases: document.querySelectorAll('#hcBody tr.hc-row').length,
                legacyHidden: getComputedStyle(document.querySelector('.history-table-shell')).display === 'none',
                chips: [...document.querySelectorAll('#hcBody .hc-chip')].map(c => c.textContent.trim()),
                rowHeights: [...document.querySelectorAll('#hcBody tr.hc-row')].map(r => Math.round(r.getBoundingClientRect().height)),
                firstCase: document.querySelector('#hcBody tr.hc-row .hc-case-id').textContent
            }));
            assert.equal(info.cases, 4, 'เคสละ 1 แถว (6 รายการ → 4 เคส)');
            assert.ok(info.legacyHidden, 'ตารางเดิมต้องถูกซ่อน');
            assert.equal(info.firstCase, '#1004', 'เคสล่าสุดอยู่บนสุด');
            assert.ok(info.chips.some(c => /PP OPD: 519\.00/.test(c)) && info.chips.every(c => !/\b0\.00\b/.test(c)), `ต้องไม่มียอด 0.00: ${info.chips.join(' | ')}`);
            if (!size.mobile) assert.ok(Math.max(...info.rowHeights) <= 90, `แถวต้องกระชับ: ${info.rowHeights}`);
            // เฉพาะปุ่มของตารางประวัติ (องค์ประกอบอื่นของหน้ารวมไม่อยู่ในขอบเขตการทดสอบนี้)
            assert.deepEqual((await layoutProblems(page, { overflow: true })).filter(p => /ดูรายละเอียด|แก้ไข|แสดงเพิ่ม|หน้าล้น/.test(p)), []);

            await page.locator('#hcBody tr.hc-row').nth(3).click();   // เคส 1001 (ปิดเคสแล้ว มีเอกสาร)
            await page.waitForSelector('#hcModal .hc-panel');
            await page.waitForTimeout(700);
            const modal = await page.evaluate(() => {
                const p = document.querySelector('#hcModal .hc-panel').getBoundingClientRect();
                const t = document.querySelector('#hcModal .history-evidence-preview');
                const r = t?.getBoundingClientRect();
                return { w: p.width, vw: innerWidth, zones: document.querySelectorAll('#hcModal .hc-zone').length, money: [...document.querySelectorAll('#hcModal .hc-money th')].map(x => x.textContent), thumb: r ? [Math.round(r.width), Math.round(r.height)] : null, empties: [...document.querySelectorAll('#hcModal .history-evidence-empty')].map(x => x.textContent.trim()), overflowX: document.querySelector('#hcModal .hc-body').scrollWidth > document.querySelector('#hcModal .hc-body').clientWidth + 1 };
            });
            assert.ok(modal.w <= 900 && (size.mobile || modal.w >= 800), `ความกว้างหน้าต่าง ${modal.w}`);
            assert.ok(modal.w <= modal.vw, 'ต้องไม่ล้นจอ');
            assert.equal(modal.zones, 4);
            assert.deepEqual(modal.money, ['PP OPD'], 'แสดงเฉพาะหมวดที่มียอด');
            assert.ok(modal.thumb && modal.thumb[0] <= 100 && modal.thumb[1] <= 100, `รูปตัวอย่างต้องไม่เกิน 100px: ${modal.thumb}`);
            assert.ok(modal.empties.every(t => t === 'ไม่มีไฟล์'), `ช่องไม่มีรูปต้องเป็นป้าย "ไม่มีไฟล์": ${modal.empties}`);
            assert.ok(!modal.overflowX, 'เนื้อหาหน้าต่างต้องไม่ล้นแนวนอน');
            await page.keyboard.press('Escape');
            assert.equal(await page.$('#hcModal'), null, 'Esc ต้องปิดหน้าต่าง');
            assert.deepEqual(s.problems, [], 'ต้องไม่มี error ในคอนโซล');
        } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
    });
}

// ปุ่ม "แก้ไข" ในหน้าต่างสรุปต้องกดแทนปุ่มจริงของรายการที่ตรงกัน (ทั้งรายบุคคลและโหมดกรอง รวมเคสที่เกินหน้าแรก 40 เคสของตารางเดิม)
test('ปุ่มแก้ไขในหน้าต่างสรุปเรียกรายการที่ถูกต้อง: โหมดรายบุคคล + โหมดกรอง (รวมเคสหลังหน้าที่ 1)', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let s;
    try {
        s = await open(browser, { width: 1440, height: 900 });
        const { page } = s;
        await page.evaluate(() => { window.__edits = []; const original = window.populateDataToForm; window.populateDataToForm = function (item, ...rest) { window.__edits.push(Number(item.targetRowNumber)); return original?.call(this, item, ...rest); }; });
        const editEach = async (caseId) => {
            const got = [];
            const count = await page.evaluate(id => { window.HistoryCompact.open(id); return document.querySelectorAll('#hcModal [data-act="edit"]').length; }, caseId);
            for (let i = 0; i < count; i++) {
                await page.evaluate(id => window.HistoryCompact.open(id), caseId);
                const status = (await page.locator('#hcModal .hc-tl li').nth(i).locator('.hc-pill').innerText()).trim();
                await page.locator('#hcModal .hc-tl li').nth(i).locator('[data-act="edit"]').click();
                const clicked = await page.evaluate(() => window.__edits.pop());
                await page.evaluate(() => document.querySelector('#hcInline .inline-edit-cancel')?.click());   // แก้ไขเปิดฟอร์มในหน้าต่างแล้ว → ยกเลิกก่อนทดสอบรายการถัดไป
                got.push({ status, clicked });
            }
            return got;
        };
        const expectRows = (events, got) => got.every(g => events.find(e => e.statusText === g.status && Number(e.targetRowNumber) === g.clicked));
        const ind = await editEach('1001');
        assert.equal(ind.length, 2);
        assert.ok(expectRows(history.filter(e => e.CaseIdNew === '1001'), ind), `รายบุคคลกดผิดรายการ: ${JSON.stringify(ind)}`);
        const flat = [];
        let r = 5000;
        for (let id = 2045; id >= 2001; id--) {
            flat.push({ ...base, CaseIdNew: String(id), targetRowNumber: r++, statusText: 'เปิดเคสและแจ้งประกันแล้ว รอเข้ารับการรักษา' });
            if (id === 2001) flat.push({ ...base, CaseIdNew: String(id), targetRowNumber: r++, statusText: 'รักษาเสร็จแล้ว รอส่งเอกสารเคลม' });
        }
        await page.evaluate(h => { window.currentFilteredHistory = h; window.currentCaseDocuments = {}; window.renderFlatHistoryTable(h); }, flat);
        await page.waitForSelector('#hcBody tr.hc-row');
        await page.waitForTimeout(500);
        for (let i = 0; i < 2; i++) { await page.locator('[data-hc-more]').click(); await page.waitForTimeout(200); }
        const fl = await editEach('2001');
        assert.equal(fl.length, 2, `เคสท้ายสุดต้องมีปุ่มแก้ไข 2 รายการ (พบ ${fl.length})`);
        assert.ok(expectRows(flat.filter(e => e.CaseIdNew === '2001'), fl), `โหมดกรองกดผิดรายการ: ${JSON.stringify(fl)}`);
        assert.deepEqual(s.problems, []);
    } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
});

// สถานะล่าสุดของเคสต้องตรงกันทุกจุด: โหมดกรองได้แถวเก่าของเคส (ผ่านตัวกรอง) แต่ป้ายสถานะ/หัวการ์ดต้องแสดงสถานะล่าสุดจากหลังบ้าน (caseLatest)
test('โหมดกรอง: ป้ายสถานะของเคสตรงกับสถานะล่าสุด (caseLatest) ทั้งตารางกระชับและการ์ดเดิม ไม่ค้างสถานะ "เปิดเคส" เก่า', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let s;
    try {
        s = await open(browser, { width: 1440, height: 900 });
        const { page } = s;
        const OPEN = 'เปิดเคสและแจ้งประกันแล้ว รอเข้ารับการรักษา', WAIT = 'ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม', CLOSE = 'ปิดเคส เอกสารและบัญชีครบถ้วน';
        // หลังบ้านส่งมาเฉพาะแถวที่ผ่านตัวกรอง = แถว "เปิดเคส" เก่าของ 3 เคส แต่สถานะล่าสุดจริงต่างกัน
        const rows = [ev(3001, { statusText: OPEN }), ev(3002, { statusText: OPEN }), ev(3003, { statusText: OPEN })];
        const latest = { 3001: { statusText: WAIT }, 3002: { statusText: CLOSE }, 3003: { statusText: OPEN } };
        await page.evaluate(({ rows, latest }) => { window.currentFilteredHistory = rows; window.currentCaseDocuments = {}; window.currentCaseTreatmentEvents = {}; window.currentCaseLatest = latest; window.renderFlatHistoryTable(rows); }, { rows, latest });
        await page.waitForSelector('#hcBody tr.hc-row');
        await page.waitForTimeout(400);
        const compact = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#hcBody tr.hc-row')].map(r => [r.dataset.case, r.querySelector('.hc-pill').textContent.trim()])));
        assert.deepEqual(compact, { 3001: WAIT, 3002: CLOSE, 3003: OPEN });
        const legacy = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#tableBodyResult tr.grouped-parent-row')].map(r => [r.querySelector('.history-case-toggle strong').textContent.trim(), r.querySelector('td[data-label="ขั้นตอนการรักษา"]').textContent.trim()])));
        assert.deepEqual(legacy, { 3001: WAIT, 3002: CLOSE, 3003: OPEN });
        await page.locator('#hcBody tr.hc-row').first().click();
        await page.waitForSelector('#hcModal');
        assert.equal(await page.locator('#hcModal .hc-head .hc-pill').innerText(), await page.evaluate(() => document.querySelector('#hcBody tr.hc-row').querySelector('.hc-pill').textContent.trim()), 'หัวหน้าต่างต้องตรงกับแถว');
        assert.deepEqual(s.problems, []);
    } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
});

// ตารางต้องไม่มีแถบเลื่อนแนวตั้งซ้อนในกรอบ: กางเต็มตามจำนวนแถว แล้วเลื่อนด้วยหน้าเว็บหลัก
test('ตารางประวัติกระชับไม่มีแถบเลื่อนแนวตั้งซ้อน (กางเต็มความสูง) ทั้งคอมพิวเตอร์และมือถือ', { skip }, async () => {
    for (const size of [{ width: 1440, height: 700 }, { width: 390, height: 700, mobile: true }]) {
        const browser = await chromium.launch({ executablePath: EDGE, headless: true });
        let s;
        try {
            s = await open(browser, size);
            const many = [];
            for (let id = 4000; id > 3980; id--) many.push(ev(id, { symptoms: `อาการ ${id}` }));
            await s.page.evaluate(h => { window.historyDisplayMode = 'individual'; window.renderHistoryTable(h); }, many);
            await s.page.waitForFunction(() => document.querySelectorAll('#hcBody tr.hc-row').length === 20);
            const m = await s.page.evaluate(() => { const box = document.querySelector('.hc-scroll'); const cs = getComputedStyle(box); return { maxHeight: cs.maxHeight, overflowY: cs.overflowY, scrollable: box.scrollHeight > box.clientHeight + 1, boxH: Math.round(box.getBoundingClientRect().height), viewH: innerHeight }; });
            assert.equal(m.maxHeight, 'none', `ต้องไม่จำกัดความสูง (${JSON.stringify(m)})`);
            assert.equal(m.scrollable, false, `กรอบต้องไม่มีแถบเลื่อนแนวตั้ง (${JSON.stringify(m)})`);
            assert.ok(m.boxH > m.viewH, `20 แถวต้องสูงกว่าจอ (เลื่อนด้วยหน้าหลัก): ${JSON.stringify(m)}`);
        } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
    }
});

// ป้ายเลขที่ฉบับรายงานเคลมใต้สถานะ: เฉพาะเคสที่อยู่ในฉบับ · ย้อนกลับ (ล้างเลขฉบับ) แล้วป้ายหายทันที
test('ตารางกระชับ: แสดงป้าย "ฉบับ: REP-…" ใต้สถานะของเคสที่อยู่ในรายงาน และหายเมื่อย้อนกลับ', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let s;
    try {
        s = await open(browser, { width: 1440, height: 900 });
        const { page } = s;
        const SENT = 'ส่งเอกสารเคลมแล้ว รอรับเงินคืน';
        const rows = [ev(4001, { statusText: SENT }), ev(4002, { statusText: SENT })];
        const show = reports => page.evaluate(({ rows, reports }) => { window.currentFilteredHistory = rows; window.currentCaseDocuments = {}; window.currentCaseTreatmentEvents = {}; window.currentCaseLatest = {}; window.currentCaseReports = reports; window.renderFlatHistoryTable(rows); }, { rows, reports });
        await show({ 4001: { reportId: 'REP-202611-001', reportBy: 'สมชาย' } });
        await page.waitForSelector('#hcBody tr.hc-row');
        await page.waitForTimeout(300);
        const badges = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#hcBody tr.hc-row')].map(r => [r.dataset.case, r.querySelector('.hc-rep')?.textContent.trim() || ''])));
        assert.deepEqual(await badges(), { 4001: 'ฉบับ: REP-202611-001', 4002: '' });
        await show({});   // ย้อนกลับแล้ว: ไม่มีเลขฉบับ
        await page.waitForTimeout(300);
        assert.deepEqual(await badges(), { 4001: '', 4002: '' });
        assert.deepEqual(s.problems, []);
    } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
});
