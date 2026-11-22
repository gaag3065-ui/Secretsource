// นำเข้าวันที่แต่ละขั้นตอนของบ้านใหม่ (ตรวจสอบ → ตั้งเบิกมัดจำ → … → เซ็นสัญญา) จากแชท Telegram ลงทะเบียนห้องพัก
// ดูตัวอย่างก่อน: จับคู่บ้านในแชทกับห้องในทะเบียน + เทียบกับค่าที่มีอยู่ → ติ๊กเลือก → บันทึก (เติมเฉพาะช่องว่าง · ช่องที่ต่างจากเดิมต้องติ๊กทับเอง)
(() => {
    const actions = document.querySelector('.as-actions');
    if (!actions) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms/timeline-import`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const KEYS = ['dH', 'dI', 'dJ', 'dK', 'dL', 'dM', 'dN', 'dO', 'dP', 'dQ'];
    const SHORT = { dH: 'ตรวจห้อง', dI: 'ตั้งเบิกมัดจำ', dJ: 'จ่ายมัดจำ', dK: 'ได้รับสัญญา', dL: 'ส่งทนาย', dM: 'ทนายตรวจเสร็จ', dN: 'ตั้งเบิกค่าเช่า', dO: 'ได้รับเงิน', dP: 'ตรวจก่อนเซ็น', dQ: 'เซ็นสัญญา' };
    const state = { data: null, sel: new Map(), msg: '', bad: false, busy: false };

    document.head.insertAdjacentHTML('beforeend', `<style>
        .ti-dialog { width: min(1500px, 98vw); max-height: 96dvh; border: 0; border-radius: 16px; padding: 0; box-shadow: 0 24px 70px rgba(16,24,40,.3); }
        .ti-dialog::backdrop { background: rgba(16,24,40,.55); }
        .ti-wrap { display: grid; gap: 10px; padding: 16px 18px; max-height: 96dvh; overflow: auto; font-size: 13.5px; }
        .ti-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; } .ti-top h2 { margin: 0; font-size: 19px; }
        .ti-note { color: #475467; font-size: 12.5px; } .ti-msg { min-height: 18px; color: #087f74; font-size: 13px; } .ti-msg.bad { color: #b42318; font-weight: 700; }
        .ti-table { width: 100%; border-collapse: collapse; font-size: 12px; } .ti-table th { background: #f1f5f6; position: sticky; top: 0; padding: 6px 4px; border: 1px solid #e1e7ea; font-size: 11.5px; }
        .ti-table td { border: 1px solid #e1e7ea; padding: 4px; vertical-align: top; } .ti-table td.c { text-align: center; white-space: nowrap; }
        .ti-new { background: #e5f7f4; } .ti-same { background: #f2f4f7; color: #667085; } .ti-conf { background: #ffe6c7; } .ti-inf { outline: 1px dashed #b54708; }
        .ti-table select { max-width: 230px; font: inherit; font-size: 12px; } .ti-end { color: #b42318; font-weight: 700; font-size: 11px; }
        .ti-btn { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; } .ti-btn.primary { background: #087f74; color: #fff; border-color: #087f74; } .ti-btn:disabled { opacity: .45; cursor: not-allowed; }
        .ti-legend span { display: inline-block; padding: 2px 8px; border-radius: 6px; margin-right: 6px; font-size: 12px; }
    </style>`);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'as-btn as-btn-ghost'; button.textContent = 'นำเข้าวันที่จากแชท Telegram';
    actions.prepend(button);
    const dialog = document.createElement('dialog'); dialog.className = 'ti-dialog'; document.body.append(dialog);

    async function request(url, options) {
        const response = await window.authFetch(url, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ (ต้องมีสิทธิ์ "ติดตามขั้นตอนที่พักใหม่ (Flow chart)")');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    const norm = v => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v || '').trim()); return m ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}` : String(v || '').trim(); };
    const roomOf = no => state.data.rooms.find(r => r.no === Number(no));
    // สถานะรายช่อง: new = ช่องว่างในทะเบียน (จะเติม) · same = ตรงกันแล้ว · conf = ต่างจากเดิม (ต้องติ๊กทับเอง)
    function cellStatus(item, key, s) {
        const step = item.steps[key]; if (!step) return null;
        const room = s.no ? roomOf(s.no) : null, old = room ? norm(room.current[key]) : '';
        return !room ? 'new' : !old ? 'new' : old === step.date ? 'same' : 'conf';
    }
    function totals() {
        let houses = 0, cells = 0;
        for (const item of state.data.items) { const s = state.sel.get(item.name); if (!s?.on || !s.no) continue; let n = 0; for (const k of KEYS) { const st = cellStatus(item, k, s); if (st === 'new' || (st === 'conf' && s.over[k])) n++; } if (n) { houses++; cells += n; } }
        return { houses, cells };
    }
    function render() {
        if (!state.data) return;
        const d = state.data, t = totals();
        const auto = d.items.filter(i => i.matched).length;
        const rows = d.items.map(item => {
            const s = state.sel.get(item.name);
            const room = s.no ? roomOf(s.no) : null;
            const opts = [...new Map([...item.candidates.map(c => [c.no, `${c.no}. ${c.project} ${c.unit}`]), ...(room ? [[room.no, `${room.no}. ${room.project} ${room.unit}`]] : [])]).entries()].map(([no, l]) => `<option value="${no}" ${Number(s.no) === Number(no) ? 'selected' : ''}>${esc(l)}</option>`).join('');
            const all = d.rooms.map(r => `<option value="${r.no}">${r.no}. ${esc(r.project)} ${esc(r.unit)}</option>`).join('');
            return `<tr data-name="${esc(item.name)}"><td class="c"><input type="checkbox" data-ti-on ${s.on ? 'checked' : ''} ${s.no ? '' : 'disabled'}></td>
                <td><b>${esc(item.name)}</b>${item.ended ? `<div class="ti-end">⚠ ยกเลิก/คืนเงิน — ${esc(item.endNote)}</div>` : ''}</td>
                <td><select data-ti-room><option value="">— เลือกห้องในทะเบียน —</option>${opts}<optgroup label="ห้องอื่นในทะเบียน">${all}</optgroup></select></td>
                ${KEYS.map(k => { const st = cellStatus(item, k, s), step = item.steps[k]; if (!step) return '<td class="c">–</td>';
                    const old = s.no ? norm(roomOf(s.no)?.current[k]) : '';
                    return `<td class="c ti-${st}${step.inferred ? ' ti-inf' : ''}" title="${esc(step.note)} · ${esc(step.ids.map(i => '#' + i).join(' '))}">${esc(step.date.slice(0, 5))}${st === 'conf' ? `<br><small>เดิม ${esc(old.slice(0, 5))}</small><br><label><input type="checkbox" data-ti-over="${k}" ${s.over[k] ? 'checked' : ''}> ทับ</label>` : st === 'same' ? '<br><small>ตรงแล้ว</small>' : ''}</td>`; }).join('')}</tr>`;
        }).join('');
        dialog.innerHTML = `<div class="ti-wrap"><div class="ti-top"><h2>นำเข้าวันที่แต่ละขั้นตอนจากแชท Telegram</h2><button type="button" class="ti-btn" data-ti-close>ปิด</button></div>
            <div class="ti-note">ข้อมูลตรวจย้อนจากข้อความต้นฉบับแล้ว (${esc(d.source)} · สร้าง ${esc(String(d.generatedAt).slice(0, 10))}) · ทุกวันที่มีเลขข้อความอ้างอิง (#id) เก็บเป็นหมายเหตุในแท็บ "ติดตามขั้นตอนการดำเนินงานที่พักใหม่" · เอาเมาส์ชี้ที่วันที่เพื่อดูหลักฐาน</div>
            <div class="ti-legend"><span class="ti-new">เขียวฟ้า = ช่องว่าง จะเติมให้</span><span class="ti-same">เทา = ตรงกับทะเบียนแล้ว</span><span class="ti-conf">ส้ม = ต่างจากที่มีอยู่ (ติ๊ก "ทับ" ถ้าต้องการเปลี่ยน)</span><span style="outline:1px dashed #b54708">เส้นประ = อนุมานจากข้อความรวมหลายบ้าน</span></div>
            <div class="ti-note">พบ ${d.items.length} บ้าน · จับคู่ห้องในทะเบียนอัตโนมัติ ${auto} · ต้องเลือกเอง ${d.items.length - auto} (ไม่ติ๊กจนกว่าจะเลือกห้อง) · บ้านที่ยกเลิก/คืนเงินไม่ติ๊กให้</div>
            <div style="overflow:auto;max-height:62dvh"><table class="ti-table"><thead><tr><th></th><th>บ้านในแชท</th><th>ห้องในทะเบียน</th>${KEYS.map(k => `<th>${SHORT[k]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
            <p class="ti-msg ${state.bad ? 'bad' : ''}" role="status">${esc(state.msg)}</p>
            <div><button type="button" class="ti-btn primary" data-ti-apply ${t.cells && !state.busy ? '' : 'disabled'}>บันทึกลงทะเบียน ${t.houses} บ้าน · ${t.cells} ช่อง</button></div></div>`;
    }
    dialog.addEventListener('click', async event => {
        const t = event.target;
        if (t === dialog || t.closest('[data-ti-close]')) return dialog.close();
        if (!t.closest('[data-ti-apply]')) return;
        const items = [];
        for (const item of state.data.items) {
            const s = state.sel.get(item.name); if (!s?.on || !s.no) continue;
            const fields = {}, overwrite = {};
            for (const k of KEYS) { const st = cellStatus(item, k, s); if (st === 'new' || (st === 'conf' && s.over[k])) { fields[k] = true; if (st === 'conf') overwrite[k] = true; } }
            if (Object.keys(fields).length) items.push({ name: item.name, no: s.no, fields, overwrite });
        }
        if (!items.length) return;
        if (!window.confirm(`บันทึกวันที่ลงทะเบียนห้องพัก ${items.length} ยูนิต?\n(เติมเฉพาะช่องที่เห็นเป็นสีเขียวฟ้า และช่องสีส้มที่ติ๊ก "ทับ")`)) return;
        state.busy = true; state.msg = 'กำลังบันทึก…'; state.bad = false; render();
        try {
            if (!(window.getCsrfToken && window.getCsrfToken())) { const r = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' }); const d = await r.json().catch(() => ({})); if (d.csrfToken) sessionStorage.setItem('csrfToken', d.csrfToken); }
            const res = await request(`${API}/apply`, { method: 'POST', body: JSON.stringify({ items }) });
            const skipped = (res.report || []).filter(r => r.skipped);
            state.msg = `บันทึกแล้ว ${res.written} ช่อง ใน ${(res.report || []).filter(r => r.wrote?.length).length} ยูนิต${skipped.length ? ` · ข้าม ${skipped.length}: ${skipped.map(r => r.name + ' (' + r.skipped + ')').join(', ')}` : ''} — รีเฟรชหน้าเพื่อดูผล`;
            const fresh = await request(API); state.data = fresh;
            for (const item of fresh.items) { const s = state.sel.get(item.name); if (s) s.on = false; }
        } catch (error) { state.msg = error.message; state.bad = true; }
        state.busy = false; render();
    });
    dialog.addEventListener('change', event => {
        const t = event.target, tr = t.closest('tr[data-name]'); if (!tr) return;
        const s = state.sel.get(tr.dataset.name), item = state.data.items.find(i => i.name === tr.dataset.name);
        if (t.matches('[data-ti-on]')) s.on = t.checked;
        else if (t.matches('[data-ti-room]')) { s.no = t.value ? Number(t.value) : null; s.on = !!s.no && !item.ended; s.over = {}; }
        else if (t.matches('[data-ti-over]')) s.over[t.dataset.tiOver] = t.checked;
        render();
    });
    button.addEventListener('click', async () => {
        state.msg = 'กำลังโหลดตัวอย่าง…'; state.bad = false; dialog.innerHTML = '<div class="ti-wrap"><p class="ti-msg">กำลังโหลดตัวอย่าง…</p></div>'; dialog.showModal();
        try {
            state.data = await request(API); state.sel.clear();
            for (const item of state.data.items) state.sel.set(item.name, { no: item.matched, on: !!item.matched && !item.ended, over: {} });
            state.msg = '';
        } catch (error) { state.data = null; dialog.innerHTML = `<div class="ti-wrap"><div class="ti-top"><h2>นำเข้าจากแชท Telegram</h2><button type="button" class="ti-btn" data-ti-close>ปิด</button></div><p class="ti-msg bad">${esc(error.message)}</p></div>`; return; }
        render();
    });
})();
