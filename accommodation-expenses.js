// ค่าใช้จ่ายรายเดือน (น้ำ/ไฟ/แก๊ส/อื่นๆ) · รอบจ่ายค่าเช่าล่วงหน้า · รอบล้างแอร์ · แจ้งยกเลิกเช่าล่วงหน้า 3 เดือน — /api/accommodation-rooms/expenses
// สีบอกสถานะทันที: เขียว = จ่าย/ทำแล้ว · แดง = ยังไม่จ่าย/เลยกำหนด · เหลือง = ใกล้ถึงกำหนด · เทา = ไม่มี/ยังไม่ถึงเวลา — มีแถบแจ้งเตือนสรุปด้านบน
(() => {
    const root = document.getElementById('roomExpenses');
    if (!root) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms/expenses`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => (Number(String(v ?? '').replace(/,/g, '')) || 0).toLocaleString('th-TH');
    const state = { data: null, month: '', filter: 'all', loading: false, cells: [], step: 'all', open: new Set(), serial: '' };
    let target = null;   // ช่องที่กำลังแก้ในกล่องบันทึก
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
        // โหลดเดือนอื่น (มีข้อมูลเดิมอยู่): ครอบหน้าด้วยข้อความ "กำลังโหลด" + หมุน ให้รู้ว่าระบบกำลังทำงาน
        let overlay = null;
        if (state.data) {
            root.classList.add('is-loading');
            overlay = document.createElement('div');
            overlay.className = 'rx-loading';
            overlay.setAttribute('role', 'status');
            overlay.innerHTML = `<div><i></i><b>กำลังโหลดข้อมูล ${esc(monthLabel(state.month))}…</b><small>กรุณารอสักครู่</small></div>`;
            root.append(overlay);
            root.querySelectorAll('[data-rx-goto]').forEach(btn => btn.classList.toggle('is-selected', btn.dataset.rxGoto === state.month));
        }
        try {
            state.data = await request(`${API}?month=${encodeURIComponent(state.month)}`);
            state.month = state.data.month;
            render();
        } catch (error) { root.innerHTML = `<div class="rx-head"><h2>ค่าใช้จ่ายและรอบกำหนด</h2></div><p class="rx-empty rx-error">${esc(error.message)}</p>`; }
        finally { state.loading = false; root.classList.remove('is-loading'); overlay?.remove(); }
    }

    // ---------------------------------------------------------------- สถานะของแต่ละช่อง → { tone, text, sub, alert, edit:{cat,period,rec} }
    const recFor = (cat, period) => (state.data.records || []).find(x => x.cat === cat && x.period === period);
    const recsOf = (no, cat, period) => (state.data.records || []).find(x => x.no === no && x.cat === cat && x.period === period);

    // ---------------------------------------------------------------- บิลค่าน้ำ/ค่าไฟ: 8 ขั้นตอนต่อเดือน (ตามงานจริงของ GA)
    // ---- ค่าอื่นๆ (สาธารณูปโภค): ประเภท (อินเทอร์เน็ต / อื่นๆ) + ค้นหายูนิตจาก Serial No. ของราวเตอร์
    const normSn = t => String(t || '').toLowerCase().replace(/[\s\-_]/g, '');
    const snMatch = (u, q) => { const k = normSn(q); return !k || (u.nets || []).some(n => normSn(n.serial).includes(k)); };
    const otherKind = rec => rec?.kind === 'internet' ? '🌐 อินเทอร์เน็ต' : 'อื่นๆ' + (rec?.note ? ': ' + rec.note : '');
    const netsLine = u => (u.nets || []).length ? (u.nets || []).map(n => [n.provider, n.package, n.serial ? 'SN ' + n.serial : ''].filter(Boolean).join(' · ')).join(' | ') : 'ยังไม่มีข้อมูลราวเตอร์ในไฟล์อินเตอร์เน็ต';
    const FLOW_CATS = ['water', 'electric'];
    const FLOW_SHORT = ['ตามบิล', 'ได้รับบิล', 'ตั้งเบิก', 'รอรับเงิน', 'รับเงิน', 'เตรียมจ่าย', 'จ่ายแล้ว', 'บันทึกบิล'];
    const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];
    const flowSteps = () => state.data.flowSteps || [];
    const flowRec = (no, cat, period) => (state.data.flow || []).find(x => x.no === no && x.cat === cat && x.period === period);
    const stepOf = rec => !rec ? -1 : rec.status === 'ไม่มีรายการ' ? -2 : flowSteps().indexOf(rec.status);
    const periodHasData = period => (state.data.flow || []).some(x => x.period === period);
    const dayPart = text => String(text || '').split(/[ ,]/)[0];
    function flowCell(u, cat, period) {
        const rec = flowRec(u.no, cat, period);
        const today = state.data.today, current = today.slice(0, 7), day = Number(today.slice(8, 10));
        const idx = stepOf(rec);
        const edit = { u, cat, period, rec };
        const base = { idx, rec, edit };
        if (idx === -2) return { ...base, tone: 'na', text: '–', sub: 'ไม่มีรายการ' };
        if (idx === -1) {
            if (period > current) return { ...base, tone: 'na', text: 'ยังไม่มีบิล' };
            if (period === current) return day > 5
                ? { ...base, tone: 'bad', text: 'ยังไม่เริ่ม — เลยวันที่ 5', sub: 'ต้องตั้งเบิกไม่เกินวันที่ 5', alert: cat, late: true }
                : { ...base, tone: 'warn', text: 'ยังไม่เริ่ม', sub: 'ตามบิลกับเจ้าของบ้าน (1–5)', alert: cat };
            return periodHasData(period) ? { ...base, tone: 'bad', text: 'ไม่มีข้อมูล', sub: 'เดือนนี้ผ่านไปแล้ว', alert: cat, late: true } : { ...base, tone: 'na', text: 'ยังไม่ได้บันทึก' };
        }
        const done = idx >= 6;
        let tone = done ? 'ok' : 'warn', late = false;
        if (!done && ((period === current && idx < 2 && day > 5) || period < current)) { tone = 'bad'; late = true; }
        const sub = [rec.amount ? `฿${num(rec.amount)}` : '', rec.date, idx === 6 ? 'รอบันทึกบิล' : '', rec.files?.length ? `📷 ${rec.files.length}` : ''].filter(Boolean).join(' · ');
        return { ...base, tone, late, text: `${idx + 1}/8 ${flowSteps()[idx]}`, sub, alert: done ? '' : cat };
    }
    function monthSummary(period, units) {
        const total = units.length * FLOW_CATS.length;
        let done = 0, billed = 0;
        for (const u of units) for (const cat of FLOW_CATS) { const i = stepOf(flowRec(u.no, cat, period)); if (i >= 6) done++; if (i >= 1) billed++; }
        return { total, done, billed };
    }
    const fileUrls = new Map();
    async function fileUrl(id) {
        if (fileUrls.has(id)) return fileUrls.get(id);
        const response = await window.authFetch(`${API}/file/${encodeURIComponent(id)}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
        const url = URL.createObjectURL(await response.blob());
        fileUrls.set(id, url);
        return url;
    }
    // โหลดรูปย่อ (ดึงผ่าน authFetch เป็น blob) เฉพาะที่อยู่บนจอ
    function hydrateThumbs(scope) {
        (scope || root).querySelectorAll('img[data-rx-src]').forEach(img => {
            const id = img.dataset.rxSrc; img.removeAttribute('data-rx-src');
            fileUrl(id).then(url => { img.src = url; }).catch(() => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'rx-thumb-err', textContent: '⚠' })); });
        });
    }
    const thumbHtml = (rec, cat, removable) => (rec?.files || []).map((f, i) => `<span class="rx-thumb-wrap"><button type="button" class="rx-thumb" data-rx-view="${esc([cat, rec.no, rec.period, i].join('|'))}" title="${esc(f.name || 'รูปบิล')} · ${esc(f.at || '')}">${f.mime === 'application/pdf' ? '<span class="rx-pdf">📄 PDF</span>' : `<img alt="" data-rx-src="${esc(f.id)}">`}</button>${removable ? `<button type="button" class="rx-thumb-del" data-rx-delfile="${esc(f.id)}" title="เอารูปนี้ออก">✕</button>` : ''}</span>`).join('');
    const histDate = (rec, step) => { const h = (rec?.hist || []).filter(x => x.s === step).pop(); return h ? dayPart(h.at) : ''; };
    function stepperHtml(c, cat) {
        const rec = c.rec, idx = c.idx;
        return `<ol class="rx-steps">${flowSteps().map((name, i) => `<li class="${i < idx ? 'is-done' : i === idx ? 'is-current' : ''}"><i>${i < idx || (i === idx && idx >= 6) ? '✓' : i + 1}</i><b>${esc(FLOW_SHORT[i])}</b><small>${esc(histDate(rec, name))}</small></li>`).join('')}</ol>`;
    }
    function flowDetail(r, units) {
        const months = [-2, -1, 0, 1].map(n => shiftMonth(state.month, n));
        return `<tr class="rx-detail"><td colspan="10"><div class="rx-detail-box">${FLOW_CATS.map(cat => {
            const c = r.cells[cat], rec = c.rec, next = flowSteps()[c.idx + 1];
            const hist = months.map(m => { const cc = flowCell(r.u, cat, m); return `<button type="button" class="rx-mini is-${cc.tone}${m === state.month ? ' is-selected' : ''}" data-rx-goto="${m}" title="${esc(cc.text)}"><b>${esc(monthLabel(m))}</b><span>${cc.idx >= 0 ? CIRCLED[cc.idx] + ' ' + esc(FLOW_SHORT[cc.idx]) : esc(cc.text)}</span></button>`; }).join('');
            return `<section class="rx-flow"><header><h4>${esc(state.data.cats[cat].label)} — ${esc(monthLabel(state.month))}</h4><span class="rx-chip is-${c.tone}">${esc(c.text)}</span></header>
                ${c.idx >= -1 ? stepperHtml(c, cat) : ''}
                <p class="rx-meta">${rec ? `${rec.amount ? `จำนวนเงิน ฿${num(rec.amount)} · ` : ''}${rec.date ? `วันที่ ${esc(rec.date)} · ` : ''}บันทึกล่าสุดโดย ${esc(rec.by || '-')} ${esc(rec.at || '')}${rec.note ? ` · หมายเหตุ: ${esc(rec.note)}` : ''}` : 'ยังไม่มีการบันทึกในเดือนนี้'}</p>
                <div class="rx-thumbs">${thumbHtml(rec, cat, false) || '<span class="rx-nophoto">ยังไม่มีรูปบิล</span>'}</div>
                <div class="rx-flow-actions"><button type="button" class="rx-btn" data-rx-cell="${(state.cells.push(c.edit), state.cells.length - 1)}">✎ อัปเดตขั้นตอน / แนบรูป</button>${next && c.idx >= -1 && c.idx < 7 ? `<button type="button" class="rx-btn rx-primary" data-rx-next="${state.cells.length - 1}">▶ ไปขั้น ${CIRCLED[c.idx + 1]} ${esc(next)}</button>` : ''}</div>
                <div class="rx-hist"><span>ย้อนหลัง / เดือนถัดไป:</span>${hist}</div></section>`;
        }).join('')}</div></td></tr>`;
    }
    function monthCell(u, cat) {
        if (state.data.cats[cat]?.flow) return flowCell(u, cat, state.month);
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
        return { tone: rec.status === 'ไม่มีรายการ' ? 'na' : done ? 'ok' : (cat === 'gas_recv' ? 'warn' : 'bad'), text: rec.status === 'ไม่มีรายการ' ? '–' : (done ? '✓ ' : '') + rec.status, sub: [cat === 'other' ? otherKind(rec) : '', money, rec.date].filter(Boolean).join(' · '), alert: done || rec.status === 'ไม่มีรายการ' ? '' : cat, edit: { u, cat, period: state.month, rec } };
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
        const flowLate = FLOW_CATS.map(c => [c, rows.filter(r => r.cells[c].late).length]).filter(([, n]) => n);
        const flowOpen = FLOW_CATS.map(c => [c, rows.filter(r => r.cells[c].alert === c && !r.cells[c].late).length]).filter(([, n]) => n);
        if (flowLate.length) alerts.push(['bad', `บิลค่าน้ำ/ไฟ ${monthLabel(state.month)} เลยกำหนดหรือค้างขั้นตอน ${flowLate.reduce((n, [, v]) => n + v, 0)} รายการ — ${flowLate.map(([c, n]) => `${labelOf(c)} ${n}`).join(' · ')}`, 'flow']);
        if (flowOpen.length) alerts.push(['warn', `บิลค่าน้ำ/ไฟ ${monthLabel(state.month)} ที่ยังไม่ครบ 8 ขั้นตอน ${flowOpen.reduce((n, [, v]) => n + v, 0)} รายการ — ${flowOpen.map(([c, n]) => `${labelOf(c)} ${n}`).join(' · ')}`, 'flow']);
        const unpaidList = MONTH_CATS.filter(c => c !== 'gas_recv' && !FLOW_CATS.includes(c)).map(c => [c, unpaid(c)]).filter(([, n]) => n);
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
        const stepMatch = r => state.step === 'all' || FLOW_CATS.some(c => state.step === 'none' ? r.cells[c].idx === -1 : r.cells[c].idx === Number(state.step));
        const shown = rows.filter(r => (state.filter === 'all' || r.flagged) && stepMatch(r) && snMatch(r.u, state.serial));
        const stepCount = key => rows.filter(r => FLOW_CATS.some(c => key === 'none' ? r.cells[c].idx === -1 : r.cells[c].idx === key)).length;
        const current = d.today.slice(0, 7);
        const monthStrip = [-2, -1, 0, 1].map(n => {
            const m = shiftMonth(state.month, n), sum = monthSummary(m, units), isFuture = m > current, has = periodHasData(m);
            const tag = m === current ? 'เดือนนี้' : m < current ? 'เดือนก่อน' : 'เดือนถัดไป';
            const pct = sum.total ? Math.round((isFuture ? sum.billed : sum.done) / sum.total * 100) : 0;
            const text = isFuture ? (sum.billed ? `บิลมาแล้ว ${sum.billed}/${sum.total}` : 'ยังไม่มีบิลมา') : has ? `เสร็จสิ้น ${sum.done}/${sum.total}` : 'ยังไม่ได้บันทึก';
            return `<button type="button" class="rx-mstep${m === state.month ? ' is-selected' : ''}${m === current ? ' is-current' : ''}" data-rx-goto="${m}"><small>${tag}</small><b>${esc(monthLabel(m))}</b><span class="rx-bar"><i style="width:${pct}%"></i></span><em>${esc(text)}</em></button>`;
        }).join('');
        const stepBar = `<button type="button" class="rx-stepchip${state.step === 'all' ? ' is-on' : ''}" data-rx-step="all">ทุกขั้นตอน</button><button type="button" class="rx-stepchip${state.step === 'none' ? ' is-on' : ''}" data-rx-step="none">ยังไม่เริ่ม <em>${stepCount('none')}</em></button>${FLOW_SHORT.map((t, i) => `<button type="button" class="rx-stepchip${state.step === String(i) ? ' is-on' : ''}" data-rx-step="${i}">${CIRCLED[i]} ${esc(t)} <em>${stepCount(i)}</em></button>`).join('')}`;
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
                    <button type="button" class="rx-btn" data-rx-expand="all">▾ ขยายทั้งหมด</button><button type="button" class="rx-btn" data-rx-expand="none">▴ ย่อทั้งหมด</button>
                    <button type="button" class="rx-btn" data-rx-reload>รีเฟรช</button>
                </div>
            </div>
            <div class="rx-mstrip" aria-label="บิลค่าน้ำ/ไฟรายเดือน">${monthStrip}</div>
            <div class="rx-stepbar" aria-label="กรองตามขั้นตอนบิลค่าน้ำ/ไฟ"><span>ขั้นตอนบิลน้ำ/ไฟ ${esc(monthLabel(state.month))}:</span>${stepBar}</div>
            <div class="rx-alerts ${alerts.length ? 'has-alert' : ''}" role="status">
                ${alerts.length ? `<b>🔔 แจ้งเตือน</b><ul>${alerts.map(([tone, text]) => `<li class="is-${tone}">${esc(text)}</li>`).join('')}</ul>` : '<b>✅ ไม่มีรายการค้าง — ค่าใช้จ่ายเดือนนี้ รอบกำหนด และการแจ้งยกเลิกเช่าเรียบร้อย</b>'}
            </div>
            <div class="rx-legend"><span class="is-ok">เขียว จ่าย/ทำแล้ว</span><span class="is-bad">แดง ยังไม่จ่าย / เลยกำหนด</span><span class="is-warn">เหลือง ใกล้ถึงกำหนด / รอรับ</span><span class="is-na">เทา ไม่มี / ยังไม่ถึงเวลา</span></div>
            <div class="rx-wrap"><table class="rx-table">
                <thead><tr><th>ที่พัก / ยูนิต</th><th>ค่าเช่า/เดือน</th><th colspan="5" class="rx-group">รายเดือน — ${esc(monthLabel(state.month))}</th><th colspan="2" class="rx-group">รอบ (ตามที่ตั้งไว้ในทะเบียน)</th><th class="rx-group">สัญญาเช่า (รายปี)</th></tr>
                    <tr class="rx-sub"><th></th><th></th>${MONTH_CATS.map(c => c === 'other' ? `<th class="rx-th-sn">${esc(labelOf(c))}<input type="search" class="rx-sn" data-rx-serial placeholder="🔎 ค้นหา Serial No. ราวเตอร์" value="${esc(state.serial)}" autocomplete="off">${state.serial ? `<small>พบ ${shown.length} ยูนิต</small>` : ''}</th>` : `<th>${esc(labelOf(c))}</th>`).join('')}<th>รอบจ่ายค่าเช่าล่วงหน้า</th><th>รอบล้างแอร์</th><th>แจ้งยกเลิกเช่าล่วงหน้า 3 เดือน</th></tr></thead>
                <tbody>${shown.map(r => { const open = state.open.has(r.u.no); return `<tr class="${r.flagged ? 'is-flag' : ''}${open ? ' is-open' : ''}"><td><button type="button" class="rx-toggle" data-rx-toggle="${r.u.no}" aria-expanded="${open}" title="${open ? 'ย่อ' : 'ขยายดูขั้นตอนและรูปบิล'}">${open ? '▾' : '▸'}</button><span class="rx-unit"><b>${esc(r.u.project)}</b><small>${esc(r.u.unit)} · ลำดับ ${esc(r.u.no)}</small>${state.serial ? `<small class="rx-sn-hit">🌐 ${esc(netsLine(r.u))}</small>` : ''}</span></td><td>${r.u.rent ? num(r.u.rent) : '-'}</td>
                    ${MONTH_CATS.map(c => `<td>${chipHtml(r.cells[c])}</td>`).join('')}<td>${chipHtml(r.cells.rent_adv)}</td><td>${chipHtml(r.cells.aircon)}</td><td>${chipHtml(r.cells.notice)}</td></tr>${open ? flowDetail(r, units) : ''}`; }).join('') || `<tr><td colspan="10" class="rx-empty">${rows.length ? 'ไม่มีรายการที่ต้องดำเนินการ 🎉' : 'ยังไม่มียูนิตที่ทำสัญญาแล้ว'}</td></tr>`}</tbody>
            </table></div>`;
        // สรุปให้หน้าภาพรวม (accommodation-dashboard.js)
        const tally = cat => { const flow = d.cats[cat].flow; const cells = rows.map(r => r.cells[cat]).filter(c => c.tone === 'ok' || c.tone === 'bad' || (flow && c.tone === 'warn')); return [d.cats[cat].label, cells.filter(c => c.tone === 'ok').length, cells.length]; };
        const cats = ['water', 'electric', 'gas', 'other'].map(tally);
        const stats = { monthLabel: monthLabel(state.month), cats, paid: cats.reduce((n, c) => n + c[1], 0), total: cats.reduce((n, c) => n + c[2], 0),
            unpaid: ['water', 'electric', 'gas', 'other'].reduce((n, c) => n + unpaid(c), 0), gasPending: unpaid('gas_recv'),
            rentOver: rows.filter(r => r.cells.rent_adv.alert === 'rent_adv:over').length, rentSoon: rows.filter(r => r.cells.rent_adv.alert === 'rent_adv:soon').length,
            airOver: rows.filter(r => r.cells.aircon.alert === 'aircon:over').length, airSoon: rows.filter(r => r.cells.aircon.alert === 'aircon:soon').length, noticeDue: nDue, noticeSoon: nSoon };
        window.__rxStats = stats;
        hydrateThumbs(root);
        window.dispatchEvent(new CustomEvent('ro-expense-alerts', { detail: { count: alerts.length, alerts: alerts.map(a => a[1]), stats } }));
    }

    // ---------------------------------------------------------------- กล่องบันทึก
    const dialog = document.createElement('dialog');
    dialog.className = 'rx-dialog';
    root.after(dialog);
    function openCell(index) {
        const c = state.cells[index];
        if (!c) return;
        target = c;
        if (state.data.cats[c.cat].flow) return openFlow(c);
        const def = state.data.cats[c.cat];
        const hasAmount = def.kind === 'month' || c.cat === 'rent_adv';
        const rec = c.rec;
        const title = def.label + ' — ' + c.u.project + ' ' + c.u.unit + ' · ' + (def.kind === 'month' ? monthLabel(c.period) : c.cat === 'notice' ? 'สัญญาหมด ' + dmy(parseIso(c.period)) : 'รอบ ' + dmy(parseIso(c.period)));
        const today = dmy(parseIso(state.data.today));
        dialog.innerHTML = `<form data-rx-form="${index}"><h3>${esc(title)}</h3>
            <label>สถานะ<select name="status">${def.states.map(s => `<option ${s === (rec?.status || def.states[0]) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
            ${c.cat === 'other' ? `<fieldset class="rx-stepopts rx-kind"><legend>ประเภทค่าใช้จ่าย</legend>
                <label class="rx-stepopt"><input type="radio" name="kind" value="internet" ${(rec?.kind || 'internet') === 'internet' ? 'checked' : ''}><span>🌐 ค่าอินเทอร์เน็ต <small>(ไม่ต้องลงหมายเหตุก็ได้)</small></span></label>
                <label class="rx-stepopt"><input type="radio" name="kind" value="other" ${rec?.kind === 'other' ? 'checked' : ''}><span>ค่าอื่นๆ <small>(ต้องลงหมายเหตุว่าเป็นค่าอะไร)</small></span></label>
                <small class="rx-nets">ราวเตอร์ของยูนิตนี้: ${esc(netsLine(c.u))}</small></fieldset>` : ''}
            ${hasAmount ? `<label>จำนวนเงิน (บาท)<input name="amount" inputmode="decimal" value="${esc(rec?.amount || '')}" placeholder="เช่น 1,250"></label>` : ''}
            <label>วันที่ (วัน/เดือน/ปี)<input name="date" value="${esc(rec?.date || today)}"></label>
            <label>หมายเหตุ<span data-rx-notehint></span><input name="note" maxlength="200" value="${esc(rec?.note || '')}"></label>
            <p class="rx-hint">${rec ? 'บันทึกล่าสุดโดย ' + esc(rec.by) + ' ' + esc(rec.at) : 'ยังไม่เคยบันทึก'}</p>
            <p class="rx-msg" role="status"></p>
            <div class="rx-actions"><button type="submit" class="rx-btn rx-primary">บันทึก</button><button type="button" class="rx-btn" data-rx-close>ยกเลิก</button></div></form>`;
        if (!dialog.open) dialog.showModal();
        syncKind();
    }
    // ค่าอื่นๆ: เลือกประเภท → บอกว่าต้องลงหมายเหตุหรือไม่
    function syncKind() {
        const f = dialog.querySelector('.rx-kind'); if (!f) return;
        const other = dialog.querySelector('input[name=kind]:checked')?.value === 'other';
        const hint = dialog.querySelector('[data-rx-notehint]'), note = dialog.querySelector('input[name=note]');
        if (hint) hint.textContent = other ? ' * จำเป็น — ระบุว่าเป็นค่าอะไร' : ' (ไม่บังคับ)';
        if (note) note.placeholder = other ? 'เช่น ค่าซ่อมท่อ / ค่าส่วนกลาง' : '';
    }
    dialog.addEventListener('change', event => { if (event.target.name === 'kind') syncKind(); });

    // ---------------------------------------------------------------- กล่องบันทึกบิลค่าน้ำ/ไฟ (เลือกขั้นตอน + แนบรูปบิล)
    const todayDmy = () => dmy(parseIso(state.data.today));
    function openFlow(c) {
        const rec = flowRec(c.u.no, c.cat, c.period);
        const label = state.data.cats[c.cat].label;
        const current = rec?.status && rec.status !== 'ไม่มีรายการ' ? rec.status : '';
        dialog.innerHTML = `<form data-rx-form="flow" class="rx-flowform"><h3>${esc(label)} — ${esc(c.u.project)} ${esc(c.u.unit)} · ${esc(monthLabel(c.period))}</h3>
            <fieldset class="rx-stepopts"><legend>ขั้นตอนตอนนี้</legend>${flowSteps().map((name, i) => `<label class="rx-stepopt"><input type="radio" name="status" value="${esc(name)}" ${name === (current || (rec ? '' : flowSteps()[0])) ? 'checked' : ''}><span><i>${CIRCLED[i]}</i> ${esc(name)}${i === 0 ? ' <small>(วันที่ 1–5)</small>' : i === 2 ? ' <small>(ไม่เกินวันที่ 5)</small>' : ''}</span></label>`).join('')}
                <label class="rx-stepopt is-none"><input type="radio" name="status" value="ไม่มีรายการ" ${rec?.status === 'ไม่มีรายการ' ? 'checked' : ''}><span>เดือนนี้ไม่มีบิล${esc(label)}</span></label></fieldset>
            <div class="rx-two"><label>จำนวนเงินตามบิล (บาท)<input name="amount" inputmode="decimal" value="${esc(rec?.amount || '')}" placeholder="เช่น 1,250"></label>
            <label>วันที่ของขั้นตอนนี้ (วัน/เดือน/ปี)<input name="date" value="${esc(todayDmy())}"></label></div>
            <label>หมายเหตุ<input name="note" maxlength="200" value="${esc(rec?.note || '')}"></label>
            <div class="rx-files"><div class="rx-files-head"><b>รูปบิล</b><label class="rx-btn rx-upload">＋ แนบรูป / PDF<input type="file" accept="image/*,application/pdf" multiple hidden data-rx-upload></label></div>
                <div class="rx-thumbs" data-rx-dialog-thumbs>${thumbHtml(rec, c.cat, true) || '<span class="rx-nophoto">ยังไม่มีรูปบิล — แนบรูปแล้วระบบจะตั้งเป็น “ได้รับบิลแล้ว” ให้</span>'}</div></div>
            <p class="rx-hint">${rec ? 'บันทึกล่าสุดโดย ' + esc(rec.by) + ' ' + esc(rec.at) : 'ยังไม่เคยบันทึก'}</p>
            <p class="rx-msg" role="status"></p>
            <div class="rx-actions"><button type="submit" class="rx-btn rx-primary">บันทึก</button><button type="button" class="rx-btn" data-rx-close>ปิด</button></div></form>`;
        if (!dialog.open) dialog.showModal();
        hydrateThumbs(dialog);
    }
    const readAsDataUrl = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้')); r.readAsDataURL(file); });
    async function prepareFile(file) {
        if (file.type === 'application/pdf') return readAsDataUrl(file);
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('รองรับเฉพาะรูป JPG / PNG / WEBP หรือไฟล์ PDF (รูป HEIC ให้ถ่ายหรือบันทึกเป็น JPG ก่อน)');
        const url = URL.createObjectURL(file);
        try {
            const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('เปิดรูปนี้ไม่ได้')); i.src = url; });
            const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
            if (scale === 1 && file.size < 1.5e6) return readAsDataUrl(file);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.85);
        } finally { URL.revokeObjectURL(url); }
    }
    async function refreshDialogFiles() {
        await load();
        const form = dialog.querySelector('[data-rx-form="flow"]');
        if (!form || !target) return;
        const rec = flowRec(target.u.no, target.cat, target.period);
        form.querySelector('[data-rx-dialog-thumbs]').innerHTML = thumbHtml(rec, target.cat, true) || '<span class="rx-nophoto">ยังไม่มีรูปบิล</span>';
        hydrateThumbs(dialog);
        if (rec && !current_status_chosen(form)) { const r = form.querySelector(`input[name=status][value="${flowSteps()[1]}"]`); if (r) r.checked = true; }
    }
    const current_status_chosen = form => { const v = form.querySelector('input[name=status]:checked')?.value; return v && v !== flowSteps()[0]; };
    dialog.addEventListener('change', async event => {
        const input = event.target.closest('[data-rx-upload]'); if (!input) return;
        const form = input.closest('form'), msg = form.querySelector('.rx-msg');
        const files = [...input.files]; input.value = '';
        let ok = 0;
        for (const file of files) {
            msg.className = 'rx-msg'; msg.textContent = `กำลังอัปโหลด ${file.name}… (${ok + 1}/${files.length})`;
            try {
                const dataUrl = await prepareFile(file);
                await request(`${API}/files`, { method: 'POST', body: JSON.stringify({ no: target.u.no, cat: target.cat, period: target.period, name: file.name, dataUrl }) });
                ok++;
            } catch (error) { msg.className = 'rx-msg is-bad'; msg.textContent = `${file.name}: ${error.message}`; break; }
        }
        if (ok) { msg.className = 'rx-msg'; msg.textContent = `แนบรูปแล้ว ${ok} ไฟล์`; await refreshDialogFiles(); }
    });
    dialog.addEventListener('click', async event => {
        const del = event.target.closest('[data-rx-delfile]');
        if (!del || !target) return;
        if (!window.confirm('เอารูปบิลนี้ออกจากรายการ? (ไฟล์ยังเก็บอยู่ใน Google Drive)')) return;
        const msg = dialog.querySelector('.rx-msg');
        try { await request(`${API}/files`, { method: 'DELETE', body: JSON.stringify({ no: target.u.no, cat: target.cat, period: target.period, id: del.dataset.rxDelfile }) }); await refreshDialogFiles(); }
        catch (error) { msg.className = 'rx-msg is-bad'; msg.textContent = error.message; }
    });

    // ---------------------------------------------------------------- ดูรูปบิลขยาย
    const lightbox = document.createElement('dialog');
    lightbox.className = 'rx-lightbox';
    root.after(lightbox);
    let view = null;
    async function showFile(delta) {
        const rec = flowRec(view.no, view.cat, view.period);
        const files = rec?.files || [];
        if (!files.length) return lightbox.close();
        view.i = (view.i + delta + files.length) % files.length;
        const f = files[view.i];
        lightbox.innerHTML = `<div class="rx-lb-bar"><b>${esc(state.data.cats[view.cat].label)} ${esc(monthLabel(view.period))} · ${view.i + 1}/${files.length}</b><span>${esc(f.name || '')} ${esc(f.at || '')}</span><button type="button" data-rx-lb="close" aria-label="ปิด">✕</button></div>
            <div class="rx-lb-body">${files.length > 1 ? '<button type="button" class="rx-lb-nav" data-rx-lb="-1" aria-label="รูปก่อนหน้า">‹</button>' : ''}<div class="rx-lb-stage">กำลังโหลด…</div>${files.length > 1 ? '<button type="button" class="rx-lb-nav" data-rx-lb="1" aria-label="รูปถัดไป">›</button>' : ''}</div>`;
        if (!lightbox.open) lightbox.showModal();
        const stage = lightbox.querySelector('.rx-lb-stage');
        try {
            const url = await fileUrl(f.id);
            stage.innerHTML = f.mime === 'application/pdf' ? `<iframe src="${url}" title="บิล PDF"></iframe>` : `<img src="${url}" alt="รูปบิล" data-rx-zoom>`;
        } catch (error) { stage.textContent = error.message; }
    }
    lightbox.addEventListener('click', event => {
        const b = event.target.closest('[data-rx-lb]');
        if (b) { b.dataset.rxLb === 'close' ? lightbox.close() : showFile(Number(b.dataset.rxLb)); return; }
        const z = event.target.closest('[data-rx-zoom]'); if (z) { z.classList.toggle('is-zoom'); return; }
        if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener('keydown', event => { if (event.key === 'ArrowLeft') showFile(-1); if (event.key === 'ArrowRight') showFile(1); });
    document.addEventListener('click', event => {
        const v = event.target.closest('[data-rx-view]'); if (!v || !(root.contains(v) || dialog.contains(v))) return;
        const [cat, no, period, i] = v.dataset.rxView.split('|');
        view = { cat, no: Number(no), period, i: Number(i) };
        showFile(0);
    });
    // ไปขั้นถัดไปทันที (ปุ่มในแผงขยาย)
    async function advance(index) {
        const c = state.cells[index]; if (!c) return;
        const rec = flowRec(c.u.no, c.cat, c.period), idx = stepOf(rec);
        const next = flowSteps()[idx + 1]; if (!next) return;
        try { await request(API, { method: 'PUT', body: JSON.stringify({ no: c.u.no, cat: c.cat, period: c.period, status: next, amount: rec?.amount || '', date: todayDmy(), note: rec?.note || '' }) }); await load(); }
        catch (error) { window.alert(error.message); }
    }
    dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-rx-close]')) dialog.close(); });
    dialog.addEventListener('submit', async event => {
        const form = event.target.closest('[data-rx-form]'); if (!form) return;
        event.preventDefault();
        const c = target;
        const body = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v).trim()]));
        const button = form.querySelector('[type=submit]'); button.disabled = true; button.textContent = 'กำลังบันทึก…';
        try {
            await request(API, { method: 'PUT', body: JSON.stringify({ no: c.u.no, cat: c.cat, period: c.period, ...body }) });
            dialog.close();
            await load();
        } catch (error) { button.disabled = false; button.textContent = 'บันทึก'; const m = form.querySelector('.rx-msg'); m.textContent = error.message; m.className = 'rx-msg is-bad'; }
    });

    root.addEventListener('input', event => {
        const box = event.target.closest('[data-rx-serial]'); if (!box) return;
        state.serial = box.value.trim();
        render();
        const again = root.querySelector('[data-rx-serial]');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
    root.addEventListener('click', event => {
        const cell = event.target.closest('[data-rx-cell]'); if (cell) return openCell(Number(cell.dataset.rxCell));
        const month = event.target.closest('[data-rx-month]'); if (month) { state.month = shiftMonth(state.month, Number(month.dataset.rxMonth)); load(); return; }
        const goto = event.target.closest('[data-rx-goto]'); if (goto) { state.month = goto.dataset.rxGoto; load(); return; }
        const step = event.target.closest('[data-rx-step]'); if (step) { state.step = step.dataset.rxStep; render(); return; }
        const toggle = event.target.closest('[data-rx-toggle]'); if (toggle) { const no = Number(toggle.dataset.rxToggle); state.open.has(no) ? state.open.delete(no) : state.open.add(no); render(); return; }
        const expand = event.target.closest('[data-rx-expand]'); if (expand) { if (expand.dataset.rxExpand === 'all') (state.data.units || []).filter(u => u.status === 'ทำสัญญาแล้ว').forEach(u => state.open.add(u.no)); else state.open.clear(); render(); return; }
        const nextBtn = event.target.closest('[data-rx-next]'); if (nextBtn) return advance(Number(nextBtn.dataset.rxNext));
        const filter = event.target.closest('[data-rx-filter]'); if (filter) { state.filter = filter.dataset.rxFilter; render(); return; }
        if (event.target.closest('[data-rx-reload]')) load();
    });
    load();
    setInterval(() => { if (!document.hidden && !dialog.open) load(); }, 5 * 60 * 1000);
})();
