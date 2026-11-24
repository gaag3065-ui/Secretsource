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
        window.authFetch = async (url, options) => {
            requests.push(JSON.parse(options.body));
            await new Promise(resolve => { window.finish = resolve; });
            return new Response('%PDF-test', { status: 200, headers: { 'X-Claim-Updated-Count': '1' } });
        };
        // Prevent test-only download navigation while still exercising the Blob creation code.
        HTMLAnchorElement.prototype.click = function () {};
    }, items);
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/history-claim-report.js') });
    await s.page.evaluate(() => openClaimReportDialog());
    return s;
}
for (const width of [1900, 390]) test(`claim report ${width}: exact pending scope, duplicate-click lock, success refresh/count and no layout regression`, { skip: !edgePath() }, async t => {
    const s = await open(t, width, [item(3, '1', WAIT), item(4, '2', 'ปิดเคส'), item(5, '3', WAIT), item(6, '4', WAIT)]);
    await s.page.evaluate(() => { currentCaseLatest['3'] = { statusText: 'ปิดเคส' }; currentFilteredHistory[3].company = 'B'; });
    await s.page.locator('[name=company]').selectOption('A');
    assert.deepEqual(await layoutProblems(s.page), []);
    await s.page.locator('.hcr-actions button[value=pdf]').click();
    await s.page.waitForFunction(() => requests.length === 1);
    assert.deepEqual(await s.page.evaluate(() => requests[0].rowNumbers), [3]);
    assert.equal(await s.page.locator('#createHistoryReportButton').isDisabled(), true);
    await s.page.evaluate(() => { document.querySelector('.hcr-actions button[value=xlsx]').click(); openClaimReportDialog(); });
    assert.equal(await s.page.evaluate(() => requests.length), 1);
    await s.page.evaluate(() => finish());
    await s.page.waitForFunction(() => messages.length === 1);
    assert.equal(await s.page.evaluate(() => refreshes), 1);
    assert.match(await s.page.evaluate(() => messages[0]), /สำเร็จจำนวน 1 เคส/);
    assert.equal(await s.page.locator('#createHistoryReportButton').isDisabled(), false);
    assert.deepEqual(s.problems, []);
});
test('claim report failure restores controls, refreshes safely and shows no success', { skip: !edgePath() }, async t => {
    const s = await open(t, 1900, [item(3, '1', WAIT)]);
    await s.page.evaluate(() => { authFetch = async () => new Response(JSON.stringify({ message: 'เขียนชีตไม่สำเร็จ' }), { status: 500 }); });
    await s.page.locator('.hcr-actions button[value=xlsx]').click();
    await s.page.waitForFunction(() => messages.length === 1);
    assert.equal(await s.page.evaluate(() => messages[0]), 'เขียนชีตไม่สำเร็จ');
    assert.equal(await s.page.locator('.hcr-actions button[value=xlsx]').isDisabled(), false);
    assert.equal(await s.page.evaluate(() => refreshes), 1);
});
test('claim report split-company partial success refreshes and reports only successful case count', { skip: !edgePath() }, async t => {
    const s = await open(t, 1900, [item(3, '1', WAIT), item(4, '2', WAIT, 'B')]);
    await s.page.evaluate(() => {
        authFetch = async (url, options) => {
            requests.push(JSON.parse(options.body));
            return requests.length === 1 ? new Response('%PDF-test', { headers: { 'X-Claim-Updated-Count': '1' } })
                : new Response(JSON.stringify({ message: 'การเชื่อมต่อขัดข้อง' }), { status: 500 });
        };
    });
    await s.page.locator('[name=split][value=each]').check();
    await s.page.locator('.hcr-actions button[value=pdf]').click();
    await s.page.waitForFunction(() => messages.length === 1);
    assert.deepEqual(await s.page.evaluate(() => requests.map(r => r.rowNumbers)), [[3], [4]]);
    assert.match(await s.page.evaluate(() => messages[0]), /สำเร็จจำนวน 1 เคส/);
    assert.match(await s.page.evaluate(() => messages[0]), /การเชื่อมต่อขัดข้อง/);
    assert.equal(await s.page.evaluate(() => refreshes), 1);
});
