// จัดการพนักงาน: ตารางจัดสรรสิ่งของตามเงื่อนไข (แถว = พนักงานในกล่องงาน · คอลัมน์ = รายการสิ่งของ · ช่อง = จำนวนชิ้น)
// สรุปสดบนหัวตาราง: สต็อกตั้งต้น − ที่แจกทั้งหมด = คงเหลือ (เกิน = ตัวแดง) · ท้ายแถว = ได้กี่รายการ/กี่ชิ้น · บันทึกทั้งหมดครั้งเดียว · พิมพ์ใบสรุปรายบุคคลได้
// ต้องโหลดหลัง staff-conditions.js (ใช้ window.StaffAlloc)
(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const A = () => window.StaffAlloc;
    const G = { box: '', cond: '', drafts: new Map(), dialog: null };
    const k = (emp, item) => `${emp}|${item}`;
    const num = v => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 0; };
    const data = () => A().view(G.box);
    const savedQty = (d, emp, item) => d.allocs.find(a => a.employee_key === emp && a.item_id === item)?.qty || 0;
    const qtyOf = (d, emp, item) => G.drafts.has(k(emp, item)) ? G.drafts.get(k(emp, item)) : savedQty(d, emp, item);
    function usedOf(d, item) {   // ยอดแจกทั้งหมด (ทุกคนในกล่อง ไม่ขึ้นกับตัวกรอง) รวมที่ยังไม่บันทึก
        let sum = 0; const seen = new Set();
        for (const a of d.allocs) if (a.item_id === item) { const key = k(a.employee_key, item); seen.add(key); sum += G.drafts.has(key) ? G.drafts.get(key) : a.qty; }
        for (const [key, q] of G.drafts) if (key.endsWith(`|${item}`) && !seen.has(key)) sum += q;
        return sum;
    }
    const rows = d => {
        const { state } = A().ctx();
        return A().peopleOf(G.box).map(key => state.byKey.get(key)).filter(Boolean).filter(e => {
            const c = d.assign[e.key] || '';
            return !G.cond || (G.cond === '_none' ? !c : c === G.cond);
        });
    };
    // ข้อมูลที่พนักงานกรอกจากลิงก์ของงานในกล่องนี้ (ตรงกับปุ่ม "งานที่มอบหมาย"/ชีตส่งของ)
    const tasksOf = key => (A().ctx().state.data.tasks || []).filter(t => t.box === G.box && t.employee_key === key && !['cancelled', 'deleted'].includes(t.status));
    const infoCols = () => {   // คอลัมน์ไดนามิก = ชื่อช่องกรอกทั้งหมดของงานในกล่อง (ไม่ซ้ำ เรียงตามที่พบ)
        const seen = new Set();
        for (const t of (A().ctx().state.data.tasks || [])) if (t.box === G.box && !['cancelled', 'deleted'].includes(t.status)) for (const f of (t.fields || [])) if (f.label) seen.add(f.label);
        return [...seen];
    };
    const answer = (key, label) => {
        for (const t of tasksOf(key)) for (const f of (t.fields || [])) if (f.label === label && t.response?.[f.id]) return String(t.response[f.id]);
        return '';
    };
    const sentOf = key => tasksOf(key).some(t => t.submitted_at || t.status === 'done' || t.status === 'submitted');
    const longCol = label => /ที่อยู่|หมายเหตุ|เวลา|ข้อมูล/.test(label);
    const dirtyCount = () => G.drafts.size;

    // ตัดช่องที่ยังไม่บันทึกของรายการที่ถูกลบ/พนักงานที่ออกจากกล่องแล้ว (ไม่งั้นหลังบ้านปฏิเสธทั้งชุดและบันทึกไม่ได้)
    function pruneDrafts(d) {
        const items = new Set(d.items.map(i => i.id)), people = new Set(A().peopleOf(G.box));
        for (const key of [...G.drafts.keys()]) { const at = key.lastIndexOf('|'); if (!items.has(key.slice(at + 1)) || !people.has(key.slice(0, at))) G.drafts.delete(key); }
    }
    function render() {
        const d = data();
        pruneDrafts(d);
        const list = rows(d);
        const cols = infoCols();
        const head = d.items.map(i => `<th class="sa-item" scope="col"><b>${esc(i.name)}</b><small data-sum="${esc(i.id)}"></small></th>`).join('');
        const infoHead = `<th class="sa-info" scope="col">สถานะการกรอก</th>${cols.map(c => `<th class="sa-info${longCol(c) ? ' is-long' : ''}" scope="col">${esc(c)}</th>`).join('')}`;
        const body = list.map(e => {
            const c = A().condOf(G.box, e.key), ok = sentOf(e.key);
            const infoCells = `<td class="sa-info"><span class="fa-badge ${ok ? 'ok' : 'dim'}">${ok ? 'ส่งข้อมูลแล้ว' : 'ยังไม่ส่งข้อมูล'}</span></td>${cols.map(l => `<td class="sa-info${longCol(l) ? ' is-long' : ''}">${esc(answer(e.key, l)) || '<span class="sa-note">–</span>'}</td>`).join('')}`;
            return `<tr data-emp="${esc(e.key)}"><th class="sa-who" scope="row"><b>${esc(e.fullname)}${e.nickname ? ` (${esc(e.nickname)})` : ''}</b><small>${esc([e.employeeId || e.centralId, e.insuranceCode].filter(Boolean).join(' · '))}</small>${c ? A().badge(c) : ''}<span class="sa-got" data-got="${esc(e.key)}"></span></th>
                ${infoCells}
                ${d.items.map(i => { const q = qtyOf(d, e.key, i.id), at = `data-q="${esc(e.key)}" data-i="${esc(i.id)}"`; return `<td class="sa-qty${G.drafts.has(k(e.key, i.id)) ? ' is-dirty' : ''}${q ? ' has-qty' : ''}"><div class="sa-ctl"><button type="button" class="sa-step" data-step="-1" ${at} aria-label="ลด 1">−</button><input type="number" min="0" max="100000" step="1" inputmode="numeric" placeholder="–" value="${q || ''}" ${at} aria-label="${esc(e.fullname)} · ${esc(i.name)}"><button type="button" class="sa-step" data-step="1" ${at} aria-label="เพิ่ม 1">＋</button><button type="button" class="sa-tick${q ? ' is-on' : ''}" data-tick ${at} aria-label="ให้ 1 ชิ้น / ล้าง" title="ให้ 1 ชิ้น (กดซ้ำ = ล้าง)">✓</button></div></td>`; }).join('')}
                <td class="sa-total" data-kinds="${esc(e.key)}"></td><td class="sa-total" data-pieces="${esc(e.key)}"></td></tr>`;
        }).join('');
        const span = cols.length + 1;
        G.dialog.innerHTML = `<div class="sa-box sa-wide"><header class="sa-head"><div><h2>📦 จัดสรรสิ่งของ · ${esc(A().boxTitle(G.box))}</h2><p>กรอกจำนวนชิ้นที่แจกให้แต่ละคน (หรือกด ✓ = 1 ชิ้น) · ดูข้อมูลที่พนักงานกรอกประกอบได้ในแถวเดียวกัน · สต็อกจัดการที่แผงด้านขวา</p></div><button type="button" class="sa-x" data-ag-close aria-label="ปิด">×</button></header>
            <div class="sa-split"><section class="sa-main">
                <div class="sa-tools"><label>กรองตามเงื่อนไข <select data-ag-cond><option value="">ทั้งหมด</option><option value="_none">ยังไม่กำหนด</option>${d.conds.map(c => `<option value="${esc(c.id)}"${G.cond === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><span class="sa-note" data-ag-count></span><div class="sa-pills" data-pills aria-label="สรุปสต็อกคงเหลือ"></div></div>
                ${d.items.length ? `<div class="sa-scroll"><table class="sa-table"><thead><tr><th class="sa-who" scope="col">พนักงาน (${list.length} คน)</th>${infoHead}${head}<th class="sa-total" scope="col">รายการ</th><th class="sa-total" scope="col">รวมชิ้น</th></tr></thead><tbody>${body || `<tr><td colspan="${d.items.length + span + 3}" class="sa-note">ไม่มีพนักงานตามเงื่อนไขนี้</td></tr>`}</tbody>
                    <tfoot><tr><th class="sa-who" scope="row">รวมที่แสดง</th><td class="sa-info" colspan="${span}"></td>${d.items.map(i => `<td class="sa-total" data-col="${esc(i.id)}"></td>`).join('')}<td class="sa-total" data-all-kinds></td><td class="sa-total" data-all-pieces></td></tr></tfoot></table></div>` : '<p class="sa-note">เพิ่มรายการสิ่งของที่แผงด้านขวาก่อน แล้วตารางจัดสรรจะแสดงที่นี่</p>'}
            </section>
            <aside class="sa-side"><section class="sa-stock"><h3>รายการสิ่งของและสต็อกตั้งต้น</h3>
                ${d.items.map(i => `<div class="sa-row" data-item="${esc(i.id)}"><div class="sa-row-top"><input type="text" data-iname value="${esc(i.name)}" maxlength="80" aria-label="ชื่อรายการ"><button type="button" class="sa-trash" data-idel aria-label="ลบรายการ ${esc(i.name)}" title="ลบรายการ">🗑</button></div><div class="sa-row-bot"><label>สต็อกตั้งต้น: <input data-istock type="number" min="0" step="1" value="${i.stock}"></label><span class="sa-left" data-side="${esc(i.id)}"></span></div></div>`).join('') || '<p class="sa-note">ยังไม่มีรายการสิ่งของ — เพิ่มด้านล่าง</p>'}
                <form class="sa-add" data-ag-add><input name="name" maxlength="80" placeholder="ชื่อรายการ เช่น เสื้อยูนิฟอร์ม" required><input name="stock" type="number" min="0" step="1" value="0" aria-label="สต็อกตั้งต้น"><button class="fa-btn fa-btn-primary">＋ เพิ่มรายการ</button></form></section>
                <div class="sa-actions"><span class="sa-dirty" data-ag-dirty></span><p class="sa-msg" data-ag-msg role="status"></p>
                    <button type="button" class="fa-btn" data-ag-print>🖨 พิมพ์ใบสรุปการแจกของ</button><button type="button" class="fa-btn fa-btn-primary" data-ag-save>💾 บันทึกการจัดสรรทั้งหมด</button></div></aside></div></div>`;
        totals();
    }
    // อัปเดตตัวเลขสรุปทั้งหมดโดยไม่วาดตารางใหม่ (ไม่ให้ช่องที่กำลังพิมพ์เสียโฟกัส)
    function totals() {
        const d = data(), q = s => G.dialog.querySelector(s), list = rows(d);
        const pills = [];
        for (const i of d.items) {
            const used = usedOf(d, i.id), left = i.stock - used, n = q(`[data-sum="${CSS.escape(i.id)}"]`);
            const level = left <= 0 ? 'is-out' : left < i.stock * 0.2 ? 'is-low' : 'is-ok';   // หมด/เกิน = แดง · เหลือ < 20% = ส้ม
            pills.push(`<span class="sa-pill ${level}" title="สต็อกตั้งต้น ${i.stock} · แจก ${used}">${esc(i.name)}: ${left < 0 ? `เกิน ${-left}` : `เหลือ ${left}`} / ${i.stock}</span>`);
            const side = q(`[data-side="${CSS.escape(i.id)}"]`);
            if (side) { side.textContent = `แจกแล้ว ${used} • ${left < 0 ? `เกิน ${-left}` : `เหลือ ${left}`}`; side.className = `sa-left ${level}`; }
            if (n) { n.textContent = left < 0 ? `สต็อก ${i.stock} · แจก ${used} · เกิน ${-left}` : `สต็อก ${i.stock} · แจก ${used} · เหลือ ${left}`; n.className = left < 0 ? 'is-over' : left === 0 ? 'is-zero' : ''; }
            const col = q(`[data-col="${CSS.escape(i.id)}"]`);
            if (col) col.textContent = list.reduce((s, e) => s + qtyOf(d, e.key, i.id), 0);
        }
        const pillBox = q('[data-pills]'); if (pillBox) pillBox.innerHTML = pills.join('');
        let kinds = 0, pieces = 0;
        for (const e of list) {
            const mine = d.items.map(i => qtyOf(d, e.key, i.id));
            const got = q(`[data-got="${CSS.escape(e.key)}"]`);   // ป้ายของที่คนนี้ได้ (สดทุกครั้งที่กรอก)
            if (got) got.innerHTML = d.items.filter((i, n) => mine[n]).map(i => `<em class="sa-gotpill">${esc(i.name)} ×${mine[d.items.indexOf(i)]}</em>`).join('') || '<em class="sa-gotnone">ยังไม่ได้จัดสรร</em>';
            const a = mine.filter(Boolean).length, b = mine.reduce((s, x) => s + x, 0);
            kinds += a; pieces += b;
            const ka = q(`[data-kinds="${CSS.escape(e.key)}"]`), kb = q(`[data-pieces="${CSS.escape(e.key)}"]`);
            if (ka) ka.textContent = a || '–'; if (kb) kb.textContent = b || '–';
        }
        const set = (s, v) => { const n = q(s); if (n) n.textContent = v; };
        set('[data-all-kinds]', kinds); set('[data-all-pieces]', pieces);
        set('[data-ag-count]', `แสดง ${list.length} คน`);
        const n = dirtyCount(), dn = q('[data-ag-dirty]');
        if (dn) dn.textContent = n ? `● ยังไม่ได้บันทึก ${n} ช่อง` : '';
        const over = d.items.filter(i => usedOf(d, i.id) > i.stock).map(i => i.name);
        set('[data-ag-msg]', over.length ? `⚠ แจกเกินสต็อก: ${over.join(', ')}` : '');
        const m = q('[data-ag-msg]'); if (m) m.className = `sa-msg${over.length ? ' is-bad' : ''}`;
    }
    function setQty(emp, item, value) {
        const d = data(), q = num(value), key = k(emp, item);
        if (q === savedQty(d, emp, item)) G.drafts.delete(key); else G.drafts.set(key, q);
        const input = G.dialog.querySelector(`input[data-q="${CSS.escape(emp)}"][data-i="${CSS.escape(item)}"]`);
        if (input) { const td = input.closest('td'); td.classList.toggle('is-dirty', G.drafts.has(key)); td.classList.toggle('has-qty', q > 0); td.querySelector('[data-tick]').classList.toggle('is-on', q > 0); }
        totals();
    }
    const flash = (text, bad) => { const n = G.dialog.querySelector('[data-ag-msg]'); if (n) { n.textContent = text; n.className = `sa-msg${bad ? ' is-bad' : ''}`; } };
    async function api(path, method, body, ok) {
        try { await A().call(G.box, path, method, body); render(); if (ok) flash(ok); } catch (error) { flash(error.message, true); }
    }
    async function save() {
        const d = data();
        if (!dirtyCount()) return flash('ไม่มีการแก้ไขที่ต้องบันทึก');
        const over = d.items.filter(i => usedOf(d, i.id) > i.stock).map(i => i.name);
        if (over.length && !confirm(`แจกเกินสต็อก: ${over.join(', ')}\nต้องการบันทึกต่อหรือไม่?`)) return;
        const cells = [...G.drafts].map(([key, qty]) => { const at = key.lastIndexOf('|'); return { employee_key: key.slice(0, at), item_id: key.slice(at + 1), qty }; });
        try { const r = await A().call(G.box, '/allocations', 'PUT', { cells }); G.drafts.clear(); render(); flash(`บันทึกการจัดสรรแล้ว (${r.saved} ช่อง)`); } catch (error) { flash(error.message, true); }
    }
    function print() {
        if (dirtyCount()) return flash('มีการแก้ไขที่ยังไม่บันทึก — กดบันทึกก่อนพิมพ์', true);
        const d = data(), list = rows(d).filter(e => d.items.some(i => qtyOf(d, e.key, i.id)));
        if (!list.length) return flash('ยังไม่มีใครได้รับของ', true);
        const date = new Date().toLocaleDateString('th-TH', { dateStyle: 'long' });
        const html = `<!doctype html><meta charset="utf-8"><title>ใบสรุปการแจกของ</title><style>body{font:14px Sarabun,Tahoma,sans-serif;margin:24px}table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border:1px solid #444;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eee}h1{font-size:20px;margin:0}p{margin:4px 0 14px}</style>
            <h1>ใบสรุปการแจกของ — ${esc(A().boxTitle(G.box))}</h1><p>พิมพ์เมื่อ ${esc(date)}</p>
            <table><thead><tr><th>ลำดับ</th><th>พนักงาน</th><th>เงื่อนไข</th><th>สิ่งของที่ได้รับ</th><th>รวม (ชิ้น)</th><th>ลงชื่อรับของ</th></tr></thead><tbody>${list.map((e, n) => {
                const got = d.items.map(i => ({ i, q: qtyOf(d, e.key, i.id) })).filter(x => x.q);
                return `<tr><td>${n + 1}</td><td>${esc(e.fullname)}<br>${esc([e.employeeId || e.centralId, e.insuranceCode].filter(Boolean).join(' · '))}</td><td>${esc(A().condOf(G.box, e.key)?.name || '-')}</td><td>${got.map(x => `${esc(x.i.name)} × ${x.q}`).join('<br>')}</td><td>${got.reduce((s, x) => s + x.q, 0)}</td><td></td></tr>`;
            }).join('')}</tbody></table>
            <table><thead><tr><th>สิ่งของ</th><th>สต็อกตั้งต้น</th><th>แจกแล้ว</th><th>คงเหลือ</th></tr></thead><tbody>${d.items.map(i => { const used = usedOf(d, i.id); return `<tr><td>${esc(i.name)}</td><td>${i.stock}</td><td>${used}</td><td>${i.stock - used}</td></tr>`; }).join('')}</tbody></table>`;
        const frame = Object.assign(document.createElement('iframe'), { className: 'sa-printframe', srcdoc: html });
        frame.addEventListener('load', () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000); });
        document.body.append(frame);
    }
    const close = () => { if (dirtyCount() && !confirm('มีการแก้ไขที่ยังไม่บันทึก — ปิดแล้วจะหายไป ปิดหน้าต่างเลยหรือไม่?')) return; G.drafts.clear(); G.dialog.close(); A().ctx().rerender(); };

    async function open(box) {
        if (!box || !A()) return;
        G.box = box; G.drafts.clear(); G.cond = document.getElementById('smCond')?.value || '';
        G.dialog ||= Object.assign(document.createElement('dialog'), { className: 'fa-dialog sa-dialog' });
        if (!G.dialog.isConnected) document.body.append(G.dialog);
        G.dialog.innerHTML = '<div class="sa-box"><p class="sa-note">กำลังโหลด…</p></div>';
        if (!G.dialog.open) G.dialog.showModal();
        try { await A().load(box, true); render(); } catch (error) { G.dialog.innerHTML = `<div class="sa-box"><header class="sa-head"><h2>📦 จัดสรรสิ่งของ</h2><button type="button" class="sa-x" data-ag-close>×</button></header><p class="sa-msg is-bad">${esc(error.message)}</p></div>`; }
    }
    document.addEventListener('input', e => { const i = e.target.closest?.('input[data-q]'); if (i && G.dialog?.contains(i)) setQty(i.dataset.q, i.dataset.i, i.value); });
    document.addEventListener('click', e => {
        if (!G.dialog?.open || !G.dialog.contains(e.target)) return;
        const t = e.target, row = t.closest('[data-item]');
        if (t === G.dialog || t.closest('[data-ag-close]')) return close();
        const tick = t.closest('[data-tick]');
        const cellInput = b => b.closest('td').querySelector('input[data-q]');
        if (tick) { const input = cellInput(tick); input.value = num(input.value) ? '' : 1; return setQty(tick.dataset.q, tick.dataset.i, input.value); }
        const step = t.closest('[data-step]');
        if (step) { const input = cellInput(step), n = Math.min(100000, Math.max(0, num(input.value) + Number(step.dataset.step))); input.value = n || ''; return setQty(step.dataset.q, step.dataset.i, input.value); }
        if (t.closest('[data-ag-save]')) return save();
        if (t.closest('[data-ag-print]')) return print();
        if (t.closest('[data-idel]') && confirm('ลบรายการสิ่งของนี้? (ข้อมูลในชีตยังอยู่ แต่จะไม่แสดงในตาราง)')) api(`/items/${encodeURIComponent(row.dataset.item)}/delete`, 'POST', {}, 'ลบรายการแล้ว');
    });
    document.addEventListener('change', e => {
        if (!G.dialog?.open || !G.dialog.contains(e.target)) return;
        const row = e.target.closest('[data-item]');
        if (e.target.matches('[data-ag-cond]')) { G.cond = e.target.value; return render(); }
        if (row && e.target.matches('[data-iname],[data-istock]')) api(`/items/${encodeURIComponent(row.dataset.item)}`, 'PUT', { name: row.querySelector('[data-iname]').value, stock: row.querySelector('[data-istock]').value }, 'บันทึกรายการแล้ว');
    });
    document.addEventListener('submit', e => {
        const f = e.target.closest?.('[data-ag-add]');
        if (!f || !G.dialog?.contains(f)) return;
        e.preventDefault();
        api('/items', 'POST', { name: f.elements.name.value, stock: f.elements.stock.value }, 'เพิ่มรายการแล้ว');
    });
    // กด Esc ก็ต้องถามก่อนทิ้งที่ยังไม่บันทึก (เหมือนปุ่ม ×)
    document.addEventListener('cancel', e => { if (G.dialog && e.target === G.dialog) { e.preventDefault(); close(); } }, true);
    window.StaffAllocGrid = { open };
})();
