// งาน GA: เจ้าหน้าที่ GA (บัญชีพอร์ทัล) → หน้าที่ที่รับผิดชอบใน 4 ส่วนงาน + กราฟสัดส่วนงานของแต่ละคน
// ข้อมูลจาก /api/staff/ga-work (สิทธิ์ ManageStaff) — หน้าที่ที่กำหนดเองเก็บในชีต "ฐานข้อมูลจัดการพนักงาน" แท็บ "หน้าที่ STAFF"
// บัญชีที่ยังไม่กำหนดหน้าที่ → ระบบเดาจากสิทธิ์ของบัญชีนั้น
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/staff${path}`;
    const state = { data: null, editing: null };

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
    const when = text => text ? new Date(text).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const sectionOf = key => state.data.sections.find(s => key.startsWith(`${s.key}.`));
    const itemTitle = key => sectionOf(key)?.items.find(i => i.key === key)?.title || key;

    async function load() {
        $('gwChart').innerHTML = '<p class="fa-empty">กำลังโหลด…</p>';
        try {
            state.data = await request('/ga-work');
            render();
        } catch (error) {
            $('gwChart').innerHTML = `<p class="fa-empty">${esc(error.message)}</p>`;
            $('gwStaff').innerHTML = '';
            $('gwSections').innerHTML = '';
        }
    }

    function render() {
        const { sections, staff } = state.data;
        // กราฟแท่งซ้อน: จำนวนหน้าที่ของแต่ละคน แยกสีตามส่วนงาน (ยาวสุด = คนที่มีหน้าที่มากที่สุด)
        $('gwLegend').innerHTML = sections.map(s => `<span style="--c:${s.color}"><i></i>${esc(s.title)}</span>`).join('');
        const max = Math.max(1, ...staff.map(p => p.duties.length));
        const total = staff.reduce((n, p) => n + p.duties.length, 0) || 1;
        const sorted = [...staff].sort((a, b) => b.duties.length - a.duties.length);
        $('gwChart').innerHTML = sorted.length ? sorted.map(p => {
            const parts = sections.map(s => ({ s, n: p.duties.filter(k => k.startsWith(`${s.key}.`)).length })).filter(x => x.n);
            return `<div class="gw-row">
                <b title="${esc(p.name)}">${esc(p.name)}<small>${esc(p.position || p.role)}</small></b>
                <div class="gw-bar" style="width:${Math.max(4, p.duties.length / max * 100)}%">${parts.map(x =>
                    `<i style="--c:${x.s.color};flex:${x.n}" title="${esc(`${x.s.title}: ${x.n} หน้าที่`)}"></i>`).join('')}</div>
                <span class="gw-num">${p.duties.length} <small>(${Math.round(p.duties.length / total * 100)}%)</small></span>
            </div>`;
        }).join('') : '<p class="fa-empty">ไม่พบบัญชีเจ้าหน้าที่</p>';
        // สัดส่วนของแต่ละส่วนงาน (นับคน-หน้าที่ทั้งหมด)
        $('gwShare').innerHTML = sections.map(s => {
            const n = staff.reduce((c, p) => c + p.duties.filter(k => k.startsWith(`${s.key}.`)).length, 0);
            const people = staff.filter(p => p.duties.some(k => k.startsWith(`${s.key}.`))).length;
            return `<div style="--c:${s.color}"><b>${Math.round(n / total * 100)}%</b><span>${esc(s.title)} · ${people} คน · ${n} หน้าที่</span></div>`;
        }).join('');

        // การ์ดเจ้าหน้าที่
        $('gwStaff').innerHTML = staff.map(p => {
            const groups = sections.map(s => ({ s, items: p.duties.filter(k => k.startsWith(`${s.key}.`)) })).filter(g => g.items.length);
            return `<article class="gw-person">
                <header>
                    <span class="gw-avatar">${esc((p.name || p.username).trim().charAt(0))}</span>
                    <div><b>${esc(p.name)}</b><small>${esc([p.position, p.role, p.username].filter(Boolean).join(' · '))}</small></div>
                    <button type="button" class="fa-btn" data-edit="${esc(p.username)}">แก้ไขหน้าที่</button>
                </header>
                ${p.note ? `<p class="gw-note">${esc(p.note)}</p>` : ''}
                ${groups.length ? groups.map(g => `<div class="gw-duty-group" style="--c:${g.s.color}"><span>${esc(g.s.title)}</span>
                    <div class="gw-chips">${g.items.map(k => `<span class="gw-chip">${esc(itemTitle(k))}</span>`).join('')}</div></div>`).join('')
                    : '<span class="fa-badge dim">ยังไม่มีหน้าที่</span>'}
                <span class="gw-meta">${p.source === 'custom' ? `กำหนดโดย ${esc(p.updated_by)} ${esc(when(p.updated_at))}` : 'ค่าตามสิทธิ์ของบัญชี (ยังไม่ได้กำหนดเอง)'} · มอบหมายงานพนักงานแล้ว ${p.tasksAssigned} งาน</span>
            </article>`;
        }).join('');

        // ส่วนงาน → ผู้รับผิดชอบแต่ละหน้าที่
        $('gwSections').innerHTML = sections.map(s => `<article class="gw-section" style="--c:${s.color}">
            <h3>${esc(s.title)}</h3>
            <ul>${s.items.map(i => {
                const people = staff.filter(p => p.duties.includes(i.key)).map(p => p.name);
                return `<li><b>${esc(i.title)}</b><small>${people.length ? esc(people.join(', ')) : '<span class="gw-none">ยังไม่มีผู้รับผิดชอบ</span>'}</small></li>`;
            }).join('')}</ul>
        </article>`).join('');
    }

    function openEdit(username) {
        const p = state.data.staff.find(x => x.username === username);
        if (!p) return;
        state.editing = username;
        $('gwEdit').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>หน้าที่ของ ${esc(p.name)}</h2><p>${esc([p.position, p.role, p.username].filter(Boolean).join(' · '))}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <form class="fa-detail-body gw-edit" id="gwForm">
                ${state.data.sections.map(s => `<div class="gw-edit-group" style="--c:${s.color}"><h3>${esc(s.title)}</h3>
                    ${s.items.map(i => `<label><input type="checkbox" name="duty" value="${esc(i.key)}" ${p.duties.includes(i.key) ? 'checked' : ''}>${esc(i.title)}</label>`).join('')}</div>`).join('')}
                <label><b>รายละเอียดงานที่รับผิดชอบ</b><textarea name="note" maxlength="2000" placeholder="เช่น ดูแลพื้นที่ SL, รับเรื่องเบิกค่ารถทุกวันศุกร์">${esc(p.note)}</textarea></label>
                <div class="gw-edit-foot"><button type="button" class="fa-btn" data-close>ยกเลิก</button><button type="submit" class="fa-btn fa-btn-primary">บันทึก</button></div>
            </form>`;
        $('gwDialog').showModal();
    }
    async function save(form) {
        const duties = [...form.querySelectorAll('[name=duty]:checked')].map(i => i.value);
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
            const result = await request(`/ga-work/${encodeURIComponent(state.editing)}`, { method: 'PUT', body: JSON.stringify({ duties, note: form.note.value }) });
            Object.assign(state.data.staff.find(x => x.username === state.editing), result, { source: 'custom' });
            $('gwDialog').close();
            render();
            toast('บันทึกหน้าที่แล้ว');
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }

    $('gwDialog').addEventListener('click', event => {
        if (event.target === $('gwDialog') || event.target.closest('[data-close]')) $('gwDialog').close();
    });
    $('gwDialog').addEventListener('submit', event => { event.preventDefault(); save(event.target); });
    document.addEventListener('click', event => {
        const edit = event.target.closest('[data-edit]');
        if (edit) return openEdit(edit.dataset.edit);
        if (event.target.closest('[data-action=refresh]')) load();
    });

    // จัดการรหัสเข้าชมอยู่ในหน้างาน GA และให้ ADMIN เท่านั้น
    const accessUrl = `${window.APP_CONFIG.API_BASE_URL}/api/exec/access-code`;
    window.authFetch(accessUrl, { cache: 'no-store' }).then(r => {
        if (r.ok) $('gwSetExecCode').hidden = false;
    }).catch(() => {});
    $('gwSetExecCode').addEventListener('click', async () => {
        const code = prompt('ตั้งรหัสเข้าชมใหม่ (6–64 ตัวอักษร) — ผู้ใช้รหัสเดิมต้องกรอกรหัสใหม่');
        if (code === null) return;
        if (code.length < 6 || code.length > 64) return toast('รหัสต้องยาว 6–64 ตัวอักษร', true);
        const button = $('gwSetExecCode'); button.disabled = true;
        try {
            await ensureCsrf();
            const response = await window.authFetch(accessUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.message || 'ตั้งรหัสไม่สำเร็จ');
            toast('ตั้งรหัสเข้าชมเรียบร้อยแล้ว');
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    });
    load();
})();
