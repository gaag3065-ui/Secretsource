// ประวัติการรักษา (มุมมองกระชับ): ปุ่มทุกตัวต้องทำงานจริงเหมือนระบบเดิม — แก้ไข(inline) · แก้ไขทุกรายละเอียด · ลบ · อัปเดตเคส · รูปเอกสาร · ไม่ดึงรูปของตารางที่ซ่อน
//   ใช้เบราว์เซอร์จริง (Edge) + ข้อมูลจำลอง: ตรวจว่าฟอร์ม/หน้าต่างปรากฏให้เห็นจริงและส่งคำขอถูกรายการ (ไม่ใช่แค่ว่าเรียกฟังก์ชัน)
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium, startStaticServer, newSession, edgePath } = require('./helpers');

const EDGE = edgePath();
const skip = EDGE ? false : 'ไม่พบ Microsoft Edge (ตั้ง EDGE_PATH ได้) — ข้ามการทดสอบรันจริง';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const drive = id => `https://drive.google.com/file/d/${id}/view`;
const OPEN = 'เปิดเคสและแจ้งประกันแล้ว รอเข้ารับการรักษา', WAIT = 'ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม', CLOSE = 'ปิดเคส เอกสารและบัญชีครบถ้วน';
const base = { treatmentDateTime: '20/10/2026 09:30', symptoms: 'ปวดหลัง', workLocation: 'SL', area: 'SL', company: 'CALL 365', hospital: 'King Hospital', employeeName: 'สุดา', insuranceId: 'IC1', size: 'M', DentalOPD: '0', PPUsageOPD: '0', PPUsageIPD: '0', SLKUsageOpdThB: '0', SLKUsageIpdThB: '0', SLKUsageOpdLkr: '0', SLKUsageIpdLkr: '0', OverLimitCreditInsThB: '0', OverLimitCreditInsLkr: '0', ExchangeRatesIns: '1', ExchangeRatesInt: '1', OtherUsage: '0', ClinicianReportedOutcomes: '-', DocumentsAttached: '-', notes: '-', autoDateTime: '22 พ.ย. 2569', adminName: 'GA' };
let row = 3;
const ev = (id, o) => ({ ...base, CaseIdNew: String(id), statusText: OPEN, targetRowNumber: row++, ...o });
const DOCS = 'OPEN_CASE|' + drive('goodImageFileId1234567890abcdef') + '\nRECEIPT|' + drive('missing404FileId1234567890abcde') + '\nMEDICAL_CERTIFICATE|' + drive('goodImageFileId2234567890abcdef');
const perms = ['SearchData', 'ViewHistory', 'ViewAllHistory', 'CreateTreatment', 'EditTreatment', 'DeleteTreatment', 'UploadFiles', 'ExportHistoryReport'];

