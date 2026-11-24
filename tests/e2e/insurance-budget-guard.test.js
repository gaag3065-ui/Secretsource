// insurance-budget-guard.js: คำขอแก้ไขเคสจากหน้าประวัติส่ง allowAppend:true (หลังบ้านเพิ่มแถวขั้นตอนใหม่เมื่อเปลี่ยนสถานะ) และเมื่อได้ appended:true ต้องโหลดตาราง/ไทม์ไลน์ใหม่
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { chromium, edgePath, newSession } = require('./helpers');

async function open(t) {
    const browser = await chromium.launch({ executablePath: edgePath(), headless: true });
    t.after(() => browser.close());
    const s = await newSession(browser, { width: 1200, height: 800 });
    await s.page.setContent('<main></main>');
    await s.page.evaluate(() => {
        window.sent = []; window.reloads = 0; window.historyDisplayMode = 'filtered';
        window.loadFilteredAllHistory = async () => { window.reloads++; };
        window.authFetch = async (url, options) => { sent.push({ url, body: options?.body ? JSON.parse(options.body) : null }); return new Response(JSON.stringify({ success: true, appended: String(url).includes('appended') }), { status: 200 }); };
    });
    await s.page.addScriptTag({ path: path.resolve(__dirname, '../../assets/js/pages/insurance-budget-guard.js') });
    return s;
}

test('แก้ไขเคสจากหน้าประวัติ: ส่ง allowAppend · ได้ appended แล้วโหลดตารางใหม่ · ไม่กระทบ API อื่น', { skip: !edgePath() }, async t => {
    const s = await open(t), { page } = s;
    await page.evaluate(() => authFetch('http://x.test/api/update-treatment?appended=1', { method: 'POST', body: JSON.stringify({ CaseIdNew: '1', statusText: 'ปิดเคส' }) }));
    assert.equal(await page.evaluate(() => sent[0].body.allowAppend), true);
    assert.equal(await page.evaluate(() => sent[0].body.CaseIdNew), '1', 'ข้อมูลเดิมต้องไม่หาย');
    await page.waitForFunction(() => reloads === 1, null, { timeout: 5000 });
    // แก้แล้วไม่มีแถวใหม่ (แก้แถวเดิม) → ไม่ต้องโหลดซ้ำ · API อื่นไม่ถูกเติม allowAppend
    await page.evaluate(() => authFetch('http://x.test/api/update-treatment', { method: 'POST', body: JSON.stringify({ CaseIdNew: '2' }) }));
    await page.evaluate(() => authFetch('http://x.test/api/save-treatment', { method: 'POST', body: JSON.stringify({ CaseIdNew: '3' }) }));
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => reloads), 1);
    assert.equal(await page.evaluate(() => sent[2].body.allowAppend), undefined);
    assert.deepEqual(s.problems, []);
});
