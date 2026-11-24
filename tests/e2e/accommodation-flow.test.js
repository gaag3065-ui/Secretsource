// แท็บ "ติดตามขั้นตอนการดำเนินงานที่พักใหม่": ผังแนวตั้ง (Vertical Stepper) ต้องไม่ซ้อนทับ/ล้นกรอบ ทั้งจอคอมและมือถือ ข้อความยาวต้องไม่ทะลุ และปุ่มทุกตัวต้องเปิดหน้าต่างที่ถูกต้อง
//   ข้อมูลที่ใช้คือข้อมูลจำลองในการทดสอบนี้เท่านั้น (ดักคำขอไปหลังบ้าน) — ไม่แตะข้อมูลจริง
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium, startStaticServer, newSession, layoutProblems, edgePath, API_ORIGIN } = require('./helpers');

const EDGE = edgePath();
const skip = EDGE ? false : 'ไม่พบ Microsoft Edge (ตั้ง EDGE_PATH ได้) — ข้ามการทดสอบรันจริง';
const perms = ['SearchData', 'ManageAccommodation', 'EditAccommodation', 'AccommodationFlow', 'AccommodationExpenses', 'AccommodationStatusNote', 'AccommodationPayments'];
const LONG = 'The Residences at Very-Long-Condominium-Name-Without-Spaces-For-Overflow-Testing-Colombo-03 อาคารชื่อยาวมากสำหรับทดสอบข้อความทะลุกรอบ';
const NOTE = 'หมายเหตุยาวมากสำหรับทดสอบการตัดบรรทัด ส่งให้ทนายส่วนกลางทางอีเมลและรอผู้รับเรื่องตอบกลับพร้อมแนบเอกสารประกอบหลายฉบับ https://example.com/a/very/long/path/that/never/breaks/by/itself/0123456789';
const room = (no, extra = {}) => ({ no, project: LONG, unit: `Unit ${no}-A`, status: 'วางจองแล้ว', rent: 250000, type: '3 ห้องนอน 2 ห้องน้ำ', dH: '1/9/2569', dI: '5/9/2569', dJ: '10/9/2569', dK: '', dL: '', dM: '', dN: '', dO: '', dP: '', dQ: '', ...extra });
const ROOMS = [
    room(1, { dK: '20/9/2569', dL: '1/10/2569' }),
    room(2),
    room(3, { status: 'รอทำสัญญา', dK: '20/9/2569', dL: '1/10/2569', dM: '15/10/2569' }),
    room(4, { status: 'ยกเลิกสัญญา', dK: '20/9/2569', dL: '1/10/2569' }),
    room(5, { dK: '20/9/2569', dL: '1/10/2569', dP: '2/10/2569' })
];
const step = (no, id, o = {}) => ({ no, id, label: '', date: '', note: '', files: [], lane: '', anchor: '', kind: '', custom: false, deleted: false, ...o });
const STEPS = [
    step(1, 'dL', { note: NOTE, files: [{ id: 'f1', name: 'ชื่อไฟล์หลักฐานที่ยาวมากมากมากมากมาก.pdf', mime: 'application/pdf' }] }),
    step(1, 'c1', { custom: true, label: 'ส่งกลับให้เจ้าของบ้านแก้สัญญา (รอบ 1)', date: '3/10/2569', lane: 'side', anchor: 'dL', kind: 'rework', note: NOTE }),
    step(1, 'c2', { custom: true, label: 'ส่งสัญญาให้ส่วนกลางอีกครั้ง (รอบ 1)', date: '8/10/2569', lane: 'side', anchor: 'dL', kind: 'rework' }),
    step(1, 'c3', { custom: true, label: 'ตรวจบ้านก่อนเซ็นสัญญาพร้อมช่างและตัวแทนเจ้าของบ้านที่ชื่อยาวมาก', date: '4/10/2569', lane: 'main', anchor: 'dL' }),
    step(4, 'c9', { custom: true, label: 'ยกเลิกสัญญา', date: '5/10/2569', lane: 'side', anchor: 'dL', kind: 'cancel', note: NOTE })
];