async function open(browser, size = { width: 1440, height: 900 }) {
    const { server, origin } = await startStaticServer();
    const session = await newSession(browser, size);
    const requests = [];
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    await session.context.route('http://127.0.0.1:43127/**', route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        requests.push({ method: req.method(), path: url.pathname, body: req.postData() });
        const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (url.pathname === '/api/session') return json({ success: true, user: { username: 'admin', name: 'ผู้ดูแล', role: 'ADMIN' }, permissions: Object.fromEntries(perms.map(p => [p, true])), csrfToken: 't' });
        if (url.pathname.includes('/api/case-evidence/file/')) return url.pathname.includes('missing404') ? json({ success: false, message: 'ไม่พบไฟล์' }, 404) : route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: PNG });
        if (url.pathname.startsWith('/api/case-evidence/')) return json({ success: true, documents: DOCS });
        if (url.pathname === '/api/update-treatment' || url.pathname === '/api/delete-treatment') return json({ success: true });
        if (url.pathname === '/api/search' || url.pathname === '/api/search-case') { const q = JSON.parse(req.postData() || '{}'); const key = q.keyword || q.caseId; return json({ success: true, caseId: key, employees: [searchEmployee(key)] }); }
        if (url.pathname === '/api/history/all') return json({ success: true, total: filterHistory.length, history: filterHistory, caseDocuments: {}, caseTreatmentEvents: {}, caseLatest: Object.fromEntries(filterHistory.map(e => [e.CaseIdNew, { statusText: e.statusText }])), options: { areas: ['SL'], companies: ['CALL 365'], hospitals: ['King Hospital'], treatmentResults: [] }, optionCounts: {} });
        if (url.pathname === '/api/history/export') return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="history-report.xlsx"' }, body: Buffer.from('PK') });
        return json({ success: true });
    });
    await session.page.goto(origin + '/search.html#all');
    await session.page.waitForFunction(() => typeof window.renderHistoryTable === 'function' && document.getElementById('hcRoot'), null, { timeout: 25000 });
    return { ...session, server, requests };
}
const dialogs = page => page.on('dialog', d => d.accept());
const filterHistory = [];
const searchEmployee = caseId => ({ colB: 'CALL 365', colC: 'IC1', colD: 'M', colE: 'E1', colG: 'สุดา', colK: 'SL', colAV: '30000', colAW: '500000', history: [ev(caseId, { statusText: OPEN }), ev(caseId, { statusText: WAIT, PPUsageOPD: '700' })] });

// เคส 6050 มี 3 รายการ (เปิดเคส → รอเอกสาร → ปิดเคส) + 30 เคสที่มีเอกสาร (ไว้ตรวจว่าตารางที่ซ่อนไม่ดึงรูป)
function sampleHistory() {
    row = 3;
    const h = [ev(6050, { symptoms: 'เปิดเคส-ปวดหลัง' }), ev(6050, { statusText: WAIT, symptoms: 'รอเอกสาร-ปวดหลัง', PPUsageOPD: '519' }), ev(6050, { statusText: CLOSE, symptoms: 'ปิดเคส-ปวดหลัง', PPUsageOPD: '519' })];
    for (let id = 6040; id > 6010; id--) h.push(ev(id, { statusText: CLOSE, DocumentsAttached: DOCS, PPUsageOPD: '100' }));
    return h;
}
const render = (page, mode, h) => page.evaluate(({ mode, h }) => {
    if (mode === 'filtered') { window.currentFilteredHistory = h; window.currentCaseDocuments = {}; window.currentCaseTreatmentEvents = {}; window.currentCaseLatest = {}; window.renderFlatHistoryTable(h); }
    else { window.historyDisplayMode = 'individual'; window.renderHistoryTable(h); }
}, { mode, h });

