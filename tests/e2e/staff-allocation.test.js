// จัดการพนักงาน: เงื่อนไขประจำกล่องงาน → กำหนดให้พนักงาน → กรองตามเงื่อนไข → จัดสรรสิ่งของ (สต็อก/คงเหลือสด) → บันทึก → โหลดหน้าใหม่ข้อมูลไม่หาย
// หลังบ้านจำลองในหน่วยความจำ (ไม่แตะ Google/ชีตจริง) · ตรวจเลย์เอาต์ทั้งคอมและมือถือ + คอลัมน์ชื่อตรึงซ้ายเมื่อเลื่อนตาราง
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium, startStaticServer, newSession, layoutProblems, edgePath, USERS } = require('./helpers');

const EDGE = edgePath();
const skip = EDGE ? false : 'ไม่พบ Microsoft Edge (ตั้ง EDGE_PATH ได้) — ข้ามการทดสอบรันจริง';
const PEOPLE = [['E1', 'สมชาย ใจดี', 'ชาย'], ['E2', 'สมหญิง รักงาน', 'หญิง'], ['E3', 'วิชัย มั่นคง', 'วิ'], ['E4', 'ไม่มีงาน คนนี้', 'ไม่มี']];
const employees = PEOPLE.map(([key, fullname, nickname], i) => ({ key, row: i + 5, fullname, nickname, employeeId: key, centralId: key, insuranceCode: `IC${i}`, company: 'GA East', status: 'on work', area: 'PP', building: 'A', floor: '1', room: String(100 + i), size: 'L', contracts: 0, contractText: '-' }));
const tasks = ['E1', 'E2', 'E3'].map((key, i) => ({ id: i + 1, employee_key: key, fullname: employees[i].fullname, company: 'GA East', title: 'ฝากของ GE', detail: '', category: 'งานทั่วไป', priority: 'ปกติ', status: 'assigned', status_label: 'มอบหมายแล้ว', note: '',
    acknowledged_at: '', created_by: 'admin', created_at: '2026-11-20T00:00:00Z', box: 'c1', box_title: 'ฝากของ GE', kind: 'info', kind_label: 'งานเก็บข้อมูล', fields: [{ id: 'f1', label: 'ไซส์เสื้อ' }, { id: 'f2', label: 'ที่อยู่จัดส่ง' }], uploads: [], response: { f1: 'L', f2: i === 0 ? '123/4 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110' : '' }, files: [], submitted_at: i === 2 ? '' : '2026-11-21T00:00:00Z', dest: null }));

// หลังบ้านจำลอง: ทำตามกติกาเดียวกับ modules/staff/allocation.routes.js (สมาชิกกล่อง = คนที่มีงานในกล่อง)
function createBackend() {
    const db = { conds: [], assign: {}, items: [], allocs: new Map() };
    const members = new Set(tasks.map(t => t.employee_key));
    const view = () => ({ conds: db.conds, assign: { ...db.assign }, items: db.items,
        allocs: [...db.allocs].filter(([, q]) => q > 0).map(([key, qty]) => { const [employee_key, item_id] = key.split('|'); return { item_id, employee_key, qty }; }) });
    return (method, path, body) => {
        const fail = message => ({ status: 400, body: { success: false, message } });
        const ok = extra => ({ status: 200, body: { success: true, allocation: view(), ...extra } });
        if (method === 'GET' && path === '/allocation') return ok();
        if (method === 'POST' && path === '/conditions') {
            if (db.conds.some(c => c.name === body.name)) return fail('มีเงื่อนไขชื่อนี้ในกล่องงานนี้แล้ว');
            db.conds.push({ id: String(db.conds.length + 1), name: body.name, color: ['#2563eb', '#db2777', '#0d9488'][db.conds.length % 3] }); return ok();
        }
        if (method === 'PUT' && path === '/assign') {
            if (body.assignments.some(a => !members.has(a.employee_key))) return fail('พนักงานคนนี้ไม่ได้อยู่ในกล่องงานนี้');
            body.assignments.forEach(a => { if (a.cond_id) db.assign[a.employee_key] = a.cond_id; else delete db.assign[a.employee_key]; }); return ok();
        }
        if (method === 'POST' && path === '/items') { db.items.push({ id: String(db.items.length + 1), name: body.name, stock: Number(body.stock) }); return ok(); }
        const edit = /^\/items\/(\d+)$/.exec(path);
        const del = /^\/items\/(\d+)\/delete$/.exec(path);
        if (method === 'POST' && del) { db.items = db.items.filter(i => i.id !== del[1]); return ok(); }
        if (method === 'PUT' && edit) { Object.assign(db.items.find(i => i.id === edit[1]), { name: body.name, stock: Number(body.stock) }); return ok(); }
        if (method === 'PUT' && path === '/allocations') {
            body.cells.forEach(c => db.allocs.set(`${c.employee_key}|${c.item_id}`, Number(c.qty))); return ok({ saved: body.cells.length });
        }
        return fail('ไม่รู้จักคำขอ ' + method + ' ' + path);
    };
}

