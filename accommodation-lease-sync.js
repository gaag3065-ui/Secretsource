// เทียบไฟล์ "สัญญาเช่า" กับทะเบียนห้องพัก: ช่องว่างเติมให้ · ช่องที่ต่างกันแสดงเทียบให้ติ๊กเลือก · ห้องที่ยังไม่อยู่ในทะเบียนเพิ่มให้ได้
(() => {
    const actions = document.querySelector('.as-actions');
    if (!actions) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms/lease-sync`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = { data: null, pick: new Map(), msg: '', bad: false, busy: false };
    document.head.insertAdjacentHTML('beforeend', `<style>
        .ls-dialog { width: min(1180px, 98vw); max-height: 96dvh; border: 0; border-radius: 16px; padding: 0; box-shadow: 0 24px 70px rgba(16,24,40,.3); }
        .ls-dialog::backdrop { background: rgba(16,24,40,.55); }
        .ls-wrap { display: grid; gap: 10px; padding: 16px 18px; max-height: 96dvh; overflow: auto; font-size: 13.5px; }
        .ls-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; } .ls-top h2 { margin: 0; font-size: 19px; }
        .ls-note { color: #475467; font-size: 12.5px; } .ls-msg { min-height: 18px; color: #087f74; } .ls-msg.bad { color: #b42318; font-weight: 700; }
        .ls-table { width: 100%; border-collapse: collapse; font-size: 12.5px; } .ls-table th { background: #f1f5f6; position: sticky; top: 0; padding: 6px; border: 1px solid #e1e7ea; }
        .ls-table td { border: 1px solid #e1e7ea; padding: 5px 6px; vertical-align: top; }
        .ls-fill { background: #e5f7f4; } .ls-differ { background: #ffe6c7; } .ls-new { background: #e0ecff; }
        .ls-btn { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; } .ls-btn.primary { background: #087f74; color: #fff; border-color: #087f74; } .ls-btn:disabled { opacity: .45; cursor: not-allowed; }
        .ls-warn { background: #fff4e5; border: 1px solid #f5c26b; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; }
    </style>`);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'as-btn as-btn-ghost'; button.textContent = 'เทียบสัญญาเช่ากับทะเบียน';
    actions.prepend(button);
    const dialog = document.createElement('dialog'); dialog.className = 'ls-dialog'; document.body.append(dialog);

    async function request(url, options) {
        const response = await window.authFetch(url, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ (ต้องมีสิทธิ์แก้ไขข้อมูลห้องพัก)');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    const money = v => Number(v) ? Number(v).toLocaleString('en-US') : esc(v);
    const show = (k, v) => k === 'rent' ? money(v) : esc(v);
    function totals() {
        let cells = 0, adds = 0;
        for (const row of state.data.rows) {
            const p = state.pick.get(row.key); if (!p) continue;
            if (row.newRow) { if (p.add) adds++; } else cells += row.fields.filter(f => p.fields[f.k]).length;
        }
        return { cells, adds };
    }
    function render() {
        const d = state.data, t = totals();
        const changed = d.rows.filter(r => r.newRow || r.fields.length);
        const body = changed.map(row => {
            const p = state.pick.get(row.key);
            const who = `<b>${esc(row.project)}</b> ${esc(row.unit)}<br><small>${esc(row.company)}${row.signer ? ' · ' + esc(row.signer) : ''} · ${esc(row.source)}${row.leaseNo ? ' #' + esc(row.leaseNo) : ''}</small>`;
            if (row.newRow) {
                const n = row.newRow;
                return `<tr data-key="${esc(row.key)}"><td>${who}</td><td class="ls-new" colspan="2"><label><input type="checkbox" data-ls-add ${p.add ? 'checked' : ''}> <b>เพิ่มห้องใหม่ในทะเบียน</b> (ยังไม่มีในทะเบียน)</label></td>
                    <td class="ls-new">${esc(n.type || '–')} · ค่าเช่า ${money(n.rent)} · ${esc(n.start || '–')} → ${esc(n.end || '–')}</td></tr>`;
            }
            return row.fields.map((f, i) => `<tr data-key="${esc(row.key)}">${i === 0 ? `<td rowspan="${row.fields.length}">${who}<br><small>ทะเบียน: ${row.matched.no}. ${esc(row.matched.project)} ${esc(row.matched.unit)}</small></td>` : ''}
                <td>${esc(f.label)}</td><td class="${f.mode === 'fill' ? 'ls-fill' : 'ls-differ'}">${f.mode === 'fill' ? 'ช่องว่างในทะเบียน' : 'ทะเบียน: ' + show(f.k, f.reg)}</td>
                <td class="${f.mode === 'fill' ? 'ls-fill' : 'ls-differ'}"><label><input type="checkbox" data-ls-field="${esc(f.k)}" ${p.fields[f.k] ? 'checked' : ''}> ${f.mode === 'fill' ? 'เติม' : 'แก้เป็น'} <b>${show(f.k, f.sheet)}</b></label></td></tr>`).join('');
        }).join('');
        const noLease = d.noLease.length ? `<div class="ls-warn"><b>ทะเบียนบอก "ทำสัญญาแล้ว" แต่ไม่พบในไฟล์สัญญาเช่า ${d.noLease.length} ห้อง</b> (ต้องลงข้อมูลสัญญาในไฟล์สัญญาเช่าก่อน ระบบจึงจะดึงเข้ามาได้): ${d.noLease.map(x => `${x.no}. ${esc(x.project)} ${esc(x.unit)}`).join(' · ')}</div>` : '';
        dialog.innerHTML = `<div class="ls-wrap"><div class="ls-top"><h2>เทียบสัญญาเช่ากับทะเบียนห้องพัก</h2><button type="button" class="ls-btn" data-ls-close>ปิด</button></div>
            <div class="ls-note">เทียบ ${d.rows.length} สัญญา · พบข้อมูลที่ต้องเติม/แก้ ${changed.length} ห้อง · <span class="ls-fill">เขียวฟ้า = ช่องว่างในทะเบียน (ติ๊กไว้ให้)</span> <span class="ls-differ">ส้ม = ต่างจากทะเบียน (ติ๊กไว้ให้เฉพาะกรณีทะเบียนผิดชัด/ต่อสัญญาใหม่ — ค่าเช่าที่ต่างต้องติ๊กเอง)</span></div>
            ${noLease}
            <div style="overflow:auto;max-height:60dvh"><table class="ls-table"><thead><tr><th>สัญญา</th><th>ข้อมูล</th><th>ทะเบียนปัจจุบัน</th><th>ค่าในสัญญา</th></tr></thead><tbody>${body || '<tr><td colspan="4">ข้อมูลตรงกันครบแล้ว</td></tr>'}</tbody></table></div>
            <p class="ls-msg ${state.bad ? 'bad' : ''}" role="status">${esc(state.msg)}</p>
            <div><button type="button" class="ls-btn primary" data-ls-apply ${(t.cells || t.adds) && !state.busy ? '' : 'disabled'}>บันทึกลงทะเบียน ${t.cells} ช่อง${t.adds ? ` + เพิ่มห้องใหม่ ${t.adds}` : ''}</button></div></div>`;
    }
    dialog.addEventListener('change', event => {
        const tr = event.target.closest('tr[data-key]'); if (!tr) return;
        const p = state.pick.get(tr.dataset.key);
        if (event.target.matches('[data-ls-add]')) p.add = event.target.checked;
        else if (event.target.matches('[data-ls-field]')) p.fields[event.target.dataset.lsField] = event.target.checked;
        render();
    });
    dialog.addEventListener('click', async event => {
        if (event.target === dialog || event.target.closest('[data-ls-close]')) return dialog.close();
        if (!event.target.closest('[data-ls-apply]')) return;
        const items = [];
        for (const row of state.data.rows) {
            const p = state.pick.get(row.key); if (!p) continue;
            if (row.newRow) { if (p.add) items.push({ key: row.key, add: true }); continue; }
            const fields = row.fields.filter(f => p.fields[f.k]).map(f => f.k);
            if (fields.length) items.push({ key: row.key, fields });
        }
        if (!items.length) return;
        if (!window.confirm(`บันทึกข้อมูลสัญญาลงทะเบียนห้องพัก ${items.length} ห้อง?\n(เฉพาะช่องที่ติ๊กไว้ — ค่าเดิมที่ถูกแก้จะหายไป)`)) return;
        state.busy = true; state.msg = 'กำลังบันทึก…'; state.bad = false; render();
        try {
            if (!(window.getCsrfToken && window.getCsrfToken())) { const r = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' }); const d = await r.json().catch(() => ({})); if (d.csrfToken) sessionStorage.setItem('csrfToken', d.csrfToken); }
            const res = await request(`${API}/apply`, { method: 'POST', body: JSON.stringify({ items }) });
            state.msg = `บันทึกแล้ว ${res.written} ช่อง — รีเฟรชหน้า (Ctrl+F5) เพื่อดูผล`;
            await load();
        } catch (error) { state.msg = error.message; state.bad = true; }
        state.busy = false; render();
    });
    async function load() {
        state.data = await request(API); state.pick.clear();
        for (const row of state.data.rows) {
            if (row.newRow) state.pick.set(row.key, { add: true, fields: {} });
            else if (row.fields.length) state.pick.set(row.key, { add: false, fields: Object.fromEntries(row.fields.map(f => [f.k, f.mode === 'fill' || f.suggest])) });
        }
    }
    button.addEventListener('click', async () => {
        dialog.innerHTML = '<div class="ls-wrap"><p class="ls-msg">กำลังเทียบข้อมูล…</p></div>'; dialog.showModal();
        try { await load(); state.msg = ''; state.bad = false; }
        catch (error) { dialog.innerHTML = `<div class="ls-wrap"><div class="ls-top"><h2>เทียบสัญญาเช่า</h2><button type="button" class="ls-btn" data-ls-close>ปิด</button></div><p class="ls-msg bad">${esc(error.message)}</p></div>`; return; }
        render();
    });
})();