for (const mode of ['individual', 'filtered']) {
    test(`แก้ไข (inline) จากหน้าต่างสรุป [${mode}]: ฟอร์มแก้ไขต้องปรากฏให้เห็น · บันทึกส่งรายการถูกแถว · หน้าต่างปิดและตารางอัปเดต`, { skip }, async () => {
        const browser = await chromium.launch({ executablePath: EDGE, headless: true });
        let s;
        try {
            s = await open(browser);
            const { page } = s; dialogs(page);
            const h = sampleHistory();
            await render(page, mode, h);
            await page.waitForSelector('#hcBody tr.hc-row[data-case="6050"]');
            await page.locator('#hcBody tr.hc-row[data-case="6050"]').click();
            await page.waitForSelector('#hcModal .hc-tl li');
            // รายการเก่าสุดอยู่ล่างสุดของไทม์ไลน์ (เปิดเคส) — ทดสอบทั้งรายการเก่าและใหม่
            for (const [index, statusStart] of [[2, 'เปิดเคส'], [0, 'ปิดเคส']]) {
                if (!(await page.$('#hcModal'))) await page.evaluate(() => window.HistoryCompact.open('6050'));
                const li = page.locator('#hcModal .hc-tl li').nth(index);
                assert.ok((await li.locator('.hc-pill').innerText()).startsWith(statusStart));
                await li.locator('[data-act="edit"]').click();
                await page.waitForSelector('#hcInline .inline-edit-field');
                const box = await page.evaluate(() => { const o = document.querySelector('#hcInline .hc-panel').getBoundingClientRect(); const f = document.querySelector('#hcInline textarea.inline-edit-field'); const r = f.getBoundingClientRect(); return { inView: o.left >= 0 && o.right <= innerWidth && o.top >= 0 && o.bottom <= innerHeight + 1, fieldVisible: r.width > 40 && r.height > 10 && !!f.offsetParent, value: f.value, buttons: [...document.querySelectorAll('#hcInline button')].map(b => b.textContent.trim()) }; });
                assert.ok(box.inView && box.fieldVisible, `ฟอร์มแก้ไขต้องมองเห็นในจอ: ${JSON.stringify(box)}`);
                assert.ok(box.buttons.some(t => /บันทึก/.test(t)) && box.buttons.some(t => /ยกเลิก/.test(t)), `ต้องมีปุ่มบันทึก/ยกเลิก: ${box.buttons}`);
                if (index === 2) {   // ยกเลิก: หน้าต่างปิด + ตารางเดิมกลับสภาพ (ไม่ค้างโหมดแก้ไข)
                    await page.locator('#hcInline .inline-edit-cancel').click();
                    await page.waitForFunction(() => !document.getElementById('hcInline'));
                    assert.equal(await page.evaluate(() => document.querySelectorAll('#tableBodyResult .is-editing-inline').length), 0, 'ตารางเดิมต้องไม่ค้างโหมดแก้ไข');
                    continue;
                }
                s.requests.length = 0;
                await page.locator('#hcInline textarea.inline-edit-field').fill('แก้แล้ว-ปวดหลังมาก');
                await page.locator('#hcInline .inline-edit-save').click();
                await page.waitForFunction(() => !document.getElementById('hcInline'), null, { timeout: 8000 });
                const posted = s.requests.find(r => r.path === '/api/update-treatment');
                assert.ok(posted, 'ต้องส่งคำขอบันทึก');
                const payload = JSON.parse(posted.body);
                const expected = h.filter(e => e.CaseIdNew === '6050').find(e => e.statusText === CLOSE);
                assert.equal(payload.symptoms, 'แก้แล้ว-ปวดหลังมาก');
                assert.equal(Number(payload.sheetRowIndex), expected.targetRowNumber, 'ต้องแก้ถูกแถว');
                await page.waitForTimeout(500);
                const shown = await page.evaluate(() => document.querySelector('#hcBody tr.hc-row[data-case="6050"] .hc-sym').textContent.trim());
                assert.equal(shown, 'แก้แล้ว-ปวดหลังมาก', 'ตารางกระชับต้องแสดงค่าใหม่หลังบันทึก');
            }
            assert.deepEqual(s.problems, []);
        } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
    });
}

