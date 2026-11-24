const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const { chromium, edgePath, newSession, layoutProblems } = require('./helpers');
for (const width of [1440, 390]) test(`budget warning ${width}: exact fields, response preserved, clear on correction, layout unchanged`, { skip: !edgePath() }, async t => {
    const browser = await chromium.launch({ executablePath: edgePath(), headless: true }); t.after(() => browser.close());
    const s = await newSession(browser, { width, height: 900 });
    await s.page.setContent('<meta charset="utf-8"><form><label>PP OPD<input id="ocInpPPUsageOPD" type="number"></label><label>IPD<input class="inline-edit-field" data-field-key="PPUsageIPD" type="number"></label></form>');
    await s.page.evaluate(() => {
        window.authFetch = async (url, options) => { window.lastOptions = options;
            return new Response(JSON.stringify({ code: 'INSURANCE_LIMIT_EXCEEDED', message: 'เกินวงเงิน OPD/IPD ไม่สามารถบันทึกได้', details: [{ fields: ['PPUsageOPD', 'PPUsageIPD'] }] }), { status: 422 }); };
    });
    const script = path.resolve(__dirname, '../../assets/js/pages/insurance-budget-guard.js');
    await s.page.addScriptTag({ path: script }); await s.page.addScriptTag({ path: script }); // duplicate initialization must not wrap twice
    assert.equal(await s.page.evaluate(async () => {
        const response = await authFetch('https://example.test/api/update-treatment', { method: 'POST' });
        return response.status === 422 && (await response.json()).code === 'INSURANCE_LIMIT_EXCEEDED' && lastOptions.method === 'POST';
    }), true);
    for (const selector of ['#ocInpPPUsageOPD', '[data-field-key="PPUsageIPD"]']) {
        assert.equal(await s.page.locator(selector).evaluate(e => e.validity.valid), true);
        assert.equal(await s.page.locator(selector).getAttribute('aria-invalid'), 'true');
    }
    await s.page.locator('#ocInpPPUsageOPD').fill('100');
    // Correcting OPD must also clear the warning on the dental/IPD partner; otherwise a valid retry stays blocked.
    for (const selector of ['#ocInpPPUsageOPD', '[data-field-key="PPUsageIPD"]']) {
        assert.equal(await s.page.locator(selector).evaluate(e => e.validity.valid), true);
        assert.equal(await s.page.locator(selector).getAttribute('aria-invalid'), null);
    }
    assert.equal(await s.page.evaluate(() => {
        let submitted = false;
        document.querySelector('form').addEventListener('submit', e => { e.preventDefault(); submitted = true; }, { once: true });
        document.querySelector('form').requestSubmit(); return submitted;
    }), true);
    assert.deepEqual(await layoutProblems(s.page), []); assert.deepEqual(s.problems, []);
});
test('budget guard loads after dynamic authFetch config and before forms; no layout modifications', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../search.html'), 'utf8');
    const config = html.indexOf("await loadScript('assets/js/core/config.js')");
    const guard = html.indexOf("await loadScript('assets/js/pages/insurance-budget-guard.js");
    assert.ok(config > 0 && guard > config && guard < html.indexOf('const sessionResponse', config));
    const js = fs.readFileSync(path.resolve(__dirname, '../../assets/js/pages/insurance-budget-guard.js'), 'utf8');
    assert.doesNotMatch(js, /\.style|insertAdjacentHTML|innerHTML|overflow\s*:|position\s*:/);
});
