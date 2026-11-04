// งาน GA แบบ WORKFLOW — บอร์ดงานที่ค้างอยู่ (ด้านบนของหน้า "งาน GA") + ผังขั้นตอน + ตัวสร้าง/แก้ขั้นตอน
// ข้อมูลจาก /api/staff/projects (หลังบ้าน modules/staff/projects.js) — ขั้นตอนเริ่มได้เมื่อขั้นที่ "ต้องทำหลังจาก" เสร็จ/ข้ามครบ
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/staff${path}`;
    const state = { data: null, staff: [], open: null, step: null, employees: null, picks: new Set(), edit: null };
    const TYPE_ICON = { general: '⚙️', collect: '📋', message: '💬', asset: '📦' };

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
        const node = $('gwToast');
        node.textContent = text;
        node.className = `fa-toast is-visible${isError ? ' is-error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { node.className = 'fa-toast'; }, isError ? 6000 : 3000);
    }
    const thDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
    const when = text => text ? new Date(text).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const staffName = username => state.staff.find(p => p.username === username)?.name || username || '';
    const isDone = s => s.status === 'done' || s.status === 'skip';
    const progressOf = p => ({ done: p.steps.filter(isDone).length, total: p.steps.length });

    async function load() {
        $('wfCards').innerHTML = '<p class="fa-empty">กำลังโหลด…</p>';
        try {
            const [data, work] = await Promise.all([request('/projects'), request('/ga-work').catch(() => ({ staff: [] }))]);
            state.data = data;
            state.staff = work.staff || [];
            renderBoard();
            if (state.open) { const p = project(state.open); if (p) renderProject(p); }
        } catch (error) { $('wfCards').innerHTML = `<p class="fa-empty">${esc(error.message)}</p>`; }
    }
    const project = id => state.data.projects.find(p => p.id === Number(id));
    function replace(p) {
        const i = state.data.projects.findIndex(x => x.id === p.id);
        if (i >= 0) state.data.projects[i] = p; else state.data.projects.unshift(p);
        renderBoard();
        if (state.open === p.id) renderProject(p);
    }

    // ---------------------------------------------------------------- บอร์ดงานที่ค้างอยู่
    function cardHtml(p) {
        const { done, total } = progressOf(p);
        const next = p.steps.filter(s => !isDone(s) && s.ready);
        const people = [...new Set(next.map(s => s.assignee).filter(Boolean))];
        const late = p.due_date && p.status !== 'done' && p.due_date < new Date().toISOString().slice(0, 10);
        return `<button type="button" class="wf-card${p.status === 'done' ? ' is-done' : ''}" data-wf-open="${p.id}">
            <span class="wf-card-top"><span class="wf-chip">${esc(p.section_title)}</span>${p.due_date ? `<span class="wf-due${late ? ' is-late' : ''}">กำหนด ${esc(thDate(p.due_date))}</span>` : ''}</span>
            <b>${esc(p.title)}</b>
            <span class="wf-dots">${p.steps.map(s => `<i class="st-${isDone(s) ? 'done' : s.status === 'doing' ? 'doing' : s.ready ? 'ready' : 'lock'}" title="${esc(s.title)}"></i>`).join('')}</span>
            <span class="wf-progress"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></span>
            <span class="wf-card-foot">${p.status === 'done' ? '✓ ปิดงานแล้ว' : next.length ? `ขั้นต่อไป: ${esc(next.slice(0, 2).map(s => s.title).join(', '))}${next.length > 2 ? '…' : ''}` : 'รอขั้นตอนที่กำลังทำ'}
                <small>${done}/${total} ขั้นตอน${people.length ? ` · ${esc(people.map(staffName).join(', '))}` : ''}</small></span>
        </button>`;
    }
    function renderBoard() {
        const list = state.data.projects;
        const active = list.filter(p => p.status !== 'done');
        const closed = list.filter(p => p.status === 'done');
        $('wfCards').innerHTML = (active.length ? active.map(cardHtml).join('') : '<p class="fa-empty">ยังไม่มีงานค้าง — กด "＋ สร้างงาน" เพื่อเริ่ม WORKFLOW ใหม่</p>');
        $('wfClosed').hidden = !closed.length;
        $('wfClosed').innerHTML = closed.length ? `<summary>งานที่ปิดแล้ว (${closed.length})</summary><div class="wf-cards">${closed.map(cardHtml).join('')}</div>` : '';
        $('wfCount').textContent = active.length ? `${active.length} งาน` : '';
    }

    // ---------------------------------------------------------------- ผังขั้นตอน (คอลัมน์ตามลำดับที่ต้องทำ เส้นเชื่อม = ต้องทำหลังจาก)
    function layout(steps) {
        const level = new Map();
        const levelOf = s => {
            if (level.has(s.id)) return level.get(s.id);
            level.set(s.id, 0);
            const v = s.after.length ? 1 + Math.max(...s.after.map(a => levelOf(steps.find(x => x.id === a) || { id: a, after: [] }))) : 0;
            level.set(s.id, v);
            return v;
        };
        steps.forEach(levelOf);
        const cols = [];
        steps.forEach(s => { const l = level.get(s.id); (cols[l] ||= []).push(s); });
        const W = 210, H = 92, GX = 64, GY = 22;
        const pos = new Map();
        cols.forEach((col, c) => col.forEach((s, r) => pos.set(s.id, { x: 16 + c * (W + GX), y: 16 + r * (H + GY) })));
        const width = 32 + cols.length * (W + GX) - GX, height = 32 + Math.max(...cols.map(c => c.length)) * (H + GY) - GY;
        return { pos, W, H, width, height };
    }
    function diagramHtml(p) {
        const { pos, W, H, width, height } = layout(p.steps);
        const edges = p.steps.flatMap(s => s.after.map(a => {
            const from = pos.get(a), to = pos.get(s.id);
            if (!from || !to) return '';
            const x1 = from.x + W, y1 = from.y + H / 2, x2 = to.x, y2 = to.y + H / 2, mx = (x1 + x2) / 2;
            const src = p.steps.find(x => x.id === a);
            return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 6},${y2}" class="${isDone(src) ? 'is-done' : ''}" marker-end="url(#wfArrow${isDone(src) ? 'Done' : ''})"/>`;
        })).join('');
        const nodes = p.steps.map((s, i) => {
            const { x, y } = pos.get(s.id);
            const st = isDone(s) ? s.status : s.status === 'doing' ? 'doing' : s.ready ? 'ready' : 'lock';
            const label = { done: '✓ เสร็จแล้ว', skip: 'ข้าม', doing: '● กำลังทำ', ready: 'พร้อมเริ่ม', lock: '🔒 รอขั้นก่อนหน้า' }[st];
            const prog = s.progress ? ` · ส่งแล้ว ${s.progress.submitted}/${s.progress.total}` : '';
            return `<button type="button" class="wf-node st-${st}${state.step === s.id ? ' is-on' : ''}" style="left:${x}px;top:${y}px;width:${W}px;height:${H}px" data-wf-step="${esc(s.id)}">
                <span class="wf-node-top"><span>${i + 1}. ${TYPE_ICON[s.type] || ''}</span><em>${label}${prog}</em></span>
                <b>${esc(s.title)}</b>
                <small>${esc(s.assignee ? `👤 ${staffName(s.assignee)}` : '')}</small>
            </button>`;
        }).join('');
        return `<div class="wf-canvas" style="width:${width}px;height:${height}px">
            <svg width="${width}" height="${height}" aria-hidden="true"><defs>
                <marker id="wfArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9aa8bb"/></marker>
                <marker id="wfArrowDone" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#16a34a"/></marker>
            </defs>${edges}</svg>${nodes}</div>`;
    }

    function openProject(id) {
        const p = project(id);
        if (!p) return;
        state.open = p.id;
        state.step = (p.steps.find(s => !isDone(s) && s.ready) || p.steps[0])?.id || null;
        renderProject(p);
        if (!$('wfDialog').open) $('wfDialog').showModal();
    }
    function renderProject(p) {
        const { done, total } = progressOf(p);
        $('wfDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>🧭 ${esc(p.title)}</h2><p>${esc(p.section_title)} · ${done}/${total} ขั้นตอน${p.due_date ? ` · กำหนดเสร็จ ${esc(thDate(p.due_date))}` : ''} · สร้างโดย ${esc(p.created_by)} ${esc(when(p.created_at))}</p></div>
                <button type="button" class="fa-close" data-wf-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <div class="wf-toolbar">
                    ${p.links ? `<a class="fa-btn fa-btn-ghost" href="${esc(p.links.sheet)}" target="_blank" rel="noopener">📊 ชีตงาน</a><a class="fa-btn fa-btn-ghost" href="${esc(p.links.folder)}" target="_blank" rel="noopener">📁 โฟลเดอร์</a>` : '<span class="fa-badge dim">ยังไม่มีไฟล์บน Drive</span>'}
                    <button type="button" class="fa-btn fa-btn-ghost" data-wf-edit="${p.id}">✏️ แก้ไขขั้นตอน</button>
                    ${p.status === 'done' ? `<button type="button" class="fa-btn fa-btn-ghost" data-wf-reopen>↺ เปิดงานอีกครั้ง</button>` : `<button type="button" class="fa-btn fa-btn-primary" data-wf-finish>✓ ปิดงาน</button>`}
                    <button type="button" class="fa-btn sm-danger wf-danger" data-wf-delete>🗑 ลบงาน</button>
                </div>
                ${p.detail ? `<p class="wf-detail">${esc(p.detail)}</p>` : ''}
                <div class="wf-legend"><span class="st-ready">พร้อมเริ่ม</span><span class="st-doing">กำลังทำ</span><span class="st-done">เสร็จแล้ว</span><span class="st-lock">รอขั้นก่อนหน้า</span><small>กดที่กล่องเพื่อดู/อัปเดตขั้นตอน</small></div>
                <div class="wf-diagram">${diagramHtml(p)}</div>
                <section class="wf-step" id="wfStep"></section>
            </div>`;
        renderStep(p);
    }

    // ---------------------------------------------------------------- รายละเอียดขั้นตอนที่เลือก
    function renderStep(p) {
        const s = p.steps.find(x => x.id === state.step);
        if (!s) { $('wfStep').innerHTML = ''; return; }
        const titleOf = id => p.steps.find(x => x.id === id)?.title || id;
        const canWork = s.ready && p.status !== 'done';
        const statusButtons = isDone(s)
            ? `<button type="button" class="fa-btn fa-btn-ghost" data-wf-status="todo">↺ กลับไปรอ</button>`
            : canWork ? `${s.status !== 'doing' ? '<button type="button" class="fa-btn" data-wf-status="doing">▶ เริ่มทำ</button>' : ''}
                <button type="button" class="fa-btn fa-btn-primary" data-wf-status="done">✓ เสร็จแล้ว</button>
                <button type="button" class="fa-btn fa-btn-ghost" data-wf-status="skip">ข้าม</button>`
            : `<span class="fa-badge dim">🔒 ต้องทำ ${esc(s.after.filter(a => !isDone(p.steps.find(x => x.id === a) || {})).map(titleOf).join(', '))} ให้เสร็จก่อน</span>`;
        let action = '';
        if (s.type === 'collect') {
            action = s.progress
                ? `<div class="wf-link">📋 ส่งงานให้พนักงานแล้ว ${s.progress.total} คน · รับทราบ ${s.progress.acknowledged} · ส่งข้อมูลแล้ว ${s.progress.submitted}
                    ${s.progress.dest ? ` · <a href="${esc(s.progress.dest.sheet)}" target="_blank" rel="noopener">เปิดรายงานข้อมูล ↗</a>` : ''}</div>`
                : canWork ? `<div class="wf-collect">
                    <b>📋 เก็บข้อมูลจากพนักงาน</b><small>ระบบจะส่งงานไปที่หน้าระบบจัดการองค์กรของพนักงานที่เลือก (กล่อง "${esc(p.title)}") และสร้างชีตรายงานให้</small>
                    <label>ข้อมูลที่ให้พนักงานกรอก (1 บรรทัด = 1 ช่อง)<textarea id="wfFields" rows="5">${esc(s.fields.join('\n'))}</textarea></label>
                    <label>ข้อความถึงพนักงาน (ถ้ามี)<textarea id="wfMessage" rows="3" placeholder="เช่น ขอข้อมูลเพื่อฝากของไป SL ภายในวันศุกร์"></textarea></label>
                    <div class="wf-pick-tools"><input type="search" id="wfPickSearch" placeholder="ค้นหาชื่อ / รหัส / บริษัท / พื้นที่…"><span id="wfPickCount">เลือกแล้ว ${state.picks.size} คน</span></div>
                    <div class="wf-pick-list" id="wfPickList"><p class="fa-empty">กำลังโหลดรายชื่อ…</p></div>
                    <button type="button" class="fa-btn fa-btn-primary" data-wf-collect>ส่งงานให้พนักงานที่เลือก</button>
                </div>` : '';
        } else if (s.type === 'message') {
            action = `<div class="wf-link">💬 ติดต่อพนักงาน: <a href="monitoring.html" target="_blank" rel="noopener">เปิด Monitoring (LINE OA / Telegram) ↗</a> — จดผลการติดต่อไว้ในบันทึกด้านล่าง</div>`;
        } else if (s.type === 'asset') {
            action = `<div class="wf-link">📦 <a href="assets.html" target="_blank" rel="noopener">เปิดงานทรัพย์สิน ↗</a> — บันทึกตำแหน่งสต็อก / จุดที่นำไปใช้ไว้ในบันทึกด้านล่าง</div>`;
        }
        $('wfStep').innerHTML = `
            <div class="wf-step-head"><h3>${TYPE_ICON[s.type] || ''} ${esc(s.title)}</h3><span class="wf-chip">${esc(state.data.stepTypes[s.type])}</span><span class="wf-chip">${esc(state.data.stepStatus[s.status])}</span></div>
            ${s.detail ? `<p>${esc(s.detail)}</p>` : ''}
            ${s.after.length ? `<p class="wf-meta">ต้องทำหลังจาก: ${esc(s.after.map(titleOf).join(', '))}</p>` : ''}
            ${s.done_at ? `<p class="wf-meta">${isDone(s) ? 'บันทึก' : ''}โดย ${esc(staffName(s.done_by))} ${esc(when(s.done_at))}</p>` : ''}
            ${action}
            <div class="wf-step-grid">
                <label>ผู้รับผิดชอบ<select id="wfAssignee"><option value="">— ไม่ระบุ —</option>${state.staff.map(x => `<option value="${esc(x.username)}" ${x.username === s.assignee ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
                <label>บันทึก / ผลลัพธ์ของขั้นตอนนี้<textarea id="wfNote" rows="5" placeholder="เช่น ของ 2 ลัง ฝากกับคุณ… เที่ยวบิน UL… ถึง 14:30">${esc(s.note)}</textarea></label>
            </div>
            <div class="wf-step-actions"><button type="button" class="fa-btn fa-btn-ghost" data-wf-save-note>บันทึก</button>${statusButtons}</div>`;
        if (s.type === 'collect' && !s.progress && canWork) loadEmployees();
    }

    async function loadEmployees() {
        try {
            if (!state.employees) state.employees = (await request('/employees')).employees;
            renderPicks();
        } catch (error) { $('wfPickList').innerHTML = `<p class="fa-empty">${esc(error.message)}</p>`; }
    }
    function renderPicks() {
        const box = $('wfPickList');
        if (!box || !state.employees) return;
        const q = ($('wfPickSearch')?.value || '').trim().toLowerCase();
        const list = state.employees.filter(e => !q || [e.fullname, e.nickname, e.employeeId, e.centralId, e.insuranceCode, e.company, e.area, e.building].some(v => String(v || '').toLowerCase().includes(q)));
        box.innerHTML = list.slice(0, 300).map(e => `<label class="wf-pick"><input type="checkbox" data-wf-pick="${esc(e.key)}" ${state.picks.has(e.key) ? 'checked' : ''}>
            <b>${esc(e.fullname)}</b>${e.nickname ? ` <span class="wf-chip">${esc(e.nickname)}</span>` : ''}<small>${esc([e.employeeId || e.centralId, e.company, e.area, e.status].filter(Boolean).join(' · '))}</small></label>`).join('')
            + (list.length > 300 ? `<p class="fa-empty">แสดง 300 จาก ${list.length} คน — พิมพ์ค้นหาเพื่อหาคนอื่น</p>` : '') || '<p class="fa-empty">ไม่พบพนักงาน</p>';
        $('wfPickCount').textContent = `เลือกแล้ว ${state.picks.size} คน`;
    }

    async function stepCall(body, button) {
        const p = project(state.open);
        button && (button.disabled = true);
        try {
            const { project: updated } = await request(`/projects/${p.id}/steps/${encodeURIComponent(state.step)}`, { method: 'POST', body: JSON.stringify(body) });
            replace(updated);
            toast('บันทึกแล้ว');
        } catch (error) { toast(error.message, true); } finally { button && (button.disabled = false); }
    }
    async function sendCollect(button) {
        const p = project(state.open);
        const fields = $('wfFields').value.split('\n').map(x => x.trim()).filter(Boolean);
        if (!fields.length) return toast('กรุณาระบุข้อมูลที่ต้องการให้พนักงานกรอก', true);
        if (!state.picks.size) return toast('กรุณาเลือกพนักงานอย่างน้อย 1 คน', true);
        if (!confirm(`ส่งงานเก็บข้อมูลให้พนักงาน ${state.picks.size} คน?`)) return;
        button.disabled = true;
        try {
            const result = await request(`/projects/${p.id}/steps/${encodeURIComponent(state.step)}/collect`, { method: 'POST', body: JSON.stringify({ fields, employee_keys: [...state.picks], message: $('wfMessage').value }) });
            state.picks.clear();
            replace(result.project);
            if (result.destError) alert(result.destError); else toast(`ส่งงานให้พนักงานแล้ว ${result.sent} คน`);
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    async function setProject(body, label) {
        const p = project(state.open);
        try { const { project: updated } = await request(`/projects/${p.id}`, { method: 'PUT', body: JSON.stringify(body) }); replace(updated); toast(label); }
        catch (error) { toast(error.message, true); }
    }
    async function deleteProject() {
        const p = project(state.open);
        if (!confirm(`ต้องการลบงาน "${p.title}" ใช่ไหม?`)) return;
        if (!confirm('⚠️ ยืนยันอีกครั้ง\n\nถ้าลบ ข้อมูลและไฟล์ทั้งหมดของงานนี้ (ชีตงาน โฟลเดอร์) จะหายจากทุกโฟลเดอร์ และอาจกู้คืนไม่ได้\n(งานที่ส่งให้พนักงานในขั้นตอนเก็บข้อมูลยังอยู่ในหน้าจัดการพนักงาน)\n\nกด "ตกลง" เพื่อลบ')) return;
        try {
            const { trashError } = await request(`/projects/${p.id}/delete`, { method: 'POST', body: JSON.stringify({ trashFiles: true }) });
            state.data.projects = state.data.projects.filter(x => x.id !== p.id);
            state.open = null;
            $('wfDialog').close();
            renderBoard();
            if (trashError) alert(`ลบงานแล้ว แต่ลบไฟล์บน Drive ไม่สำเร็จ — ลบโฟลเดอร์ใน Drive เองได้\n\nสาเหตุ: ${trashError}`); else toast('ลบงานและไฟล์แล้ว');
        } catch (error) { toast(error.message, true); }
    }

    // ---------------------------------------------------------------- สร้าง / แก้ไข WORKFLOW (ต้องทำหลังจาก = เลือกได้เฉพาะขั้นที่อยู่ก่อน → ไม่วน)
    function openEditor(id) {
        const p = id ? project(id) : null;
        const tpl = state.data.templates[0];
        state.edit = { id: p?.id || null, steps: JSON.parse(JSON.stringify(p ? p.steps : tpl.steps)) };
        $('wfEditor').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>${p ? '✏️ แก้ไขขั้นตอนงาน' : '＋ สร้างงาน (WORKFLOW)'}</h2><p>กำหนดแต่ละจุดของงาน และเส้นเชื่อมว่าต้องทำอะไรก่อนจึงจะไปจุดถัดไปได้</p></div>
                <button type="button" class="fa-close" data-wfe-close aria-label="ปิด">×</button>
            </header>
            <form class="fa-detail-body wf-editor" id="wfEditForm">
                <div class="wf-edit-grid">
                    <label class="wf-wide">ชื่องาน <span class="wf-req">*</span><input name="title" maxlength="150" required value="${esc(p?.title || tpl.title)}"></label>
                    ${p ? '' : `<label>แม่แบบ<select name="template">${state.data.templates.map(t => `<option value="${esc(t.key)}">${esc(t.title)}</option>`).join('')}</select></label>`}
                    <label>ส่วนงาน (โฟลเดอร์เก็บไฟล์)<select name="section" ${p ? 'disabled' : ''}>${Object.entries(state.data.sections).map(([k, v]) => `<option value="${k}" ${(p?.section || tpl.section) === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
                    <label>กำหนดเสร็จ<input type="date" name="due_date" value="${esc(p?.due_date || '')}"></label>
                    <label class="wf-wide">รายละเอียดงาน<textarea name="detail" rows="5" maxlength="2000" placeholder="เช่น จาก: K012500516 กร ธีรเทพ · ส่งไป: ทีม บ้าน BKK">${esc(p?.detail || '')}</textarea></label>
                </div>
                <h3>ขั้นตอน</h3>
                <div id="wfEditSteps" class="wf-edit-steps"></div>
                <button type="button" class="fa-btn fa-btn-ghost" data-wfe-add>＋ เพิ่มขั้นตอน</button>
                <div class="wf-edit-foot"><button type="button" class="fa-btn" data-wfe-close>ยกเลิก</button><button type="submit" class="fa-btn fa-btn-primary">${p ? 'บันทึกขั้นตอน' : 'สร้างงาน'}</button></div>
            </form>`;
        renderEditSteps();
        $('wfEditDialog').showModal();
    }
    function readEditSteps() {
        const rows = [...document.querySelectorAll('#wfEditSteps .wf-erow')];
        state.edit.steps = rows.map(r => ({
            ...state.edit.steps.find(s => s.id === r.dataset.id),
            id: r.dataset.id, title: r.querySelector('[data-e=title]').value, type: r.querySelector('[data-e=type]').value,
            assignee: r.querySelector('[data-e=assignee]').value, detail: r.querySelector('[data-e=detail]').value,
            after: [...r.querySelectorAll('[data-e=after]:checked')].map(c => c.value),
            fields: (r.querySelector('[data-e=fields]')?.value || '').split('\n').map(x => x.trim()).filter(Boolean)
        }));
    }
    function renderEditSteps() {
        const steps = state.edit.steps;
        $('wfEditSteps').innerHTML = steps.map((s, i) => `<div class="wf-erow" data-id="${esc(s.id)}">
            <span class="wf-enum">${i + 1}</span>
            <div class="wf-ebody">
                <div class="wf-eline">
                    <input data-e="title" maxlength="150" placeholder="ชื่อขั้นตอน" value="${esc(s.title)}">
                    <select data-e="type">${Object.entries(state.data.stepTypes).map(([k, v]) => `<option value="${k}" ${k === s.type ? 'selected' : ''}>${TYPE_ICON[k]} ${esc(v)}</option>`).join('')}</select>
                    <select data-e="assignee"><option value="">ผู้รับผิดชอบ —</option>${state.staff.map(x => `<option value="${esc(x.username)}" ${x.username === s.assignee ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
                    <span class="wf-emove"><button type="button" data-wfe-up title="เลื่อนขึ้น">↑</button><button type="button" data-wfe-down title="เลื่อนลง">↓</button><button type="button" data-wfe-del title="ลบขั้นตอน">×</button></span>
                </div>
                <textarea data-e="detail" rows="3" maxlength="1000" placeholder="รายละเอียด / สิ่งที่ต้องทำในขั้นนี้">${esc(s.detail || '')}</textarea>
                ${i ? `<div class="wf-after"><span>ต้องทำหลังจาก:</span>${steps.slice(0, i).map((x, j) => `<label><input type="checkbox" data-e="after" value="${esc(x.id)}" ${(s.after || []).includes(x.id) ? 'checked' : ''}>${j + 1}. ${esc(x.title || '…')}</label>`).join('')}</div>` : '<div class="wf-after"><span>จุดเริ่มต้น (ทำได้ทันที)</span></div>'}
                ${s.type === 'collect' ? `<label class="wf-efields">ข้อมูลที่ให้พนักงานกรอก (1 บรรทัด = 1 ช่อง)<textarea data-e="fields" rows="5">${esc((s.fields || []).join('\n'))}</textarea></label>` : ''}
            </div></div>`).join('');
    }
    async function saveEditor(form) {
        readEditSteps();
        const body = { title: form.title.value, detail: form.detail.value, due_date: form.due_date.value, steps: state.edit.steps };
        if (!state.edit.id) Object.assign(body, { section: form.section.value, template: form.template.value });
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
            const result = state.edit.id
                ? await request(`/projects/${state.edit.id}`, { method: 'PUT', body: JSON.stringify(body) })
                : await request('/projects', { method: 'POST', body: JSON.stringify(body) });
            $('wfEditDialog').close();
            replace(result.project);
            if (result.fileError) alert(`สร้างงานแล้ว แต่สร้างไฟล์บน Drive ไม่สำเร็จ — ระบบจะลองใหม่เมื่อมีการอัปเดตงาน\n\nสาเหตุ: ${result.fileError}`);
            else toast(state.edit.id ? 'บันทึกขั้นตอนแล้ว' : 'สร้างงานแล้ว');
            openProject(result.project.id);
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }

    // ---------------------------------------------------------------- เหตุการณ์
    document.addEventListener('click', event => {
        const t = event.target;
        if (t.closest('[data-wf-new]')) return openEditor(null);
        const open = t.closest('[data-wf-open]');
        if (open) return openProject(open.dataset.wfOpen);
        if (t.closest('[data-action=refresh]')) load();
    });
    $('wfDialog').addEventListener('click', event => {
        const t = event.target;
        if (t === $('wfDialog') || t.closest('[data-wf-close]')) { state.open = null; return $('wfDialog').close(); }
        const step = t.closest('[data-wf-step]');
        if (step) { state.step = step.dataset.wfStep; return renderProject(project(state.open)); }
        const status = t.closest('[data-wf-status]');
        if (status) return stepCall({ status: status.dataset.wfStatus, note: $('wfNote').value, assignee: $('wfAssignee').value }, status);
        if (t.closest('[data-wf-save-note]')) return stepCall({ note: $('wfNote').value, assignee: $('wfAssignee').value }, t.closest('button'));
        if (t.closest('[data-wf-collect]')) return sendCollect(t.closest('button'));
        const edit = t.closest('[data-wf-edit]');
        if (edit) return openEditor(Number(edit.dataset.wfEdit));
        if (t.closest('[data-wf-finish]')) {
            const p = project(state.open);
            const left = p.steps.filter(s => !isDone(s)).length;
            if (left && !confirm(`ยังมี ${left} ขั้นตอนที่ไม่เสร็จ — ปิดงานเลยไหม?`)) return;
            return setProject({ status: 'done' }, 'ปิดงานแล้ว');
        }
        if (t.closest('[data-wf-reopen]')) return setProject({ status: 'active' }, 'เปิดงานอีกครั้งแล้ว');
        if (t.closest('[data-wf-delete]')) return deleteProject();
    });
    $('wfDialog').addEventListener('input', event => { if (event.target.id === 'wfPickSearch') renderPicks(); });
    $('wfDialog').addEventListener('change', event => {
        const pick = event.target.closest('[data-wf-pick]');
        if (!pick) return;
        if (pick.checked) state.picks.add(pick.dataset.wfPick); else state.picks.delete(pick.dataset.wfPick);
        $('wfPickCount').textContent = `เลือกแล้ว ${state.picks.size} คน`;
    });
    $('wfEditDialog').addEventListener('click', event => {
        const t = event.target;
        if (t.closest('[data-wfe-close]')) return $('wfEditDialog').close();
        if (t.closest('[data-wfe-add]')) { readEditSteps(); state.edit.steps.push({ id: `s${Date.now().toString(36)}`, title: '', type: 'general', after: state.edit.steps.length ? [state.edit.steps.at(-1).id] : [] }); return renderEditSteps(); }
        const row = t.closest('.wf-erow');
        if (!row) return;
        const move = t.closest('[data-wfe-up], [data-wfe-down], [data-wfe-del]');
        if (!move) return;
        readEditSteps();
        const steps = state.edit.steps;
        const i = steps.findIndex(s => s.id === row.dataset.id);
        if (move.matches('[data-wfe-del]')) { const id = steps[i].id; steps.splice(i, 1); steps.forEach(s => { s.after = (s.after || []).filter(a => a !== id); }); }
        else { const j = move.matches('[data-wfe-up]') ? i - 1 : i + 1; if (j < 0 || j >= steps.length) return; [steps[i], steps[j]] = [steps[j], steps[i]]; }
        // ต้องทำหลังจาก = เฉพาะขั้นที่อยู่ก่อนหน้า (กันวน)
        steps.forEach((s, k) => { const before = new Set(steps.slice(0, k).map(x => x.id)); s.after = (s.after || []).filter(a => before.has(a)); });
        renderEditSteps();
    });
    $('wfEditDialog').addEventListener('change', event => {
        const t = event.target;
        if (t.name === 'template') {
            const tpl = state.data.templates.find(x => x.key === t.value);
            state.edit.steps = JSON.parse(JSON.stringify(tpl.steps));
            const form = $('wfEditForm');
            form.title.value = tpl.title;
            form.section.value = tpl.section;
            return renderEditSteps();
        }
        if (t.matches('[data-e=type]')) { readEditSteps(); renderEditSteps(); }
    });
    $('wfEditDialog').addEventListener('submit', event => { event.preventDefault(); saveEditor(event.target); });

    load();
})();
