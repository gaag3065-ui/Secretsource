// หน้า HR: พนักงานพักที่ไหน + แก้ที่พัก (เขียนกลับไฟล์ HR ต้นทางของบริษัท) — ไม่มีข้อมูลค่าน้ำ/ไฟ/การเงิน
(async () => {
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-hr`;
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = { data: null, filter: 'all', query: '', canEdit: false, view: 'people' };
    const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

    try { await window.requirePagePermission('AccommodationHr'); } catch { return; }
    state.canEdit = window.isCurrentUserAdmin === true || window.USER_PERMISSIONS?.AccommodationHrEdit === true;

    async function request(path, options) {
        const response = await window.authFetch(API + path, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    const unitOf = no => state.data.units.find(u => u.no === Number(no));
    const placeText = p => [p.building, p.floor && 'ชั้น ' + p.floor, p.room && 'ห้อง ' + p.room].filter(Boolean).join(' · ');
    function leaseCell(u) {
        if (!u) return '<span class="hr-none">–</span>';
        const bits = [];
        if (u.end) bits.push(`หมดสัญญา <b>${esc(u.end)}</b>`);
        if (u.remaining) bits.push(`<small>${esc(u.remaining)}</small>`);
        if (u.noticeBy) bits.push(`<small>แจ้งยกเลิกก่อน ${esc(u.noticeBy)}</small>`);
        return bits.join('<br>') || '<span class="hr-none">ยังไม่ระบุ</span>';
    }
    function visible() {
        const q = norm(state.query);
        return state.data.people.filter(p => {
            if (state.filter === 'none' && p.roomNo) return false;
            if (state.filter === 'placed' && !p.roomNo) return false;
            if (!q) return true;
            const u = p.roomNo ? unitOf(p.roomNo) : null;
            return norm([p.name, p.nickname, p.employeeId, p.company, p.building, p.floor, p.room, u?.project, u?.unit].join(' ')).includes(q);
        });
    }
    // เปิดไฟล์ PDF (ผ่านสิทธิ์ผู้ใช้ — ระบบเปิดให้เฉพาะ PDF ตรวจห้อง/สัญญาที่เซ็นแล้ว)
    async function openFile(id) {
        try { const r = await window.authFetch(`${API}/file/${encodeURIComponent(id)}`); if (!r.ok) throw new Error('เปิดไม่ได้'); window.open(URL.createObjectURL(await r.blob()), '_blank'); }
        catch { window.alert('เปิดไฟล์ไม่ได้ — ลองใหม่อีกครั้ง'); }
    }
    const peopleOf = no => state.data.people.filter(p => p.roomNo === no);
    function renderHouses() {
        const d = state.data, q = norm(state.query);
        const list = d.units.filter(u => !q || norm([u.project, u.unit, u.status].join(' ')).includes(q));
        const signed = d.units.filter(u => u.status === 'ทำสัญญาแล้ว').length, withPdf = d.units.filter(u => u.inspections.length).length;
        $('hrChips').innerHTML = `<span class="hr-count">บ้านทั้งหมด <b>${d.units.length}</b> หลัง · ทำสัญญาแล้ว <b>${signed}</b> · มี PDF รูปตรวจห้อง <b>${withPdf}</b></span>`;
        $('hrStatus').textContent = `แสดง ${list.length} จาก ${d.units.length} หลัง · อัปเดต ${new Date(d.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`;
        $('hrHouseBody').innerHTML = list.map(u => {
            const ins = u.inspections, ppl = peopleOf(u.no);
            const name = ins.length
                ? `<button type="button" class="hr-link" data-open="${esc(ins[0].id)}" title="เปิด PDF รูปตรวจห้อง: ${esc(ins[0].name)}">${esc(u.project)}</button>${ins.slice(1).map((f, i) => `<button type="button" class="hr-link hr-link-sm" data-open="${esc(f.id)}" title="${esc(f.name)}">ไฟล์ ${i + 2}</button>`).join('')}`
                : `<b>${esc(u.project)}</b>`;
            const chips = [...u.signedLeases.map((f, i, a) => `<button type="button" class="hr-chip hr-chip-ok" data-open="${esc(f.id)}" title="สัญญาที่เซ็นแล้ว: ${esc(f.name)}">✅ สัญญาเซ็นแล้ว${a.length > 1 ? ' ' + (i + 1) : ''}</button>`),
                ...u.contracts.map((c, i, a) => `<a class="hr-chip" href="${esc(c.url)}" target="_blank" rel="noopener" title="เปิดไฟล์สัญญาเช่า: ${esc(c.name)}">📄 สัญญา${a.length > 1 ? ' ' + (i + 1) : ''}</a>`)].join('');
            const companies = [...new Set(ppl.map(p => p.company).filter(Boolean))].join(', ');
            const pill = u.status === 'ทำสัญญาแล้ว' ? 'is-ok' : 'is-process';
            return `<tr><td>${esc(u.no)}</td>
                <td>${name}<small>${esc(u.unit)}${ins.length ? '' : ' · <span class="hr-warn">ยังไม่แนบ PDF รูปตรวจห้อง</span>'}</small></td>
                <td class="hr-files-cell">${chips || '<span class="hr-none">–</span>'}</td>
                <td><span class="hr-pill ${pill}">${esc(u.status || '-')}</span></td>
                <td>${ppl.length ? `${ppl.length} คน<small>${esc(companies)}</small>` : '<span class="hr-pill is-empty">ไม่มีพนักงาน</span>'}</td>
                <td>${esc(u.type || '-')}</td>
                <td>${u.start || u.end ? `${esc(u.start)} – ${esc(u.end)}` : '-'}${u.remaining ? `<small>${esc(u.remaining)}</small>` : ''}${u.noticeBy ? `<small>แจ้งยกเลิกก่อน ${esc(u.noticeBy)}</small>` : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="7" class="hr-empty">ไม่พบบ้านตามเงื่อนไข</td></tr>';
    }
    function render() {
        $('hrTabs').querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.view === state.view));
        $('hrPeopleWrap').hidden = state.view !== 'people'; $('hrHouseWrap').hidden = state.view !== 'houses';
        if (state.view === 'houses') return renderHouses();
        const d = state.data, list = visible();
        const placed = d.people.filter(p => p.roomNo).length, none = d.people.length - placed;
        const chip = (k, label, n) => `<button type="button" data-f="${k}" class="${state.filter === k ? 'is-on' : ''}">${label} <b>${n}</b></button>`;
        $('hrChips').innerHTML = chip('all', 'ทั้งหมด', d.people.length) + chip('placed', 'จับคู่ห้องในทะเบียนแล้ว', placed) + chip('none', 'ยังไม่จับคู่ห้อง / ยังไม่ระบุที่พัก', none);
        $('hrStatus').textContent = `แสดง ${list.length} จาก ${d.people.length} คน · ${d.source === 'hr-files' ? 'อ่านตรงจากไฟล์ HR (แก้ในไฟล์แล้วเห็นภายใน ~30 วินาที)' : 'อ่านจากไฟล์รวม (อาจช้ากว่าไฟล์ HR สักครู่)'}${d.diag ? ' · เปิดบางไฟล์ไม่ได้: ' + d.diag : ''}`;
        $('hrTable').hidden = false;
        $('hrBody').innerHTML = list.slice(0, 600).map(p => {
            const u = p.roomNo ? unitOf(p.roomNo) : null;
            return `<tr>
                <td><b>${esc(p.name || '-')}</b><small>${esc([p.nickname, p.employeeId].filter(Boolean).join(' · '))}</small></td>
                <td>${esc(p.company || '-')}</td>
                <td>${esc(placeText(p) || 'ยังไม่ระบุ')}${p.roomNo ? '' : (p.reason ? `<small class="hr-warn">${esc(p.reason)}</small>` : '')}</td>
                <td>${u ? `<b>${esc(u.project)}</b><small>ยูนิต ${esc(u.unit)}</small>` : '<span class="hr-none">ยังไม่จับคู่</span>'}</td>
                <td>${leaseCell(u)}</td>
                <td>${state.canEdit && p.employeeId ? `<button type="button" class="hr-btn hr-btn-sm" data-edit="${esc(p.employeeId)}">แก้ที่พัก</button>` : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="6" class="hr-empty">ไม่พบพนักงานตามเงื่อนไข</td></tr>';
    }
    function openEdit(id) {
        const p = state.data.people.find(x => x.employeeId === id); if (!p) return;
        const opts = state.data.units.map(u => `<option value="${u.no}" ${u.no === p.roomNo ? 'selected' : ''}>${esc(u.no + '. ' + u.project + ' · ' + u.unit)}</option>`).join('');
        $('hrDialog').innerHTML = `<form class="hr-form" data-id="${esc(id)}"><h3>แก้ที่พักของ ${esc(p.name)}</h3>
            <p class="hr-hint">${esc(p.company)} · รหัส ${esc(p.employeeId)} · ตอนนี้: ${esc(placeText(p) || 'ยังไม่ระบุ')}</p>
            <label>ย้ายไปอยู่ห้อง (ตามทะเบียนห้องพัก)<select name="no" required><option value="">— เลือกห้อง —</option>${opts}</select></label>
            <label>ชั้น (ถ้ามี)<input name="floor" maxlength="20" value="${esc(p.floor)}" placeholder="เช่น 5"></label>
            <p class="hr-hint">บันทึกแล้วระบบแก้ช่อง "ที่พัก / ชั้น / ห้อง" ในไฟล์ HR ต้นทางของบริษัทนี้ทันที และบันทึกประวัติว่าใครแก้ ข้อมูลในหน้านี้อัปเดตตามภายในไม่กี่นาที</p>
            <p class="hr-msg" role="status"></p>
            <div class="hr-actions"><button type="submit" class="hr-btn hr-primary">บันทึกลงไฟล์ HR</button><button type="button" class="hr-btn" data-close>ยกเลิก</button></div></form>`;
        $('hrDialog').showModal();
    }
    $('hrDialog').addEventListener('click', e => { if (e.target === $('hrDialog') || e.target.closest('[data-close]')) $('hrDialog').close(); });
    $('hrDialog').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target, msg = form.querySelector('.hr-msg'), btn = form.querySelector('[type=submit]');
        const f = new FormData(form), no = Number(f.get('no')); if (!no) { msg.textContent = 'กรุณาเลือกห้อง'; msg.className = 'hr-msg is-bad'; return; }
        const u = unitOf(no), p = state.data.people.find(x => x.employeeId === form.dataset.id);
        if (!window.confirm(`ย้าย ${p?.name || ''} ไปที่ ${u?.project} ${u?.unit}?\n(เขียนลงไฟล์ HR ต้นทางทันที)`)) return;
        btn.disabled = true; msg.textContent = 'กำลังบันทึก…'; msg.className = 'hr-msg';
        try {
            const res = await request('/employee', { method: 'PUT', body: JSON.stringify({ employeeId: form.dataset.id, no, floor: String(f.get('floor') || '') }) });
            msg.textContent = res.unchanged ? 'ข้อมูลเหมือนเดิม ไม่ได้แก้อะไร' : `บันทึกแล้ว (${res.file || 'ไฟล์ HR'})${res.historyError ? ' — แต่บันทึกประวัติไม่สำเร็จ' : ''}`;
            if (p) { p.building = u.project; p.room = u.unit; p.floor = String(f.get('floor') || ''); p.roomNo = no; p.reason = ''; }
            render(); setTimeout(() => $('hrDialog').close(), 900);
        } catch (error) { msg.textContent = error.message; msg.className = 'hr-msg is-bad'; btn.disabled = false; }
    });
    $('hrTabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { state.view = b.dataset.view; render(); } });
    $('hrHouseBody').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openFile(b.dataset.open); });
    $('hrChips').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { state.filter = b.dataset.f; render(); } });
    $('hrBody').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) openEdit(b.dataset.edit); });
    $('hrQ').addEventListener('input', () => { state.query = $('hrQ').value; render(); });
    async function load(silent) {
        if (silent !== true) $('hrStatus').textContent = 'กำลังโหลด…';
        try { state.data = await request('/overview'); render(); } catch (error) { if (silent !== true) $('hrStatus').textContent = error.message; }
    }
    $('hrRefresh').addEventListener('click', () => load());
    load();
    // แก้ในไฟล์ HR แล้วหน้านี้อัปเดตเอง (ข้ามถ้ากำลังเปิดฟอร์มแก้ไขหรือแท็บถูกซ่อน)
    setInterval(() => { if (!$('hrDialog').open && !document.hidden) load(true); }, 45000);
})();
