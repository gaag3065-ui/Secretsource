// ระบบจัดการองค์กร — ระบบรับ - ส่งเอกสาร GA (หน้าพนักงาน)
// เข้าสู่ระบบด้วยรหัสพนักงาน / รหัสประกัน → เลือกหัวข้อ → กรอก + แนบไฟล์ → ส่ง
// แบบฟอร์มทั้งหมดมาจากหลังบ้าน (/api/ga-docs/public/config) · ส่ง 3 ขั้น: submit → upload ทีละไฟล์ → finalize
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/ga-docs/public`;
    const TOKEN_KEY = 'gaDocsSession';
    const state = { config: null, session: null, form: null, files: {}, tasks: [], taskBoxes: [], task: null };
    // หัวข้อที่ยังเป็นแนวคิด (ยังไม่มีฟอร์มที่หลังบ้าน) — กดแล้วแสดงแนวคิดของระบบ
    const CONCEPTS = [
        {
            key: 'quests', icon: '📣', color: '#4f46e5', title: 'ข่าวและภารกิจจากบริษัทถึงคุณ', short: 'ข่าวและภารกิจถึงคุณ',
            description: 'งานที่บริษัทมอบหมาย และข่าวสารเฉพาะคุณ (เร็ว ๆ นี้)',
            concept: 'แสดงข่าวสารเฉพาะบุคคลนั้น ๆ ที่แสดงงาน หรือรายการที่บริษัทมอบหมายให้ทำ เป็นเหมือนการทำเควส เพื่อสะสมความร่วมมือระหว่างบริษัทกับพนักงาน มีรายละเอียดแจกแจงสำหรับแต่ละเควส และมีปุ่มสำหรับกดรับทราบว่าเห็นแล้ว',
            points: ['ข่าวสารเฉพาะบุคคล', 'งาน / รายการที่บริษัทมอบหมาย', 'ทำเป็นเควส สะสมความร่วมมือ', 'รายละเอียดแจกแจงของแต่ละเควส', 'ปุ่ม "รับทราบแล้ว"']
        }
    ];
    // กล่องที่ GA สร้างเอง (แสดงเฉพาะคนที่มีงานในกล่องนั้น)
    const customTiles = () => state.taskBoxes.map(b => ({ key: b.key, icon: b.icon || '📌', color: '#16a34a', title: b.title, short: b.title,
        description: 'งานที่ได้รับมอบหมายจาก GA', box: true, scope: b.scope || 'personal' }));
    // งานส่วนบุคคล: แสดงเฉพาะกล่องที่คนนี้มีงาน (แถบ "รายการเฉพาะคุณ") · งานหลัก: ทุกคนเห็นในเมนู
    const isPersonal = f => f.scope === 'personal';
    const personalItems = () => { const used = new Set(state.tasks.map(t => t.box)); return menuItems().filter(f => isPersonal(f) && !f.menuHidden && (f.box || used.has(f.key))); };
    // หัวข้อที่เปิดอยู่ + กล่องที่คนนี้มีงาน (กล่องที่สร้างเอง หรือหัวข้อที่ปิดไปแล้วแต่ยังมีงานค้าง)
    const menuItems = () => [...state.config.forms, ...customTiles()];
    const boxInfo = key => [...menuItems(), ...CONCEPTS].find(f => f.key === key) || { key, icon: '📌', color: '#16a34a', title: key };
    // งานที่ต้องแจ้งเตือน = ยังไม่กดรับทราบ
    const unread = () => state.tasks.filter(t => !t.acknowledged_at);

    const store = {
        get() { try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); } catch { return null; } },
        set(value) { try { value ? sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value)) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ใช้ได้เฉพาะหน้านี้ */ } }
    };

    async function call(path, body) {
        const headers = { 'Content-Type': 'application/json' };
        if (state.session?.token) headers.Authorization = `Bearer ${state.session.token}`;
        let response;
        try {
            response = await fetch(API + path, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) });
        } catch { throw new Error('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่'); }
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 && !data.message) throw new Error('ระบบยังไม่เปิดใช้งาน กรุณาแจ้ง GA');
        if (!response.ok || data.success === false) {
            if (/เซสชันหมดอายุ/.test(data.message || '')) logout();
            throw new Error(data.message || `ทำรายการไม่สำเร็จ (${response.status})`);
        }
        return data;
    }
    const msg = (node, text, kind = '') => { node.textContent = text; node.className = `gd-msg${kind ? ' is-' + kind : ''}`; };
    const show = id => ['gdLogin', 'gdHome', 'gdForm', 'gdDone'].forEach(key => { $(key).hidden = key !== id; });
    const thDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : ''; };
    const when = text => text ? new Date(text).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '';

    // ---------------------------------------------------------------- เข้าสู่ระบบ
    async function loadConfig() {
        if (state.config) return state.config;
        state.config = await call('/config');
        return state.config;
    }
    $('gdLoginForm').addEventListener('submit', async event => {
        event.preventDefault();
        const id = $('gdId').value.trim();
        if (!id) return msg($('gdLoginMsg'), 'กรุณากรอกรหัสพนักงาน / รหัสประกัน', 'bad');
        const button = event.target.querySelector('button');
        button.disabled = true;
        msg($('gdLoginMsg'), 'กำลังตรวจสอบ…');
        try {
            await loadConfig();
            const { employee, token } = await call('/login', { id });
            state.session = { employee, token };
            store.set(state.session);
            msg($('gdLoginMsg'), '');
            openHome();
        } catch (error) { msg($('gdLoginMsg'), error.message, 'bad'); } finally { button.disabled = false; }
    });
    function logout() {
        state.session = null;
        store.set(null);
        $('gdId').value = '';
        show('gdLogin');
    }

    // ---------------------------------------------------------------- เมนูหลัก
    function openHome() {
        const e = state.session.employee;
        $('gdName').textContent = e.fullname;
        $('gdMeta').textContent = [e.ID, e.insuranceCode, e.company].filter(Boolean).join(' · ');
        renderMenu();
        renderAlerts();
        show('gdHome');
        window.scrollTo(0, 0);
        loadMine();
        loadTasks();
    }
    function renderMenu() {
        renderPersonal();
        $('gdMenu').innerHTML = menuItems().filter(f => !f.menuHidden && !isPersonal(f)).map(f => `
            <button type="button" class="gd-tile" style="--c:${esc(f.color)}" data-open="${esc(f.key)}">
                <span class="gd-count" data-badge="${esc(f.key)}" hidden></span>
                <span class="gd-tile-icon" aria-hidden="true">${esc(f.icon)}</span>
                <b>${esc(f.title)}</b>
                <small>${esc(f.description)}</small>
            </button>`).join('');
        renderBadges();
    }

    // ---------------------------------------------------------------- งานที่ GA มอบหมาย / แจ้งเตือน
    async function loadTasks() {
        try {
            const { tasks, boxes } = await call('/tasks');
            const sig = () => [...state.taskBoxes.map(b => b.key + b.scope), '|', ...new Set(state.tasks.map(t => t.box))].join();
            const before = sig();
            state.tasks = tasks;
            state.taskBoxes = boxes || [];
            if (before !== sig() && !$('gdHome').hidden) renderMenu();
            renderAlerts();
            renderBadges();
        } catch { /* หลังบ้านยังไม่อัปเดต — ไม่แสดงแจ้งเตือน */ }
    }
    // เคสรักษาที่แจ้งไว้และยังไม่ได้บันทึกค่ารักษา
    const openCareCases = () => (state.mine || []).filter(r => r.type === 'treatment' && !['billed', 'deleted', 'rejected'].includes(r.status));
    function renderPersonal() {
        const list = personalItems();
        const box = $('gdPersonal');
        if (!box) return;
        box.hidden = !list.length;
        $('gdPersonalList').innerHTML = list.map(f => `
            <button type="button" class="gd-personal-item" style="--c:${esc(f.color)}" data-open="${esc(f.key)}">
                <span class="gd-personal-icon" aria-hidden="true">${esc(f.icon)}</span>
                <span class="gd-personal-body"><b>${esc(f.title)}</b><small>${esc(f.description || '')}</small></span>
                <span class="gd-count" data-badge="${esc(f.key)}" hidden></span>
            </button>`).join('');
    }
    function renderBadges() {
        const counts = new Map();
        unread().forEach(t => counts.set(t.box, (counts.get(t.box) || 0) + 1));
        const openCases = openCareCases().length;
        if (openCases) counts.set('treatment', (counts.get('treatment') || 0) + openCases);
        document.querySelectorAll('[data-badge]').forEach(node => {
            const n = counts.get(node.dataset.badge) || 0;
            node.hidden = !n;
            node.textContent = n;
        });
        const total = unread().length + gaNotes().length;
        $('gdBellCount').hidden = !total;
        $('gdBellCount').textContent = total > 99 ? '99+' : total;
    }
    // ข้อความ/สถานะจาก GA ในรายการที่ส่ง (เช่น "แจ้งประกันเรียบร้อย เข้ารักษาได้เลย") ที่ยังไม่ได้เปิดอ่าน
    const seenKey = () => `gdSeenNotes:${state.session?.employee?.ID || ''}`;
    const seenNotes = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey()) || '[]')); } catch { return new Set(); } };
    const noteId = r => `${r.id}|${r.handled_at || ''}`;
    const gaNotes = () => { const seen = seenNotes(); return (state.mine || []).filter(r => r.admin_note && r.handled_at && !seen.has(noteId(r))); };
    function markNoteSeen(id) {
        const seen = seenNotes(); seen.add(id);
        try { localStorage.setItem(seenKey(), JSON.stringify([...seen].slice(-300))); } catch { /* ไม่เป็นไร */ }
        renderAlerts(); renderBadges();
    }
    function renderAlerts() {
        const list = unread();
        const notes = gaNotes();
        const box = $('gdAlerts');
        const total = list.length + notes.length;
        box.classList.toggle('is-empty', !total);
        const groups = new Map();
        list.forEach(t => { if (!groups.has(t.box)) groups.set(t.box, []); groups.get(t.box).push(t); });
        box.innerHTML = `<h3>🔔 แจ้งเตือนสำหรับคุณ ${total ? `<span class="gd-count">${total}</span>` : ''}</h3>`
            + notes.map(r => `<button type="button" class="gd-alert is-ga-note" data-ga-note="${esc(noteId(r))}">
                    <span>📣</span>
                    <span><b>${esc(r.type_title)}${r.case_id ? ` · เคส #${esc(r.case_id)}` : ''}</b><small>GA: ${esc(r.admin_note)}</small></span>
                    <span class="gd-tag is-new">ใหม่</span>
                </button>`).join('')
            + (list.length ? [...groups.entries()].map(([key, items]) => {
                const info = boxInfo(key);
                return `<button type="button" class="gd-alert" data-box="${esc(key)}">
                    <span>${esc(info.icon)}</span>
                    <span><b>${esc(items[0].box_title || info.title)}</b><small>${esc(items.map(t => t.title).join(' · '))}</small></span>
                    <span class="gd-count">${items.length}</span>
                </button>`;
            }).join('') : notes.length ? '' : '<p class="gd-empty">ไม่มีงานแจ้งเตือน ✓</p>');
    }
    // หน้ารวมงานในกล่อง (กล่องที่สร้างเอง / ข่าวและภารกิจ)
    function tasksHtml(tasks) {
        return `<div class="gd-tasks">${tasks.map(t => `
            <article class="gd-task ${t.acknowledged_at ? 'is-read' : ''}">
                <header><b>${esc(t.title)}</b>
                    ${t.acknowledged_at ? '' : '<span class="gd-tag is-new">ใหม่</span>'}
                    ${t.priority && t.priority !== 'ปกติ' ? `<span class="gd-tag ${t.priority === 'ด่วน' ? 'is-urgent' : ''}">${esc(t.priority)}</span>` : ''}
                    <span class="gd-tag">${esc(t.submitted_at ? 'ส่งแล้ว' : t.kind_label)}</span>
                </header>
                <span class="gd-task-meta">${esc(when(t.created_at))}${t.due_date ? ` · กำหนดเสร็จ ${esc(thDate(t.due_date))}` : ''}</span>
                ${t.detail ? `<p>${esc(t.detail)}</p>` : ''}
                <div class="gd-task-actions"><button type="button" class="gd-btn gd-btn-sm ${t.acknowledged_at ? 'gd-btn-primary' : 'gd-ack-go'}" data-task="${t.id}">${t.acknowledged_at ? 'เปิดงาน →' : '✓ รับทราบและดำเนินการ →'}</button></div>
            </article>`).join('')}</div>`;
    }
    function openBox(key) {
        const info = boxInfo(key);
        const form = state.config.forms.find(f => f.key === key && f.fields);
        if (form) return openForm(key);
        const tasks = state.tasks.filter(t => t.box === key);
        state.form = null;
        $('gdFormTitle').textContent = info.short || info.title;
        $('gdFormHead').innerHTML = `<span class="gd-tile-icon" style="--c:${esc(info.color)}">${esc(info.icon)}</span><div><h2>${esc(info.title)}</h2><p>${esc(info.description || '')}</p></div>`;
        $('gdInfo').innerHTML = tasks.length ? tasksHtml(tasks)
            : info.concept ? `<div class="gd-concept"><h3>ยังไม่มีงานหรือข่าวถึงคุณ</h3><p>${esc(info.concept)}</p></div>` : '<p class="gd-empty">ยังไม่มีงานในหัวข้อนี้</p>';
        $('gdFields').innerHTML = '';
        $('gdFields').hidden = true;
        document.querySelector('.gd-submit').hidden = true;
        $('gdProgress').hidden = true;
        msg($('gdFormMsg'), '');
        state.view = { box: key };
        show('gdForm');
        window.scrollTo(0, 0);
    }
    // หน้างาน 1 งาน: รายละเอียด + ช่องกรอก/ช่องอัปโหลด + ปุ่มรับทราบ
    function openTask(id) {
        const t = state.tasks.find(x => x.id === Number(id));
        if (!t) return;
        state.task = t;
        state.taskFiles = {};
        const info = boxInfo(t.box);
        const done = Boolean(t.submitted_at) || t.status === 'done';
        const needsForm = (t.fields || []).length || (t.uploads || []).length;
        $('gdFormTitle').textContent = t.title;
        $('gdFormHead').innerHTML = `<span class="gd-tile-icon" style="--c:${esc(info.color)}">${esc(info.icon)}</span><div><h2>${esc(t.title)}</h2><p>${esc(t.box_title || info.title)} · ${esc(t.kind_label)}</p></div>`;
        const filesOf = slot => (t.files || []).filter(f => f.slot === slot);
        const answer = done ? `<div class="gd-answer"><b>✓ ส่งข้อมูลแล้วเมื่อ ${esc(when(t.submitted_at))}${t.status === 'done' ? ' · GA ตรวจสอบแล้ว' : ''}</b>
            ${(t.fields || []).map(f => `<div><small>${esc(f.label)}</small>${esc(t.response?.[f.id] || '-')}</div>`).join('')}
            ${(t.uploads || []).map(u => `<div><small>${esc(u.label)}</small>ส่งแล้ว ${filesOf(u.id).length} ไฟล์</div>`).join('')}</div>` : '';
        const form = !done && needsForm ? `<form id="gdTaskForm" class="gd-task-form" novalidate>
            ${(t.fields || []).map(f => `<div class="gd-field"><label for="gt_${f.id}">${esc(f.label)} <span class="gd-req">*</span></label><input type="text" id="gt_${f.id}" name="${esc(f.id)}" value="${esc(t.response?.[f.id] || '')}"></div>`).join('')}
            ${(t.uploads || []).map(u => `<div class="gd-field" data-slot="${esc(u.id)}"><span class="gd-label">${esc(u.label)} <span class="gd-req">*</span> <small>(${u.type === 'pdf' ? 'ไฟล์ PDF' : 'รูปภาพ'})</small></span>
                ${filesOf(u.id).length ? `<small class="gd-task-meta">ส่งไว้แล้ว ${filesOf(u.id).length} ไฟล์ — แนบเพิ่มได้</small>` : ''}
                <label class="gd-pick">＋ แนบ${u.type === 'pdf' ? 'ไฟล์ PDF' : 'รูป'}<input type="file" accept="${u.type === 'pdf' ? 'application/pdf' : 'image/*'}" multiple data-task-slot="${esc(u.id)}"></label>
                <div class="gd-thumbs" data-task-thumbs="${esc(u.id)}"></div>
                ${u.type === 'pdf' ? `<input type="text" data-password="${esc(u.id)}" placeholder="รหัสเปิดไฟล์ PDF (ถ้ามี)" autocomplete="off">` : ''}
            </div>`).join('')}
            <button type="submit" class="gd-btn gd-btn-primary gd-submit-task">ส่งข้อมูล</button>
        </form>` : '';
        $('gdInfo').innerHTML = `<article class="gd-task ${t.acknowledged_at ? 'is-read' : ''}">
            <span class="gd-task-meta">มอบหมายเมื่อ ${esc(when(t.created_at))}${t.due_date ? ` · กำหนดเสร็จ ${esc(thDate(t.due_date))}` : ''}${t.priority && t.priority !== 'ปกติ' ? ` · ${esc(t.priority)}` : ''}</span>
            ${t.detail ? `<p>${esc(t.detail)}</p>` : ''}
            ${answer}${form}
            ${state.config.forms.some(f => f.key === t.box && f.fields) ? `<button type="button" class="gd-btn gd-btn-primary" data-open-box="${esc(t.box)}">กรอกแบบฟอร์ม "${esc(info.title)}" →</button>` : ''}
            ${t.acknowledged_at ? `<p class="gd-task-meta">✓ รับทราบแล้วเมื่อ ${esc(when(t.acknowledged_at))}</p>` : ''}
        </article>`;
        $('gdFields').innerHTML = '';
        $('gdFields').hidden = true;
        document.querySelector('.gd-submit').hidden = true;
        $('gdProgress').hidden = true;
        msg($('gdFormMsg'), '');
        state.view = { task: t.id, box: t.box };
        show('gdForm');
        window.scrollTo(0, 0);
    }
    function replaceTask(task) {
        const i = state.tasks.findIndex(t => t.id === task.id);
        if (i >= 0) state.tasks[i] = task;
        renderAlerts();
        renderBadges();
    }
    // เข้างาน: งานที่ยังไม่รับทราบ → บันทึกรับทราบก่อน แล้วเปิดหน้างาน (ตัวเลขแจ้งเตือนลดลงทันที)
    async function goTask(id) {
        const t = state.tasks.find(x => x.id === Number(id));
        if (!t) return;
        if (!t.acknowledged_at) {
            try { const { task } = await call(`/tasks/${t.id}/ack`, {}); replaceTask(task); }
            catch (error) { msg($('gdFormMsg'), error.message, 'bad'); }
        }
        // งานในกล่องที่มีแบบฟอร์ม และไม่มีช่องของงานเอง → ไปกรอกแบบฟอร์มของกล่องเลย
        const boxForm = state.config.forms.some(f => f.key === t.box && f.fields);
        if (boxForm && !(t.fields || []).length && !(t.uploads || []).length) { state.view = null; return openForm(t.box); }
        openTask(t.id);
    }
    async function ackTask(button) {
        button.disabled = true;
        try {
            const { task } = await call(`/tasks/${state.task.id}/ack`, {});
            replaceTask(task);
            openTask(task.id);
            msg($('gdFormMsg'), 'รับทราบแล้ว', 'ok');
        } catch (error) { msg($('gdFormMsg'), error.message, 'bad'); button.disabled = false; }
    }
    async function submitTask(form) {
        const t = state.task;
        const values = {};
        for (const f of t.fields || []) {
            values[f.id] = form.elements[f.id].value.trim();
            if (!values[f.id]) return msg($('gdFormMsg'), `กรุณากรอก "${f.label}"`, 'bad');
        }
        for (const u of t.uploads || []) {
            if (!(state.taskFiles[u.id] || []).length && !(t.files || []).some(f => f.slot === u.id)) return msg($('gdFormMsg'), `กรุณาแนบ "${u.label}"`, 'bad');
        }
        const jobs = (t.uploads || []).flatMap(u => (state.taskFiles[u.id] || []).map(item => ({ slot: u.id, file: item.file,
            password: form.querySelector(`[data-password="${u.id}"]`)?.value.trim() || '' })));
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        const bar = $('gdProgress');
        bar.hidden = false;
        try {
            for (let i = 0; i < jobs.length; i++) {
                msg($('gdFormMsg'), `กำลังอัปโหลดไฟล์ ${i + 1}/${jobs.length}…`);
                bar.firstElementChild.style.width = `${Math.round(i / (jobs.length + 1) * 100)}%`;
                await call('/upload/task', { id: t.id, slot: jobs[i].slot, password: jobs[i].password, data: await toDataUrl(jobs[i].file) });
            }
            msg($('gdFormMsg'), 'กำลังส่งงาน…');
            const { task } = await call(`/tasks/${t.id}/respond`, { values });
            replaceTask(task);
            openTask(task.id);
            msg($('gdFormMsg'), 'ส่งงานเรียบร้อย ✓', 'ok');
        } catch (error) {
            msg($('gdFormMsg'), `ส่งไม่สำเร็จ: ${error.message}`, 'bad');
            button.disabled = false;
            bar.hidden = true;
        }
    }
    async function loadMine() {
        const box = $('gdMine');
        box.innerHTML = '<p class="gd-empty">กำลังโหลด…</p>';
        try {
            const { records } = await call('/mine');
            state.mine = records;
            renderBadges();
            renderAlerts();
            const icon = key => state.config.forms.find(f => f.key === key)?.icon || '📄';
            box.innerHTML = records.length ? records.map(r => {
                const slips = r.files.filter(f => f.field === 'refund_slip');
                const form = state.config.forms.find(f => f.key === r.type);
                const fileFields = (form?.fields || []).filter(f => f.type === 'files');
                // GA ขอเอกสารเพิ่ม → แนบไฟล์เพิ่มในรายการเดิม แล้วส่งกลับให้ตรวจ
                const more = r.status === 'rejected' && fileFields.length ? `<div class="gd-more" data-more="${r.id}">
                    <b>＋ ส่งเอกสารเพิ่ม</b>
                    <select data-more-field>${fileFields.map(f => `<option value="${esc(f.name)}">${esc(f.label)}</option>`).join('')}</select>
                    <label class="gd-pick">＋ เลือกรูป / PDF<input type="file" accept="image/*,application/pdf" multiple data-more-files></label>
                    <small data-more-msg></small>
                    <button type="button" class="gd-btn gd-btn-primary gd-btn-sm" data-resubmit="${r.id}">ส่งกลับให้ GA ตรวจ</button>
                </div>` : '';
                return `<div class="gd-item">
                    <span class="gd-item-icon">${esc(icon(r.type))}</span>
                    <div><b>${esc(r.type_title)}</b><small>เลขที่ ${r.id} · ส่งเมื่อ ${esc(when(r.submitted_at))} · ไฟล์แนบ ${r.files.length - slips.length}</small>
                        ${r.admin_note ? `<span class="gd-note">GA: ${esc(r.admin_note)}</span>` : ''}
                        ${r.type === 'treatment' && !['billed', 'deleted', 'rejected'].includes(r.status) ? (r.case_id ? `<button type="button" class="gd-btn gd-btn-primary gd-btn-sm gd-bill" data-bill-from="${r.id}">📤 รักษาเสร็จ / ส่งบิล (เคส #${esc(r.case_id)})</button>` : '<span class="gd-pill is-pending">รอ GA เปิดเคสก่อน จึงบันทึกค่ารักษาได้</span>') : ''}
                        ${slips.length ? `<span class="gd-slips">${slips.map(f => `<button type="button" class="gd-btn gd-btn-sm" data-own-file="${r.id}/${f.n}" data-mime="${esc(f.mime)}">🧾 ดูสลิปโอนเงินคืน${slips.length > 1 ? ` ${f.index}` : ''}</button>`).join('')}</span>` : ''}
                        ${more}</div>
                    <span class="gd-pill is-${esc(r.status)}">${esc(r.status_label)}</span>
                </div>`;
            }).join('') : '<p class="gd-empty">ยังไม่มีรายการที่ส่ง</p>';
        } catch (error) { box.innerHTML = `<p class="gd-empty">${esc(error.message)}</p>`; }
    }

    // ไฟล์ของรายการตัวเอง (สลิปโอนคืน) — ต้องส่ง token จึงดึงเป็น blob แล้วแสดงในหน้าเดียวกัน
    async function openOwnFile(ref, mime) {
        const [id, n] = ref.split('/');
        const response = await fetch(`${API}/file/${id}/${n}`, { headers: { Authorization: `Bearer ${state.session?.token || ''}` } });
        if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
        const url = URL.createObjectURL(await response.blob());
        if (!/^image\//.test(mime)) { window.open(url, '_blank'); return; }
        const box = document.createElement('div');
        box.className = 'gd-viewer';
        box.innerHTML = `<img src="${url}" alt="สลิปโอนเงินคืน"><button type="button" aria-label="ปิด">×</button>`;
        box.addEventListener('click', event => { if (event.target.tagName !== 'IMG') box.remove(); });
        box.querySelector('img').addEventListener('click', event => event.target.classList.toggle('is-zoom'));
        document.body.append(box);
    }
    async function uploadMore(input) {
        const wrap = input.closest('[data-more]');
        const note = wrap.querySelector('[data-more-msg]');
        const files = [...input.files];
        input.disabled = true;
        try {
            for (let i = 0; i < files.length; i++) {
                note.textContent = `กำลังอัปโหลด ${i + 1}/${files.length}…`;
                await call('/upload/more', { id: Number(wrap.dataset.more), field: wrap.querySelector('[data-more-field]').value, data: await toDataUrl(files[i]) });
            }
            wrap.dataset.added = String(Number(wrap.dataset.added || 0) + files.length);
            note.textContent = `✓ แนบเพิ่มแล้ว ${wrap.dataset.added} ไฟล์ — กด "ส่งกลับให้ GA ตรวจ" เมื่อครบ`;
        } catch (error) { note.textContent = `แนบไม่สำเร็จ: ${error.message}`; }
        finally { input.disabled = false; input.value = ''; }
    }
    document.addEventListener('change', event => { const input = event.target.closest('[data-more-files]'); if (input && input.files.length) uploadMore(input); });
    document.addEventListener('click', async event => {
        const own = event.target.closest('[data-own-file]');
        if (own) { own.disabled = true; try { await openOwnFile(own.dataset.ownFile, own.dataset.mime); } catch (error) { alert(error.message); } finally { own.disabled = false; } return; }
        const bill = event.target.closest('[data-bill-from]');
        if (bill) {
            const r = (state.mine || []).find(x => x.id === Number(bill.dataset.billFrom));
            if (!r) return;
            openForm('medical');
            state.billFrom = r.id;
            const set = (name, value) => {
                if (!value) return;
                const radio = $('gdFields').querySelector(`input[type=radio][name="${name}"][value="${CSS.escape(value)}"]`);
                if (radio) radio.checked = true;
                const input = $('gdFields').querySelector(`[name="${name}"]:not([type=radio])`);
                if (input) input.value = value;
            };
            set('case_ref', r.case_id ? `เคส #${r.case_id} (แจ้งเลขที่ ${r.id})` : `แจ้งเลขที่ ${r.id}`);
            // ข้อมูลจากตอนแจ้งเข้ารักษา: แสดงให้เห็นแต่แก้ไม่ได้
            // บอกให้ชัดว่ากำลังบันทึกค่ารักษาของเคสไหน
            $('gdInfo').insertAdjacentHTML('afterbegin', `<div class="gd-bill-case">🩺 บันทึกค่ารักษาของ <b>เคส #${esc(r.case_id || '-')}</b> · ${esc(r.fields?.hospital || '-')} · ${esc(thDate(r.fields?.treat_date || ''))}<small>บิลนี้จะผูกกับเคสนี้เท่านั้น — ถ้ารักษาคนละครั้ง ให้กดบันทึกที่เคสของครั้งนั้น</small></div>`);
            ['treat_date', 'hospital', 'symptom'].forEach(k => {
                set(k, r.fields?.[k]);
                const input = $('gdFields').querySelector(`[name="${k}"]`);
                if (input && input.value) { input.readOnly = true; input.closest('.gd-field').classList.add('is-readonly'); }
            });
            refreshVisibility();
            return;
        }
        const resubmit = event.target.closest('[data-resubmit]');
        if (resubmit) {
            const wrap = resubmit.closest('[data-more]');
            if (!Number(wrap.dataset.added || 0) && !confirm('ยังไม่ได้แนบไฟล์เพิ่ม — ส่งกลับให้ GA ตรวจเลยไหม?')) return;
            resubmit.disabled = true;
            try { await call('/resubmit', { id: Number(resubmit.dataset.resubmit) }); loadMine(); }
            catch (error) { alert(error.message); resubmit.disabled = false; }
        }
    });

    // ---------------------------------------------------------------- แบบฟอร์ม
    const money = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
    function limitCard(title, sub, limit, balance, color) {
        const used = balance === null ? null : Math.max(0, limit - balance);
        const pct = limit ? Math.min(100, Math.round((used || 0) / limit * 100)) : 0;
        return `<div class="gd-limit" style="--c:${color}"><div class="gd-limit-head"><b>${title}</b><small>${sub}</small></div>
            <div class="gd-limit-nums"><div><small>วงเงินตั้งต้น</small><b>${money(limit)}</b></div><div><small>ใช้ไป</small><b>${used === null ? '-' : money(used)}</b></div><div class="is-left"><small>คงเหลือ</small><b>${balance === null ? '-' : money(balance)}</b></div></div>
            <div class="gd-limit-bar"><i style="width:${pct}%"></i></div><small class="gd-limit-note">${balance !== null && balance < 1000 ? '⚠️ วงเงินเหลือน้อย' : `ใช้ไป ${pct}%`}</small></div>`;
    }
    async function renderCare() {
        const box = document.createElement('div');
        box.className = 'gd-care';
        box.innerHTML = '<p class="gd-empty">กำลังโหลดวงเงินและประวัติการรักษา…</p>';
        $('gdInfo').prepend(box);
        const cases = openCareCases();
        const casesHtml = cases.length ? `<section class="gd-care-section"><h3>🩺 เคสที่แจ้งไว้ (${cases.length}) — รักษาเสร็จแล้วกดบันทึกค่ารักษา</h3>
            ${cases.map(r => `<div class="gd-care-case"><div><b>${esc(r.fields?.hospital || '-')}</b><small>${esc(thDate(r.fields?.treat_date || ''))} ${esc(r.fields?.treat_time || '')} · ${esc(r.fields?.symptom || '')}</small>
                <small>เลขที่ ${r.id}${r.case_id ? ` · เคสประกัน #${esc(r.case_id)}` : ''} · <span class="gd-pill is-${r.case_id ? 'received' : 'pending'}">${r.case_id ? 'GA เปิดเคสแล้ว' : 'รอ GA เปิดเคส'}</span></small>${r.case_id && r.admin_note ? `<small class="gd-ga-status">📣 GA: ${esc(r.admin_note)}</small>` : ''}</div>
                ${r.case_id ? `<button type="button" class="gd-btn gd-btn-primary gd-btn-sm" data-bill-from="${r.id}">📤 บันทึกค่ารักษา (เคส #${esc(r.case_id)})</button>` : '<button type="button" class="gd-btn gd-btn-sm" disabled title="รอ GA เปิดเคสกับประกันก่อน">รอ GA เปิดเคส</button>'}</div>`).join('')}</section>` : '';
        let summary = null;
        try { summary = (await call('/care')).summary; } catch (error) { box.innerHTML = casesHtml + `<p class="gd-empty">${esc(error.message)}</p>`; return; }
        if (!summary) { box.innerHTML = casesHtml + '<p class="gd-empty">ยังไม่พบข้อมูลวงเงินประกันของคุณ — กรุณาติดต่อ GA</p>'; return; }
        const history = summary.cases.length ? summary.cases.map(c => {
            const parts = [c.opd && `OPD ${money(c.opd)}`, c.dental && `ทันตกรรม (OPD) ${money(c.dental)}`, c.ipd && `IPD ${money(c.ipd)}`, c.other && `วงเงินอื่นๆ ${money(c.other)}`].filter(Boolean);
            return `<div class="gd-care-row"><div class="gd-care-main"><b>${esc(c.hospital || '-')}</b><small>เคส #${esc(c.caseId)} · ${esc(c.symptoms || '')}</small>
                <small class="gd-care-dates"><span>แจ้งเคส ${esc(String(c.reportedAt || '-').split(/[ ,]/)[0])}</span><span>วันที่รักษา ${esc(String(c.date || '-').split(/[ ,]/)[0])}</span><span>รักษาเสร็จ ${esc(c.closedAt ? String(c.closedAt).split(/[ ,]/)[0] : '—')}</span></small>
                <small class="gd-care-status">${esc(c.status || '')}</small></div>
                <div class="gd-care-amount"><b>${c.total ? `${money(c.total)} บาท` : '—'}</b><small>${esc(parts.join(' · ') || 'ยังไม่บันทึกยอด')}</small></div>
                ${c.docs.length ? `<div class="gd-care-docs">${c.docs.map(d => `<button type="button" class="gd-btn gd-btn-sm" data-care-doc="${esc(c.caseId)}/${d.n}">${d.label === 'ใบเสร็จ' ? '🧾' : '📎'} ${esc(d.label)}</button>`).join('')}</div>` : ''}</div>`;
        }).join('') : '<p class="gd-empty">ยังไม่มีประวัติการรักษา</p>';
        box.innerHTML = `
            <section class="gd-care-section"><h3>💳 วงเงินค่ารักษาพยาบาลของคุณ <small>Size ${esc(summary.size || '-')}</small></h3>
                <div class="gd-limits">${limitCard('ผู้ป่วยนอก (OPD)', 'รวมทันตกรรม / ทำฟัน', summary.opd.limit, summary.opd.balance, '#2563eb')}
                ${limitCard('ผู้ป่วยใน (IPD)', 'นอนโรงพยาบาล', summary.ipd.limit, summary.ipd.balance, '#7c3aed')}
                ${summary.other ? limitCard('วงเงินอื่นๆ', 'แยกจาก OPD / IPD', summary.other.limit, summary.other.balance, '#0d9488') : ''}</div>
                <p class="gd-limit-foot">ทันตกรรม / ทำฟัน หักจากวงเงิน OPD เท่านั้น · ค่ารักษาไม่เกิน 5,000 บาท สำรองจ่ายเองแล้วเบิกคืน</p></section>
            ${casesHtml}
            <section class="gd-care-section"><h3>📋 ประวัติการรักษา (${summary.cases.length} ครั้ง)</h3>${history}</section>
            <h3 class="gd-care-open">＋ แจ้งเปิดเคสก่อนไปรักษา</h3>`;
    }
    async function openCareDoc(ref) {
        const [caseId, n] = ref.split('/');
        const response = await fetch(`${API}/care/file/${encodeURIComponent(caseId)}/${n}`, { headers: { Authorization: `Bearer ${state.session?.token || ''}` } });
        if (!response.ok) throw new Error('เปิดเอกสารไม่ได้');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (!/^image\//.test(blob.type)) { window.open(url, '_blank'); return; }
        const viewer = document.createElement('div');
        viewer.className = 'gd-viewer';
        viewer.innerHTML = `<img src="${url}" alt=""><button type="button" aria-label="ปิด">×</button>`;
        viewer.addEventListener('click', event => { if (event.target.tagName !== 'IMG') viewer.remove(); });
        viewer.querySelector('img').addEventListener('click', event => event.target.classList.toggle('is-zoom'));
        document.body.append(viewer);
    }
    document.addEventListener('click', async event => {
        const doc = event.target.closest('[data-care-doc]');
        if (!doc) return;
        doc.disabled = true;
        try { await openCareDoc(doc.dataset.careDoc); } catch (error) { alert(error.message); } finally { doc.disabled = false; }
    });

    function openForm(key) {
        const form = menuItems().find(f => f.key === key);
        if (!form) return;
        if (key !== 'medical') state.billFrom = null;
        if (form.link) { location.href = form.link; return; }
        if (form.concept || form.box) return openBox(key);
        document.querySelector('.gd-submit').hidden = false;
        $('gdFields').hidden = false;
        state.form = form;
        state.files = {};
        $('gdFormTitle').textContent = form.short || form.title;
        $('gdFormHead').innerHTML = `<span class="gd-tile-icon" style="--c:${esc(form.color)}">${esc(form.icon)}</span><div><h2>${esc(form.title)}</h2><p>${esc(form.description)}</p></div>`;
        $('gdInfo').innerHTML = form.info ? `<div class="gd-info">${form.info.map(i => `<div><small>${esc(i.label)}</small>${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.value)}</a>` : esc(i.value)}</div>`).join('')}</div>` : '';
        // งานที่ GA มอบหมายในหัวข้อนี้ แสดงไว้ด้านบนของฟอร์ม
        const boxTasks = state.tasks.filter(t => t.box === key);
        if (boxTasks.length) $('gdInfo').innerHTML += `<h3 class="gd-box-tasks">งานที่ได้รับมอบหมายในหัวข้อนี้</h3>${tasksHtml(boxTasks)}`;
        // มีงานในหัวข้อนี้ที่ยังไม่กดรับทราบ → ยังกรอกไม่ได้
        const mustAck = boxTasks.some(t => !t.acknowledged_at);
        if (mustAck) $('gdInfo').innerHTML += '<p class="gd-lock-note">🔒 กรุณากด "รับทราบและดำเนินการ" ที่งานด้านบนก่อน จึงจะกรอกข้อมูลและอัปโหลดเอกสารได้</p>';
        $('gdFields').innerHTML = form.fields.map(fieldHtml).join('');
        if (key === 'treatment') renderCare();
        $('gdFields').classList.toggle('is-locked', mustAck);
        $('gdFields').querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = mustAck; });
        document.querySelector('.gd-submit').disabled = mustAck;
        form.fields.filter(f => f.type === 'files').forEach(f => { state.files[f.name] = []; });
        refreshVisibility();
        msg($('gdFormMsg'), '');
        $('gdProgress').hidden = true;
        show('gdForm');
        window.scrollTo(0, 0);
    }
    function openConcept(item) {
        state.form = null;
        $('gdFormTitle').textContent = item.short || item.title;
        $('gdFormHead').innerHTML = `<span class="gd-tile-icon" style="--c:${esc(item.color)}">${esc(item.icon)}</span><div><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p></div>`;
        $('gdInfo').innerHTML = `<div class="gd-concept"><span class="gd-concept-badge">เตรียมระบบ · กำลังออกแบบ</span><h3>แนวคิด</h3><p>${esc(item.concept)}</p>
            <ul>${item.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
        $('gdFields').innerHTML = '';
        $('gdFields').hidden = true;
        document.querySelector('.gd-submit').hidden = true;
        $('gdProgress').hidden = true;
        msg($('gdFormMsg'), '');
        show('gdForm');
        window.scrollTo(0, 0);
    }
    function fieldHtml(f) {
        const label = `${esc(f.label)}${f.required ? ' <span class="gd-req">*</span>' : ''}`;
        const id = `gd_${f.name}`;
        const attrs = `id="${id}" name="${esc(f.name)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}`;
        let input;
        if (f.type === 'textarea') input = `<textarea ${attrs}></textarea>`;
        else if (f.type === 'select') input = `<select ${attrs}><option value="">— เลือก —</option>${f.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
        else if (f.type === 'radio') return `<div class="gd-field" data-field="${esc(f.name)}"><span class="gd-label">${label}</span><div class="gd-choices">${f.options.map(o => `<label class="gd-choice"><input type="radio" name="${esc(f.name)}" value="${esc(o)}">${esc(o)}</label>`).join('')}</div></div>`;
        else if (f.type === 'files') return `<div class="gd-field" data-field="${esc(f.name)}"><span class="gd-label">${label}</span>
            <label class="gd-pick">＋ แนบไฟล์ <small>(รูปหรือ PDF${(f.max || 10) > 1 ? ` · ได้ถึง ${f.max || 10} ไฟล์` : ''})</small><input type="file" accept="image/*,application/pdf" ${(f.max || 10) > 1 ? 'multiple' : ''} data-files="${esc(f.name)}"></label>
            <div class="gd-thumbs" data-thumbs="${esc(f.name)}"></div></div>`;
        else if (f.type === 'number') input = `<input type="number" inputmode="decimal" min="0" step="0.01" ${attrs}>`;
        else input = `<input type="${f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}" ${attrs}${f.maxDate ? ` max="${esc(f.maxDate)}"` : ''}>`;
        return `<div class="gd-field" data-field="${esc(f.name)}"><label for="${id}">${label}</label>${input}</div>`;
    }
    const values = () => {
        const out = {};
        new FormData($('gdFields')).forEach((value, key) => { if (typeof value === 'string') out[key] = value.trim(); });
        return out;
    };
    const isVisible = (f, v) => !f.hidden && (!f.showIf || v[f.showIf.name] === f.showIf.value);
    function refreshVisibility() {
        const v = values();
        state.form.fields.forEach(f => { $('gdFields').querySelector(`[data-field="${f.name}"]`).hidden = !isVisible(f, v); });
    }
    // ไฟล์ของงานที่ GA มอบหมาย (ช่องอัปโหลดตามที่ GA ตั้ง)
    $('gdInfo').addEventListener('change', event => {
        const input = event.target.closest('input[data-task-slot]');
        if (!input) return;
        const slot = input.dataset.taskSlot;
        const list = state.taskFiles[slot] ||= [];
        const def = (state.task.uploads || []).find(u => u.id === slot);
        for (const file of input.files) {
            if (def.type === 'pdf' ? file.type !== 'application/pdf' : !file.type.startsWith('image/')) { msg($('gdFormMsg'), `"${def.label}" ต้องเป็น${def.type === 'pdf' ? 'ไฟล์ PDF' : 'รูปภาพ'}`, 'bad'); continue; }
            list.push({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' });
        }
        input.value = '';
        const box = $('gdInfo').querySelector(`[data-task-thumbs="${slot}"]`);
        box.replaceChildren(...list.map((item, i) => {
            const div = document.createElement('div');
            div.className = 'gd-thumb';
            if (item.url) div.append(Object.assign(document.createElement('img'), { src: item.url, alt: '' }));
            else div.textContent = `📄 ${item.file.name}`;
            const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: 'ลบไฟล์นี้' });
            remove.onclick = () => { list.splice(i, 1); input.dispatchEvent(new Event('change', { bubbles: true })); };
            div.append(remove);
            return div;
        }));
    });
    $('gdInfo').addEventListener('submit', event => { if (event.target.id === 'gdTaskForm') { event.preventDefault(); submitTask(event.target); } });
    $('gdFields').addEventListener('change', event => {
        const input = event.target.closest('input[data-files]');
        if (!input) return refreshVisibility();
        const field = state.form.fields.find(f => f.name === input.dataset.files);
        const list = state.files[field.name];
        for (const file of input.files) {
            if (!/^image\/|^application\/pdf$/.test(file.type)) continue;
            if (list.length >= (field.max || 10)) { msg($('gdFormMsg'), `"${field.label}" แนบได้ไม่เกิน ${field.max || 10} ไฟล์`, 'bad'); break; }
            list.push({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' });
        }
        input.value = '';
        renderThumbs(field.name);
    });
    function renderThumbs(name) {
        const box = $('gdFields').querySelector(`[data-thumbs="${name}"]`);
        box.replaceChildren(...state.files[name].map((item, i) => {
            const div = document.createElement('div');
            div.className = 'gd-thumb';
            if (item.url) div.append(Object.assign(document.createElement('img'), { src: item.url, alt: '' }));
            else div.textContent = `📄 ${item.file.name}`;
            const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: 'ลบไฟล์นี้' });
            remove.onclick = () => { if (item.url) URL.revokeObjectURL(item.url); state.files[name].splice(i, 1); renderThumbs(name); };
            div.append(remove);
            return div;
        }));
    }

    // รูปย่อด้านยาวไม่เกิน 1800px (JPEG) · PDF ส่งตามเดิม (ไม่เกิน 8 MB)
    function toDataUrl(file) {
        if (file.type === 'application/pdf') {
            if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error(`ไฟล์ ${file.name} ใหญ่เกิน 8 MB`));
            return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่ได้`)); r.readAsDataURL(file); });
        }
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
                const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`เปิดรูป ${file.name} ไม่ได้`)); };
            img.src = url;
        });
    }

    async function submit(button) {
        const form = state.form;
        const v = values();
        // ตรวจเบื้องต้นที่หน้าเว็บ (หลังบ้านตรวจซ้ำอีกรอบ)
        for (const f of form.fields) {
            if (!f.required || !isVisible(f, v)) continue;
            if (f.type === 'files' ? !state.files[f.name].length : !v[f.name]) return msg($('gdFormMsg'), `กรุณา${f.type === 'files' ? 'แนบ' : 'กรอก'} "${f.label}"`, 'bad');
        }
        const uploads = form.fields.filter(f => f.type === 'files' && isVisible(f, v)).flatMap(f => state.files[f.name].map(item => ({ field: f.name, file: item.file })));
        if (form.atLeastOne && !uploads.length && !Object.values(v).some(Boolean)) return msg($('gdFormMsg'), 'กรุณากรอกข้อมูลอย่างน้อย 1 ช่อง', 'bad');
        button.disabled = true;
        const bar = $('gdProgress');
        bar.hidden = false;
        const step = pct => { bar.firstElementChild.style.width = `${pct}%`; };
        try {
            msg($('gdFormMsg'), 'กำลังส่งข้อมูล…');
            step(5);
            const { id } = await call('/submit', { type: form.key, fields: v });
            const fromCase = form.key === 'medical' ? state.billFrom : null;
            for (let i = 0; i < uploads.length; i++) {
                msg($('gdFormMsg'), `กำลังอัปโหลดไฟล์ ${i + 1}/${uploads.length}…`);
                step(10 + Math.round(i / uploads.length * 80));
                await call('/upload', { id, field: uploads[i].field, data: await toDataUrl(uploads[i].file) });
            }
            msg($('gdFormMsg'), 'กำลังยืนยันการส่ง…');
            step(95);
            await call('/finalize', { id, from_case: fromCase || undefined });
            state.billFrom = null;
            loadMine();
            $('gdDoneText').textContent = `${form.title} · เลขที่ ${id} — GA จะตรวจสอบและอัปเดตสถานะในหน้า "รายการที่ฉันส่ง"`;
            show('gdDone');
            window.scrollTo(0, 0);
        } catch (error) {
            msg($('gdFormMsg'), `ส่งไม่สำเร็จ: ${error.message}`, 'bad');
            bar.hidden = true;
        } finally { button.disabled = false; }
    }

    // ---------------------------------------------------------------- ช่องทางการติดต่อ (จอเล็ก: พับเก็บ กดเปิด/ปิด)
    function toggleContacts(open) {
        const on = open ?? !document.body.classList.contains('contacts-open');
        document.body.classList.toggle('contacts-open', on);
        $('gdContactToggle')?.setAttribute('aria-expanded', String(on));
    }
    $('gdContactToggle')?.addEventListener('click', event => { event.stopPropagation(); toggleContacts(); });
    document.addEventListener('click', event => {
        if (document.body.classList.contains('contacts-open') && !event.target.closest('#gdContacts')) toggleContacts(false);
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') toggleContacts(false); });
    // โทรศัพท์: กดช่องทางไหน → แสดง QR Code ของช่องทางนั้น + ปุ่มเปิด LINE (คอมพิวเตอร์กดแล้วเปิด LINE ตรงเหมือนเดิม)
    const PHONE = window.matchMedia('(max-width: 760px)');
    let qrLib = null;
    const loadQr = () => qrLib ||= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
        s.onload = () => resolve(window.qrcode);
        s.onerror = () => { qrLib = null; reject(new Error('โหลด QR ไม่ได้')); };
        document.head.append(s);
    });
    document.addEventListener('click', async event => {
        const card = event.target.closest('.gd-contact');
        if (!card || !PHONE.matches) return;
        if (event.target.closest('[data-qr-open]')) return;   // ปุ่มเปิด LINE ในแผง QR
        event.preventDefault();
        const opened = card.nextElementSibling?.classList.contains('gd-contact-qr');
        document.querySelectorAll('.gd-contact-qr').forEach(n => n.remove());
        if (opened) return;
        const id = card.querySelector('code')?.textContent || '';
        const panel = document.createElement('div');
        panel.className = 'gd-contact-qr';
        panel.innerHTML = `<div class="gd-qr-img">กำลังสร้าง QR…</div><p>สแกนเพื่อเพิ่มเพื่อน <b>${esc(id)}</b></p><a class="gd-btn gd-btn-primary" data-qr-open href="${esc(card.href)}" target="_blank" rel="noopener">เปิด LINE ›</a>`;
        card.after(panel);
        try {
            const qrcode = await loadQr();
            const qr = qrcode(0, 'M');
            qr.addData(card.href);
            qr.make();
            panel.querySelector('.gd-qr-img').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
        } catch (error) { panel.querySelector('.gd-qr-img').textContent = error.message; }
    });

    // ---------------------------------------------------------------- ปุ่ม
    document.addEventListener('click', event => {
        const gaNote = event.target.closest('[data-ga-note]');
        if (gaNote) {
            markNoteSeen(gaNote.dataset.gaNote);
            const rec = $('gdMine').querySelector(`[data-rec="${gaNote.dataset.gaNote.split('|')[0]}"]`) || $('gdMine');
            rec.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const tile = event.target.closest('[data-open]');
        if (tile) return openForm(tile.dataset.open);
        const formButton = event.target.closest('[data-open-box]');
        if (formButton) { state.view = null; return openForm(formButton.dataset.openBox); }
        // แจ้งเตือน: มีงานใหม่งานเดียวในกล่อง → เปิดหน้างาน (ช่องกรอก/อัปโหลด) ทันที
        const alertBox = event.target.closest('[data-box]');
        if (alertBox) {
            const items = unread().filter(t => t.box === alertBox.dataset.box);
            return items.length === 1 ? goTask(items[0].id) : openBox(alertBox.dataset.box);
        }
        const taskButton = event.target.closest('[data-task]');
        if (taskButton) return goTask(taskButton.dataset.task);
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'logout') logout();
        else if (action === 'back') {
            // จากหน้างาน → กลับไปกล่องของงานนั้น · จากกล่อง/ฟอร์ม → เมนูหลัก
            if (state.view?.task && !$('gdForm').hidden) { const box = state.view.box; state.view = null; openBox(box); }
            else { state.view = null; openHome(); }
        }
        else if (action === 'alerts') { openHome(); $('gdAlerts').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else if (action === 'ack') ackTask(button);
        else if (action === 'reload-mine') loadMine();
        else if (action === 'submit') submit(button);
    });

    // เปิดหน้าใหม่: ใช้เซสชันเดิมถ้ายังอยู่ · แจ้งถ้าระบบปิดรับ — ระหว่างนี้แสดงหน้าจอโหลด (gd-booting) แล้วค่อยเปิดหน้าที่ถูกต้องหน้าเดียว
    const booted = () => document.documentElement.classList.remove('gd-booting');
    (async () => {
        try {
            const config = await loadConfig();
            if (config.locked) msg($('gdLoginMsg'), 'ระบบปิดรับการเข้าสู่ระบบชั่วคราว', 'bad');
            const saved = store.get();
            if (saved?.token && !config.locked) { state.session = saved; openHome(); }
            booted();
            // แจ้งเตือนใหม่: ถามหลังบ้านทุก 15 วินาทีระหว่างเปิดหน้าไว้ และทันทีที่กลับมาที่หน้านี้
            setInterval(() => { if (state.session && !document.hidden) loadTasks(); }, 15 * 1000);
            document.addEventListener('visibilitychange', () => { if (state.session && !document.hidden) loadTasks(); });
            window.addEventListener('focus', () => { if (state.session) loadTasks(); });
        } catch (error) { msg($('gdLoginMsg'), error.message, 'bad'); booted(); }
    })();
})();
