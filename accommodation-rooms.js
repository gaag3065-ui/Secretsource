// ภาพรวมห้องพักทั้งหมดจากทะเบียนห้องพัก (อัปเดตตลอด) + จำนวนพนักงานที่พักอยู่ — /api/accommodation-rooms
// แยก 3 กลุ่ม: ห้องที่มีอยู่แล้ว (มีพนักงาน / ไม่มีพนักงาน) · ห้องที่กำลังอยู่ในกระบวนการ · รวมทั้งหมด
(() => {
    const root = document.getElementById('roomOverview');
    if (!root) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const state = { data: null, filter: 'all', query: '' };
    // สถานะของยูนิตในทะเบียน (ตัวเลือกเดียวกับช่อง "สถานะ" ในไฟล์ทะเบียนที่พักและแดชบอร์ดค่าไฟ)
    const STATUS_LIST = ['ทำสัญญาแล้ว', 'รอทำสัญญา', 'วางจองแล้ว', 'ตั้งเบิกแล้ว รอรับเงินวางจอง', 'ไม่มีการวางจอง', 'ได้รับเงินแล้ว รอวางจอง', 'จัดทำรายการ รอตั้งเบิกค่ามัดจำ', 'รอเข้าตรวจสอบก่อนวางมัดจำ', 'รอเข้าตรวจสอบก่อนเซ็นสัญญา'];
    const bedsOf = r => Number((/(\d+)\s*ห้องนอน/.exec(r.type || '') || [])[1] || 0);
    const bathsOf = r => Number((/(\d+)\s*ห้องน้ำ/.exec(r.type || '') || [])[1] || 0);
    const buildingKey = name => String(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    const DATE_KEYS = ['dH', 'dI', 'dJ', 'dK', 'dL', 'dM', 'dN', 'dO', 'dP', 'dQ'];

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
        const byFilter = r => state.filter === 'all' || (state.filter.startsWith('st:') ? r.status === state.filter.slice(3) : state.filter === 'process' ? r.group === 'กำลังดำเนินการ' : r.group === state.filter);
        const list = rooms.filter(r => byFilter(r)
            && (!q || `${r.project} ${r.unit} ${r.status} ${r.agent} ${r.companies.join(' ')}`.toLowerCase().includes(q)));
        const chip = (key, label, n) => `<button type="button" data-ro-filter="${key}" class="${state.filter === key ? 'is-on' : ''}">${label} <b>${num(n)}</b></button>`;
        root.querySelector('.ro-updated').textContent = `อัปเดต ${new Date(at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`;
        root.querySelector('.ro-master').hidden = !masterUrl;
        if (masterUrl) root.querySelector('.ro-master').href = masterUrl;
        root.querySelector('.ro-body').innerHTML = `
            <div class="ro-cards">
                ${(() => {
                    const beds = rooms.reduce((n, r) => n + bedsOf(r), 0), baths = rooms.reduce((n, r) => n + bathsOf(r), 0), unknown = rooms.filter(r => !bedsOf(r)).length;
                    const buildings = new Set(rooms.map(r => buildingKey(r.project)).filter(Boolean));
                    const contracted = new Set(rooms.filter(r => r.status === STATUS_LIST[0]).map(r => buildingKey(r.project)));
                    const rentAll = rooms.reduce((n, r) => n + (r.rent || 0), 0), rentContract = rooms.filter(r => r.status === STATUS_LIST[0]).reduce((n, r) => n + (r.rent || 0), 0);
                    const stat = s => rooms.filter(r => r.status === s).length;
                    const other = rooms.filter(r => !STATUS_LIST.includes(r.status));
                    return `
                <article class="ro-card ro-existing">
                    <small>ห้อง (ห้องนอนรวมทุกยูนิต)</small><strong>${num(beds)}</strong>
                    <div class="ro-split"><span>ห้องน้ำรวม <b>${num(baths)}</b></span>${unknown ? `<span>ยูนิตที่ไม่ระบุประเภทห้อง <b>${num(unknown)}</b></span>` : ''}</div>
                </article>
                <article class="ro-card ro-process ro-card-units">
                    <small>ยูนิต (แยกตามสถานะ — กดเพื่อกรองตารางด้านล่าง)</small><strong>${num(rooms.length)}</strong>
                    <div class="ro-status-grid">${STATUS_LIST.map(s => `<button type="button" data-ro-filter="st:${esc(s)}" class="${state.filter === 'st:' + s ? 'is-on' : ''}"><span>${esc(s)}</span><b>${num(stat(s))}</b></button>`).join('')}${other.length ? `<button type="button" class="ro-status-other" disabled><span>สถานะอื่นๆ</span><b>${num(other.length)}</b></button>` : ''}</div>
                </article>
                <article class="ro-card ro-total">
                    <small>ตึก</small><strong>${num(buildings.size)}</strong>
                    <div class="ro-split"><span>ทำสัญญาแล้ว <b>${num(contracted.size)}</b> ตึก</span></div>
                </article>
                <article class="ro-card ro-rent">
                    <small>ค่าเช่าทั้งหมด (รวมต่อเดือน)</small><strong>${num(rentAll)}</strong>
                    <div class="ro-split"><span>ทำสัญญาแล้ว <b>${num(rentContract)}</b></span><span>ยังไม่ทำสัญญา <b>${num(rentAll - rentContract)}</b></span></div>
                </article>`;
                })()}
            </div>
            <p class="ro-emp-line">พนักงาน on work <b>${num(c.employeesOnWork)}</b> · จับคู่ห้องได้ <b>${num(c.employeesMatched)}</b></p>
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
    const DATE_FALLBACK = ['วันตรวจสอบ', 'วันที่ตั้งเบิกค่ามัดจำ', 'วันที่จ่ายค่ามัดจำ', 'วันที่ได้รับสัญญา', 'วันที่ส่งสัญญาไปตรวจสอบ', 'วันที่ตรวจสอบเสร็จ', 'วันที่ตั้งเบิกค่าเช่าล่วงหน้า', 'วันที่ได้รับเงินตั้งเบิก', 'วันที่ตรวจสอบก่อนเซ็นสัญญา', 'วันที่เซ็นสัญญา'];
    const fieldsOf = () => [['project', 'ชื่อที่พัก / โครงการ'], ['unit', 'ยูนิต'], ['agent', 'ผู้จัดหา (Agent)'], ['type', 'ประเภทห้อง (เช่น 3 ห้องนอน 2 ห้องน้ำ)'], ['rent', 'ค่าเช่า/เดือน (บาท)'],
        ['status', 'สถานะ'],
        ...DATE_KEYS.map((k, i) => [k, (state.data?.dateHeaders?.[k] || DATE_FALLBACK[i]) + ' (วัน/เดือน/ปี)']),
        ['start', 'วันเริ่มสัญญา (วัน/เดือน/ปี)'], ['end', 'วันสิ้นสุดสัญญา (วัน/เดือน/ปี)'], ['mt', 'ระยะทางถึง Mireka Tower (กม.)'], ['or', 'ระยะทางถึง Orion City (กม.)']];
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
                fieldsOf().filter(([k]) => !DATE_KEYS.includes(k) || r[k]).map(([k, label]) => '<dt>' + esc(label.replace(/ \(.*\)$/, '')) + '</dt><dd>' + esc((k === 'rent' ? (r.rent ? num(r.rent) : '') : r[k]) || '-') + '</dd>').join('') +
                '<dt>เหลือเวลาสัญญา</dt><dd>' + esc(r.remaining || '-') + '</dd>' +
                '<dt>พนักงานที่พักอยู่</dt><dd>' + (employees.length ? employees.map(e => esc(e.name) + ' <small>(' + esc(e.company) + ')</small>').join('<br>') : '-') + '</dd></dl></section>' +
            '<section class="ro-edit" ' + (edit ? '' : 'hidden') + '><h4>✏️ แก้ไขข้อมูลห้อง <small>บันทึกลงไฟล์ทะเบียนห้องพักใน Google Sheet</small></h4><form data-ro-form="' + esc(r.no) + '">' +
                '<div class="ro-form-grid">' + fieldsOf().map(([k, label]) => {
                    const val = k === 'rent' ? (r.rent || '') : (r[k] || '');
                    const head = k === DATE_KEYS[0] ? '<h5 class="ro-form-sub">วันที่ของแต่ละขั้นตอน</h5>' : '';
                    if (k === 'status') return '<label>' + esc(label) + '<select name="status">' + (STATUS_LIST.includes(val) || !val ? '' : '<option selected>' + esc(val) + '</option>') + STATUS_LIST.map(s => '<option' + (s === val ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label>';
                    return head + '<label>' + esc(label) + '<input name="' + k + '" value="' + esc(val) + '" ' + (k === 'project' ? 'required' : '') + '></label>';
                }).join('') + '</div>' +
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
            if (!confirm('แก้ที่พักในไฟล์ HR ของพนักงานคนนี้โดยตรง และบันทึกประวัติ (ข้อมูลเดิม เทียบข้อมูลที่แก้) ?\n\nที่พัก: ' + value('building') + '\nชั้น: ' + (value('floor') || '-') + '\nห้อง: ' + (value('room') || '-'))) return;
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
