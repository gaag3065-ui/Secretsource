// ค่าใช้จ่ายรายเดือน (น้ำ/ไฟ/แก๊ส/อื่นๆ) · รอบจ่ายค่าเช่าล่วงหน้า · รอบล้างแอร์ · แจ้งยกเลิกเช่าล่วงหน้า 3 เดือน — /api/accommodation-rooms/expenses
// สีบอกสถานะทันที: เขียว = จ่าย/ทำแล้ว · แดง = ยังไม่จ่าย/เลยกำหนด · เหลือง = ใกล้ถึงกำหนด · เทา = ไม่มี/ยังไม่ถึงเวลา — มีแถบแจ้งเตือนสรุปด้านบน
(() => {
    const root = document.getElementById('roomExpenses');
    if (!root) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms/expenses`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const state = { data: null, month: '', filter: 'all', loading: false, cells: [] };
    const DAY = 86400000;
    const MONTH_CATS = ['water', 'electric', 'gas', 'gas_recv', 'other'];
    const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    // ---------------------------------------------------------------- วันที่
    const parseDmy = text => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim()); if (!m) return null; const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); };
    const parseIso = text => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
    const iso = d => d.toISOString().slice(0, 10);
    const dmy = d => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    const addMonths = (d, n) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d.getUTCDate(), last)); return t; };
    const daysBetween = (a, b) => Math.round((b - a) / DAY);
    const monthLabel = m => { const [y, mo] = m.split('-').map(Number); return `${MONTH_NAMES[mo - 1]} ${y + 543}`; };
    const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };

    async function request(url, options) {
        const response = await window.authFetch(url, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลห้องพัก');
        if (!response.ok || !data.success) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    async function load() {
        if (state.loading) return;
        state.loading = true;
        if (!state.data) root.innerHTML = '<div class="rx-head"><h2>ค่าใช้จ่ายและรอบกำหนด</h2></div><p class="rx-empty">กำลังโหลด…</p>';
        try {
            state.data = await request(`${API}?month=${encodeURIComponent(state.month)}`);
            state.month = state.data.month;
            render();
        } catch (error) { root.innerHTML = `<div class="rx-head"><h2>ค่าใช้จ่ายและรอบกำหนด</h2></div><p class="rx-empty rx-error">${esc(error.message)}</p>`; }
        finally { state.loading = false; }
    }

    // ---------------------------------------------------------------- สถานะของแต่ละช่อง → { tone, text, sub, alert, edit:{cat,period,rec} }
    const recFor = (cat, period) => (state.data.records || []).find(x => x.cat === cat && x.period === period);
    const recsOf = (no, cat, period) => (state.data.records || []).find(x => x.no === no && x.cat === cat && x.period === period);
    function monthCell(u, cat) {
        const rec = recsOf(u.no, cat, state.month);
        const current = state.data.today.slice(0, 7);
        const future = state.month > current;
        const def = state.data.cats[cat];
        const money = rec?.amount ? `฿${num(rec.amount)}` : '';
        if (cat === 'gas_recv') {
            const gas = recsOf(u.no, 'gas', state.month);
            if (gas?.status === 'ไม่มีรายการ' && !rec) return { tone: 'na', text: '–', edit: { u, cat, period: state.month, rec } };
        }
        if (!rec) return future ? { tone: 'na', text: '–', edit: { u, cat, period: state.month, rec } } : { tone: cat === 'gas_recv' ? 'warn' : 'bad', text: def.states[1], alert: cat, edit: { u, cat, period: state.month, rec } };
        const done = rec.status === def.states[0];
        return { tone: rec.status === 'ไม่มีรายการ' ? 'na' : done ? 'ok' : (cat === 'gas_recv' ? 'warn' : 'bad'), text: rec.status === 'ไม่มีรายการ' ? '–' : (done ? '✓ ' : '') + rec.status, sub: [money, rec.date].filter(Boolean).join(' · '), alert: done || rec.status === 'ไม่มีรายการ' ? '' : cat, edit: { u, cat, period: state.month, rec } };
    }
    // รอบ (ค่าเช่าล่วงหน้า / ล้างแอร์): ครบกำหนดทุก N เดือนนับจากวันเริ่ม — ดูรอบล่าสุดที่ถึง (หรือใกล้ถึงภายใน 30 วัน)
    function cycleCell(u, cat, cycle) {
        const today = parseIso(state.data.today);
        const start = parseDmy(cycle.start);
        if (!start || !cycle.months) return { tone: 'na', text: 'ยังไม่ตั้งรอบ', edit: null };
        let k = 0;
        while (addMonths(start, (k + 1) * cycle.months) <= new Date(today.getTime() + 30 * DAY)) k++;
        const due = addMonths(start, k * cycle.months);
        const next = addMonths(start, (k + 1) * cycle.months);
        const rec = recsOf(u.no, cat, iso(due));
        const doneWord = state.data.cats[cat].states[0];
        const edit = { u, cat, period: iso(due), rec, due };
        const head = `รอบ ${dmy(due)}`;
        if (due > new Date(today.getTime() + 30 * DAY)) return { tone: 'na', text: `ถัดไป ${dmy(due)}`, sub: `ทุก ${cycle.months} เดือน`, edit };
        if (rec && rec.status === doneWord) return { tone: 'ok', text: `✓ ${doneWord}`, sub: `${head} · ถัดไป ${dmy(next)}`, edit };
        const days = daysBetween(today, due);
        if (days < 0) return { tone: 'bad', text: `เลยกำหนด ${-days} วัน`, sub: `${head} · ${state.data.cats[cat].states[1]}`, alert: cat + ':over', edit };
        return { tone: 'warn', text: days === 0 ? 'ครบกำหนดวันนี้' : `อีก ${days} วัน`, sub: `${head} · ${state.data.cats[cat].states[1]}`, alert: cat + ':soon', edit };
    }
    // สัญญาเช่า: ต้องแจ้งยกเลิกล่วงหน้า 3 เดือนก่อนหมดสัญญา
    function noticeCell(u) {
        const today = parseIso(state.data.today);
        const end = parseDmy(u.end);
        if (!end) return { tone: 'na', text: 'ไม่มีวันสิ้นสุดสัญญา', edit: null };
        const deadline = addMonths(end, -3);
        const rec = recsOf(u.no, 'notice', iso(end));
        const edit = { u, cat: 'notice', period: iso(end), rec, due: deadline };
        const sub = `หมดสัญญา ${dmy(end)}`;
        if (rec && rec.status === 'แจ้งแล้ว') return { tone: 'ok', text: '✓ แจ้งยกเลิกแล้ว', sub, edit };
        if (today > end) return { tone: 'bad', text: 'หมดสัญญาแล้ว', sub, alert: 'notice:over', edit };
        const toDeadline = daysBetween(today, deadline);
        if (toDeadline <= 0) return { tone: 'bad', text: `ถึงกำหนดแจ้งยกเลิก (เหลือ ${daysBetween(today, end)} วันก่อนหมดสัญญา)`, sub: `ต้องแจ้งภายใน ${dmy(deadline)} · ${sub}`, alert: 'notice:due', edit };
        if (toDeadline <= 30) return { tone: 'warn', text: `ต้องแจ้งภายใน ${toDeadline} วัน`, sub: `${dmy(deadline)} · ${sub}`, alert: 'notice:soon', edit };
        return { tone: 'na', text: sub, sub: `แจ้งยกเลิกภายใน ${dmy(deadline)}`, edit };
    }

    // ---------------------------------------------------------------- แสดงผล
    function render() {
        const d = state.data;
        const units = d.units.filter(u => u.status === 'ทำสัญญาแล้ว');
        state.cells = [];
        const rows = units.map(u => {
            const cells = {};
            for (const cat of MONTH_CATS) cells[cat] = monthCell(u, cat);
            cells.rent_adv = cycleCell(u, 'rent_adv', u.rentCycle);
            cells.aircon = cycleCell(u, 'aircon', u.airCycle);
            cells.notice = noticeCell(u);
            const flagged = Object.values(cells).some(c => c.alert);
            return { u, cells, flagged };
        });
        // แจ้งเตือนสรุป
        const count = pred => rows.reduce((n, r) => n + Object.values(r.cells).filter(pred).length, 0);
        const labelOf = cat => d.cats[cat].label;
        const unpaid = cat => rows.filter(r => r.cells[cat].alert === cat).length;
        const alerts = [];
        const unpaidList = MONTH_CATS.filter(c => c !== 'gas_recv').map(c => [c, unpaid(c)]).filter(([, n]) => n);
        if (unpaidList.length) alerts.push(['bad', `ค่าใช้จ่ายเดือน ${monthLabel(state.month)} ที่ยังไม่จ่าย ${unpaidList.reduce((n, [, v]) => n + v, 0)} รายการ — ${unpaidList.map(([c, n]) => `${labelOf(c)} ${n}`).join(' · ')}`, 'unpaid']);
        if (unpaid('gas_recv')) alerts.push(['warn', `ยังไม่ได้รับค่าแก๊สจากพนักงาน ${unpaid('gas_recv')} ยูนิต`, 'unpaid']);
        for (const [cat, name] of [['rent_adv', 'ค่าเช่าล่วงหน้า'], ['aircon', 'ล้างแอร์']]) {
            const over = rows.filter(r => r.cells[cat].alert === cat + ':over').length, soon = rows.filter(r => r.cells[cat].alert === cat + ':soon').length;
            if (over) alerts.push(['bad', `เลยกำหนด${name} ${over} ยูนิต`, 'cycle']);
            if (soon) alerts.push(['warn', `ใกล้ถึงกำหนด${name} (ภายใน 30 วัน) ${soon} ยูนิต`, 'cycle']);
        }
        const nDue = rows.filter(r => ['notice:due', 'notice:over'].includes(r.cells.notice.alert)).length, nSoon = rows.filter(r => r.cells.notice.alert === 'notice:soon').length;
        if (nDue) alerts.push(['bad', `ถึงกำหนดแจ้งยกเลิกเช่า (ล่วงหน้า 3 เดือน) ${nDue} ยูนิต`, 'notice']);
        if (nSoon) alerts.push(['warn', `ใกล้ถึงกำหนดแจ้งยกเลิกเช่า (ภายใน 30 วัน) ${nSoon} ยูนิต`, 'notice']);
        const shown = state.filter === 'all' ? rows : rows.filter(r => r.flagged);
        const chipHtml = (c, key) => {
            if (!c.edit) return `<span class="rx-chip is-${c.tone}">${esc(c.text)}</span>`;
            state.cells.push(c.edit);
            return `<button type="button" class="rx-chip is-${c.tone}" data-rx-cell="${state.cells.length - 1}" title="กดเพื่อบันทึก/แก้ไข"><b>${esc(c.text)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</button>`;
        };
        root.innerHTML = `
            <div class="rx-head">
                <div><h2>ค่าใช้จ่ายและรอบกำหนด</h2><p>เฉพาะยูนิตที่ทำสัญญาแล้ว ${num(units.length)} ยูนิต · บันทึกลงแท็บ "ค่าใช้จ่ายและรอบกำหนด" ในไฟล์ทะเบียนที่พัก · กดที่ช่องเพื่อบันทึกว่าจ่าย/ทำแล้ว</p></div>
                <div class="rx-tools">
                    <div class="rx-month"><button type="button" data-rx-month="-1" aria-label="เดือนก่อน">‹</button><b>${esc(monthLabel(state.month))}</b><button type="button" data-rx-month="1" aria-label="เดือนถัดไป">›</button></div>
                    <button type="button" class="rx-btn" data-rx-filter="${state.filter === 'all' ? 'flag' : 'all'}">${state.filter === 'all' ? '⚠ เฉพาะที่ต้องดำเนินการ' : 'แสดงทั้งหมด'}</button>
                    <button type="button" class="rx-btn" data-rx-reload>รีเฟรช</button>
                </div>
            </div>
            <div class="rx-alerts ${alerts.length ? 'has-alert' : ''}" role="status">
                ${alerts.length ? `<b>🔔 แจ้งเตือน</b><ul>${alerts.map(([tone, text]) => `<li class="is-${tone}">${esc(text)}</li>`).join('')}</ul>` : '<b>✅ ไม่มีรายการค้าง — ค่าใช้จ่ายเดือนนี้ รอบกำหนด และการแจ้งยกเลิกเช่าเรียบร้อย</b>'}
            </div>
            <div class="rx-legend"><span class="is-ok">เขียว จ่าย/ทำแล้ว</span><span class="is-bad">แดง ยังไม่จ่าย / เลยกำหนด</span><span class="is-warn">เหลือง ใกล้ถึงกำหนด / รอรับ</span><span class="is-na">เทา ไม่มี / ยังไม่ถึงเวลา</span></div>
            <div class="rx-wrap"><table class="rx-table">
                <thead><tr><th>ที่พัก / ยูนิต</th><th>ค่าเช่า/เดือน</th><th colspan="5" class="rx-group">รายเดือน — ${esc(monthLabel(state.month))}</th><th colspan="2" class="rx-group">รอบ (ตามที่ตั้งไว้ในทะเบียน)</th><th class="rx-group">สัญญาเช่า (รายปี)</th></tr>
                    <tr class="rx-sub"><th></th><th></th>${MONTH_CATS.map(c => `<th>${esc(labelOf(c))}</th>`).join('')}<th>รอบจ่ายค่าเช่าล่วงหน้า</th><th>รอบล้างแอร์</th><th>แจ้งยกเลิกเช่าล่วงหน้า 3 เดือน</th></tr></thead>
                <tbody>${shown.map(r => `<tr class="${r.flagged ? 'is-flag' : ''}"><td><b>${esc(r.u.project)}</b><small>${esc(r.u.unit)} · ลำดับ ${esc(r.u.no)}</small></td><td>${r.u.rent ? num(r.u.rent) : '-'}</td>
                    ${MONTH_CATS.map(c => `<td>${chipHtml(r.cells[c])}</td>`).join('')}<td>${chipHtml(r.cells.rent_adv)}</td><td>${chipHtml(r.cells.aircon)}</td><td>${chipHtml(r.cells.notice)}</td></tr>`).join('') || `<tr><td colspan="10" class="rx-empty">${rows.length ? 'ไม่มีรายการที่ต้องดำเนินการ 🎉' : 'ยังไม่มียูนิตที่ทำสัญญาแล้ว'}</td></tr>`}</tbody>
            </table></div>`;
        // สรุปให้หน้าภาพรวม (accommodation-dashboard.js)
        const tally = cat => { const cells = rows.map(r => r.cells[cat]).filter(c => c.tone === 'ok' || c.tone === 'bad'); return [d.cats[cat].label, cells.filter(c => c.tone === 'ok').length, cells.length]; };
        const cats = ['water', 'electric', 'gas', 'other'].map(tally);
        const stats = { monthLabel: monthLabel(state.month), cats, paid: cats.reduce((n, c) => n + c[1], 0), total: cats.reduce((n, c) => n + c[2], 0),
            unpaid: ['water', 'electric', 'gas', 'other'].reduce((n, c) => n + unpaid(c), 0), gasPending: unpaid('gas_recv'),
            rentOver: rows.filter(r => r.cells.rent_adv.alert === 'rent_adv:over').length, rentSoon: rows.filter(r => r.cells.rent_adv.alert === 'rent_adv:soon').length,
            airOver: rows.filter(r => r.cells.aircon.alert === 'aircon:over').length, airSoon: rows.filter(r => r.cells.aircon.alert === 'aircon:soon').length, noticeDue: nDue, noticeSoon: nSoon };
        window.__rxStats = stats;
        window.dispatchEvent(new CustomEvent('ro-expense-alerts', { detail: { count: alerts.length, alerts: alerts.map(a => a[1]), stats } }));
    }

    // ---------------------------------------------------------------- กล่องบันทึก
    const dialog = document.createElement('dialog');
    dialog.className = 'rx-dialog';
    root.after(dialog);
    function openCell(index) {
        const c = state.cells[index];
        if (!c) return;
        const def = state.data.cats[c.cat];
        const hasAmount = def.kind === 'month' || c.cat === 'rent_adv';
        const rec = c.rec;
        const title = def.label + ' — ' + c.u.project + ' ' + c.u.unit + ' · ' + (def.kind === 'month' ? monthLabel(c.period) : c.cat === 'notice' ? 'สัญญาหมด ' + dmy(parseIso(c.period)) : 'รอบ ' + dmy(parseIso(c.period)));
        const today = dmy(parseIso(state.data.today));
        dialog.innerHTML = `<form data-rx-form="${index}"><h3>${esc(title)}</h3>
            <label>สถานะ<select name="status">${def.states.map(s => `<option ${s === (rec?.status || def.states[0]) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
            ${hasAmount ? `<label>จำนวนเงิน (บาท)<input name="amount" inputmode="decimal" value="${esc(rec?.amount || '')}" placeholder="เช่น 1,250"></label>` : ''}
            <label>วันที่ (วัน/เดือน/ปี)<input name="date" value="${esc(rec?.date || today)}"></label>
            <label>หมายเหตุ<input name="note" maxlength="200" value="${esc(rec?.note || '')}"></label>
            <p class="rx-hint">${rec ? 'บันทึกล่าสุดโดย ' + esc(rec.by) + ' ' + esc(rec.at) : 'ยังไม่เคยบันทึก'}</p>
            <p class="rx-msg" role="status"></p>
            <div class="rx-actions"><button type="submit" class="rx-btn rx-primary">บันทึก</button><button type="button" class="rx-btn" data-rx-close>ยกเลิก</button></div></form>`;
        if (!dialog.open) dialog.showModal();
    }
    dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-rx-close]')) dialog.close(); });
    dialog.addEventListener('submit', async event => {
        const form = event.target.closest('[data-rx-form]'); if (!form) return;
        event.preventDefault();
        const c = state.cells[Number(form.dataset.rxForm)];
        const body = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v).trim()]));
        const button = form.querySelector('[type=submit]'); button.disabled = true; button.textContent = 'กำลังบันทึก…';
        try {
            await request(API, { method: 'PUT', body: JSON.stringify({ no: c.u.no, cat: c.cat, period: c.period, ...body }) });
            dialog.close();
            await load();
        } catch (error) { button.disabled = false; button.textContent = 'บันทึก'; const m = form.querySelector('.rx-msg'); m.textContent = error.message; m.className = 'rx-msg is-bad'; }
    });

    root.addEventListener('click', event => {
        const cell = event.target.closest('[data-rx-cell]'); if (cell) return openCell(Number(cell.dataset.rxCell));
        const month = event.target.closest('[data-rx-month]'); if (month) { state.month = shiftMonth(state.month, Number(month.dataset.rxMonth)); load(); return; }
        const filter = event.target.closest('[data-rx-filter]'); if (filter) { state.filter = filter.dataset.rxFilter; render(); return; }
        if (event.target.closest('[data-rx-reload]')) load();
    });
    load();
    setInterval(() => { if (!document.hidden && !dialog.open) load(); }, 5 * 60 * 1000);
})();
