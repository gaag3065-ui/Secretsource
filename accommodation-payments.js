// จัดการรายงานทุกขั้นตอน (บิลที่พัก): ① ตั้งเบิก (PDF แยกตามบริษัท) → ② รับเงิน (จัดก้อนตามจุดจ่าย) → ③ นำส่งหลักฐาน
// ข้อมูลชุดตั้งเบิกเก็บที่หลังบ้าน (/api/accommodation-rooms/payments) · PDF จาก /api/room-inspection/pdf (kind: payment-request)
// เงื่อนไขต่อเนื่อง: ต้องตั้งเบิกก่อนจึงรับเงินได้ · ต้องบันทึกรับเงินก่อนจึงติ๊กจ่ายได้ · ต้องจ่ายก่อนจึงติ๊กนำส่งหลักฐานได้
(() => {
    const actions = document.querySelector('.as-actions');
    if (!actions) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const METHODS = { super: 'ซุปเปอร์มาเก็ต', condo: 'นิติบุคคล / นิติอาคาร', bank: 'ธนาคาร' };
    const STATUS = { requested: 'ตั้งเบิกแล้ว — รอรับเงิน', received: 'รับเงินแล้ว — รอจ่าย/นำส่ง', done: 'เสร็จสมบูรณ์' };
    const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const now = new Date(Date.now() + 7 * 3600 * 1000);
    const todayDmy = () => { const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).split('-'); return `${d[2]}/${d[1]}/${d[0]}`; };
    const state = { tab: 'request', cands: [], batches: [], sel: new Set(), rows: new Map(), period: `${THAI_MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`, round: 'T.1', notes: '', payDate: '', batchId: '', filter: 'all', q: '', busy: false, msg: '' };

    document.head.insertAdjacentHTML('beforeend', `<style>
        .pm-dialog { width: min(1320px, 98vw); max-height: 96dvh; border: 0; border-radius: 16px; padding: 0; box-shadow: 0 24px 70px rgba(16,24,40,.3); }
        .pm-dialog::backdrop { background: rgba(16,24,40,.55); }
        .pm-wrap { display: grid; gap: 12px; padding: 16px 18px 18px; max-height: 96dvh; overflow: auto; font-size: 14px; }
        .pm-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .pm-top h2 { margin: 0; font-size: 20px; }
        .pm-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .pm-tabs button { flex: 1 1 220px; border: 2px solid #d0d5dd; background: #fff; border-radius: 12px; padding: 10px 14px; font: inherit; font-weight: 700; cursor: pointer; text-align: left; }
        .pm-tabs button small { display: block; font-weight: 400; color: #667085; }
        .pm-tabs button.is-on { border-color: #087f74; background: #e9f7f5; color: #065f56; }
        .pm-card { border: 1px solid #e1e7ea; border-radius: 12px; padding: 12px 14px; background: #fff; }
        .pm-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .pm-wrap label { display: grid; gap: 3px; font-size: 12.5px; color: #475467; font-weight: 600; }
        .pm-wrap input, .pm-wrap select, .pm-wrap textarea { font: inherit; font-size: 13.5px; padding: 6px 8px; border: 1px solid #d0d5dd; border-radius: 8px; min-width: 0; box-sizing: border-box; width: 100%; }
        .pm-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .pm-table th { background: #f4b26b; padding: 6px 6px; border: 1px solid #c9954f; font-size: 12.5px; text-align: center; position: sticky; top: 0; }
        .pm-table td { border: 1px solid #e1e7ea; padding: 4px 5px; vertical-align: top; }
        .pm-table td.n { text-align: right; white-space: nowrap; }
        .pm-table tr.co td { background: #fde6c8; font-weight: 700; }
        .pm-table tr.sub td { background: #fff3e0; font-weight: 700; text-align: right; }
        .pm-table tr.grand td { background: #f4b26b; font-weight: 800; text-align: right; }
        .pm-table input, .pm-table select { padding: 4px 6px; font-size: 12.5px; }
        .pm-bankbox { display: grid; gap: 4px; }
        .pm-btn { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
        .pm-btn.primary { background: #087f74; color: #fff; border-color: #087f74; }
        .pm-btn:disabled { opacity: .45; cursor: not-allowed; }
        .pm-msg { font-size: 13px; color: #087f74; min-height: 18px; } .pm-msg.bad { color: #b42318; font-weight: 700; }
        .pm-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .pm-chip { border: 1px solid #d0d5dd; background: #fff; border-radius: 999px; padding: 5px 12px; cursor: pointer; font: inherit; font-size: 13px; }
        .pm-chip.is-on { background: #087f74; color: #fff; border-color: #087f74; }
        .pm-kpis { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        .pm-kpi { border: 1px solid #e1e7ea; border-top: 4px solid #087f74; border-radius: 12px; padding: 8px 12px; background: #fff; }
        .pm-kpi span { font-size: 12px; color: #667085; display: block; } .pm-kpi b { font-size: 20px; }
        .pm-groups { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
        .pm-group { border: 2px solid #e1e7ea; border-radius: 12px; padding: 10px 12px; background: #fff; display: grid; gap: 6px; align-content: start; }
        .pm-group.is-paid { border-color: #7cd1c6; background: #f1fbf9; }
        .pm-group h4 { margin: 0; font-size: 15px; } .pm-group .tot { font-size: 20px; font-weight: 800; }
        .pm-group ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: #475467; }
        .pm-check { display: flex !important; align-items: center; gap: 8px; font-size: 13.5px !important; color: #18212f !important; }
        .pm-check input { width: 18px; height: 18px; flex: none; accent-color: #087f74; }
        .pm-check small { color: #667085; font-weight: 400; }
        .pm-note { font-size: 12.5px; color: #667085; }
        .pm-warn { background: #fff4d6; border: 1px solid #f2cf93; color: #9a5b00; border-radius: 10px; padding: 8px 12px; font-size: 13px; }
        @media (max-width: 760px) { .pm-table { min-width: 980px; } .pm-scroll { overflow-x: auto; } }
    </style>`);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'as-btn as-btn-ghost'; button.textContent = 'จัดการรายงานทุกขั้นตอน';
    actions.prepend(button);
    const dialog = document.createElement('dialog');
    dialog.className = 'pm-dialog';
    document.body.append(dialog);

    async function ensureCsrf() {
        if (window.getCsrfToken && window.getCsrfToken()) return;
        const response = await window.authFetch(`${API}/session`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (data.csrfToken) sessionStorage.setItem('csrfToken', data.csrfToken);
    }
    async function request(path, options) {
        if (options?.method && options.method !== 'GET') await ensureCsrf();
        const response = await window.authFetch(`${API}${path}`, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        if (options?.blob && response.ok) return response.blob();
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ในส่วนนี้ (ต้องมีสิทธิ์ "จัดการรายงานตั้งเบิก / รับเงิน / นำส่งหลักฐาน")');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    async function load() {
        const data = await request('/accommodation-rooms/payments');
        state.cands = data.candidates || []; state.batches = data.batches || [];
        for (const c of state.cands) if (!state.rows.has(c.key)) state.rows.set(c.key, { ...c, fee: c.fee || (c.method === 'super' ? 30 : 0) });
        if (!state.batchId || !state.batches.some(b => b.id === state.batchId)) state.batchId = (state.batches.find(b => b.status !== 'done') || state.batches[0] || {}).id || '';
    }
    const batchOf = () => state.batches.find(b => b.id === state.batchId);
    const itemTotal = i => (Number(i.amount) || 0) + (i.method === 'super' ? Number(i.fee) || 0 : 0);
    const sum = list => list.reduce((n, i) => n + itemTotal(i), 0);
    const groupKey = i => i.method === 'bank' ? `ธนาคาร|${i.bank}|${i.acctNo}|${i.acctName}` : i.method === 'condo' ? `นิติ|${i.place || i.building}` : 'ซุปเปอร์มาเก็ต';
    const groupTitle = i => i.method === 'bank' ? `🏦 ${i.bank || '(ไม่ระบุธนาคาร)'}` : i.method === 'condo' ? `🏢 นิติอาคาร ${i.place || ''}`.trim() : '🛒 ซุปเปอร์มาเก็ต';
    function groupsOf(batch) {
        const map = new Map();
        for (const i of batch.items) {
            const k = groupKey(i);
            const g = map.get(k) || { key: k, method: i.method, title: groupTitle(i), bank: i.bank, acctNo: i.acctNo, acctName: i.acctName, items: [] };
            g.items.push(i); map.set(k, g);
        }
        const order = { super: 0, condo: 1, bank: 2 };
        return [...map.values()].sort((a, b) => order[a.method] - order[b.method] || a.title.localeCompare(b.title));
    }

    // ---------------------------------------------------------------- แท็บ ① ตั้งเบิก
    function requestHtml() {
        const rows = state.cands.map(c => state.rows.get(c.key));
        const co = new Map();
        for (const r of rows) { const k = (r.company || '').trim() || 'ไม่ระบุบริษัท'; (co.get(k) || co.set(k, []).get(k)).push(r); }
        const picked = rows.filter(r => state.sel.has(r.key));
        const body = [...co.entries()].map(([name, list]) => {
            const chosen = list.filter(r => state.sel.has(r.key));
            return `<tr class="co"><td colspan="7">${esc(name)} <small style="font-weight:400">· ${list.length} รายการ</small></td></tr>` + list.map(r => `<tr data-key="${esc(r.key)}">
                <td><input type="checkbox" data-pm-sel ${state.sel.has(r.key) ? 'checked' : ''}></td>
                <td><input data-f="desc" value="${esc(r.desc)}"><small class="pm-note">${esc(r.building)}${r.files ? ` · 📷 ${r.files}` : ''}</small></td>
                <td><input data-f="company" value="${esc(r.company)}" placeholder="บริษัท" style="width:90px"></td>
                <td><input data-f="amount" inputmode="decimal" value="${esc(r.amount)}" style="width:110px;text-align:right"></td>
                <td><select data-f="method">${Object.entries(METHODS).map(([k, v]) => `<option value="${k}" ${r.method === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
                <td>${r.method === 'bank' ? `<div class="pm-bankbox"><input data-f="bank" value="${esc(r.bank)}" placeholder="ธนาคารอะไร"><input data-f="acctNo" value="${esc(r.acctNo)}" placeholder="หมายเลขบัญชี"><input data-f="acctName" value="${esc(r.acctName)}" placeholder="ชื่อบัญชี"></div>`
                    : r.method === 'condo' ? `<input data-f="place" value="${esc(r.place)}" placeholder="ชื่อนิติอาคาร / สถานที่จ่าย">`
                    : `<label>ค่าธรรมเนียมเคาน์เตอร์ (LKR)<input data-f="fee" inputmode="decimal" value="${esc(r.fee)}" style="width:90px"></label>`}</td>
                <td class="n rowtot">${num(itemTotal(r))}</td></tr>`).join('') + `<tr class="sub" data-co="${esc(name)}"><td colspan="6">รวม ${esc(name)} (ที่เลือก ${chosen.length})</td><td class="n subtot">${num(sum(chosen))}</td></tr>`;
        }).join('');
        return `<div class="pm-grid">
            <label>ประจำเดือน<input data-pm-top="period" value="${esc(state.period)}"></label>
            <label>รอบ<input data-pm-top="round" value="${esc(state.round)}"></label>
            <label>Payment Date (ใส่ทุกแถวในใบ)<input data-pm-top="payDate" value="${esc(state.payDate)}" placeholder="วัน/เดือน/ปี (ไม่บังคับ)"></label></div>
        ${rows.length ? `<div class="pm-scroll"><table class="pm-table"><thead><tr><th style="width:34px"><input type="checkbox" data-pm-all ${picked.length === rows.length ? 'checked' : ''}></th><th>รายการ / ที่พัก</th><th>บริษัท</th><th>ยอดตามบิล (LKR)</th><th>จ่ายอย่างไร</th><th>รายละเอียดการจ่าย</th><th>ยอดรวม (LKR)</th></tr></thead><tbody>${body}
            <tr class="grand"><td colspan="6">Grand Total — เลือก ${picked.length} จาก ${rows.length} รายการ</td><td class="n" id="pmGrand">${num(sum(picked))}</td></tr></tbody></table></div>`
            : '<div class="pm-warn">ยังไม่มีบิลที่ได้รับแล้ว — ไปที่แท็บ "ค่าใช้จ่ายและรอบกำหนด" ทำขั้น ② ได้รับบิลและลงเว็บ (วันที่ + รูปบิล + ยอดเงิน) ก่อน รายการจะมาแสดงที่นี่</div>'}
        <label>หมายเหตุด้านล่างใบ (บรรทัดละ 1 ข้อ — แสดงตัวอักษรสีแดงใต้ตาราง)<textarea data-pm-top="notes" rows="3" placeholder="เช่น *** ตึก ... ">${esc(state.notes)}</textarea></label>
        <div class="pm-note">กดสร้างแล้วระบบเก็บเป็นชุดตั้งเบิก (รายการจะไม่โผล่ซ้ำ) + ดาวน์โหลด PDF · จากนั้นส่งใบให้บัญชี แล้วไปกด ขั้น ③ ตั้งเบิก ในแท็บค่าใช้จ่ายพร้อมแนบแคปหน้าแชท (ระบบไม่ข้ามเงื่อนไขของขั้นตอนให้)</div>
        <div><button type="button" class="pm-btn primary" data-pm-create ${picked.length && !state.busy ? '' : 'disabled'}>📄 สร้างชุดตั้งเบิก + ดาวน์โหลด PDF</button></div>`;
    }
    function readTop(root) {
        root.querySelectorAll('[data-pm-top]').forEach(el => { state[el.dataset.pmTop] = el.value; });
    }
    function validatePicked(picked) {
        for (const r of picked) {
            if (!(Number(r.amount) > 0)) return `รายการ "${r.desc} ${r.building}" ยังไม่มียอด`;
            if (!String(r.company || '').trim()) return `รายการ "${r.desc} ${r.building}" ยังไม่ระบุบริษัท`;
            if (r.method === 'bank' && !(r.bank?.trim() && r.acctNo?.trim() && r.acctName?.trim())) return `รายการ "${r.desc} ${r.building}" จ่ายผ่านธนาคาร ต้องระบุธนาคาร / หมายเลขบัญชี / ชื่อบัญชี`;
        }
        return '';
    }
    async function downloadPdf(batch) {
        const items = batch.items.map(i => ({ ...i, payDate: i.payDate || state.payDate || '' }));
        const blob = await request('/room-inspection/pdf', { method: 'POST', body: JSON.stringify({ kind: 'payment-request', data: { period: batch.period, round: batch.round, items, notes: batch.notes } }), blob: true });
        const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ตั้งเบิกค่าน้ำไฟ ${batch.period} ${batch.round}.pdf`.replace(/[\\/:*?"<>|]/g, '-') });
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    }
    async function createBatch() {
        const picked = state.cands.map(c => state.rows.get(c.key)).filter(r => state.sel.has(r.key));
        const bad = validatePicked(picked);
        if (bad) { state.msg = bad; state.bad = true; return render(); }
        state.busy = true; state.msg = 'กำลังบันทึกชุดตั้งเบิกและสร้าง PDF…'; state.bad = false; render();
        try {
            const saved = await request('/accommodation-rooms/payments/batches', { method: 'PUT', body: JSON.stringify({ status: 'requested', period: state.period, round: state.round, label: `${state.period} ${state.round}`, requestedAt: todayDmy(),
                notes: state.notes.split('\n').map(x => x.trim()).filter(Boolean), items: picked.map(r => ({ ...r, payDate: state.payDate })) }) });
            state.sel.clear(); state.rows.clear();
            state.cands = saved.candidates || []; state.batches = saved.batches || [];
            state.batchId = saved.batch.id;
            try { await downloadPdf(saved.batch); state.msg = `สร้างชุดตั้งเบิกแล้ว (${saved.batch.items.length} รายการ) และดาวน์โหลด PDF แล้ว — ต่อไปไปที่แท็บ ② รับเงิน`; state.bad = false; }
            catch (error) { state.msg = `บันทึกชุดตั้งเบิกแล้ว แต่สร้าง PDF ไม่สำเร็จ: ${error.message} — กด "โหลด PDF อีกครั้ง" ในแท็บ ② ได้`; state.bad = true; }
        } catch (error) { state.msg = error.message; state.bad = true; }
        state.busy = false; for (const c of state.cands) state.rows.set(c.key, { ...c, fee: c.fee || (c.method === 'super' ? 30 : 0) }); render();
    }

    // ---------------------------------------------------------------- ตัวเลือกชุด (แท็บ ② ③)
    function batchPicker() {
        const list = state.batches;
        if (!list.length) return '<div class="pm-warn">ยังไม่มีชุดตั้งเบิก — เริ่มที่แท็บ ① ตั้งเบิก</div>';
        const b = batchOf();
        return `<div class="pm-grid"><label>ชุดตั้งเบิก<select data-pm-batch>${list.map(x => `<option value="${esc(x.id)}" ${x.id === state.batchId ? 'selected' : ''}>${esc(x.label || x.period)} · ${x.items.length} รายการ · ${esc(STATUS[x.status] || x.status)}</option>`).join('')}</select></label>
            <div class="pm-kpi"><span>ยอดตั้งเบิกรวม</span><b>LKR ${num(sum(b.items))}</b></div>
            <div style="align-self:end"><button type="button" class="pm-btn" data-pm-pdf>⬇ โหลด PDF ตั้งเบิกอีกครั้ง</button></div></div>`;
    }
    async function patchBatch(fn) {
        const b = structuredClone(batchOf()); fn(b);
        try { const saved = await request('/accommodation-rooms/payments/batches', { method: 'PUT', body: JSON.stringify(b) }); state.batches = saved.batches; state.cands = saved.candidates || state.cands; state.msg = ''; }
        catch (error) { state.msg = error.message; state.bad = true; }
        render();
    }

    // ---------------------------------------------------------------- แท็บ ② รับเงิน
    function receiveHtml() {
        const b = batchOf(); if (!b) return batchPicker();
        const total = sum(b.items), groups = groupsOf(b), received = b.status !== 'requested';
        const q = state.q.trim().toLowerCase();
        const banks = [...new Set(b.items.filter(i => i.method === 'bank').map(i => i.bank || '(ไม่ระบุ)'))];
        const shown = groups.filter(g => (state.filter === 'all' || (state.filter === 'super' && g.method === 'super') || (state.filter === 'condo' && g.method === 'condo') || (state.filter === 'bank' && g.method === 'bank') || state.filter === 'b:' + (g.bank || '(ไม่ระบุ)'))
            && (!q || (g.title + ' ' + g.items.map(i => i.building + ' ' + i.desc + ' ' + i.company).join(' ') + ' ' + g.acctNo + ' ' + g.acctName).toLowerCase().includes(q)));
        const byM = m => sum(b.items.filter(i => i.method === m));
        const paidTotal = sum(groups.filter(g => b.paid?.[g.key]?.at).flatMap(g => g.items));
        const chip = (k, l) => `<button type="button" class="pm-chip ${state.filter === k ? 'is-on' : ''}" data-pm-filter="${esc(k)}">${esc(l)}</button>`;
        return `${batchPicker()}
        <div class="pm-card"><h3 style="margin:0 0 8px">① บันทึกการรับเงิน <small style="font-weight:400;color:#667085">— ต้องบันทึกก่อน จึงติ๊กจ่ายแต่ละก้อนได้</small></h3>
            <div class="pm-grid"><label>วันที่ได้รับเงิน<input data-pm-recv="date" value="${esc(b.receivedAt || todayDmy())}"></label>
            <label>ยอดเงินที่ได้รับจริง (LKR)<input data-pm-recv="amount" inputmode="decimal" value="${esc(b.receivedAmount || total)}"></label>
            <div class="pm-kpi"><span>ส่วนต่างจากยอดตั้งเบิก</span><b id="pmDiff">${num((b.receivedAmount || total) - total)}</b></div>
            <div style="align-self:end"><button type="button" class="pm-btn primary" data-pm-receive>${received ? 'อัปเดตการรับเงิน' : '✔ บันทึกว่าได้รับเงินแล้ว'}</button></div></div></div>
        <div class="pm-kpis"><div class="pm-kpi"><span>🛒 ซุปเปอร์มาเก็ต</span><b>${num(byM('super'))}</b></div><div class="pm-kpi"><span>🏢 นิติบุคคล</span><b>${num(byM('condo'))}</b></div><div class="pm-kpi"><span>🏦 ธนาคาร</span><b>${num(byM('bank'))}</b></div>
            <div class="pm-kpi"><span>จ่ายแล้ว / ทั้งหมด</span><b>${num(paidTotal)} / ${num(total)}</b></div></div>
        <div class="pm-chips">${chip('all', `ทั้งหมด ${groups.length} ก้อน`)}${chip('super', 'ซุปเปอร์มาเก็ต')}${chip('condo', 'นิติบุคคล')}${chip('bank', 'ธนาคารทั้งหมด')}${banks.map(x => chip('b:' + x, x)).join('')}
            <input data-pm-q placeholder="ค้นหาที่พัก / ธนาคาร / บริษัท…" value="${esc(state.q)}" style="max-width:260px"></div>
        <div class="pm-groups">${shown.map(g => { const p = b.paid?.[g.key] || {}; return `<div class="pm-group ${p.at ? 'is-paid' : ''}"><h4>${esc(g.title)}</h4>
            ${g.method === 'bank' ? `<div class="pm-note">เลขบัญชี ${esc(g.acctNo)} · ${esc(g.acctName)}</div>` : ''}
            <div class="tot">LKR ${num(sum(g.items))}</div><div class="pm-note">${g.items.length} รายการ · ${[...new Set(g.items.map(i => i.company))].join(', ')}</div>
            <ul>${g.items.map(i => `<li>${esc(i.building)} — ${esc(i.desc)} <b>${num(itemTotal(i))}</b></li>`).join('')}</ul>
            <label class="pm-check"><input type="checkbox" data-pm-paid="${esc(g.key)}" ${p.at ? 'checked' : ''} ${received ? '' : 'disabled'}><span>จ่ายก้อนนี้แล้ว ${p.at ? `<small>· ${esc(p.at)}</small>` : (received ? '' : '<small>(ต้องบันทึกรับเงินก่อน)</small>')}</span></label></div>`; }).join('') || '<div class="pm-note">ไม่พบก้อนที่ตรงกับตัวกรอง</div>'}</div>`;
    }

    // ---------------------------------------------------------------- แท็บ ③ นำส่งหลักฐาน
    const CHANNELS = [['telegram', 'ส่งบิลที่จ่ายแล้วลง Telegram กลุ่ม SL ตั้งเบิก (ให้บัญชีดู)'], ['whatsapp', 'ส่งลงกลุ่ม WhatsApp ให้เจ้าของดู'], ['web', 'อัปโหลดบิลที่จ่ายแล้วขึ้นหน้าเว็บ (เก็บหลักฐาน)']];
    function deliverHtml() {
        const b = batchOf(); if (!b) return batchPicker();
        const groups = groupsOf(b);
        const complete = g => b.paid?.[g.key]?.at && CHANNELS.every(([k]) => b.deliver?.[g.key]?.[k]);
        const done = groups.filter(complete).length;
        return `${batchPicker()}
        <div class="pm-kpis"><div class="pm-kpi"><span>นำส่งครบแล้ว</span><b>${done} / ${groups.length} ก้อน</b></div></div>
        ${b.status === 'requested' ? '<div class="pm-warn">ยังไม่ได้บันทึกการรับเงิน (แท็บ ② รับเงิน) — ต้องรับเงินและจ่ายก่อน จึงนำส่งหลักฐานได้</div>' : ''}
        <div class="pm-groups">${groups.map(g => { const paid = !!b.paid?.[g.key]?.at, d = b.deliver?.[g.key] || {}; return `<div class="pm-group ${complete(g) ? 'is-paid' : ''}"><h4>${esc(g.title)}</h4>
            <div class="tot">LKR ${num(sum(g.items))}</div><div class="pm-note">${g.items.map(i => esc(i.building)).join(' · ')}</div>
            ${paid ? '' : '<div class="pm-warn">ก้อนนี้ยังไม่ได้ติ๊ก "จ่ายแล้ว" (แท็บ ② รับเงิน) — ติ๊กนำส่งไม่ได้</div>'}
            ${CHANNELS.map(([k, l]) => `<label class="pm-check"><input type="checkbox" data-pm-deliver="${esc(g.key)}|${k}" ${d[k] ? 'checked' : ''} ${paid ? '' : 'disabled'}><span>${esc(l)} ${d[k] ? `<small>· ${esc(d[k])}</small>` : ''}</span></label>`).join('')}</div>`; }).join('')}</div>
        <div><button type="button" class="pm-btn primary" data-pm-finish ${done === groups.length && b.status !== 'done' ? '' : 'disabled'}>${b.status === 'done' ? '✓ ชุดนี้เสร็จสมบูรณ์แล้ว' : '✔ ปิดชุดนี้ (นำส่งหลักฐานครบทุกก้อน)'}</button></div>`;
    }

    function render() {
        const tabs = [['request', '① ตั้งเบิก', 'เลือกบิลที่ได้รับ · แยกบริษัท · วิธีจ่าย · PDF'], ['receive', '② รับเงิน', 'จัดก้อนเงินตามจุดจ่าย · ยอดแต่ละที่'], ['deliver', '③ นำส่งหลักฐานการจ่าย', 'Telegram · WhatsApp · หน้าเว็บ']];
        const body = state.tab === 'request' ? requestHtml() : state.tab === 'receive' ? receiveHtml() : deliverHtml();
        const keep = dialog.querySelector('.pm-wrap')?.scrollTop || 0;
        dialog.innerHTML = `<div class="pm-wrap"><div class="pm-top"><h2>จัดการรายงานทุกขั้นตอน — บิลที่พักพนักงาน</h2><button type="button" class="pm-btn" data-pm-close>ปิด</button></div>
            <div class="pm-tabs">${tabs.map(([k, t, s]) => `<button type="button" data-pm-tab="${k}" class="${state.tab === k ? 'is-on' : ''}">${t}<small>${s}</small></button>`).join('')}</div>
            <p class="pm-msg ${state.bad ? 'bad' : ''}" role="status">${esc(state.msg)}</p>${body}</div>`;
        dialog.querySelector('.pm-wrap').scrollTop = keep;
    }

    // ---------------------------------------------------------------- เหตุการณ์
    dialog.addEventListener('click', async event => {
        const t = event.target;
        if (t.closest('[data-pm-close]') || t === dialog) return dialog.close();
        const tab = t.closest('[data-pm-tab]'); if (tab) { readTop(dialog); state.tab = tab.dataset.pmTab; state.msg = ''; state.bad = false; return render(); }
        const f = t.closest('[data-pm-filter]'); if (f) { state.filter = f.dataset.pmFilter; return render(); }
        if (t.closest('[data-pm-create]')) { readTop(dialog); return createBatch(); }
        if (t.closest('[data-pm-pdf]')) { try { state.msg = 'กำลังสร้าง PDF…'; state.bad = false; render(); await downloadPdf(batchOf()); state.msg = 'ดาวน์โหลด PDF แล้ว'; } catch (error) { state.msg = error.message; state.bad = true; } return render(); }
        if (t.closest('[data-pm-receive]')) {
            const date = dialog.querySelector('[data-pm-recv=date]').value.trim(), amount = dialog.querySelector('[data-pm-recv=amount]').value.trim();
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) { state.msg = 'กรอกวันที่ได้รับเงินเป็น วัน/เดือน/ปี'; state.bad = true; return render(); }
            if (!(Number(String(amount).replace(/,/g, '')) > 0)) { state.msg = 'กรอกยอดเงินที่ได้รับจริง'; state.bad = true; return render(); }
            return patchBatch(b => { b.receivedAt = date; b.receivedAmount = Number(String(amount).replace(/,/g, '')); if (b.status === 'requested') b.status = 'received'; });
        }
        if (t.closest('[data-pm-finish]')) return patchBatch(b => { b.status = 'done'; });
    });
    dialog.addEventListener('change', event => {
        const t = event.target;
        if (t.matches('[data-pm-batch]')) { state.batchId = t.value; return render(); }
        if (t.matches('[data-pm-all]')) { readTop(dialog); state.cands.forEach(c => t.checked ? state.sel.add(c.key) : state.sel.delete(c.key)); return render(); }
        const row = t.closest('tr[data-key]');
        if (row) {
            readTop(dialog);
            const r = state.rows.get(row.dataset.key);
            if (t.matches('[data-pm-sel]')) { t.checked ? state.sel.add(r.key) : state.sel.delete(r.key); return render(); }
            const f = t.dataset.f; if (!f) return;
            r[f] = t.value;
            if (f === 'method' && t.value === 'super' && !Number(r.fee)) r.fee = 30;
            if (f === 'method' || f === 'company') return render();
            // ช่องอื่น: อัปเดตยอดรวมในที่เดิม ไม่วาดใหม่ (กันโฟกัสหลุดตอนกด Tab)
            dialog.querySelectorAll('tr[data-key]').forEach(tr => { const x = state.rows.get(tr.dataset.key); tr.querySelector('.rowtot').textContent = num(itemTotal(x)); });
            dialog.querySelectorAll('tr.sub').forEach(tr => { const list = state.cands.map(c => state.rows.get(c.key)).filter(x => ((x.company || '').trim() || 'ไม่ระบุบริษัท') === tr.dataset.co && state.sel.has(x.key)); tr.querySelector('.subtot').textContent = num(sum(list)); });
            const g = dialog.querySelector('#pmGrand'); if (g) g.textContent = num(sum(state.cands.map(c => state.rows.get(c.key)).filter(x => state.sel.has(x.key))));
            return;
        }
        if (t.matches('[data-pm-top]')) { readTop(dialog); return; }
        if (t.matches('[data-pm-paid]')) { const k = t.dataset.pmPaid, on = t.checked; return patchBatch(b => { b.paid = b.paid || {}; if (on) b.paid[k] = { at: todayDmy(), by: '' }; else delete b.paid[k]; if (!on) { delete (b.deliver || {})[k]; if (b.status === 'done') b.status = 'received'; } }); }
        if (t.matches('[data-pm-deliver]')) { const [k, ch] = t.dataset.pmDeliver.split('|'), on = t.checked; return patchBatch(b => { b.deliver = b.deliver || {}; b.deliver[k] = b.deliver[k] || {}; b.deliver[k][ch] = on ? todayDmy() : ''; if (!on && b.status === 'done') b.status = 'received'; }); }
    });
    dialog.addEventListener('input', event => {
        const t = event.target;
        if (t.matches('[data-pm-q]')) { state.q = t.value; const pos = t.selectionStart; render(); const q = dialog.querySelector('[data-pm-q]'); q.focus(); q.setSelectionRange(pos, pos); return; }
        if (t.matches('[data-pm-recv]')) { const b = batchOf(), a = Number(String(dialog.querySelector('[data-pm-recv=amount]').value).replace(/,/g, '')) || 0; const d = dialog.querySelector('#pmDiff'); if (d && b) d.textContent = num(a - sum(b.items)); }
    });
    button.addEventListener('click', async () => {
        state.msg = 'กำลังโหลด…'; state.bad = false; render(); dialog.showModal();
        try { await load(); state.msg = ''; } catch (error) { state.msg = error.message; state.bad = true; }
        render();
    });
})();
