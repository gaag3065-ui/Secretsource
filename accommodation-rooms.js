// ภาพรวมห้องพักทั้งหมดจากทะเบียนห้องพัก (อัปเดตตลอด) + จำนวนพนักงานที่พักอยู่ — /api/accommodation-rooms
// แยก 3 กลุ่ม: ห้องที่มีอยู่แล้ว (มีพนักงาน / ไม่มีพนักงาน) · ห้องที่กำลังอยู่ในกระบวนการ · รวมทั้งหมด
(() => {
    const root = document.getElementById('roomOverview');
    if (!root) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const state = { data: null, filter: 'all', query: '' };

    async function load(refresh = false) {
        root.querySelector('.ro-body').innerHTML = '<p class="ro-empty">กำลังโหลดทะเบียนห้องพัก…</p>';
        try {
            const response = await window.authFetch(`${API}/overview${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)');
            if (!response.ok || !data.success) throw new Error(data.message || 'โหลดไม่สำเร็จ');
            state.data = data;
            render();
        } catch (error) {
            root.querySelector('.ro-body').innerHTML = `<p class="ro-empty ro-error">${esc(error.message)}</p>`;
        }
    }

    function render() {
        const { counts: c, rooms, issues, unmatched, at, masterUrl } = state.data;
        const statuses = Object.entries(c.processByStatus || {}).map(([s, n]) => `<span>${esc(s)} <b>${num(n)}</b></span>`).join('');
        const q = state.query.toLowerCase();
        const list = rooms.filter(r => (state.filter === 'all' || (state.filter === 'process' ? r.group === 'กำลังดำเนินการ' : r.group === state.filter))
            && (!q || `${r.project} ${r.unit} ${r.status} ${r.agent} ${r.companies.join(' ')}`.toLowerCase().includes(q)));
        const chip = (key, label, n) => `<button type="button" data-ro-filter="${key}" class="${state.filter === key ? 'is-on' : ''}">${label} <b>${num(n)}</b></button>`;
        root.querySelector('.ro-updated').textContent = `อัปเดต ${new Date(at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`;
        root.querySelector('.ro-master').hidden = !masterUrl;
        if (masterUrl) root.querySelector('.ro-master').href = masterUrl;
        root.querySelector('.ro-body').innerHTML = `
            <div class="ro-cards">
                <article class="ro-card ro-existing">
                    <small>ห้องที่มีอยู่แล้ว (ทำสัญญาแล้ว)</small><strong>${num(c.existing)}</strong>
                    <div class="ro-split"><span>มีพนักงาน <b>${num(c.existingOccupied)}</b></span><span>ไม่มีพนักงาน <b>${num(c.existingEmpty)}</b></span></div>
                </article>
                <article class="ro-card ro-process">
                    <small>ห้องที่กำลังอยู่ในกระบวนการ</small><strong>${num(c.process)}</strong>
                    <div class="ro-split">${statuses || '<span>-</span>'}</div>
                </article>
                <article class="ro-card ro-total">
                    <small>รวมห้องทั้งหมด</small><strong>${num(c.total)}</strong>
                    <div class="ro-split"><span>พนักงาน on work <b>${num(c.employeesOnWork)}</b></span><span>จับคู่ห้องได้ <b>${num(c.employeesMatched)}</b></span></div>
                </article>
            </div>
            <div class="ro-check ${(c.issues || c.employeesUnmatched || rooms.some(r => pendingReviews(r).length)) ? 'has-issue' : ''}">
                <b>${(c.issues || c.employeesUnmatched || rooms.some(r => pendingReviews(r).length)) ? '⚠️ ตรวจสอบความถูกต้องของข้อมูล' : '✅ ตรวจสอบความถูกต้องของข้อมูล: ไม่พบจุดผิดปกติ'}</b>
                ${!c.employeesOnWork ? `<span class="ro-diag">อ่านรายชื่อพนักงาน on work ไม่ได้ — ${esc(c.employeeDiag || 'เครื่องหลังบ้านยังไม่ได้อัปเดต')}</span>` : ''}
                ${rooms.some(r => pendingReviews(r).length) ? `<span><b>⚠ ต้องยืนยันที่พักของพนักงาน ${num(rooms.filter(r => pendingReviews(r).length).length)} ห้อง</b> — กดปุ่ม "รายละเอียด" ที่ห้องนั้น</span>` : ''}
                <span>จุดที่ต้องตรวจในทะเบียน ${num(c.issues)} · พนักงานที่จับคู่ห้องไม่ได้ ${num(c.employeesUnmatched)} · ยังไม่มีที่พัก ${num(c.employeesWithoutRoom)}</span>
                ${issues.length || unmatched.length ? '<button type="button" data-ro-toggle-check>ดูรายละเอียด</button>' : ''}
                <div class="ro-check-list" hidden>
                    ${issues.length ? `<h4>ทะเบียนห้องพัก</h4><ul>${issues.map(i => `<li><b>${esc(i.type)}</b> — ลำดับ ${esc(i.no)} ${esc(i.project)} ${esc(i.unit)} ${esc(i.detail)}</li>`).join('')}</ul>` : ''}
                    ${unmatched.length ? `<h4>พนักงานที่จับคู่ห้องในทะเบียนไม่ได้ (แท็บข้อมูลเบื้องต้น)</h4><ul>${unmatched.map(e => `<li>แถว ${esc(e.row)} · ${esc(e.company)} · ${esc(e.building)} ${esc(e.floor)} ${esc(e.room)} — ${esc(e.reason)}</li>`).join('')}</ul>` : ''}
                </div>
            </div>
            <div class="ro-toolbar">
                <div class="ro-chips">${chip('all', 'ทั้งหมด', c.total)}${chip('มีพนักงาน', 'มีพนักงาน', c.existingOccupied)}${chip('ไม่มีพนักงาน', 'ไม่มีพนักงาน', c.existingEmpty)}${chip('process', 'กำลังดำเนินการ', c.process)}</div>
                <input type="search" data-ro-search placeholder="ค้นหาที่พัก ยูนิต สถานะ…" value="${esc(state.query)}">
            </div>
            <div class="ro-table-wrap"><table class="ro-table">
                <thead><tr><th>#</th><th>ที่พัก / ยูนิต</th><th>สถานะ</th><th>พนักงาน</th><th>ประเภทห้อง</th><th>ค่าเช่า/เดือน</th><th>สัญญา</th><th>ผู้จัดหา</th><th>จัดการ</th></tr></thead>
                <tbody>${list.map(r => `<tr>
                    <td>${esc(r.no)}</td>
                    <td><b>${esc(r.project)}</b><small>${esc(r.unit)}</small></td>
                    <td><span class="ro-pill ${r.group === 'มีพนักงาน' ? 'is-ok' : r.group === 'ไม่มีพนักงาน' ? 'is-empty' : 'is-process'}">${esc(r.group === 'กำลังดำเนินการ' ? r.status : r.group)}</span></td>
                    <td>${r.employees ? `${num(r.employees)} คน<small>${esc(r.companies.join(', '))}</small>` : '-'}</td>
                    <td>${esc(r.type || '-')}</td>
                    <td>${r.rent ? num(r.rent) : '-'}</td>
                    <td>${r.start || r.end ? `${esc(r.start)} – ${esc(r.end)}<small>${esc(r.remaining)}</small>` : '-'}</td>
                    <td>${esc(r.agent || '-')}</td>
                    <td class="ro-actions-cell"><button type="button" class="ro-btn ro-btn-sm ${pendingReviews(r).length ? 'is-warn' : ''}" data-ro-detail="${esc(r.no)}">รายละเอียด${pendingReviews(r).length ? ` <span class="ro-badge" title="ต้องตรวจสอบที่พักพนักงาน">⚠ ${pendingReviews(r).length}</span>` : ''}</button> <button type="button" class="ro-btn ro-btn-sm" data-ro-edit="${esc(r.no)}">✏️ แก้ไข</button></td></tr>`).join('') || '<tr><td colspan="9" class="ro-empty">ไม่พบห้องตามเงื่อนไข</td></tr>'}</tbody>
            </table></div>`;
    }


    // ---------------------------------------------------------------- รายละเอียด / แก้ไขห้อง / ยืนยันที่พักของพนักงาน
    const FIELDS = [['project', 'ชื่อที่พัก / โครงการ'], ['unit', 'ยูนิต'], ['agent', 'ผู้จัดหา (Agent)'], ['type', 'ประเภทห้อง (เช่น 3 ห้องนอน 2 ห้องน้ำ)'], ['rent', 'ค่าเช่า/เดือน (บาท)'],
        ['status', 'สถานะ'], ['start', 'วันเริ่มสัญญา (วัน/เดือน/ปี)'], ['end', 'วันสิ้นสุดสัญญา (วัน/เดือน/ปี)'], ['mt', 'ระยะทางถึง Mireka Tower (กม.)'], ['or', 'ระยะทางถึง Orion City (กม.)']];
    const dialog = document.createElement('dialog');
    dialog.className = 'ro-dialog';
    root.appendChild(dialog);
    const dismissKey = (room, row) => room.no + ':' + row;
    const readDismissed = () => { try { return new Set(JSON.parse(localStorage.getItem('roDismissed') || '[]')); } catch { return new Set(); } };
    const saveDismissed = set => { try { localStorage.setItem('roDismissed', JSON.stringify([...set].slice(-500))); } catch { /* ignore */ } };
    const pendingReviews = room => { const d = readDismissed(); return (room.review || []).filter(x => !d.has(dismissKey(room, x.row))); };
    const roomByNo = no => (state.data?.rooms || []).find(r => String(r.no) === String(no));
    let toastTimer = null;
    const note = (text, bad) => { const el = dialog.querySelector('.ro-note'); if (!el) return; el.textContent = text; el.className = 'ro-note' + (bad ? ' is-bad' : ' is-ok'); clearTimeout(toastTimer); };
    async function send(method, path, body) {
        const response = await window.authFetch(API + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลห้องพัก');
        if (!response.ok || !data.success) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
        return data;
    }
    function openRoom(no, edit) {
        const r = roomByNo(no);
        if (!r) return;
        const reviews = pendingReviews(r);
        const employees = r.employeeList || [];
        dialog.innerHTML = '<div class="ro-dlg">' +
            '<div class="ro-dlg-head"><div><h3>ลำดับ ' + esc(r.no) + ' · ' + esc(r.project) + ' <small>' + esc(r.unit) + '</small></h3><span class="ro-pill ' + (r.group === 'มีพนักงาน' ? 'is-ok' : r.group === 'ไม่มีพนักงาน' ? 'is-empty' : 'is-process') + '">' + esc(r.status) + '</span></div><button type="button" class="ro-x" data-ro-close aria-label="ปิด">✕</button></div>' +
            '<p class="ro-note" role="status"></p>' +
            (reviews.length ? '<section class="ro-review"><h4>⚠️ ตรวจสอบพนักงานที่อาจอยู่บ้านหลังนี้ (' + reviews.length + ' คน)</h4>' +
                '<p class="ro-hint">ข้อมูลในชีตพนักงานไม่ตรงกับทะเบียนห้อง — ตรวจสอบว่าพนักงานคนนี้อยู่บ้านหลังนี้จริงหรือไม่ ถ้าใช่ กดบันทึกเพื่อแก้ชีตให้ตรงกับชื่อบ้านในทะเบียน (แก้ข้อความในช่องก่อนบันทึกได้)</p>' +
                reviews.map(x => '<article class="ro-rv" data-rv-row="' + esc(x.row) + '" data-rv-id="' + esc(x.employeeId) + '">' +
                    '<div class="ro-rv-who"><b>' + esc(x.name) + '</b><small>รหัส ' + esc(x.employeeId) + ' · ' + esc(x.company) + ' · แถวที่ ' + esc(x.row) + ' ในชีตพนักงาน</small></div>' +
                    '<p class="ro-rv-now">ชีตพนักงานระบุว่า: ที่พัก <b>' + esc(x.building || '-') + '</b> · ชั้น <b>' + esc(x.floor || '-') + '</b> · ห้อง <b>' + esc(x.room || '-') + '</b></p>' +
                    '<p class="ro-rv-why">' + esc(x.message) + '</p>' +
                    '<div class="ro-rv-form"><label>ชื่อที่พัก<input data-rv="building" value="' + esc(x.proposal.building) + '"></label><label>ชั้น<input data-rv="floor" value="' + esc(x.proposal.floor) + '"></label><label>ห้อง/ยูนิต<input data-rv="room" value="' + esc(x.proposal.room) + '"></label></div>' +
                    '<div class="ro-rv-actions"><button type="button" class="ro-btn ro-btn-primary" data-rv-yes>✔ ใช่ อยู่บ้านหลังนี้ — ยืนยัน</button><button type="button" class="ro-btn" data-rv-no>ไม่ใช่ / ข้ามไปก่อน</button></div></article>').join('') + '</section>' : '') +
            '<section><h4>รายละเอียดห้อง</h4><dl class="ro-dl">' +
                FIELDS.map(([k, label]) => '<dt>' + esc(label.replace(/ \(.*\)$/, '')) + '</dt><dd>' + esc((k === 'rent' ? (r.rent ? num(r.rent) : '') : r[k]) || '-') + '</dd>').join('') +
                '<dt>เหลือเวลาสัญญา</dt><dd>' + esc(r.remaining || '-') + '</dd>' +
                '<dt>พนักงานที่พักอยู่</dt><dd>' + (employees.length ? employees.map(e => esc(e.name) + ' <small>(' + esc(e.company) + ')</small>').join('<br>') : '-') + '</dd></dl></section>' +
            '<section class="ro-edit" ' + (edit ? '' : 'hidden') + '><h4>✏️ แก้ไขข้อมูลห้อง <small>บันทึกลงไฟล์ทะเบียนห้องพักใน Google Sheet</small></h4><form data-ro-form="' + esc(r.no) + '">' +
                '<div class="ro-form-grid">' + FIELDS.map(([k, label]) => '<label>' + esc(label) + '<input name="' + k + '" value="' + esc(k === 'rent' ? (r.rent || '') : (r[k] || '')) + '" ' + (k === 'project' ? 'required' : '') + '></label>').join('') + '</div>' +
                '<p class="ro-hint">เหลือเวลาสัญญาคำนวณอัตโนมัติจากชีต — แก้ไม่ได้ · เว้นว่างได้ยกเว้นชื่อที่พัก</p>' +
                '<div class="ro-rv-actions"><button type="submit" class="ro-btn ro-btn-primary">บันทึกลงทะเบียน</button><button type="button" class="ro-btn" data-ro-close>ยกเลิก</button></div></form></section>' +
            '<div class="ro-dlg-foot">' + (edit ? '' : '<button type="button" class="ro-btn" data-ro-show-edit>✏️ แก้ไขข้อมูลห้อง</button>') + '<button type="button" class="ro-btn" data-ro-close>ปิด</button></div></div>';
        if (!dialog.open) dialog.showModal();
        dialog.dataset.no = r.no;
    }
    const reopen = async no => { await load(true); if (dialog.open) openRoom(no, false); };

    root.addEventListener('click', async event => {
        const t = event.target;
        const detail = t.closest('[data-ro-detail]'); if (detail) return openRoom(detail.dataset.roDetail, false);
        const edit = t.closest('[data-ro-edit]'); if (edit) return openRoom(edit.dataset.roEdit, true);
        if (t.closest('[data-ro-close]')) { dialog.close(); return; }
        if (t.closest('[data-ro-show-edit]')) { openRoom(dialog.dataset.no, true); return; }
        const no = t.closest('[data-rv-no]');
        if (no) {
            const card = no.closest('.ro-rv'), room = roomByNo(dialog.dataset.no);
            const set = readDismissed(); set.add(dismissKey(room, card.dataset.rvRow)); saveDismissed(set);
            card.remove(); render(); return;
        }
        const yes = t.closest('[data-rv-yes]');
        if (yes) {
            const card = yes.closest('.ro-rv');
            const value = k => card.querySelector('[data-rv="' + k + '"]').value.trim();
            if (!value('building')) { note('ต้องระบุชื่อที่พัก', true); return; }
            if (!confirm('บันทึกที่พักที่ GA ยืนยัน? (เก็บในแท็บ "ที่พักที่ GA ยืนยัน" ไม่แก้ไฟล์ HR)\n\nที่พัก: ' + value('building') + '\nชั้น: ' + (value('floor') || '-') + '\nห้อง: ' + (value('room') || '-'))) return;
            yes.disabled = true; yes.textContent = 'กำลังบันทึก…';
            try {
                await send('POST', '/employee-fix', { row: Number(card.dataset.rvRow), employeeId: card.dataset.rvId, building: value('building'), floor: value('floor'), room: value('room') });
                const keep = dialog.dataset.no; await reopen(keep); note('บันทึกที่พักของพนักงานในชีตเรียบร้อยแล้ว', false);
            } catch (error) { yes.disabled = false; yes.textContent = '✔ ใช่ อยู่บ้านหลังนี้ — ยืนยัน'; note(error.message, true); }
        }
    });
    root.addEventListener('submit', async event => {
        const form = event.target.closest('[data-ro-form]'); if (!form) return;
        event.preventDefault();
        const body = Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v).trim()]));
        const button = form.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'กำลังบันทึก…';
        try {
            const result = await send('PUT', '/rooms/' + encodeURIComponent(form.dataset.roForm), body);
            const keep = dialog.dataset.no; await reopen(keep); note(result.changed ? 'บันทึกลงทะเบียนห้องพักเรียบร้อย (' + result.changed + ' ช่อง)' : 'ไม่มีข้อมูลที่เปลี่ยนแปลง', false);
        } catch (error) { button.disabled = false; button.textContent = 'บันทึกลงทะเบียน'; note(error.message, true); }
    });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

    root.addEventListener('click', async event => {
        const filter = event.target.closest('[data-ro-filter]');
        if (filter) { state.filter = filter.dataset.roFilter; render(); return; }
        if (event.target.closest('[data-ro-toggle-check]')) { const list = root.querySelector('.ro-check-list'); list.hidden = !list.hidden; return; }
        if (event.target.closest('[data-ro-refresh]')) { load(true); return; }
        const sync = event.target.closest('[data-ro-sync]');
        if (sync) {
            sync.disabled = true; sync.textContent = 'กำลังอัปเดต…';
            try {
                const response = await window.authFetch(`${API}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) throw new Error(data.message || 'อัปเดตไม่สำเร็จ');
                await load(true);
            } catch (error) { alert(error.message); }
            finally { sync.disabled = false; sync.textContent = 'อัปเดตไฟล์หลักตอนนี้'; }
        }
    });
    root.addEventListener('input', event => {
        if (!event.target.matches('[data-ro-search]')) return;
        state.query = event.target.value;
        const pos = event.target.selectionStart;
        render();
        const input = root.querySelector('[data-ro-search]'); input.focus(); input.setSelectionRange(pos, pos);
    });
    load();
})();
