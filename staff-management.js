// จัดการพนักงาน: รายชื่อจากแท็บ "ข้อมูลเบื้องต้น" → กรองตามบริษัท/สถานะ/พื้นที่/ที่พัก/Size/สัญญาเช่า → "จัดงาน" สร้างและติดตามงานรายคน
// ข้อมูลจาก /api/staff (สิทธิ์ ManageStaff) — งานเก็บบน Google Drive (ชีต "ฐานข้อมูลจัดการพนักงาน")
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/staff${path}`;
    const PRIO_CLASS = { 'สำคัญ': 'p-high', 'ด่วน': 'p-urgent' };
    const OPEN = new Set(['assigned', 'doing']);
    // ตัวกรอง: always = คอลัมน์ที่แสดงตลอด · ที่เหลือแสดงคอลัมน์เมื่อเลือกตัวกรองนั้น (รวม "ทุก…") — ค่า '*' = แสดงคอลัมน์แต่ไม่กรอง
    const FILTERS = [
        { key: 'company', label: 'บริษัท', all: 'ทุกบริษัท', always: true },
        { key: 'status', label: 'สถานะปัจจุบัน', all: 'ทุกสถานะ', always: true },
        { key: 'area', label: 'พื้นที่รันงาน', all: 'ทุกพื้นที่' },
        { key: 'building', label: 'ตึกพัก', all: 'ทุกตึก' },
        { key: 'floor', label: 'ชั้น', all: 'ทุกชั้น' },
        { key: 'room', label: 'ห้อง', all: 'ทุกห้อง' },
        { key: 'size', label: 'Size 2026', all: 'ทุก Size' },
        { key: 'contractText', label: 'สัญญาเช่าบ้าน SL', all: 'ทั้งหมด' }
    ];
    const pick = key => document.querySelector(`[data-filter="${key}"]`)?.value || '';
    // ห้องที่กรอกเป็นชื่อตึกซ้ำ (ไม่มีเลขห้อง) ไม่ต้องแสดงซ้ำ
    const roomOf = e => (e.room && e.room !== e.building ? e.room : '');
    const state = { data: null, byKey: new Map(), current: null, drafts: new Map() };

    // หน้านี้เปิดตรง/ฝังใน iframe ได้โดยไม่ผ่านหน้าที่เก็บ csrfToken ไว้ → ขอจาก /api/session ก่อนส่งคำขอแก้ไขครั้งแรก
    async function ensureCsrf() {
        if (window.getCsrfToken()) return;
        const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (data.csrfToken) sessionStorage.setItem('csrfToken', data.csrfToken);
    }
    async function request(path, options = {}) {
        if (options.method && options.method !== 'GET') await ensureCsrf();
        const response = await window.authFetch(api(path), { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ทหลังบ้าน)');
        if (!response.ok || data.success === false) throw new Error(data.message || `ทำรายการไม่สำเร็จ (${response.status})`);
        return data;
    }
    let toastTimer = null;
    function toast(text, isError = false) {
        const node = $('smToast');
        node.textContent = text;
        node.className = `fa-toast is-visible${isError ? ' is-error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { node.className = 'fa-toast'; }, isError ? 6000 : 3000);
    }
    const when = text => text ? new Date(text).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const thDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : ''; };
    const tasksOf = key => (state.data?.tasks || []).filter(t => t.employee_key === key).sort((a, b) => (OPEN.has(b.status) - OPEN.has(a.status)) || b.id - a.id);
    const isOnWork = e => /on\s*work/i.test(e.status);

    // ---------------------------------------------------------------- โหลด
    async function load(refresh = false) {
        $('smRows').innerHTML = '<tr><td colspan="6" class="fa-empty">กำลังโหลด…</td></tr>';
        try {
            state.data = await request(`/employees${refresh ? '?refresh=1' : ''}`);
            state.byKey = new Map(state.data.employees.map(e => [e.key, e]));
            $('smUpdated').textContent = `· อัปเดต ${new Date(state.data.updatedAt).toLocaleTimeString('th-TH')}`;
            fillFilters();
            render();
        } catch (error) {
            $('smRows').innerHTML = `<tr><td colspan="6" class="fa-empty">${esc(error.message)}</td></tr>`;
        }
    }

    // ตัวเลือกในตัวกรองมาจากข้อมูลจริง (พร้อมจำนวนคน)
    // หัวตัวเลือก: "ตึกพัก : ยังไม่เลือก" / "ตึกพัก : ทุกตึก" / "ตึกพัก : <ค่า> (จำนวน)"
    function fillFilters() {
        const sortTh = (a, b) => a.localeCompare(b, 'th', { numeric: true });
        const value = (e, key) => (key === 'room' ? roomOf(e) : e[key]) || '(ว่าง)';
        $('smFilters').innerHTML = FILTERS.map(f => {
            const keep = pick(f.key);
            const counts = new Map();
            state.data.employees.forEach(e => { const v = value(e, f.key); counts.set(v, (counts.get(v) || 0) + 1); });
            const options = [...counts.keys()].sort(sortTh);
            const head = f.always
                ? `<option value="">${esc(f.label)} : ${esc(f.all)}</option>`
                : `<option value="">${esc(f.label)} : ยังไม่เลือก</option><option value="*" ${keep === '*' ? 'selected' : ''}>${esc(f.label)} : ${esc(f.all)}</option>`;
            return `<select data-filter="${f.key}" title="${esc(f.label)}">${head}${options.map(v =>
                `<option value="${esc(v)}" ${v === keep ? 'selected' : ''}>${esc(f.label)} : ${esc(v)} (${counts.get(v)})</option>`).join('')}</select>`;
        }).join('');
    }

    function filtered() {
        const q = $('smSearch').value.trim().toLowerCase();
        const taskMode = $('smTask').value;
        const picks = Object.fromEntries(FILTERS.map(f => [f.key, pick(f.key)]));
        return state.data.employees.filter(e => {
            for (const f of FILTERS) {
                const want = picks[f.key];
                if (want && want !== '*' && ((f.key === 'room' ? roomOf(e) : e[f.key]) || '(ว่าง)') !== want) return false;
            }
            const tasks = tasksOf(e.key);
            if (taskMode === 'open' && !tasks.some(t => OPEN.has(t.status))) return false;
            if (taskMode === 'none' && tasks.some(t => t.status !== 'cancelled')) return false;
            if (taskMode === 'done' && !tasks.some(t => t.status === 'done')) return false;
            if (q && ![e.fullname, e.nickname, e.employeeId, e.centralId, e.insuranceCode, e.company, e.building, e.room, ...tasks.map(t => t.title)]
                .some(v => String(v || '').toLowerCase().includes(q))) return false;
            return true;
        });
    }

    // ---------------------------------------------------------------- ตาราง
    function render() {
        const rows = filtered();
        const all = state.data.employees;
        const tasks = state.data.tasks;
        const stat = (n, label) => `<div class="fa-stat"><strong>${n.toLocaleString('th-TH')}</strong><span>${label}</span></div>`;
        $('smStats').innerHTML = stat(all.length, 'พนักงานทั้งหมด') + stat(all.filter(isOnWork).length, 'สถานะ on work')
            + stat(new Set(tasks.filter(t => OPEN.has(t.status)).map(t => t.employee_key)).size, 'คนที่มีงานค้าง')
            + stat(tasks.filter(t => OPEN.has(t.status)).length, 'งานที่ยังไม่เสร็จ') + stat(tasks.filter(t => t.status === 'done').length, 'งานเสร็จแล้ว')
            + stat(all.filter(e => e.contracts > 0).length, 'เคยเซ็นสัญญาเช่าบ้าน SL');
        document.querySelectorAll('.sm-toolbar select').forEach(s => s.classList.toggle('is-set', Boolean(s.value)));
        $('smCount').textContent = `แสดง ${rows.length.toLocaleString('th-TH')} จาก ${all.length.toLocaleString('th-TH')} คน`;
        // คอลัมน์: บริษัท · สถานะ · ชื่อเล่น · ชื่อจริง · [ช่องที่เลือกตัวกรอง] · งานที่มอบหมาย · ปุ่ม
        const extra = FILTERS.filter(f => !f.always && pick(f.key));
        const cell = (e, key) => {
            if (key === 'contractText') return `<span class="fa-badge ${e.contracts ? 'ok' : 'dim'}">${esc(e.contractText)}</span>`;
            const v = key === 'room' ? roomOf(e) : e[key];
            return `<span class="sm-wrap">${esc(v || '-')}</span>`;
        };
        $('smHead').innerHTML = `<th>บริษัท</th><th>สถานะปัจจุบัน</th><th>ชื่อเล่น</th><th>ชื่อพนักงาน</th>${extra.map(f => `<th>${esc(f.label)}</th>`).join('')}<th>งานที่มอบหมาย</th><th></th>`;
        const span = 6 + extra.length;
        if (!rows.length) { $('smRows').innerHTML = `<tr><td colspan="${span}" class="fa-empty">ไม่พบพนักงานตามตัวกรอง</td></tr>`; return; }
        $('smRows').innerHTML = rows.map(e => {
            const list = tasksOf(e.key).filter(t => t.status !== 'cancelled');
            const pills = list.slice(0, 6).map(t => {
                const stages = stagesOf(t);
                return `<span class="sm-task-pill ${esc(t.status)}" title="${esc(`${t.title} · ${stages.map(s => s[1]).join(' · ')}`)}"><span class="sm-task-title">${esc(t.title)}</span>${stages.map(([cls, text]) => `<i class="sm-ack ${cls}">${text}</i>`).join('')}</span>`;
            }).join('')
                + (list.length > 6 ? `<span class="sm-task-pill more">+${list.length - 6}</span>` : '');
            return `<tr>
                <td>${esc(e.company || '-')}</td>
                <td><span class="fa-badge ${isOnWork(e) ? 'ok' : 'dim'}">${esc(e.status || '-')}</span></td>
                <td class="sm-nick">${esc(e.nickname || '-')}</td>
                <td><b>${esc(e.fullname)}</b><small>${esc([e.employeeId || e.centralId, e.insuranceCode].filter(Boolean).join(' · '))}</small></td>
                ${extra.map(f => `<td>${cell(e, f.key)}</td>`).join('')}
                <td class="sm-tasks-cell"><div class="sm-tasks">${pills || '<span class="fa-badge dim">ยังไม่มีงาน</span>'}</div></td>
                <td class="sm-actions"><button type="button" class="fa-btn sm-check" data-check="${esc(e.key)}" ${list.some(t => (t.fields || []).length || (t.uploads || []).length || t.submitted_at) ? '' : 'disabled title="ยังไม่มีงานที่ต้องส่งข้อมูล"'}>ตรวจ${list.some(t => t.status === 'submitted') ? ' <i class="sm-dot"></i>' : ''}</button><button type="button" class="fa-btn sm-plan" data-plan="${esc(e.key)}">จัดงาน</button></td>
            </tr>`;
        }).join('');
    }

    // ---------------------------------------------------------------- จัดงาน (รายคน)
    function openPlan(key) {
        const e = state.byKey.get(key);
        if (!e) return;
        state.current = key;
        const info = [
            ['รหัสพนักงาน', e.employeeId || e.centralId || '-'], ['รหัสประกัน', e.insuranceCode || '-'], ['บริษัท', e.company || '-'],
            ['สถานะปัจจุบัน', e.status || '-'], ['พื้นที่รันงาน', e.area || '-'],
            ['ที่พัก', [e.building, e.floor && `ชั้น ${e.floor}`, roomOf(e) && `ห้อง ${roomOf(e)}`].filter(Boolean).join(' · ') || '-'],
            ['Size 2026', e.size || '-'], ['สัญญาเช่าบ้าน SL', e.contractText]
        ];
        const visible = filtered();
        const opt = list => list.map(v => `<option>${esc(v)}</option>`).join('');
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>จัดงาน · ${esc(e.fullname)}${e.nickname ? ` (${esc(e.nickname)})` : ''}</h2><p>แถว ${e.row} ในแท็บข้อมูลเบื้องต้น</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <div class="sm-info">${info.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
                <section class="sm-section">
                    <h3>สร้างงานใหม่</h3>
                    ${templatesHtml()}
                    <form class="sm-form" id="smNewTask">
                        <label class="sm-wide">หัวเรื่องงาน <span class="sm-req">*</span><input name="title" maxlength="150" required placeholder="เช่น ส่งเอกสารตรวจสุขภาพประจำปี"></label>
                        <label class="sm-wide">รายละเอียด<textarea name="detail" maxlength="3000" placeholder="สิ่งที่ต้องทำ ขั้นตอน เอกสารที่ต้องใช้ ผู้ประสานงาน"></textarea></label>
                        <label>ลงกล่องงาน (หน้าระบบจัดการองค์กร)<select name="box">
                            ${(state.data.boxes || []).map(b => `<option value="${esc(b.key)}" ${b.key === 'quests' ? 'selected' : ''}>${esc(`${b.icon} ${b.title}`)}</option>`).join('')}
                            <option value="__new">＋ สร้างกล่องใหม่…</option></select></label>
                        <label class="sm-newbox sm-wide" hidden>ชื่อกล่องใหม่ <span class="sm-req">*</span><input name="new_box_title" maxlength="80" placeholder="เช่น เอกสารเดินทางไป SL"></label>
                        <label>ความสำคัญ<select name="priority">${opt(state.data.priorities)}</select></label>
                        <label>กำหนดเสร็จ<input type="date" name="due_date"></label>
                        <div class="sm-wide sm-kinds">
                            <span class="sm-kinds-title">ประเภทงาน</span>
                            <label><input type="radio" name="kind" value="notice" checked> แจ้งให้รับทราบอย่างเดียว</label>
                            <label><input type="radio" name="kind" value="info"> งานเก็บข้อมูล (ให้กรอกข้อมูล)</label>
                            <label><input type="radio" name="kind" value="info_upload"> งานเก็บข้อมูลและอัปโหลดเอกสาร</label>
                        </div>
                        <div class="sm-wide sm-builder" data-builder="fields" hidden>
                            <b>ช่องกรอกข้อมูล</b><small>ตั้งหัวเรื่องของแต่ละช่อง เช่น เบอร์โทรศัพท์, เลขบัญชี</small>
                            <div class="sm-builder-rows"></div>
                            <button type="button" class="fa-btn fa-btn-ghost" data-add="fields">＋ เพิ่มช่องกรอกข้อมูล</button>
                        </div>
                        <div class="sm-wide sm-builder" data-builder="uploads" hidden>
                            <b>ช่องอัปโหลด</b><small>เขียนว่าให้อัปโหลดอะไร และเลือกชนิดไฟล์ — ไฟล์ PDF พนักงานกรอกรหัสเปิดไฟล์ได้ (ถ้ามี)</small>
                            <div class="sm-builder-rows"></div>
                            <button type="button" class="fa-btn fa-btn-ghost" data-add="uploads">＋ เพิ่มช่องอัปโหลด</button>
                        </div>
                        <div class="sm-form-foot">
                            <label><input type="checkbox" name="bulk"> มอบหมายให้พนักงานที่กรองอยู่ทั้งหมด (${visible.length} คน)</label>
                            <button type="submit" class="fa-btn fa-btn-primary">มอบหมายงาน</button>
                        </div>
                    </form>
                </section>
                <section class="sm-section">
                    <h3>งานของ ${esc(e.fullname)}</h3>
                    <div class="sm-task-list" id="smTaskList"></div>
                </section>
            </div>`;
        renderTasks();
        // ข้อมูลที่กรอกค้างไว้ของพนักงานคนนี้ (ปิดหน้าต่างไปก่อนส่ง) → ใส่คืน
        const draft = state.drafts.get(key);
        if (draft) fillForm($('smNewTask'), draft);
        else syncBuilder($('smNewTask'));
        const dialog = $('smDialog');
        if (!dialog.open) dialog.showModal();
    }
    // หัวเรื่องงานที่เคยสร้าง → ปุ่มให้กดใช้ซ้ำ (กรอกทุกช่องเหมือนเดิม ไม่ต้องตั้งใหม่)
    function templates() {
        const seen = new Set();
        return [...state.data.tasks].sort((a, b) => b.id - a.id).filter(t => {
            const k = t.title.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 15);
    }
    function templatesHtml() {
        const list = templates();
        if (!list.length) return '';
        return `<div class="sm-templates"><span>ใช้หัวเรื่องที่เคยสร้าง:</span>${list.map(t =>
            `<button type="button" class="sm-template" data-template="${t.id}" title="${esc(`${t.box_title || ''} · ${t.kind_label || ''}`)}">${esc(t.title)}</button>`).join('')}</div>`;
    }
    function readForm(form) {
        const rows = type => [...form.querySelectorAll(`[data-builder="${type}"] .sm-builder-row`)];
        return {
            title: form.title.value, detail: form.detail.value, box: form.box.value, new_box_title: form.new_box_title.value,
            priority: form.priority.value, due_date: form.due_date.value, kind: form.querySelector('[name=kind]:checked')?.value || 'notice',
            bulk: form.bulk.checked,
            fields: rows('fields').map(r => ({ label: r.querySelector('[data-label]').value })),
            uploads: rows('uploads').map(r => ({ label: r.querySelector('[data-label]').value, type: r.querySelector('[data-type]').value }))
        };
    }
    function fillForm(form, d) {
        ['title', 'detail', 'new_box_title', 'priority', 'due_date'].forEach(k => { if (d[k] !== undefined) form[k].value = d[k]; });
        if (d.box && [...form.box.options].some(o => o.value === d.box)) form.box.value = d.box;
        const kind = form.querySelector(`[name=kind][value="${d.kind || 'notice'}"]`);
        if (kind) kind.checked = true;
        form.bulk.checked = Boolean(d.bulk);
        [['fields', d.fields || []], ['uploads', d.uploads || []]].forEach(([type, list]) => {
            const rows = form.querySelector(`[data-builder="${type}"] .sm-builder-rows`);
            rows.replaceChildren(...list.map(item => {
                const row = builderRow(type);
                row.querySelector('[data-label]').value = item.label || '';
                if (type === 'uploads') row.querySelector('[data-type]').value = item.type === 'pdf' ? 'pdf' : 'image';
                return row;
            }));
        });
        syncBuilder(form);
    }
    function useTemplate(id) {
        const t = state.data.tasks.find(x => x.id === Number(id));
        if (!t) return;
        fillForm($('smNewTask'), { title: t.title, detail: t.detail || '', box: t.box || 'quests', new_box_title: '', priority: t.priority || 'ปกติ',
            due_date: t.due_date || '', kind: t.kind || 'notice', fields: t.fields || [], uploads: t.uploads || [] });
        toast(`ใช้หัวเรื่อง "${t.title}" แล้ว — แก้ไขได้ก่อนกดมอบหมาย`);
    }
    // ตัวสร้างแบบฟอร์มงาน: เพิ่ม/ลบช่องกรอกข้อมูลและช่องอัปโหลด
    function builderRow(type) {
        const row = document.createElement('div');
        row.className = 'sm-builder-row';
        row.innerHTML = type === 'fields'
            ? '<input data-label maxlength="150" placeholder="หัวเรื่องช่องกรอกข้อมูล"><button type="button" class="fa-btn fa-btn-ghost" data-remove title="ลบช่องนี้">×</button>'
            : '<input data-label maxlength="150" placeholder="ให้อัปโหลดอะไร เช่น ผลตรวจ 4 โรค"><select data-type><option value="image">รูปภาพ</option><option value="pdf">PDF (มีช่องกรอกรหัส ถ้ามี)</option></select><button type="button" class="fa-btn fa-btn-ghost" data-remove title="ลบช่องนี้">×</button>';
        return row;
    }
    function syncBuilder(form) {
        const kind = form.querySelector('[name=kind]:checked').value;
        form.querySelector('.sm-newbox').hidden = form.box.value !== '__new';
        [['fields', kind !== 'notice'], ['uploads', kind === 'info_upload']].forEach(([type, on]) => {
            const box = form.querySelector(`[data-builder="${type}"]`);
            box.hidden = !on;
            const rows = box.querySelector('.sm-builder-rows');
            if (on && !rows.children.length && (type === 'uploads' || kind === 'info')) rows.append(builderRow(type));
        });
    }
    function renderTasks() {
        const list = tasksOf(state.current);
        const statuses = state.data.statuses;
        $('smTaskList').innerHTML = list.length ? list.map(t => `
            <article class="sm-task ${esc(t.status)}" data-task="${t.id}">
                <header>
                    <div><b>${esc(t.title)}</b> <span class="sm-prio ${PRIO_CLASS[t.priority] || ''}">${esc(t.priority)}</span> <span class="fa-type">${esc(t.box_title || t.category)}</span> <span class="fa-type">${esc(t.kind_label || '')}</span>
                        ${t.acknowledged_at ? `<span class="fa-badge ok">รับทราบแล้ว ${esc(when(t.acknowledged_at))}</span>` : '<span class="fa-badge wait">ยังไม่รับทราบ</span>'}</div>
                    <span class="sm-meta">#${t.id} · มอบหมายโดย ${esc(t.created_by)} ${esc(when(t.created_at))}${t.due_date ? ` · กำหนดเสร็จ ${esc(thDate(t.due_date))}` : ''}</span>
                </header>
                ${t.detail ? `<p>${esc(t.detail)}</p>` : ''}
                ${responseHtml(t)}
                <div class="sm-task-actions">
                    <select data-field="status">${Object.entries(statuses).map(([k, v]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
                    <input data-field="note" value="${esc(t.note)}" placeholder="บันทึกติดตามงาน">
                    <button type="button" class="fa-btn" data-save="${t.id}">บันทึก</button>
                    <button type="button" class="fa-btn fa-btn-ghost" data-delete="${t.id}" title="ลบงานนี้ออกจากรายการ">ลบ</button>
                </div>
                ${t.updated_by && t.updated_at !== t.created_at ? `<span class="sm-meta">แก้ไขล่าสุดโดย ${esc(t.updated_by)} ${esc(when(t.updated_at))}</span>` : ''}
            </article>`).join('') : '<p class="fa-empty">ยังไม่มีงาน — สร้างงานใหม่ด้านบน</p>';
    }

    // ขั้นตอนของงาน: ยังไม่รับทราบ → รับทราบแล้ว → ส่งข้อมูลแล้ว → ตรวจสอบแล้ว
    function stagesOf(t) {
        if (!t.acknowledged_at && !t.submitted_at) return [['unread', 'ยังไม่รับทราบ']];
        const out = [['read', '✓ รับทราบแล้ว']];
        if (t.submitted_at || t.status === 'done') out.push(['sent', '✓ ส่งข้อมูลแล้ว']);
        if (t.status === 'done') out.push(['checked', '✓ ตรวจสอบแล้ว']);
        return out;
    }

    // ---------------------------------------------------------------- ตรวจเอกสารที่พนักงานส่ง (ครบ/ไม่ครบ + ดูรูป/ไฟล์บนเว็บ)
    const blobCache = new Map();
    async function fileUrl(ref) {
        if (blobCache.has(ref)) return blobCache.get(ref);
        const [id, n] = ref.split('/');
        const response = await window.authFetch(api(`/tasks/${id}/file/${n}`));
        if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
        const url = URL.createObjectURL(await response.blob());
        blobCache.set(ref, url);
        return url;
    }
    function openCheck(key) {
        const e = state.byKey.get(key);
        if (!e) return;
        state.current = key;
        state.mode = 'check';
        const list = tasksOf(key).filter(t => (t.fields || []).length || (t.uploads || []).length || t.submitted_at);
        const check = t => {
            const files = t.files || [];
            const missingFields = (t.fields || []).filter(f => !t.response?.[f.id]);
            const missingUploads = (t.uploads || []).filter(u => !files.some(f => f.slot === u.id));
            const complete = Boolean(t.submitted_at) && !missingFields.length && !missingUploads.length;
            return { files, missingFields, missingUploads, complete };
        };
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>ตรวจเอกสาร · ${esc(e.fullname)}${e.nickname ? ` (${esc(e.nickname)})` : ''}</h2><p>${esc([e.employeeId || e.centralId, e.insuranceCode, e.company].filter(Boolean).join(' · '))}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                ${list.length ? list.map(t => {
                    const c = check(t);
                    return `<article class="sm-check-task ${c.complete ? 'is-ok' : 'is-wait'}" data-task="${t.id}">
                        <header>
                            <div><b>${esc(t.title)}</b> <span class="fa-type">${esc(t.box_title || '')}</span></div>
                            <div class="sm-stages">${stagesOf(t).map(([cls, text]) => `<i class="sm-ack ${cls}">${text}</i>`).join('')}</div>
                        </header>
                        <p class="sm-check-sum">${!t.submitted_at ? '⏳ พนักงานยังไม่ส่งข้อมูล' : c.complete ? '✅ ข้อมูลและเอกสารครบถ้วน' : `⚠️ ไม่ครบ: ${[...c.missingFields.map(f => f.label), ...c.missingUploads.map(u => u.label)].map(esc).join(', ')}`}
                            ${t.submitted_at ? ` · ส่งเมื่อ ${esc(when(t.submitted_at))}` : ''}</p>
                        ${(t.fields || []).length ? `<div class="sm-check-fields">${t.fields.map(f => `<div class="${t.response?.[f.id] ? '' : 'is-missing'}"><small>${esc(f.label)}</small><b>${esc(t.response?.[f.id] || 'ยังไม่กรอก')}</b></div>`).join('')}</div>` : ''}
                        ${(t.uploads || []).map(u => {
                            const files = c.files.filter(f => f.slot === u.id);
                            return `<div class="sm-check-slot ${files.length ? '' : 'is-missing'}"><small>${esc(u.label)} · ${u.type === 'pdf' ? 'PDF' : 'รูปภาพ'} · ${files.length ? `${files.length} ไฟล์` : 'ยังไม่อัปโหลด'}</small>
                                <div class="sm-check-files">${files.map(f => f.mime === 'application/pdf'
                                    ? `<button type="button" class="sm-pdf" data-file="${t.id}/${f.n}">📄 เปิด PDF ${f.n + 1}${f.password ? `<span>รหัส: ${esc(f.password)}</span>` : ''}</button>`
                                    : `<button type="button" class="sm-thumb" data-view="${t.id}/${f.n}"><img data-src="${t.id}/${f.n}" alt="${esc(u.label)}"></button>`).join('')}</div></div>`;
                        }).join('')}
                        <div class="sm-check-actions">
                            <input data-field="note" value="${esc(t.note || '')}" placeholder="หมายเหตุถึงพนักงาน / บันทึกการตรวจ">
                            <button type="button" class="fa-btn fa-btn-primary" data-review="done" ${t.submitted_at ? '' : 'disabled'}>✓ ตรวจสอบแล้ว</button>
                            <button type="button" class="fa-btn" data-review="reopen" ${t.submitted_at || t.status === 'done' ? '' : 'disabled'}>↩ ให้ส่งใหม่</button>
                        </div>
                    </article>`;
                }).join('') : '<p class="fa-empty">ยังไม่มีงานที่ให้พนักงานส่งข้อมูล</p>'}
            </div>`;
        const dialog = $('smDialog');
        if (!dialog.open) dialog.showModal();
        // โหลดภาพย่อจากหลังบ้าน (ต้องแนบสิทธิ์ล็อกอิน — ใช้ลิงก์ Drive ตรงไม่ได้)
        $('smDetail').querySelectorAll('img[data-src]').forEach(async img => {
            try { img.src = await fileUrl(img.dataset.src); } catch { img.alt = 'เปิดรูปไม่ได้'; }
        });
    }
    async function reviewTask(button) {
        const card = button.closest('[data-task]');
        const id = card.dataset.task;
        const note = card.querySelector('[data-field=note]').value;
        const reopen = button.dataset.review === 'reopen';
        if (reopen && !confirm('ให้พนักงานแก้ไขและส่งข้อมูลงานนี้ใหม่?')) return;
        button.disabled = true;
        try {
            await updateTask(id, reopen ? { reopen: true, note } : { status: 'done', note }, reopen ? 'ส่งกลับให้พนักงานแก้ไขแล้ว' : 'บันทึกว่าตรวจสอบแล้ว');
            openCheck(state.current);
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }

    // สิ่งที่ GA ขอ + สิ่งที่พนักงานตอบกลับ (ข้อมูลที่กรอก / ไฟล์ที่ส่ง)
    function responseHtml(t) {
        const fields = t.fields || [], uploads = t.uploads || [];
        if (!fields.length && !uploads.length) return '';
        const files = t.files || [];
        return `<div class="sm-response">
            ${t.submitted_at ? `<span class="fa-badge ok">พนักงานส่งแล้ว ${esc(when(t.submitted_at))}</span>` : '<span class="fa-badge dim">พนักงานยังไม่ส่ง</span>'}
            ${fields.map(f => `<div><small>${esc(f.label)}</small><b>${esc(t.response?.[f.id] || '-')}</b></div>`).join('')}
            ${uploads.map(u => `<div><small>${esc(u.label)} (${u.type === 'pdf' ? 'PDF' : 'รูปภาพ'})</small>${files.filter(f => f.slot === u.id).map(f =>
                `<button type="button" class="fa-btn fa-btn-ghost sm-file" data-file="${t.id}/${f.n}">เปิดไฟล์ ${f.n + 1}</button>${f.password ? ` <span class="fa-type">รหัส PDF: ${esc(f.password)}</span>` : ''}`).join(' ') || '<b>-</b>'}</div>`).join('')}
        </div>`;
    }
    async function openFile(ref) {
        const win = window.open('', '_blank');
        try {
            const response = await window.authFetch(api(`/tasks/${ref.split('/')[0]}/file/${ref.split('/')[1]}`));
            if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
            const url = URL.createObjectURL(await response.blob());
            if (win) win.location.href = url; else window.open(url, '_blank');
        } catch (error) { if (win) win.close(); toast(error.message, true); }
    }

    async function createTask(form) {
        const fd = Object.fromEntries(new FormData(form));
        if (!fd.title?.trim()) return toast('กรุณากรอกหัวเรื่องงาน', true);
        if (fd.box === '__new' && !fd.new_box_title?.trim()) return toast('กรุณาตั้งชื่อกล่องใหม่', true);
        const rowsOf = type => [...form.querySelectorAll(`[data-builder="${type}"] .sm-builder-row`)];
        fd.fields = fd.kind === 'notice' ? [] : rowsOf('fields').map(r => ({ label: r.querySelector('[data-label]').value.trim() })).filter(f => f.label);
        fd.uploads = fd.kind !== 'info_upload' ? [] : rowsOf('uploads').map(r => ({ label: r.querySelector('[data-label]').value.trim(), type: r.querySelector('[data-type]').value })).filter(u => u.label);
        // เลือก "เก็บข้อมูลและอัปโหลด" แต่ไม่ได้ตั้งช่องอัปโหลด → เป็นงานเก็บข้อมูล
        if (fd.kind === 'info_upload' && !fd.uploads.length && fd.fields.length) fd.kind = 'info';
        if (fd.kind === 'info' && !fd.fields.length) return toast('งานเก็บข้อมูลต้องมีช่องกรอกข้อมูลอย่างน้อย 1 ช่อง', true);
        if (fd.kind === 'info_upload' && !fd.uploads.length) return toast('กรุณาเพิ่มช่องอัปโหลดอย่างน้อย 1 ช่อง', true);
        const keys = fd.bulk ? filtered().map(e => e.key) : [state.current];
        if (fd.bulk && !confirm(`มอบหมายงาน "${fd.title}" ให้พนักงาน ${keys.length} คน?`)) return;
        const button = form.querySelector('button[type=submit]');
        button.disabled = true;
        try {
            const { tasks, boxes } = await request('/tasks', { method: 'POST', body: JSON.stringify({ ...fd, bulk: undefined, employee_keys: keys }) });
            state.data.tasks.push(...tasks);
            if (boxes) state.data.boxes = boxes;
            state.drafts.delete(state.current);
            openPlan(state.current);      // วาดฟอร์มใหม่ (มีกล่องที่เพิ่งสร้างให้เลือก)
            renderTasks();
            render();
            toast(`มอบหมายงานแล้ว ${tasks.length} คน`);
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }
    async function updateTask(id, patch, done) {
        const { task } = await request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
        const i = state.data.tasks.findIndex(t => t.id === task.id);
        if (patch.status === 'deleted') state.data.tasks.splice(i, 1); else state.data.tasks[i] = task;
        if ($('smTaskList')) renderTasks();
        render();
        toast(done);
    }

    // ---------------------------------------------------------------- เหตุการณ์
    // ตัวกรองถูกสร้างใหม่ตอนโหลด → ฟังที่แถบเครื่องมือแทน
    document.querySelector('.sm-toolbar').addEventListener('change', event => { if (event.target.matches('select')) render(); });
    $('smSearch').addEventListener('input', render);
    $('smDialog').addEventListener('submit', event => { if (event.target.id === 'smNewTask') { event.preventDefault(); createTask(event.target); } });
    // ปิดหน้าต่าง (ปุ่ม × / Esc) → เก็บข้อมูลที่กรอกไว้ เปิดพนักงานคนเดิมอีกครั้งจะกรอกคืนให้
    $('smDialog').addEventListener('close', () => {
        const form = $('smNewTask');
        if (!form || !state.current) return;
        const d = readForm(form);
        const filled = d.title.trim() || d.detail.trim() || d.fields.some(f => f.label.trim()) || d.uploads.some(u => u.label.trim());
        if (filled) state.drafts.set(state.current, d); else state.drafts.delete(state.current);
    });
    $('smDialog').addEventListener('change', event => { const form = event.target.closest('#smNewTask'); if (form && event.target.matches('[name=kind], [name=box]')) syncBuilder(form); });
    $('smDialog').addEventListener('click', async event => {
        // คลิกพื้นที่ว่างนอกหน้าต่างไม่ปิด (กันข้อมูลที่กรอกหาย) — ปิดด้วยปุ่ม × เท่านั้น
        if (event.target.closest('[data-close]')) return $('smDialog').close();
        const template = event.target.closest('[data-template]');
        if (template) return useTemplate(template.dataset.template);
        const add = event.target.closest('[data-add]');
        if (add) return add.previousElementSibling.append(builderRow(add.dataset.add));
        if (event.target.closest('[data-remove]')) return event.target.closest('.sm-builder-row').remove();
        const review = event.target.closest('[data-review]');
        if (review) return reviewTask(review);
        const view = event.target.closest('[data-view]');
        if (view) { try { const url = await fileUrl(view.dataset.view); window.open(url, '_blank'); } catch (error) { toast(error.message, true); } return; }
        const file = event.target.closest('[data-file]');
        if (file) return openFile(file.dataset.file);
        const save = event.target.closest('[data-save]'), del = event.target.closest('[data-delete]');
        if (!save && !del) return;
        const button = save || del;
        const card = button.closest('[data-task]');
        button.disabled = true;
        try {
            if (del) {
                if (!confirm('ลบงานนี้ออกจากรายการ?')) return;
                await updateTask(del.dataset.delete, { status: 'deleted' }, 'ลบงานแล้ว');
            } else {
                await updateTask(save.dataset.save, { status: card.querySelector('[data-field=status]').value, note: card.querySelector('[data-field=note]').value }, 'บันทึกแล้ว');
            }
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    });
    document.addEventListener('click', event => {
        const plan = event.target.closest('[data-plan]');
        if (plan) { state.mode = 'plan'; return openPlan(plan.dataset.plan); }
        const checkBtn = event.target.closest('[data-check]');
        if (checkBtn) return openCheck(checkBtn.dataset.check);
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'refresh') load(true);
        if (action === 'clear-filters') {
            document.querySelectorAll('.sm-toolbar select').forEach(s => { s.value = ''; });
            $('smSearch').value = '';
            render();
        }
    });

    load();
})();
