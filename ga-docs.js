// ระบบจัดการองค์กร — ระบบรับ - ส่งเอกสาร GA (หน้าพนักงาน)
// เข้าสู่ระบบด้วยรหัสพนักงาน / รหัสประกัน → เลือกหัวข้อ → กรอก + แนบไฟล์ → ส่ง
// แบบฟอร์มทั้งหมดมาจากหลังบ้าน (/api/ga-docs/public/config) · ส่ง 3 ขั้น: submit → upload ทีละไฟล์ → finalize
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/ga-docs/public`;
    const TOKEN_KEY = 'gaDocsSession';
    const state = { config: null, session: null, form: null, files: {} };

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
        $('gdMenu').innerHTML = state.config.forms.map(f => `
            <button type="button" class="gd-tile" style="--c:${esc(f.color)}" data-open="${esc(f.key)}">
                <span class="gd-tile-icon" aria-hidden="true">${esc(f.icon)}</span>
                <b>${esc(f.title)}</b>
                <small>${esc(f.description)}</small>
            </button>`).join('');
        show('gdHome');
        window.scrollTo(0, 0);
        loadMine();
    }
    async function loadMine() {
        const box = $('gdMine');
        box.innerHTML = '<p class="gd-empty">กำลังโหลด…</p>';
        try {
            const { records } = await call('/mine');
            const icon = key => state.config.forms.find(f => f.key === key)?.icon || '📄';
            box.innerHTML = records.length ? records.map(r => `
                <div class="gd-item">
                    <span class="gd-item-icon">${esc(icon(r.type))}</span>
                    <div><b>${esc(r.type_title)}</b><small>เลขที่ ${r.id} · ส่งเมื่อ ${esc(when(r.submitted_at))} · ไฟล์แนบ ${r.files.length}</small>
                        ${r.admin_note ? `<span class="gd-note">GA: ${esc(r.admin_note)}</span>` : ''}</div>
                    <span class="gd-pill is-${esc(r.status)}">${esc(r.status_label)}</span>
                </div>`).join('') : '<p class="gd-empty">ยังไม่มีรายการที่ส่ง</p>';
        } catch (error) { box.innerHTML = `<p class="gd-empty">${esc(error.message)}</p>`; }
    }

    // ---------------------------------------------------------------- แบบฟอร์ม
    function openForm(key) {
        const form = state.config.forms.find(f => f.key === key);
        if (!form) return;
        if (form.link) { location.href = form.link; return; }
        state.form = form;
        state.files = {};
        $('gdFormTitle').textContent = form.short || form.title;
        $('gdFormHead').innerHTML = `<span class="gd-tile-icon" style="--c:${esc(form.color)}">${esc(form.icon)}</span><div><h2>${esc(form.title)}</h2><p>${esc(form.description)}</p></div>`;
        $('gdInfo').innerHTML = form.info ? `<div class="gd-info">${form.info.map(i => `<div><small>${esc(i.label)}</small>${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.value)}</a>` : esc(i.value)}</div>`).join('')}</div>` : '';
        $('gdFields').innerHTML = form.fields.map(fieldHtml).join('');
        form.fields.filter(f => f.type === 'files').forEach(f => { state.files[f.name] = []; });
        refreshVisibility();
        msg($('gdFormMsg'), '');
        $('gdProgress').hidden = true;
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
        else input = `<input type="${f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : 'text'}" ${attrs}>`;
        return `<div class="gd-field" data-field="${esc(f.name)}"><label for="${id}">${label}</label>${input}</div>`;
    }
    const values = () => {
        const out = {};
        new FormData($('gdFields')).forEach((value, key) => { if (typeof value === 'string') out[key] = value.trim(); });
        return out;
    };
    const isVisible = (f, v) => !f.showIf || v[f.showIf.name] === f.showIf.value;
    function refreshVisibility() {
        const v = values();
        state.form.fields.forEach(f => { $('gdFields').querySelector(`[data-field="${f.name}"]`).hidden = !isVisible(f, v); });
    }
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
            for (let i = 0; i < uploads.length; i++) {
                msg($('gdFormMsg'), `กำลังอัปโหลดไฟล์ ${i + 1}/${uploads.length}…`);
                step(10 + Math.round(i / uploads.length * 80));
                await call('/upload', { id, field: uploads[i].field, data: await toDataUrl(uploads[i].file) });
            }
            msg($('gdFormMsg'), 'กำลังยืนยันการส่ง…');
            step(95);
            await call('/finalize', { id });
            $('gdDoneText').textContent = `${form.title} · เลขที่ ${id} — GA จะตรวจสอบและอัปเดตสถานะในหน้า "รายการที่ฉันส่ง"`;
            show('gdDone');
            window.scrollTo(0, 0);
        } catch (error) {
            msg($('gdFormMsg'), `ส่งไม่สำเร็จ: ${error.message}`, 'bad');
            bar.hidden = true;
        } finally { button.disabled = false; }
    }

    // ---------------------------------------------------------------- ปุ่ม
    document.addEventListener('click', event => {
        const tile = event.target.closest('[data-open]');
        if (tile) return openForm(tile.dataset.open);
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'logout') logout();
        else if (action === 'back') openHome();
        else if (action === 'reload-mine') loadMine();
        else if (action === 'submit') submit(button);
    });

    // เปิดหน้าใหม่: ใช้เซสชันเดิมถ้ายังอยู่ · แจ้งถ้าระบบปิดรับ
    (async () => {
        try {
            const config = await loadConfig();
            if (config.locked) msg($('gdLoginMsg'), 'ระบบปิดรับการเข้าสู่ระบบชั่วคราว', 'bad');
            const saved = store.get();
            if (saved?.token && !config.locked) { state.session = saved; openHome(); }
        } catch (error) { msg($('gdLoginMsg'), error.message, 'bad'); }
    })();
})();
