const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { chromium, edgePath, newSession, layoutProblems } = require('./helpers');
const WAIT = 'ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม', SENT = 'ส่งเอกสารเคลมแล้ว รอรับเงินคืน';
const item = (row, id, status, company = 'A') => ({ targetRowNumber: row, CaseIdNew: id, insuranceId: `IC${id}`, statusText: status,
    workLocation: 'SL', company, PPUsageOPD: 100 });
async function open(t, width, items) {
    const browser = await chromium.launch({ executablePath: edgePath(), headless: true });
    t.after(() => browser.close());
    const s = await newSession(browser, { width, height: 1000 });
    await s.page.setContent('<button id="createHistoryReportButton">ทำรายงาน</button><select id="historyAreaFilter"><option>SL</option></select><select id="historyCompanyFilter"><option value="">ทั้งหมด</option></select>');
    await s.page.evaluate(items => {
        window.currentFilteredHistory = items; window.currentCaseLatest = {}; window.APP_CONFIG = { API_BASE_URL: 'http://test.invalid' };
        window.requests = []; window.refreshes = 0; window.messages = []; window.alert = message => messages.push(message);
        window.loadFilteredAllHistory = async () => { refreshes++; currentFilteredHistory = currentFilteredHistory.map(row => ({ ...row, statusText: 'ส่งเอกสารเคลมแล้ว รอรับเงินคืน' })); };
        // ขั้น "ดูตัวอย่าง" (mode: preview) ตอบข้อมูลตัวอย่างทันที และไม่นับเป็นคำขอสร้างรายงาน
        window.previewResponse = body => body.mode !== 'preview' ? null : new Response(JSON.stringify({ success: true, nextReportNo: 'REP-202611-001', total: 100 * body.rowNumbers.length,
            summary: {}, rows: body.rowNumbers.map(n => ({ caseKey: String(n), name: `Person ${n}`, insuranceId: `IC${n}`, team: body.company || 'A', date: '24/11/2026', symptom: 'ทดสอบ', opd: 100, ipd: 0, dental: 0 })) }), { status: 200 });
        window.authFetch = async (url, options) => {
            if (!options?.body) return new Response(JSON.stringify({ success: true, total: 0, reports: [] }), { status: 200 });   // ตรวจว่าหลังบ้านรองรับระบบฉบับรายงาน
            const body = JSON.parse(options.body), preview = previewResponse(body); if (preview) return preview;
            requests.push(body);
            await new Promise(resolve => { window.finish = resolve; });
            return new Response('%PDF-test', { status: 200, headers: { 'X-Claim-Updated-Count': '1', 'X-Claim-Report-No': 'REP-202611-001' } });
        };
        // Prevent test-only download navigation while still exercising the Blob creation code.
        HTMLAnchorElement.prototype.click = function () {};
    }, items);
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/history-claim-preview.js') });
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/history-claim-report.js') });
    await s.page.evaluate(() => openClaimReportDialog());
    return s;
}
// ขั้นตอนดูตัวอย่าง: ต้องเห็นหน้าต่างตัวอย่าง (ยังไม่มีคำขอสร้างรายงานจริง) แล้วกรอกชื่อผู้จัดทำ + กดปุ่มที่ต้องการ
async function pick(s, act = 'confirm', creator = 'ผู้ทดสอบ') {
    await s.page.waitForSelector('.hcp[open]');
    assert.equal(await s.page.evaluate(() => requests.length), 0, 'ระหว่างดูตัวอย่างต้องยังไม่มีคำขอสร้างรายงานจริง');
    await s.page.fill('.hcp [name=creator]', creator);
    await s.page.click(`.hcp [data-act=${act}]`);
}
for (const width of [1900, 390]) test(`claim report ${width}: exact pending scope, duplicate-click lock, success refresh/count and no layout regression`, { skip: !edgePath() }, async t => {
    const s = await open(t, width, [item(3, '1', WAIT), item(4, '2', 'ปิดเคส'), item(5, '3', WAIT), item(6, '4', WAIT)]);
    await s.page.evaluate(() => { currentCaseLatest['3'] = { statusText: 'ปิดเคส' }; currentFilteredHistory[3].company = 'B'; });
    await s.page.locator('[name=company]').selectOption('A');
    assert.deepEqual(await layoutProblems(s.page), []);
    await s.page.locator('.hcr-actions button[value=pdf]').click();
    await pick(s);
    await s.page.waitForFunction(() => requests.length === 1);
    assert.deepEqual(await s.page.evaluate(() => requests[0].rowNumbers), [3]);
    assert.deepEqual(await s.page.evaluate(() => [requests[0].mode, requests[0].creator]), ['confirm', 'ผู้ทดสอบ']);
    assert.equal(await s.page.locator('#createHistoryReportButton').isDisabled(), true);
    await s.page.evaluate(() => { document.querySelector('.hcr-actions button[value=xlsx]').click(); openClaimReportDialog(); });
    assert.equal(await s.page.evaluate(() => requests.length), 1);
    await s.page.evaluate(() => finish());
    await s.page.waitForFunction(() => messages.length === 1);
    assert.equal(await s.page.evaluate(() => refreshes), 1);
    assert.match(await s.page.evaluate(() => messages[0]), /REP-202611-001.*สำเร็จจำนวน 1 เคส/);
    assert.equal(await s.page.locator('#createHistoryReportButton').isDisabled(), false);
    assert.deepEqual(s.problems, []);
});
test('claim report failure restores controls, refreshes safely and shows no success', { skip: !edgePath() }, async t => {
    const s = await open(t, 1900, [item(3, '1', WAIT)]);
    await s.page.evaluate(() => { authFetch = async (url, options) => !options?.body ? new Response(JSON.stringify({ success: true, reports: [] })) : previewResponse(JSON.parse(options.body)) || new Response(JSON.stringify({ message: 'เขียนชีตไม่สำเร็จ' }), { status: 500 }); });
    await s.page.locator('.hcr-actions button[value=xlsx]').click();
    await pick(s);
    await s.page.waitForFunction(() => messages.length === 1);
    assert.equal(await s.page.evaluate(() => messages[0]), 'เขียนชีตไม่สำเร็จ');
    assert.equal(await s.page.locator('.hcr-actions button[value=xlsx]').isDisabled(), false);
    assert.equal(await s.page.evaluate(() => refreshes), 1);
});
test('claim report split-company partial success refreshes and reports only successful case count', { skip: !edgePath() }, async t => {
    const s = await open(t, 1900, [item(3, '1', WAIT), item(4, '2', WAIT, 'B')]);
    await s.page.evaluate(() => {
        authFetch = async (url, options) => {
            if (!options?.body) return new Response(JSON.stringify({ success: true, reports: [] }));
            const body = JSON.parse(options.body), preview = previewResponse(body); if (preview) return preview;
            requests.push(body);
            return requests.length === 1 ? new Response('%PDF-test', { headers: { 'X-Claim-Updated-Count': '1' } })
                : new Response(JSON.stringify({ message: 'การเชื่อมต่อขัดข้อง' }), { status: 500 });
        };
    });
    await s.page.locator('[name=split][value=each]').check();
    await s.page.locator('.hcr-actions button[value=pdf]').click();
    await pick(s);
    await s.page.waitForFunction(() => messages.length === 1);
    assert.deepEqual(await s.page.evaluate(() => requests.map(r => r.rowNumbers)), [[3], [4]]);
    assert.match(await s.page.evaluate(() => messages[0]), /สำเร็จจำนวน 1 เคส/);
    assert.match(await s.page.evaluate(() => messages[0]), /การเชื่อมต่อขัดข้อง/);
    assert.equal(await s.page.evaluate(() => refreshes), 1);
});