test('แก้ไขทุกรายละเอียด / ลบ / อัปเดตเคส (แถวและหน้าต่าง): ป๊อปอัปเดิมต้องเปิดให้เห็นจริง และลบส่งคำขอถูกแถว', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let s;
    try {
        s = await open(browser);
        const { page } = s; dialogs(page);
        const h = sampleHistory();
        await render(page, 'individual', h);
        await page.waitForSelector('#hcBody tr.hc-row[data-case="6050"]');
        const visible = sel => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 100 && r.height > 100; }, sel);
        // แก้ไขทุกรายละเอียด
        await page.locator('#hcBody tr.hc-row[data-case="6050"]').click();
        await page.waitForSelector('#hcModal .hc-tl li');
        await page.locator('#hcModal .hc-tl li').nth(0).locator('[data-act="full"]').click();
        await page.waitForFunction(() => !document.getElementById('hcModal'));
        await page.waitForTimeout(300);
        assert.ok(await visible('#editCaseModal'), 'ป๊อปอัปแก้ไขทุกรายละเอียดต้องปรากฏ');
        assert.equal(await page.inputValue('#mdCaseId'), '6050');
        await page.evaluate(() => window.closeEditModal?.());
        // อัปเดตเคสจากแถว
        await page.locator('#hcBody tr.hc-row[data-case="6050"] [data-hc-update]').click();
        await page.waitForTimeout(400);
        assert.ok(await visible('#outcomeUpdateModal'), 'ฟอร์มอัปเดตเคสต้องปรากฏเมื่อกดจากแถว');
        await page.evaluate(() => window.closeOutcomeUpdateModal?.());
        // อัปเดตเคสจากหน้าต่าง
        await page.locator('#hcBody tr.hc-row[data-case="6050"] [data-hc-view]').click();
        await page.locator('#hcModal [data-hc-update-modal]').click();
        await page.waitForTimeout(400);
        assert.ok(await visible('#outcomeUpdateModal'), 'ฟอร์มอัปเดตเคสต้องปรากฏเมื่อกดจากหน้าต่าง');
        assert.equal(await page.$('#hcModal'), null, 'หน้าต่างสรุปต้องปิดอัตโนมัติ');
        await page.evaluate(() => window.closeOutcomeUpdateModal?.());
        // ลบ: ต้องส่ง delete ของแถวที่เลือก
        await page.locator('#hcBody tr.hc-row[data-case="6050"] [data-hc-view]').click();
        await page.waitForSelector('#hcModal .hc-tl li');
        s.requests.length = 0;
        await page.locator('#hcModal .hc-tl li').nth(2).locator('[data-act="del"]').click();   // รายการเก่าสุด (เปิดเคส)
        await page.waitForTimeout(600);
        const del = s.requests.find(r => r.path === '/api/delete-treatment');
        assert.ok(del, 'ต้องส่งคำขอลบ');
        assert.equal(Number(JSON.parse(del.body).rowIndex ?? JSON.parse(del.body).targetRowNumber ?? JSON.parse(del.body).sheetRowIndex), h.find(e => e.CaseIdNew === '6050' && e.statusText === OPEN).targetRowNumber, `ลบผิดแถว: ${del.body}`);
        assert.deepEqual(s.problems, []);
    } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
});

test('รูปเอกสาร: ตารางที่ซ่อนไม่ดึงรูป (ไม่ยิงหลายร้อยคำขอ) · รูปในหน้าต่างโหลดแล้วเห็น/ที่ไม่มีไฟล์เป็นป้ายข้อความ ไม่มีรูปแตกค้าง', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let s;
    try {
        s = await open(browser);
        const { page } = s;
        const h = sampleHistory();
        s.requests.length = 0;
        await render(page, 'individual', h);
        await page.waitForSelector('#hcBody tr.hc-row');
        await page.waitForTimeout(1500);
        const before = s.requests.filter(r => r.path.includes('/api/case-evidence/file/')).length;
        assert.equal(before, 0, `ตารางที่ซ่อนต้องไม่ดึงรูป (พบ ${before} คำขอ)`);
        await page.locator('#hcBody tr.hc-row[data-case="6040"]').click();
        await page.waitForSelector('#hcModal .history-evidence-item');
        await page.waitForTimeout(1500);
        const state = await page.evaluate(() => [...document.querySelectorAll('#hcModal .history-evidence-item')].map(i => { const img = i.querySelector('img'); return { title: i.querySelector('.history-evidence-title')?.textContent, img: img ? { loaded: img.classList.contains('hc-loaded'), natural: img.naturalWidth, opacity: getComputedStyle(img).opacity } : null, text: i.textContent.replace(i.querySelector('.history-evidence-title')?.textContent || '', '').trim() }; }));
        const withImage = state.filter(x => x.img);
        assert.ok(withImage.length >= 2 && withImage.every(x => x.img.loaded && x.img.natural > 0 && x.img.opacity === '1'), `รูปที่มีต้องโหลดและเห็น: ${JSON.stringify(state)}`);
        assert.ok(state.filter(x => !x.img).every(x => x.text.length > 0), `ช่องที่ไม่มีรูปต้องเป็นป้ายข้อความ: ${JSON.stringify(state)}`);
        assert.equal(state.filter(x => x.img && x.img.opacity !== '1').length, 0, 'ต้องไม่มีรูปที่ค้างครึ่งทาง/รูปแตก');
        assert.deepEqual(s.problems, []);
    } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
});

