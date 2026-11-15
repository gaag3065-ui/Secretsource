// ตารางวันหยุดของแผนก GA (ปุ่ม "ตารางวันหยุด" หน้า งาน GA)
// ตารางรายเดือน: แถว = เจ้าหน้าที่ GA (บัญชีพอร์ทัล) · คอลัมน์ = วันที่ — เลือกประเภทวันหยุดจากแถบสีแล้วคลิก/ลากบนช่องเพื่อลง (เลือก "ลบ" เพื่อเอาออก)
// แถวบนสุด = วันหยุดทั้งแผนก/นักขัตฤกษ์ · แถวล่างสุด = จำนวนคนที่ยังทำงานในแต่ละวัน · บันทึกอัตโนมัติ (หลังบ้าน /api/staff/ga-work/leaves)
(() => {
    const openBtn = document.getElementById('gwHolidays');
    if (!openBtn) return;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/staff/ga-work`;
    const TYPES = [
        ['off', 'หยุด', 'วันหยุดประจำสัปดาห์', '#0e7c86'],
        ['vacation', 'พักร้อน', 'ลาพักร้อน', '#2563eb'],
        ['sick', 'ป่วย', 'ลาป่วย', '#dc2626'],
        ['personal', 'กิจ', 'ลากิจ', '#d97706'],
        ['comp', 'ชดเชย', 'หยุดชดเชย', '#7c3aed'],
        ['holiday', 'นข.', 'วันหยุดบริษัท/นักขัตฤกษ์ (ทั้งแผนก)', '#be185d']
    ];
    const T = Object.fromEntries(TYPES.map(t => [t[0], t]));
    const WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const WEEK_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const now = new Date();
    const state = { y: now.getFullYear(), m: now.getMonth(), staff: [], leaves: new Map(), brush: 'off', drag: null, loaded: false };
    const pad = n => String(n).padStart(2, '0');
    const iso = (d) => `${state.y}-${pad(state.m + 1)}-${pad(d)}`;
    const daysIn = () => new Date(state.y, state.m + 1, 0).getDate();
    const key = (u, date) => `${u}|${date}`;

    const dialog = Object.assign(document.createElement('dialog'), { className: 'fa-dialog gh-dialog' });
    document.body.append(dialog);

    async function request(path, options = {}) {
        if (options.method && options.method !== 'GET' && !window.getCsrfToken?.()) {
            const r = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' });
            const d = await r.json().catch(() => ({}));
            if (d.csrfToken) sessionStorage.setItem('csrfToken', d.csrfToken);
        }
        const response = await window.authFetch(`${API}${path}`, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)');
        if (!response.ok || data.success === false) throw new Error(data.message || `ทำรายการไม่สำเร็จ (${response.status})`);
        return data;
    }
    const toast = (text, bad) => { const n = document.getElementById('gwToast'); if (!n) return; n.textContent = text; n.className = `fa-toast is-visible${bad ? ' is-error' : ''}`; setTimeout(() => { n.className = 'fa-toast'; }, bad ? 6000 : 2500); };

    async function loadMonth() {
        const from = iso(1), to = iso(daysIn());
        const data = await request(`/leaves?from=${from}&to=${to}`);
        // ลบของเดือนนี้ออกก่อน แล้วใส่ใหม่ (เดือนอื่นที่โหลดไว้คงไว้)
        for (const k of [...state.leaves.keys()]) { const d = k.split('|')[1]; if (d >= from && d <= to) state.leaves.delete(k); }
        data.leaves.forEach(l => state.leaves.set(key(l.username, l.date), { type: l.type, note: l.note }));
    }
    async function loadStaff() {
        const data = await request('');
        state.staff = (data.staff || []).map(s => ({ username: s.username, name: s.name, position: s.position || '' }));
    }
    async function open() {
        dialog.innerHTML = '<div class="gh-box"><p class="fa-empty">กำลังโหลดตารางวันหยุด…</p></div>';
        dialog.showModal();
        try { if (!state.staff.length) await loadStaff(); await loadMonth(); state.loaded = true; render(); } catch (error) { dialog.innerHTML = `<div class="gh-box"><header class="gh-head"><h2>🗓️ ตารางวันหยุด GA</h2><button type="button" class="gh-x" data-gh-close>×</button></header><p class="gh-err">${esc(error.message)}</p></div>`; }
    }

    const typeAt = (u, date) => state.leaves.get(key(u, date))?.type || '';
    const dayOff = (u, date) => typeAt(u, date) || typeAt('*', date);   // ทั้งแผนกหยุด = ทุกคนหยุด

    function render() {
        const n = daysIn(), people = state.staff;
        const dayHeads = Array.from({ length: n }, (_, i) => { const d = i + 1, w = new Date(state.y, state.m, d).getDay(); return { d, w, date: iso(d) }; });
        const isToday = date => date === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const cell = (u, h) => {
            const own = typeAt(u, h.date), all = u !== '*' && typeAt('*', h.date);
            const t = own || (all ? 'holiday' : '');
            const note = state.leaves.get(key(own ? u : '*', h.date))?.note || '';
            return `<td class="gh-cell${h.w === 0 || h.w === 6 ? ' is-wk' : ''}${isToday(h.date) ? ' is-today' : ''}${t ? ' has-type' : ''}${all && !own ? ' is-inherit' : ''}" data-u="${esc(u)}" data-date="${h.date}" ${t ? `style="--c:${T[t][3]}" title="${esc(T[t][2] + (note ? ' · ' + note : ''))}"` : ''}>${t ? esc(T[t][1]) : ''}</td>`;
        };
        const head1 = dayHeads.map(h => `<th class="gh-day${h.w === 0 || h.w === 6 ? ' is-wk' : ''}${isToday(h.date) ? ' is-today' : ''}">${h.d}</th>`).join('');
        const head2 = dayHeads.map(h => `<th class="gh-wd${h.w === 0 || h.w === 6 ? ' is-wk' : ''}">${WEEK[h.w]}</th>`).join('');
        const count = u => dayHeads.filter(h => dayOff(u, h.date)).length;
        const rows = people.map(p => `<tr><th class="gh-name" scope="row"><b>${esc(p.name)}</b><small>${esc(p.position || p.username)}</small></th>${dayHeads.map(h => cell(p.username, h)).join('')}<td class="gh-sum">${count(p.username)}</td>
            <td class="gh-fill"><select data-fill="${esc(p.username)}" aria-label="เติมวันหยุดประจำสัปดาห์"><option value="">เติมวัน…</option>${WEEK_FULL.map((w, i) => `<option value="${i}">ทุกวัน${w}</option>`).join('')}</select></td></tr>`).join('');
        const working = dayHeads.map(h => { const free = typeAt('*', h.date) ? 0 : people.filter(p => !dayOff(p.username, h.date)).length; const low = free <= Math.ceil(people.length / 3); return `<td class="gh-work${low ? ' is-low' : ''}${typeAt('*', h.date) ? ' is-closed' : ''}" title="${free} คนทำงาน">${free}</td>`; }).join('');
        const holidays = dayHeads.filter(h => typeAt('*', h.date)).map(h => `<span class="gh-hl">${h.d} ${esc(MONTHS[state.m].slice(0, 3))}.${state.leaves.get(key('*', h.date))?.note ? ' — ' + esc(state.leaves.get(key('*', h.date)).note) : ''}</span>`).join('');
        const totals = TYPES.map(([k, short, label, color]) => { const c = people.reduce((s, p) => s + dayHeads.filter(h => typeAt(p.username, h.date) === k).length, 0); return c ? `<span><i style="background:${color}"></i>${esc(label.split(' (')[0])} ${c} วัน</span>` : ''; }).join('');
        dialog.innerHTML = `<div class="gh-box">
            <header class="gh-head"><div><h2>🗓️ ตารางวันหยุด แผนก GA</h2><p>เลือกประเภทด้านล่าง แล้วคลิกหรือลากบนช่องวันที่ของแต่ละคน · บันทึกให้อัตโนมัติ</p></div><button type="button" class="gh-x" data-gh-close aria-label="ปิด">×</button></header>
            <div class="gh-bar"><div class="gh-month"><button type="button" data-gh-nav="-1" aria-label="เดือนก่อน">◀</button><b>${MONTHS[state.m]} ${state.y + 543}</b><button type="button" data-gh-nav="1" aria-label="เดือนถัดไป">▶</button><button type="button" data-gh-nav="0" class="gh-today">เดือนนี้</button></div>
                <div class="gh-brush" role="radiogroup" aria-label="ประเภทที่จะลง">${TYPES.map(([k, short, label, color]) => `<button type="button" role="radio" aria-checked="${state.brush === k}" class="${state.brush === k ? 'is-on' : ''}" data-brush="${k}" style="--c:${color}" title="${esc(label)}"><i></i>${esc(label.split(' (')[0])}</button>`).join('')}<button type="button" role="radio" aria-checked="${state.brush === ''}" class="gh-erase${state.brush === '' ? ' is-on' : ''}" data-brush="" title="ลบวันหยุดออก">⌫ ลบ</button></div></div>
            <div class="gh-scroll"><table class="gh-table"><thead><tr><th class="gh-name" rowspan="2">เจ้าหน้าที่</th>${head1}<th rowspan="2" class="gh-sum">รวม<br>วัน</th><th rowspan="2" class="gh-fill"></th></tr><tr>${head2}</tr></thead>
                <tbody><tr class="gh-all"><th class="gh-name" scope="row"><b>วันหยุดทั้งแผนก</b><small>นักขัตฤกษ์ / ปิดทำการ</small></th>${dayHeads.map(h => cell('*', h)).join('')}<td class="gh-sum">${dayHeads.filter(h => typeAt('*', h.date)).length}</td><td></td></tr>${rows || `<tr><td colspan="${n + 3}" class="gh-err">ไม่พบรายชื่อเจ้าหน้าที่</td></tr>`}</tbody>
                <tfoot><tr><th class="gh-name">คนที่ทำงาน</th>${working}<td colspan="2"></td></tr></tfoot></table></div>
            <footer class="gh-foot"><div class="gh-legend">${totals || '<span>เดือนนี้ยังไม่มีวันหยุดที่ลงไว้</span>'}</div>${holidays ? `<div class="gh-holidays"><b>วันหยุดทั้งแผนก:</b> ${holidays}</div>` : ''}<small>แถว “คนที่ทำงาน” สีแดง = เหลือคนทำงานน้อย (ไม่เกิน 1 ใน 3 ของทีม) · ช่องที่หยุดทั้งแผนกจะเป็นสีจางในแถวของทุกคน</small></footer></div>`;
    }

    // ---------------------------------------------------------------- ลง / ลบวันหยุด (คลิก หรือ ลากข้ามหลายช่อง)
    async function commit(cells) {
        const type = state.brush;
        if (!cells.length) return;
        let note = '';
        if (type === 'holiday') { note = (prompt('ชื่อวันหยุด (เว้นว่างได้ เช่น วันขึ้นปีใหม่)', '') ?? '').trim(); }
        const before = new Map(cells.map(c => [key(c.username, c.date), state.leaves.get(key(c.username, c.date))]));
        cells.forEach(c => { if (type) state.leaves.set(key(c.username, c.date), { type, note }); else state.leaves.delete(key(c.username, c.date)); });
        render();
        try { await request('/leaves', { method: 'PUT', body: JSON.stringify({ cells, type, note }) }); }
        catch (error) { before.forEach((v, k) => { if (v) state.leaves.set(k, v); else state.leaves.delete(k); }); render(); toast(error.message, true); }
    }
    const cellOf = el => { const c = el.closest?.('.gh-cell'); return c ? { username: c.dataset.u, date: c.dataset.date, el: c } : null; };
    const allowed = c => state.brush === 'holiday' ? c.username === '*' : (c.username !== '*' || !state.brush);
    function paint(c) {
        if (!state.drag || !c || !allowed(c) || state.drag.seen.has(key(c.username, c.date))) return;
        state.drag.seen.add(key(c.username, c.date)); state.drag.cells.push({ username: c.username, date: c.date });
        c.el.classList.add('is-painting');
    }
    dialog.addEventListener('mousedown', e => { const c = cellOf(e.target); if (!c || e.button !== 0) return; if (!allowed(c)) { toast(state.brush === 'holiday' ? 'วันหยุดทั้งแผนกลงที่แถวบนสุด' : 'แถวบนสุดใช้ได้เฉพาะ “วันหยุดบริษัท/นักขัตฤกษ์” หรือ “ลบ”', true); return; } e.preventDefault(); state.drag = { cells: [], seen: new Set() }; paint(c); });
    dialog.addEventListener('mouseover', e => { if (state.drag) paint(cellOf(e.target)); });
    window.addEventListener('mouseup', () => { if (!state.drag) return; const cells = state.drag.cells; state.drag = null; commit(cells); });

    dialog.addEventListener('click', async e => {
        if (e.target === dialog || e.target.closest('[data-gh-close]')) return dialog.close();
        const brush = e.target.closest('[data-brush]'); if (brush) { state.brush = brush.dataset.brush; return render(); }
        const nav = e.target.closest('[data-gh-nav]');
        if (nav) {
            const step = Number(nav.dataset.ghNav);
            if (step === 0) { state.y = now.getFullYear(); state.m = now.getMonth(); } else { const d = new Date(state.y, state.m + step, 1); state.y = d.getFullYear(); state.m = d.getMonth(); }
            try { await loadMonth(); } catch (error) { toast(error.message, true); }
            render();
        }
    });
    dialog.addEventListener('change', e => {
        const sel = e.target.closest('[data-fill]'); if (!sel || sel.value === '') return;
        const wd = Number(sel.value), u = sel.dataset.fill, n = daysIn();
        const cells = Array.from({ length: n }, (_, i) => i + 1).filter(d => new Date(state.y, state.m, d).getDay() === wd).map(d => ({ username: u, date: iso(d) })).filter(c => !typeAt(u, c.date));
        const prev = state.brush; state.brush = 'off'; sel.value = '';
        if (!cells.length) { state.brush = prev; return toast('ทุกวัน' + WEEK_FULL[wd] + 'ของเดือนนี้มีวันหยุดลงไว้แล้ว'); }
        commit(cells).finally(() => { state.brush = prev; render(); });
    });
    openBtn.addEventListener('click', open);
})();
