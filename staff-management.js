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
    const state = { data: null, byKey: new Map(), current: null };

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
            const pills = list.slice(0, 6).map(t => `<span class="sm-task-pill ${esc(t.status)}" title="${esc(`${t.title} · ${t.status_label}`)}">${esc(t.title)}</span>`).join('')
                + (list.length > 6 ? `<span class="sm-task-pill more">+${list.length - 6}</span>` : '');
            return `<tr>
                <td>${esc(e.company || '-')}</td>
                <td><span class="fa-badge ${isOnWork(e) ? 'ok' : 'dim'}">${esc(e.status || '-')}</span></td>
                <td class="sm-nick">${esc(e.nickname || '-')}</td>
                <td><b>${esc(e.fullname)}</b><small>${esc([e.employeeId || e.centralId, e.insuranceCode].filter(Boolean).join(' · '))}</small></td>
                ${extra.map(f => `<td>${cell(e, f.key)}</td>`).join('')}
                <td class="sm-tasks-cell"><div class="sm-tasks">${pills || '<span class="fa-badge dim">ยังไม่มีงาน</span>'}</div></td>
                <td><button type="button" class="fa-btn sm-plan" data-plan="${esc(e.key)}">จัดงาน</button></td>
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
                    <form class="sm-form" id="smNewTask">
                        <label class="sm-wide">หัวเรื่องงาน <span class="sm-req">*</span><input name="title" maxlength="150" required placeholder="เช่น ส่งเอกสารตรวจสุขภาพประจำปี"></label>
                        <label class="sm-wide">รายละเอียด<textarea name="detail" maxlength="3000" placeholder="สิ่งที่ต้องทำ ขั้นตอน เอกสารที่ต้องใช้ ผู้ประสานงาน"></textarea></label>
                        <label>หมวดงาน<select name="category">${opt(state.data.categories)}</select></label>
                        <label>ความสำคัญ<select name="priority">${opt(state.data.priorities)}</select></label>
                        <label>กำหนดเสร็จ<input type="date" name="due_date"></label>
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
        const dialog = $('smDialog');
        if (!dialog.open) dialog.showModal();
    }
    function renderTasks() {
        const list = tasksOf(state.current);
        const statuses = state.data.statuses;
        $('smTaskList').innerHTML = list.length ? list.map(t => `
            <article class="sm-task ${esc(t.status)}" data-task="${t.id}">
                <header>
                    <div><b>${esc(t.title)}</b> <span class="sm-prio ${PRIO_CLASS[t.priority] || ''}">${esc(t.priority)}</span> <span class="fa-type">${esc(t.category)}</span></div>
                    <span class="sm-meta">#${t.id} · มอบหมายโดย ${esc(t.created_by)} ${esc(when(t.created_at))}${t.due_date ? ` · กำหนดเสร็จ ${esc(thDate(t.due_date))}` : ''}</span>
                </header>
                ${t.detail ? `<p>${esc(t.detail)}</p>` : ''}
                <div class="sm-task-actions">
                    <select data-field="status">${Object.entries(statuses).map(([k, v]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
                    <input data-field="note" value="${esc(t.note)}" placeholder="บันทึกติดตามงาน">
                    <button type="button" class="fa-btn" data-save="${t.id}">บันทึก</button>
                    <button type="button" class="fa-btn fa-btn-ghost" data-delete="${t.id}" title="ลบงานนี้ออกจากรายการ">ลบ</button>
                </div>
                ${t.updated_by && t.updated_at !== t.created_at ? `<span class="sm-meta">แก้ไขล่าสุดโดย ${esc(t.updated_by)} ${esc(when(t.updated_at))}</span>` : ''}
            </article>`).join('') : '<p class="fa-empty">ยังไม่มีงาน — สร้างงานใหม่ด้านบน</p>';
    }

    async function createTask(form) {
        const fd = Object.fromEntries(new FormData(form));
        if (!fd.title?.trim()) return toast('กรุณากรอกหัวเรื่องงาน', true);
        const keys = fd.bulk ? filtered().map(e => e.key) : [state.current];
        if (fd.bulk && !confirm(`มอบหมายงาน "${fd.title}" ให้พนักงาน ${keys.length} คน?`)) return;
        const button = form.querySelector('button[type=submit]');
        button.disabled = true;
        try {
            const { tasks } = await request('/tasks', { method: 'POST', body: JSON.stringify({ ...fd, bulk: undefined, employee_keys: keys }) });
            state.data.tasks.push(...tasks);
            form.reset();
            renderTasks();
            render();
            toast(`มอบหมายงานแล้ว ${tasks.length} คน`);
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }
    async function updateTask(id, patch, done) {
        const { task } = await request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
        const i = state.data.tasks.findIndex(t => t.id === task.id);
        if (patch.status === 'deleted') state.data.tasks.splice(i, 1); else state.data.tasks[i] = task;
        renderTasks();
        render();
        toast(done);
    }

    // ---------------------------------------------------------------- เหตุการณ์
    // ตัวกรองถูกสร้างใหม่ตอนโหลด → ฟังที่แถบเครื่องมือแทน
    document.querySelector('.sm-toolbar').addEventListener('change', event => { if (event.target.matches('select')) render(); });
    $('smSearch').addEventListener('input', render);
    $('smDialog').addEventListener('submit', event => { if (event.target.id === 'smNewTask') { event.preventDefault(); createTask(event.target); } });
    $('smDialog').addEventListener('click', async event => {
        if (event.target === $('smDialog') || event.target.closest('[data-close]')) return $('smDialog').close();
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
        if (plan) return openPlan(plan.dataset.plan);
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