test('ค้นหาเคส / กรองประวัติ / สร้างรายงาน: ปุ่มทำงานจริง ผลขึ้นตารางกระชับ ป้ายกำลังโหลดหายหลังเสร็จ', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let s;
    try {
        s = await open(browser);
        const { page } = s; dialogs(page);
        // 1) ค้นหาเคสด้วยเลข Case ID → แสดงประวัติของเคสนั้นในตารางกระชับ
        await page.fill('#caseSearchInput', '7001');
        await page.click('#caseSearchBtn');
        await page.waitForSelector('#hcBody tr.hc-row[data-case="7001"]', { timeout: 10000 });
        assert.equal(await page.evaluate(() => document.querySelector('#hcBody tr.hc-row[data-case="7001"] .hc-pill').textContent.trim()), WAIT, 'ป้ายสถานะต้องเป็นสถานะล่าสุด');
        // 2) กรองประวัติ → โหมดกรอง แสดงเคสจากหลังบ้าน + ปุ่ม/ป้ายกำลังโหลดกลับสภาพ
        filterHistory.length = 0;
        row = 9000;
        for (let id = 8003; id >= 8001; id--) filterHistory.push(ev(id, { statusText: CLOSE, PPUsageOPD: '300' }));
        s.requests.length = 0;
        await page.click('#advancedHistoryFilterButton');
        await page.waitForSelector('#hcBody tr.hc-row[data-case="8003"]', { timeout: 10000 });
        await page.waitForTimeout(800);
        assert.ok(s.requests.some(r => r.path === '/api/history/all'), 'ต้องเรียก history/all');
        const ui = await page.evaluate(() => ({ btn: document.getElementById('advancedHistoryFilterButton').textContent.trim(), disabled: document.getElementById('advancedHistoryFilterButton').disabled, summary: document.getElementById('historyFilterSummary').textContent.trim(), bar: [...document.querySelectorAll('#gaTopBar')].filter(b => getComputedStyle(b).display !== 'none').length, rows: document.querySelectorAll('#hcBody tr.hc-row').length, count: document.getElementById('historyResultCount')?.textContent.trim() }));
        assert.equal(ui.btn, '🔎 กรองประวัติ'); assert.equal(ui.disabled, false);
        assert.ok(/พบประวัติทั้งหมด 3 รายการ/.test(ui.summary), ui.summary);
        assert.equal(ui.rows, 3); assert.equal(ui.bar, 0, 'แถบ "กำลังโหลด" ต้องหายหลังโหลดเสร็จ');
        // 3) ปุ่ม "สร้างรายงาน" เปิดป๊อปอัปใบสรุปเคลม (ระบบเดิม) · ส่วนรายงาน Excel รายการที่กรองเรียกฟังก์ชันเดิมได้ → ส่ง rowNumbers ถูกต้อง
        await page.click('#createHistoryReportButton');
        await page.waitForSelector('.hcr', { state: 'visible', timeout: 5000 });
        await page.keyboard.press('Escape');
        s.requests.length = 0;
        const download = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
        await page.evaluate(() => window.downloadFilteredHistoryReport?.());
        await page.waitForTimeout(1200);
        const exp = s.requests.find(r => r.path === '/api/history/export');
        assert.ok(exp, 'ต้องส่งคำขอสร้างรายงาน Excel');
        assert.deepEqual(JSON.parse(exp.body).rowNumbers.sort((a, b) => a - b), filterHistory.map(e => e.targetRowNumber).sort((a, b) => a - b));
        await download;
        assert.deepEqual(s.problems, []);
    } finally { await s?.context.close(); s?.server.close(); await browser.close(); }
});