async function open(browser, size) {
    const { server, origin } = await startStaticServer();
    const session = await newSession(browser, size);
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    const calls = [];
    await session.context.route(`${API_ORIGIN}/**`, route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        calls.push(`${req.method()} ${url.pathname}`);
        const json = body => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (url.pathname === '/api/session') return json({ success: true, user: { username: 'admin', name: 'ผู้ดูแล', role: 'ADMIN' }, permissions: Object.fromEntries(perms.map(p => [p, true])), csrfToken: 't' });
        if (url.pathname === '/api/accommodation-rooms/flow') return json({ success: true, steps: STEPS });
        return json({ success: true });
    });
    await session.page.goto(origin + '/accommodation.html');
    await session.page.waitForSelector('.dx-tab', { timeout: 25000 });
    await session.page.evaluate(rooms => window.dispatchEvent(new CustomEvent('ro-data', { detail: { rooms, counts: {} } })), ROOMS);
    await session.page.locator('.dx-tab').nth(3).click();
    await session.page.waitForSelector('#accommodationFlow .fl-card', { timeout: 10000 });
    await session.page.waitForTimeout(800);
    return { ...session, server, calls };
}

// ตรวจเฉพาะในแท็บนี้: ไม่มี absolute / margin ติดลบ · ข้อความไม่ทะลุกรอบการ์ด · แถวขั้นตอนไม่ซ้อนกัน · การ์ดไม่ล้นแนวนอน
const flowProblems = page => page.evaluate(() => {
    const host = document.getElementById('accommodationFlow'), out = [];
    for (const el of host.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.position === 'absolute' || cs.position === 'fixed') out.push(`position:${cs.position} ที่ .${el.className}`);
        if ([cs.marginLeft, cs.marginRight, cs.marginTop, cs.marginBottom].some(v => parseFloat(v) < 0)) out.push(`margin ติดลบที่ .${el.className}`);
    }
    for (const card of host.querySelectorAll('.fl-card')) {
        const c = card.getBoundingClientRect();
        for (const el of card.querySelectorAll('.fl-row, .fl-label, .fl-date, .fl-note, .fl-ev, .fl-gap, .fl-wait, .fl-decision, .fl-group, .fl-plus, h3, .fl-status')) {
            const r = el.getBoundingClientRect();
            if (r.width && (r.right > c.right + 1 || r.left < c.left - 1)) out.push(`ทะลุกรอบการ์ด: .${el.className} (${Math.round(r.right - c.right)}px)`);
        }
        const rows = [...card.querySelectorAll('.fl-row')].map(e => e.getBoundingClientRect());
        for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
            const a = rows[i], b = rows[j];
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) out.push('แถวขั้นตอนซ้อนกัน');
        }
        // ซ้าย/ขวาในแถวเดียวกันต้องไม่ซ้อนกัน
        for (const row of card.querySelectorAll('.fl-row')) {
            const m = row.querySelector('.fl-main')?.getBoundingClientRect(), a = row.querySelector('.fl-act')?.getBoundingClientRect();
            if (m && a && Math.min(m.right, a.right) - Math.max(m.left, a.left) > 1 && Math.min(m.bottom, a.bottom) - Math.max(m.top, a.top) > 1) out.push('คอลัมน์ซ้าย/ขวาซ้อนกัน');
        }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 2) out.push(`หน้าล้นแนวนอน ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    return [...new Set(out)];
});

for (const [name, size] of [['จอคอม 1440', { width: 1440, height: 900 }], ['จอแท็บเล็ต 820', { width: 820, height: 1000 }], ['มือถือ 390', { width: 390, height: 844, mobile: true }]]) {
    test(`ผังติดตามขั้นตอน (${name}): ไม่ซ้อนทับ/ไม่ทะลุกรอบ · ไม่มี error`, { skip }, async () => {
        const browser = await chromium.launch({ executablePath: EDGE, headless: true });
        let ctx;
        try {
            ctx = await open(browser, size);
            const { page, problems } = ctx;
            assert.equal(await page.locator('.fl-card').count(), 5);
            assert.deepEqual(await flowProblems(page), [], 'พบปัญหาเลย์เอาต์ในผัง');
            assert.deepEqual(await layoutProblems(page, { overflow: true }), [], 'ปุ่ม/ช่องกรอกซ้อนกันหรือหน้าล้น');
            // ซ้าย/ขวา: ปุ่มแนบหลักฐานอยู่ในคอลัมน์ขวาของแถว และรายละเอียดอยู่คอลัมน์ซ้าย
            const cols = await page.evaluate(() => { const row = document.querySelector('.fl-row'); return { main: !!row.querySelector('.fl-main .fl-label'), ev: !!row.querySelector('.fl-act .fl-ev') }; });
            assert.deepEqual(cols, { main: true, ev: true });
            if (name.startsWith('จอคอม')) if (process.env.FLOW_SHOT) await page.locator('.fl-card').first().screenshot({ path: process.env.FLOW_SHOT });
            assert.deepEqual(problems, [], 'Console error: ' + problems.join(' | '));
        } finally { await ctx?.context.close(); await browser.close(); ctx?.server.close(); }
    });
}

test('ผังติดตามขั้นตอน: ปุ่มกล่อง / แนบหลักฐาน / ＋ เพิ่มขั้น / สัญญาต้องแก้ไข? เปิดหน้าต่างที่ถูกต้อง และกรอง/ค้นหาทำงาน', { skip }, async () => {
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    let ctx;
    try {
        ctx = await open(browser, { width: 1440, height: 900 });
        const { page, problems } = ctx;
        const dialogTitle = () => page.evaluate(() => document.querySelector('.fl-dialog[open] h3')?.textContent.trim() || '');
        const closeDlg = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.fl-dialog[open]')); };
        // ปุ่มรายละเอียดของขั้น (ซ้าย) และปุ่มแนบหลักฐาน (ขวา) เปิดหน้าต่างเดียวกัน
        await page.locator('.fl-card').first().locator('button.fl-main[data-step="dH"]').click();
        assert.match(await dialogTitle(), /./); await closeDlg();
        await page.locator('.fl-card').first().locator('button.fl-ev[data-step="dH"]').click();
        assert.equal(await page.locator('.fl-dialog[open] input[type=date]').count(), 1);
        assert.equal(await page.locator('.fl-dialog[open] [data-upload]').count(), 1); await closeDlg();
        // ปุ่ม ＋
        await page.locator('.fl-card').first().locator('.fl-plus').first().click();
        assert.match(await dialogTitle(), /เพิ่มขั้นตอนเสริม/); await closeDlg();
        // ข้อ "สัญญาต้องแก้ไข?"
        await page.locator('.fl-card').first().locator('.fl-decide').click();
        assert.match(await dialogTitle(), /สัญญาต้องแก้ไขไหม/);
        assert.equal(await page.locator('.fl-dialog[open] [data-rework]').count(), 1); await closeDlg();
        // ยูนิตที่ยกเลิกแล้ว: ผังจบที่ข้อสัญญาต้องแก้ไข และไม่มีป้าย "เซ็นสัญญา ✔"
        const cancelled = page.locator('.fl-card', { hasText: 'Unit 4-A' });
        assert.equal(await cancelled.locator('.fl-end').count(), 0);
        assert.equal(await cancelled.locator('.fl-row.is-cancel').count(), 1);
        // ตัวกรองสถานะและช่องค้นหา
        await page.locator('[data-fl-filter="รอทำสัญญา"]').click();
        assert.equal(await page.locator('.fl-card').count(), 1);
        await page.locator('[data-fl-filter="all"]').click();
        await page.locator('[data-fl-q]').fill('Unit 2-A');
        assert.equal(await page.locator('.fl-card').count(), 1);
        await page.locator('[data-fl-q]').fill('ไม่มีที่พักนี้');
        assert.equal(await page.locator('.fl-card').count(), 0);
        assert.match(await page.locator('.fl-empty').innerText(), /ไม่พบยูนิต/);
        assert.deepEqual(problems, [], 'Console error: ' + problems.join(' | '));
    } finally { await ctx?.context.close(); await browser.close(); ctx?.server.close(); }
});