test('ดูตัวอย่างรายงาน: แสดงเลขที่ฉบับ/ยอดรวม · ฉบับร่างไม่เปลี่ยนสถานะ · ยืนยันต้องกรอกชื่อผู้จัดทำ · ยกเลิกไม่ส่งคำขอ · ไม่ล้น/ซ้อนทับ', { skip: !edgePath() }, async t => {
    const s = await open(t, 1900, [item(3, '1', WAIT), item(4, '2', WAIT)]);
    await s.page.locator('.hcr-actions button[value=pdf]').click();
    await s.page.waitForSelector('.hcp[open]');
    assert.match(await s.page.locator('.hcp-no').innerText(), /^REP-\d{6}-001$/);
    assert.match(await s.page.locator('.hcp-meta').innerText(), /ยอดรวมทั้งหมด\s*200/);
    assert.equal(await s.page.locator('.hcp tbody tr').count(), 2);
    // ยืนยันโดยไม่กรอกชื่อ → ถูกบล็อก ไม่ส่งคำขอ
    await s.page.click('.hcp [data-act=confirm]');
    assert.equal(await s.page.locator('.hcp-error').isVisible(), true);
    assert.equal(await s.page.evaluate(() => requests.length), 0);
    // หน้าต่างตัวเลือกด้านล่าง (ถูกบังด้วยตัวอย่าง) ไม่นับ — ตรวจเฉพาะตัวอย่างที่อยู่บนสุด
    await s.page.evaluate(() => { document.querySelector('.hcr').style.visibility = 'hidden'; });
    assert.deepEqual(await layoutProblems(s.page, { overflow: true }), []);
    await s.page.evaluate(() => { document.querySelector('.hcr').style.visibility = ''; });
    // ฉบับร่าง: ส่งโหมด draft โดยไม่ต้องมีชื่อ
    await s.page.click('.hcp [data-act=draft]');
    await s.page.waitForFunction(() => requests.length === 1);
    assert.equal(await s.page.evaluate(() => requests[0].mode), 'draft');
    await s.page.evaluate(() => finish());
    await s.page.waitForFunction(() => messages.length === 1);
    assert.match(await s.page.evaluate(() => messages[0]), /ฉบับร่าง.*ไม่เปลี่ยนสถานะ/);
    // ยกเลิก = ไม่ส่งคำขอสร้างจริงเพิ่ม
    await s.page.evaluate(w => { currentFilteredHistory = currentFilteredHistory.map(r => ({ ...r, statusText: w })); }, WAIT);   // mock ตอนรีเฟรชเปลี่ยนเป็นส่งแล้ว — คืนเป็นรอนำส่งเพื่อเปิดตัวอย่างอีกครั้ง
    await s.page.locator('.hcr-actions button[value=xlsx]').click();
    await s.page.waitForSelector('.hcp[open]');
    await s.page.click('.hcp [data-act=close]');
    assert.equal(await s.page.evaluate(() => requests.length), 1);
    assert.deepEqual(s.problems, []);
});

test('หลังบ้านรุ่นเก่า (ไม่มีเส้นทาง claim-reports → 404): หยุดก่อนส่งคำขอสร้างรายงาน ไม่เปลี่ยนสถานะเคสใดๆ', { skip: !edgePath() }, async t => {
    const s = await open(t, 1900, [item(3, '1', WAIT)]);
    await s.page.evaluate(() => { authFetch = async (url, options) => { requests.push(url); return new Response('{}', { status: 404 }); }; });
    await s.page.locator('.hcr-actions button[value=pdf]').click();
    await s.page.waitForFunction(() => messages.length === 1);
    assert.match(await s.page.evaluate(() => messages[0]), /ยังไม่ได้ทำรายการใดๆ/);
    assert.equal(await s.page.evaluate(() => requests.length), 1, 'ต้องมีแค่การตรวจ ไม่มีคำขอ claim-summary');
    assert.equal(await s.page.locator('.hcp[open]').count(), 0);
});
