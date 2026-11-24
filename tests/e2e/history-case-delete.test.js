const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { chromium, edgePath, newSession, layoutProblems } = require('./helpers');
const fixture = [{ CaseIdNew: '1455', insuranceId: 'IC1', targetRowNumber: 3, employeeName: 'Test Person', statusText: 'ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม' },
    { CaseIdNew: '1455', insuranceId: 'IC1', targetRowNumber: 5, employeeName: 'Test Person', statusText: 'เปิดเคส' },
    { CaseIdNew: '999', insuranceId: 'IC2', targetRowNumber: 9, employeeName: 'Other Person', statusText: 'ปิดเคส' }];
async function open(t, width, allowed = true) {
    const browser = await chromium.launch({ executablePath: edgePath(), headless: true }); t.after(() => browser.close());
    const s = await newSession(browser, { width, height: 1000 });
    await s.page.setContent('<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0}</style><div id="table-box-placeholder"><div class="history-table-shell"><table><tbody id="tableBodyResult"></tbody></table></div></div>');
    await s.page.addStyleTag({ path: path.resolve(__dirname, '../../assets/css/history-compact.css') });
    await s.page.evaluate(({ fixture, allowed }) => {
        window.historyDisplayMode = 'filtered'; window.currentFilteredHistory = structuredClone(fixture);
        window.currentIndividualHistory = structuredClone(fixture); window.currentCaseLatest = { 999: { targetRowNumber: 9 } };
        window.currentCaseDocuments = {}; window.currentCaseTreatmentEvents = {};
        window.hasPermission = key => key !== 'DeleteTreatment' || allowed;
        window.APP_CONFIG = { API_BASE_URL: 'http://test.invalid' }; window.calls = []; window.messages = []; window.prompt = () => '1455'; window.alert = text => messages.push(text);
        window.loadFilteredAllHistory = async () => { window.refreshed = true; };
        window.authFetch = async (url, options) => {
            const body = JSON.parse(options.body); calls.push({ url, body });
            return new Response(JSON.stringify(url.endsWith('/preview') ? { success: true, caseId: '1455', fingerprint: 'test-fingerprint', steps: 4, fileCount: 3, sharedFileCount: 1 }
                : { success: true, caseId: '1455', deletedRows: 4, deletedRowNumbers: [3, 5, 6, 8], trashedFiles: 3, sharedFiles: 1 }));
        };
    }, { fixture, allowed });
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/history-case-delete.js') });
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/history-compact.js') });
    await s.page.waitForSelector('#hcBody [data-case="1455"]');
    await s.page.locator('#hcBody [data-case="1455"] [data-hc-view]').click();
    return s;
}
for (const width of [1440, 390]) test(`whole case delete ${width}: confirmation, all-step count, correct identity, refresh, no layout overlap`, { skip: !edgePath() }, async t => {
    const s = await open(t, width);
    await s.page.locator('[data-delete-whole-case]').waitFor();
    assert.deepEqual(await layoutProblems(s.page), []);
    await s.page.locator('[data-delete-whole-case]').click();
    await s.page.waitForFunction(() => messages.length > 0);
    const calls = await s.page.evaluate(() => calls);
    assert.equal(calls.length, 2); assert.equal(calls[0].body.caseId, '1455'); assert.equal(calls[1].body.insuranceId, 'IC1');
    assert.equal(calls[1].body.confirmation, '1455'); assert.equal(calls[1].body.fingerprint, 'test-fingerprint');
    assert.match(await s.page.evaluate(() => messages[0]), /ครบ 4 ขั้นตอน/);
    assert.equal(await s.page.evaluate(() => refreshed), true);
    assert.deepEqual(await s.page.evaluate(() => currentFilteredHistory.map(row => [row.CaseIdNew, row.targetRowNumber])), [['999', 5]]);
    assert.equal(await s.page.locator('#hcModal').count(), 0); assert.deepEqual(s.problems, []);
});
test('whole case deletion cancel/mismatched confirmation makes no delete request', { skip: !edgePath() }, async t => {
    const s = await open(t, 1440);
    for (const answer of [null, '999']) {
        await s.page.evaluate(answer => { prompt = () => answer; calls.length = 0; }, answer);
        await s.page.locator('[data-delete-whole-case]').click();
        await s.page.waitForFunction(() => !document.querySelector('[data-delete-whole-case]').disabled);
        assert.equal(await s.page.evaluate(() => calls.length), 1);
        assert.equal(await s.page.evaluate(() => currentFilteredHistory.length), 3);
    }
});
test('whole case deletion failure preserves UI and re-enables button; duplicate click blocked', { skip: !edgePath() }, async t => {
    const s = await open(t, 1440);
    await s.page.evaluate(() => {
        authFetch = async () => { calls.push({}); await new Promise(resolve => { window.finishDelete = resolve; });
            return new Response(JSON.stringify({ success: false, message: 'Drive ใช้งานไม่ได้' }), { status: 502 }); };
    });
    await s.page.locator('[data-delete-whole-case]').click();
    await s.page.waitForFunction(() => calls.length === 1);
    await s.page.evaluate(() => document.querySelector('[data-delete-whole-case]').click());
    assert.equal(await s.page.evaluate(() => calls.length), 1);
    await s.page.evaluate(() => finishDelete());
    await s.page.waitForFunction(() => messages.length === 1);
    assert.equal(await s.page.evaluate(() => currentFilteredHistory.length), 3);
    assert.equal(await s.page.locator('[data-delete-whole-case]').isDisabled(), false);
});
test('whole case deletion hidden without DeleteTreatment permission', { skip: !edgePath() }, async t => {
    const s = await open(t, 1440, false);
    assert.equal(await s.page.locator('[data-delete-whole-case]').count(), 0);
});