async function open(browser, size, backend, existing) {
    const { server, origin } = existing || await startStaticServer();
    const session = await newSession(browser, size);
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' };
    await session.context.route('http://127.0.0.1:43127/**', route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const send = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (url.pathname === '/api/session') return send(200, { success: true, ...USERS.ADMIN, csrfToken: 'test-csrf' });
        if (url.pathname === '/api/staff/employees') return send(200, { success: true, can: {}, removedBoxes: [], employees, columns: { detail: '', size: 'Size', contract: [] }, statuses: { assigned: 'มอบหมายแล้ว' }, priorities: ['ปกติ'], categories: ['งานทั่วไป'], links: {}, kinds: {}, sections: [],
            boxes: [{ key: 'c1', title: 'ฝากของ GE', icon: '📌', custom: true, scope: 'personal' }], tasks, updatedAt: new Date().toISOString() });
        const m = /^\/api\/staff\/boxes\/c1(\/.*)$/.exec(url.pathname);
        if (m) { let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch { /* GET */ } const r = backend(req.method(), m[1], body); return send(r.status, r.body); }
        return send(200, { success: true });
    });
    session.page.on('dialog', d => d.accept());
    await session.page.goto(origin + '/staff-management.html');
    await session.page.waitForSelector('.sm-box[data-box="c1"]', { timeout: 25000 });
    return { ...session, server, origin };
}

for (const [name, size] of [['คอมพิวเตอร์', { width: 1440, height: 900 }], ['จอขนาดกลาง', { width: 1024, height: 768 }],['มือถือ', { width: 390, height: 844, mobile: true }]]) {
    test(`เงื่อนไข + จัดสรรสิ่งของบน${name}: สร้าง → กำหนด → กรอง → จัดสรร → คงเหลือ → บันทึก → โหลดใหม่ข้อมูลอยู่`, { skip }, async () => {
        const browser = await chromium.launch({ executablePath: EDGE, headless: true });
        const backend = createBackend();
        let s;
        try {
            s = await open(browser, size, backend);
            const { page } = s;
            const rows = () => page.locator('#smRows tr').count();
            assert.equal(await page.locator('#smCondBar').isVisible(), false, 'ยังไม่เลือกกล่องงาน → ไม่แสดงแถบเงื่อนไข');

            // 1) เลือกกล่องงาน → แถบเงื่อนไข (ยังไม่มีเงื่อนไข)
            await page.click('.sm-box[data-box="c1"]');
            await page.waitForSelector('#smCondBar [data-sa="manage"]');
            assert.equal(await rows(), 3, 'กล่อง ฝากของ GE มี 3 คน');
            assert.equal(await page.locator('#smCond').isVisible(), false, 'ยังไม่มีเงื่อนไข → ไม่มีตัวกรองเงื่อนไข');

            // 2) สร้างเทมเพลตเงื่อนไข 2 อัน (ชื่อซ้ำต้องถูกปฏิเสธ)
            await page.click('#smCondBar [data-sa="manage"]');
            for (const n of ['กลุ่ม A - รับของที่ออฟฟิศ', 'กลุ่ม B - ฝากส่งทางแอร์']) {
                await page.fill('.sa-dialog [data-sa-add] input[name=name]', n);
                await page.press('.sa-dialog [data-sa-add] input[name=name]', 'Enter');
                await page.waitForFunction(t => [...document.querySelectorAll('.sa-dialog .sa-row input')].some(i => i.value === t), n);
            }
            await page.fill('.sa-dialog [data-sa-add] input[name=name]', 'กลุ่ม A - รับของที่ออฟฟิศ');
            await page.press('.sa-dialog [data-sa-add] input[name=name]', 'Enter');
            await page.waitForFunction(() => /มีเงื่อนไขชื่อนี้/.test(document.querySelector('.sa-dialog [data-sa-msg]')?.textContent || ''));
            await page.click('.sa-dialog [data-sa-close]');

            // 3) กำหนดเงื่อนไขรายคนจากรายการเทมเพลต (E1 = A, E2 = B) → ป้ายสีที่แถว
            await page.waitForSelector('select[data-sa-pick="E1"]');
            await page.selectOption('select[data-sa-pick="E1"]', { label: 'กลุ่ม A - รับของที่ออฟฟิศ' });
            await page.waitForSelector('#smRows tr:has(select[data-sa-pick="E1"]) .sa-badge');
            await page.selectOption('select[data-sa-pick="E2"]', { label: 'กลุ่ม B - ฝากส่งทางแอร์' });
            await page.waitForSelector('#smRows tr:has(select[data-sa-pick="E2"]) .sa-badge');
            assert.equal(await page.locator('#smRows .sa-badge').count(), 2);

            assert.deepEqual(await layoutProblems(page, { overflow: true }), [], 'หน้าหลัก (แถบเงื่อนไข + ป้ายในตาราง) ซ้อนทับ/ล้นจอ');

            // 4) ตัวกรองชั้นที่ 2: เฉพาะกลุ่ม A / ยังไม่กำหนด
            const optA = await page.locator('#smCond option', { hasText: 'กลุ่ม A' }).getAttribute('value');
            await page.selectOption('#smCond', optA);
            await page.waitForFunction(() => document.querySelectorAll('#smRows tr').length === 1);
            assert.match(await page.locator('#smRows').innerText(), /สมชาย/);
            await page.selectOption('#smCond', '_none');
            await page.waitForFunction(() => document.querySelectorAll('#smRows tr').length === 1);
            assert.match(await page.locator('#smRows').innerText(), /วิชัย/);
            await page.selectOption('#smCond', '');
            await page.waitForFunction(() => document.querySelectorAll('#smRows tr').length === 3);

            // 5) Modal ตรวจเอกสารของพนักงาน: เปลี่ยนเงื่อนไขจากที่นั่นได้
            await page.click('#smRows tr:has(select[data-sa-pick="E3"]) [data-check]');
            await page.waitForSelector('#smDialog .sa-modal select');
            await page.selectOption('#smDialog .sa-modal select', { label: 'กลุ่ม B - ฝากส่งทางแอร์' });
            await page.waitForFunction(() => document.querySelectorAll('#smRows .sa-badge').length === 3);
            await page.click('#smDialog [data-close]');

            // 6) ตารางจัดสรร: เพิ่มรายการ + สต็อก → กรอกจำนวน → คงเหลือสด / เกิน = แดง
            await page.click('#smCondBar [data-sa="grid"]');
            await page.waitForSelector('.sa-dialog [data-ag-add]');
            for (const [n, st] of [['ซิมการ์ด SL', '3'], ['เสื้อยูนิฟอร์ม', '5']]) {
                await page.fill('.sa-dialog [data-ag-add] input[name=name]', n);
                await page.fill('.sa-dialog [data-ag-add] input[name=stock]', st);
                await page.press('.sa-dialog [data-ag-add] input[name=stock]', 'Enter');
                await page.waitForSelector(`.sa-dialog .sa-item b:text("${n}")`);
            }
            const sum = i => page.locator(`.sa-dialog [data-sum="${i}"]`).innerText();
            assert.match(await sum(1), /สต็อก 3 · แจก 0 · เหลือ 3/);
            await page.fill('input[data-q="E1"][data-i="1"]', '2');
            await page.fill('input[data-q="E2"][data-i="1"]', '2');
            assert.match(await sum(1), /แจก 4 · เกิน 1/, 'แจกเกินสต็อก → แจ้งเกิน');
            assert.equal(await page.locator('.sa-dialog [data-sum="1"].is-over').count(), 1, 'ตัวเลขเกินเป็นสีแดง (is-over)');
            assert.match(await page.locator('.sa-dialog [data-ag-msg]').innerText(), /แจกเกินสต็อก/);
            await page.fill('input[data-q="E2"][data-i="1"]', '1');
            assert.match(await sum(1), /แจก 3 · เหลือ 0/);
            await page.click('button[data-tick][data-q="E3"][data-i="2"]');   // ✓ = 1 ชิ้น
            await page.fill('input[data-q="E1"][data-i="2"]', '2');
            assert.match(await sum(2), /แจก 3 · เหลือ 2/);
            assert.equal((await page.locator('[data-kinds="E1"]').innerText()).trim(), '2', 'E1 ได้ 2 รายการ');
            assert.equal((await page.locator('[data-pieces="E1"]').innerText()).trim(), '4', 'E1 ได้ 4 ชิ้น');
            assert.match(await page.locator('.sa-dialog [data-ag-dirty]').innerText(), /ยังไม่ได้บันทึก 4 ช่อง/);

            // ลบรายการที่มีช่องค้างยังไม่บันทึก → ช่องของรายการนั้นต้องหายจากยอดค้าง (ไม่งั้นบันทึกไม่ได้)
            await page.fill('.sa-dialog [data-ag-add] input[name=name]', 'ชั่วคราว');
            await page.press('.sa-dialog [data-ag-add] input[name=name]', 'Enter');
            await page.waitForSelector('.sa-dialog .sa-item b:text("ชั่วคราว")');
            await page.fill('input[data-q="E1"][data-i="3"]', '1');
            assert.match(await page.locator('.sa-dialog [data-ag-dirty]').innerText(), /ยังไม่ได้บันทึก 5 ช่อง/);
            await page.click('.sa-dialog [data-item="3"] [data-idel]');
            await page.waitForFunction(() => !document.querySelector('.sa-dialog [data-item="3"]'));
            assert.match(await page.locator('.sa-dialog [data-ag-dirty]').innerText(), /ยังไม่ได้บันทึก 4 ช่อง/, 'ช่องของรายการที่ลบต้องถูกตัดออก');

            // ตารางกว้างเลื่อนได้ + คอลัมน์ชื่อตรึงซ้าย + ไม่มีอะไรซ้อนทับ/ล้นจอ
            const sticky = await page.evaluate(() => {
                const box = document.querySelector('.sa-scroll'), th = box.querySelector('tbody .sa-who');
                box.scrollLeft = 120; box.scrollTop = 0;
                return { canScroll: box.scrollWidth > box.clientWidth, left: Math.round(th.getBoundingClientRect().left - box.getBoundingClientRect().left), pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 2 };
            });
            assert.ok(sticky.left <= 2 && sticky.left >= -2, `คอลัมน์ชื่อต้องตรึงซ้ายขณะเลื่อน (left=${sticky.left})`);
            assert.equal(sticky.pageOverflow, false, 'หน้าห้ามล้นแนวนอน');
            if (size.mobile) assert.ok(sticky.canScroll, 'มือถือ: ตารางต้องเลื่อนแนวนอนได้');
            // ตรวจเฉพาะองค์ประกอบในหน้าต่างจัดสรร (หน้าเว็บด้านหลังโมดอลถูกบังอยู่แล้ว จึงซ่อนไว้ชั่วคราวไม่ให้ตัวตรวจนับซ้อน)
            await page.evaluate(() => { document.querySelector('main.fa-page').style.visibility = 'hidden'; });
            const overlaps = await layoutProblems(page, { overflow: true });
            await page.evaluate(() => { document.querySelector('main.fa-page').style.visibility = ''; });
            assert.deepEqual(overlaps, [], 'ตารางจัดสรรซ้อนทับ/ล้นจอ');

            // 7) บันทึกทั้งหมด (ยืนยันกรณีเกินสต็อกอัตโนมัติ) → ไม่เหลือสถานะค้าง
            // สรุปสต็อกด้านบน (pill): แดง = หมด/เกิน · ส้ม = เหลือ < 20% · ปกติ = เขียว
            const pill = n => page.locator('.sa-pills .sa-pill', { hasText: n });
            assert.match(await pill('ซิมการ์ด SL').innerText(), /เหลือ 0 \/ 3/);
            assert.match(await pill('ซิมการ์ด SL').getAttribute('class'), /is-out/);
            assert.match(await pill('เสื้อยูนิฟอร์ม').innerText(), /เหลือ 2 \/ 5/);
            assert.match(await pill('เสื้อยูนิฟอร์ม').getAttribute('class'), /is-ok/);
            await page.fill('.sa-side [data-item="2"] [data-istock]', '6'); await page.press('.sa-side [data-item="2"] [data-istock]', 'Tab');
            await page.waitForFunction(() => /เหลือ 3 \/ 6/.test(document.querySelector('.sa-pills')?.textContent || ''));
            await page.fill('input[data-q="E2"][data-i="2"]', '2');   // แจกรวม 5 จาก 6 → เหลือ 1 (< 20%)
            assert.match(await pill('เสื้อยูนิฟอร์ม').innerText(), /เหลือ 1 \/ 6/);
            assert.match(await pill('เสื้อยูนิฟอร์ม').getAttribute('class'), /is-low/);
            // ป้ายของที่แต่ละคนได้ใต้ชื่อ (สด) + ปุ่ม − ＋ + ไฮไลต์ช่องที่มีของ
            const got = k => page.locator(`tr[data-emp="${k}"] [data-got]`).innerText();
            assert.match(await got('E1'), /ซิมการ์ด SL ×2/); assert.match(await got('E1'), /เสื้อยูนิฟอร์ม ×2/);
            assert.match(await got('E2'), /ซิมการ์ด SL ×1/);
            assert.equal(await page.locator('tr[data-emp="E3"] [data-got] .sa-gotnone').count(), 0, 'E3 ได้เสื้อ 1 ชิ้นแล้ว');
            await page.click('button[data-step="-1"][data-q="E2"][data-i="1"]');
            assert.equal(await page.inputValue('input[data-q="E2"][data-i="1"]'), '');
            await page.fill('input[data-q="E2"][data-i="2"]', '0');
            assert.match(await got('E2'), /ยังไม่ได้จัดสรร/);
            await page.click('button[data-step="1"][data-q="E2"][data-i="1"]');
            await page.click('button[data-step="1"][data-q="E2"][data-i="1"]');
            assert.equal(await page.inputValue('input[data-q="E2"][data-i="1"]'), '2');
            await page.click('button[data-step="-1"][data-q="E2"][data-i="1"]');
            assert.match(await got('E2'), /ซิมการ์ด SL ×1/);
            assert.equal(await page.locator('tr[data-emp="E1"] td.sa-qty.has-qty').count(), 2, 'ไฮไลต์เฉพาะช่องที่แจกของ');
            assert.equal(await page.locator('tr[data-emp="E1"] td.sa-qty:not(.has-qty)').count(), 0);
            // แผงขวากะทัดรัด: การ์ดรายการไม่สูงเกินจริง · ช่องชื่อสูงมาตรฐาน
            const card = await page.evaluate(() => { const r = document.querySelector('.sa-side [data-item="1"]'); return { h: r.getBoundingClientRect().height, name: r.querySelector('[data-iname]').getBoundingClientRect().height, tag: r.querySelector('[data-iname]').tagName, side: document.querySelector('.sa-side').getBoundingClientRect().width }; });
            assert.ok(card.h <= 110 && card.name <= 40 && card.tag === 'INPUT', `การ์ดรายการสูง ${card.h}, ช่องชื่อ ${card.name}`);
            if (!size.mobile && size.width >= 1000) assert.ok(Math.abs(card.side - 320) <= 2, `แผงขวากว้าง 320px (${card.side})`);

            // ข้อมูลที่พนักงานกรอก: คอลัมน์ไดนามิก + สถานะการกรอก ในแถวเดียวกับช่องจัดสรร
            const e1 = page.locator('tr[data-emp="E1"]'), e3 = page.locator('tr[data-emp="E3"]');
            assert.equal(await page.locator('.sa-table thead th.sa-info:text("ไซส์เสื้อ")').count(), 1);
            assert.equal(await page.locator('.sa-table thead th.sa-info:text("ที่อยู่จัดส่ง")').count(), 1);
            assert.match(await e1.innerText(), /123\/4 ถนนสุขุมวิท/);
            assert.match(await e1.innerText(), /ส่งข้อมูลแล้ว/);
            assert.match(await e3.innerText(), /ยังไม่ส่งข้อมูล/);
            // เลย์เอาต์ 2 ฝั่ง: ตารางซ้ายกว้างกว่าแผงสต็อกขวา (จอกว้าง) · ปุ่มบันทึก/พิมพ์เห็นตลอดในแผงขวา
            const geo = await page.evaluate(() => {
                const r = s => document.querySelector(s).getBoundingClientRect(), main = r('.sa-main'), side = r('.sa-side'), dlg = r('.sa-dialog:has(.sa-wide)'), save = r('[data-ag-save]'), prn = r('[data-ag-print]');
                return { mainW: main.width, sideW: side.width, sideRight: side.left >= main.right - 1, dlgW: dlg.width / innerWidth, dlgH: dlg.height / innerHeight, saveVisible: save.bottom <= innerHeight && prn.bottom <= innerHeight && save.right <= innerWidth };
            });
            if (!size.mobile) { assert.ok(geo.saveVisible, 'ปุ่มบันทึก/พิมพ์ต้องอยู่ในจอ');assert.ok(geo.sideRight && geo.mainW > geo.sideW * 1.5, `ตารางซ้ายต้องกว้างกว่าแผงขวา (${geo.mainW}/${geo.sideW})`); assert.ok(geo.dlgW > 0.9 && geo.dlgW < 0.94 && geo.dlgH < 0.9, `ขนาดหน้าต่าง ${geo.dlgW}/${geo.dlgH}`); }

            await page.click('[data-ag-save]');
            await page.waitForFunction(() => /บันทึกการจัดสรรแล้ว/.test(document.querySelector('.sa-dialog [data-ag-msg]')?.textContent || ''));
            assert.equal((await page.locator('.sa-dialog [data-ag-dirty]').innerText()).trim(), '');
            // แก้สต็อกที่แผงขวา → หัวคอลัมน์ฝั่งซ้ายอัปเดตทันที
            await page.fill('.sa-side [data-item="1"] [data-istock]', '6');
            await page.press('.sa-side [data-item="1"] [data-istock]', 'Tab');
            await page.waitForFunction(() => /สต็อก 6 · แจก 3 · เหลือ 3/.test(document.querySelector('.sa-dialog [data-sum="1"]')?.textContent || ''));
            await page.fill('.sa-side [data-item="1"] [data-istock]', '3');
            await page.press('.sa-side [data-item="1"] [data-istock]', 'Tab');
            await page.waitForFunction(() => /สต็อก 3 · แจก 3 · เหลือ 0/.test(document.querySelector('.sa-dialog [data-sum="1"]')?.textContent || ''));
            await page.click('.sa-dialog [data-ag-close]');
            await page.close();

            // 8) โหลดหน้าเว็บใหม่ทั้งหน้า → เงื่อนไข/สต็อก/จัดสรรยังอยู่
            await s.context.close();
            s = await open(browser, size, backend, { server: s.server, origin: s.origin });
            await s.page.click('.sm-box[data-box="c1"]');
            await s.page.waitForSelector('#smRows .sa-badge');
            assert.equal(await s.page.locator('#smRows .sa-badge').count(), 3, 'ป้ายเงื่อนไขหลังโหลดใหม่');
            await s.page.click('#smCondBar [data-sa="grid"]');
            await s.page.waitForSelector('input[data-q="E1"][data-i="1"]');
            assert.equal(await s.page.inputValue('input[data-q="E1"][data-i="1"]'), '2');
            assert.equal(await s.page.inputValue('input[data-q="E2"][data-i="1"]'), '1');
            assert.equal(await s.page.inputValue('input[data-q="E3"][data-i="2"]'), '1');
            assert.match(await s.page.locator('.sa-dialog [data-sum="1"]').innerText(), /สต็อก 3 · แจก 3 · เหลือ 0/);
            assert.deepEqual(s.problems, [], 'ข้อผิดพลาดในหน้า:\n' + s.problems.join('\n'));
        } finally { await s?.context.close().catch(() => {}); s?.server.close(); await browser.close(); }
    });
}
