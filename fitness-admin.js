// หลังบ้าน "ออกกำลังกายและฟิตเนส 15 ครั้ง": รายการแบบฟอร์มของพนักงานรายเดือน → เปิดดูรูป/วันที่/ลายเซ็น → ตรวจรูปและให้ผลตรวจ
// ข้อมูลจาก /api/fitness/admin (สิทธิ์ ManageFitness) — ทั้งหมดเก็บบน Google Drive (ชีต "ฐานข้อมูลออกกำลังกาย")
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/fitness/admin${path}`;
    const TYPE_LABEL = { 'กิจกรรม30วัน': 'กิจกรรม 30 วัน', 'ออกกำลังกายทั่วไป15ครั้ง': 'ทั่วไป 15 ครั้ง', 'ค่าฟิตเนสรายเดือน': 'ฟิตเนสรายเดือน' };
    const REVIEW = { pending: ['รอตรวจ', 'wait'], approved: ['ผ่าน', 'ok'], rejected: ['ไม่ผ่าน', 'bad'] };
    const state = { data: null, type: '', images: new Map(), detail: null };

    async function request(path, options = {}) {
        const response = await window.authFetch(api(path), { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ทหลังบ้าน)');
        if (!response.ok || data.success === false) throw new Error(data.message || `ทำรายการไม่สำเร็จ (${response.status})`);
        return data;
    }
    let toastTimer = null;
    function toast(text, isError = false) {
        const node = $('faToast');
        node.textContent = text;
        node.className = `fa-toast is-visible${isError ? ' is-error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { node.className = 'fa-toast'; }, isError ? 6000 : 3000);
    }
    const when = text => text ? new Date(text).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-';
    const publicUrl = () => new URL('exercise.html', location.href).href;

    // ---------------------------------------------------------------- รายการ
    async function load(month = $('faMonth').value) {
        try {
            state.data = await request(`/forms${month ? `?month=${encodeURIComponent(month)}` : ''}`);
            $('faMonth').innerHTML = state.data.months.map(m => `<option value="${m}" ${m === state.data.month ? 'selected' : ''}>${m}</option>`).join('');
            const links = state.data.links;
            if (links) { $('faSheetLink').href = links.sheet; $('faFolderLink').href = links.folder; $('faSheetLink').hidden = $('faFolderLink').hidden = false; }
            renderLock();
            $('faUpdated').textContent = `· อัปเดต ${new Date().toLocaleTimeString('th-TH')}`;
            render();
        } catch (error) {
            $('faRows').innerHTML = `<tr><td colspan="9" class="fa-empty">${esc(error.message)}</td></tr>`;
            $('faLock').textContent = 'สถานะระบบไม่ทราบ';
        }
    }
    function renderLock() {
        const locked = state.data.locked;
        $('faLock').textContent = locked ? '🔒 ปิดรับพนักงานอยู่ — กดเพื่อเปิด' : '🔓 เปิดรับพนักงานอยู่ — กดเพื่อปิด';
        $('faLock').className = `fa-btn ${locked ? 'is-locked' : 'is-open'}`;
    }
    function filtered() {
        const status = $('faStatus').value;
        const query = $('faSearch').value.trim().toLowerCase();
        return state.data.forms.filter(f => (!state.type || f.form_type === state.type)
            && (!status || (status === 'complete' ? f.complete : status === 'incomplete' ? !f.complete : f.review_status === status))
            && (!query || [f.fullname, f.employee_id, f.company, f.insurance_code].some(v => String(v || '').toLowerCase().includes(query))));
    }
    function render() {
        const all = state.data.forms.filter(f => !state.type || f.form_type === state.type);
        const count = fn => all.filter(fn).length;
        $('faStats').innerHTML = [
            ['แบบฟอร์มทั้งหมด', all.length], ['ส่งครบแล้ว', count(f => f.complete)], ['รอตรวจ (ส่งครบ)', count(f => f.complete && f.review_status === 'pending')],
            ['ผ่าน', count(f => f.review_status === 'approved')], ['ไม่ผ่าน', count(f => f.review_status === 'rejected')], ['มีรูปที่ติดธงไม่ผ่าน', count(f => f.bad_images)]
        ].map(([label, value]) => `<div class="fa-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
        const rows = filtered();
        $('faRows').innerHTML = rows.length ? rows.map(f => {
            const req = f.required || { slots: 0, days: 0 };
            const bar = (n, max) => `<div class="fa-bar"><i class="${n >= max ? 'is-full' : ''}" style="width:${max ? Math.min(100, n / max * 100) : 0}%"></i></div>`;
            const [label, cls] = REVIEW[f.review_status] || REVIEW.pending;
            return `<tr>
                <td><b>${esc(f.fullname)}</b><small>${esc(f.employee_id)} · ${esc(f.company)}</small></td>
                <td><span class="fa-type">${esc(TYPE_LABEL[f.form_type] || f.form_type)}</span></td>
                <td>${f.images}/${req.slots}${bar(f.images, req.slots)}${f.bad_images ? `<small style="color:var(--fa-bad)">ติดธง ${f.bad_images} รูป</small>` : ''}</td>
                <td>${f.dates}/${req.days}${bar(f.dates, req.days)}</td>
                <td>${f.has_signature ? '✔' : '<span class="fa-badge dim">ยังไม่ลงชื่อ</span>'}</td>
                <td>${f.complete ? '<span class="fa-badge ok">ส่งครบ</span>' : '<span class="fa-badge dim">ยังไม่ครบ</span>'}</td>
                <td><span class="fa-badge ${cls}">${label}</span>${f.reviewed_by ? `<small>${esc(f.reviewed_by)}</small>` : ''}</td>
                <td><small>${when(f.updated_at)}</small></td>
                <td><button type="button" class="fa-btn fa-btn-primary" data-open="${f.id}">ตรวจ</button></td>
            </tr>`;
        }).join('') : '<tr><td colspan="9" class="fa-empty">ไม่มีแบบฟอร์มตามเงื่อนไข</td></tr>';
    }

    // ---------------------------------------------------------------- รูป (ดึงผ่าน authFetch เพราะต้องแนบสิทธิ์)
    function imageUrl(formId, slot, stamp) {
        const key = `${formId}/${slot}/${stamp}`;
        if (!state.images.has(key)) {
            state.images.set(key, window.authFetch(api(`/image/${formId}/${slot}`))
                .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
                .then(blob => URL.createObjectURL(blob))
                .catch(() => { state.images.delete(key); return ''; }));
        }
        return state.images.get(key);
    }
    function hydrate(root) {
        root.querySelectorAll('img[data-src]').forEach(async img => {
            const [formId, slot, stamp] = img.dataset.src.split('/');
            const src = await imageUrl(formId, slot, stamp);
            if (src) img.src = src; else img.replaceWith(Object.assign(document.createElement('div'), { className: 'fa-missing', textContent: 'เปิดรูปไม่ได้' }));
        });
    }

    // ---------------------------------------------------------------- รายละเอียด / ตรวจ
    function shot(form, slots, slot, caption) {
        const s = slots.get(slot);
        if (!s) return `<div class="fa-shot"><div class="fa-missing">${esc(caption)}: ยังไม่อัปโหลด</div></div>`;
        return `<div class="fa-shot ${s.review_flag || ''}" title="${esc(caption)} · อัปโหลด ${esc(when(s.uploaded_at))}">
            <img data-src="${form.id}/${slot}/${s.stamp}" data-zoom alt="${esc(caption)}">
            <div class="fa-flags"><button type="button" class="${s.review_flag === 'ok' ? 'on-ok' : ''}" data-flag="ok" data-slot="${slot}">ผ่าน</button><button type="button" class="${s.review_flag === 'bad' ? 'on-bad' : ''}" data-flag="bad" data-slot="${slot}">ไม่ผ่าน</button></div>
        </div>`;
    }
    async function openDetail(id) {
        try {
            const data = await request(`/forms/${id}`);
            state.detail = data;
            renderDetail();
            $('faDialog').showModal();
        } catch (error) { toast(error.message, true); }
    }
    function renderDetail() {
        const { form, slots: slotList, days: dayList } = state.detail;
        const req = form.required || { slots: 0, days: 0 };
        const slots = new Map(slotList.map(s => [s.slot, s]));
        const days = new Map(dayList.map(d => [d.day, d]));
        const label = form.form_type === 'ออกกำลังกายทั่วไป15ครั้ง' ? 'ครั้งที่' : 'วันที่';
        const dayCards = Array.from({ length: req.days }, (_, i) => {
            const d = days.get(i + 1) || {};
            const done = slots.has(i * 2 + 1) && slots.has(i * 2 + 2) && d.date;
            return `<article class="fa-day ${done ? 'is-done' : ''}"><header><b>${label} ${i + 1}</b><span>${esc(d.date || 'ยังไม่ระบุวันที่')}</span></header>
                ${req.details ? `<p>${esc(d.description || '—')}</p>` : ''}
                <div class="fa-shots">${shot(form, slots, i * 2 + 1, 'รูปที่ 1')}${shot(form, slots, i * 2 + 2, 'รูปที่ 2')}</div></article>`;
        }).join('');
        const bill = form.form_type === 'ค่าฟิตเนสรายเดือน' ? `<div><h3>🧾 ใบเสร็จค่าฟิตเนส</h3>${shot(form, slots, 31, 'ใบเสร็จ')}</div>` : '';
        const signature = form.has_signature
            ? `<div class="fa-shot" style="background:#fff"><img data-src="${form.id}/0/${form.signature_stamp}" data-zoom alt="ลายเซ็น" style="object-fit:contain"></div>`
            : '<div class="fa-shot"><div class="fa-missing">ยังไม่ลงชื่อ</div></div>';
        $('faDetail').innerHTML = `<div class="fa-detail-head">
                <div><h2>${esc(form.fullname)} · <span class="fa-type">${esc(TYPE_LABEL[form.form_type] || form.form_type)}</span></h2>
                <p>${esc(form.employee_id)} · ${esc(form.company)} · รหัสประกัน ${esc(form.insurance_code || '-')} · เดือน ${esc(form.month)} · ${form.completed_at ? `ส่งครบเมื่อ ${esc(when(form.completed_at))}` : 'ยังส่งไม่ครบ'}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </div>
            <div class="fa-detail-body">
                <section class="fa-review"><h3>ผลการตรวจ</h3>
                    <div class="fa-review-row">
                        ${Object.entries(REVIEW).map(([key, [text]]) => `<label><input type="radio" name="faReview" value="${key}" ${form.review_status === key ? 'checked' : ''}> ${text}</label>`).join('')}
                        <span style="flex:1"></span>
                        <button type="button" class="fa-btn fa-btn-primary" data-action="save-review">บันทึกผลตรวจ</button>
                    </div>
                    <textarea id="faReviewNote" placeholder="หมายเหตุ เช่น รูปวันที่ 3 ไม่ตรงวันที่">${esc(form.review_note)}</textarea>
                    ${form.reviewed_by ? `<small>ตรวจล่าสุดโดย ${esc(form.reviewed_by)} · ${esc(when(form.reviewed_at))}</small>` : ''}
                </section>
                <div class="fa-days">${dayCards}</div>
                <div class="fa-extra">${bill}<div><h3>✍️ ลายเซ็นรับรอง</h3>${signature}</div></div>
            </div>`;
        hydrate($('faDetail'));
    }

    $('faDetail').addEventListener('click', async event => {
        const t = event.target;
        if (t.closest('[data-close]')) return $('faDialog').close();
        const zoom = t.closest('img[data-zoom]');
        if (zoom && zoom.src) { $('faLightbox').querySelector('img').src = zoom.src; return $('faLightbox').showModal(); }
        const flag = t.closest('[data-flag]');
        if (flag) {
            const { form, slots } = state.detail;
            const slot = Number(flag.dataset.slot);
            const item = slots.find(s => s.slot === slot);
            const next = item.review_flag === flag.dataset.flag ? '' : flag.dataset.flag;
            try {
                await request(`/forms/${form.id}/slots/${slot}`, { method: 'PUT', body: JSON.stringify({ flag: next }) });
                item.review_flag = next;
                renderDetail();
            } catch (error) { toast(error.message, true); }
            return;
        }
        if (t.closest('[data-action="save-review"]')) {
            const status = document.querySelector('input[name="faReview"]:checked')?.value;
            if (!status) return toast('เลือกผลการตรวจก่อน', true);
            try {
                await request(`/forms/${state.detail.form.id}/review`, { method: 'PUT', body: JSON.stringify({ status, note: $('faReviewNote').value }) });
                toast('บันทึกผลตรวจแล้ว');
                $('faDialog').close();
                load();
            } catch (error) { toast(error.message, true); }
        }
    });
    $('faDialog').addEventListener('click', event => { if (event.target === $('faDialog')) $('faDialog').close(); });
    $('faLightbox').addEventListener('click', event => { if (event.target === $('faLightbox') || event.target.closest('[data-close-lightbox]')) $('faLightbox').close(); });

    // ---------------------------------------------------------------- แถบเครื่องมือ
    $('faRows').addEventListener('click', event => { const button = event.target.closest('[data-open]'); if (button) openDetail(button.dataset.open); });
    $('faTypeChips').addEventListener('click', event => {
        const button = event.target.closest('[data-type]'); if (!button) return;
        state.type = button.dataset.type;
        $('faTypeChips').querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === button));
        render();
    });
    $('faStatus').addEventListener('change', render);
    $('faSearch').addEventListener('input', render);
    $('faMonth').addEventListener('change', event => load(event.target.value));
    $('faPublicLink').href = publicUrl();

    const actions = {
        async 'copy-link'() {
            try { await navigator.clipboard.writeText(publicUrl()); toast('คัดลอกลิงก์แล้ว: ' + publicUrl()); }
            catch { prompt('คัดลอกลิงก์นี้ส่งให้พนักงาน', publicUrl()); }
        },
        async 'toggle-lock'() {
            const locked = !state.data?.locked;
            if (!confirm(locked ? 'ปิดรับการเข้าสู่ระบบของพนักงานชั่วคราว?' : 'เปิดรับการเข้าสู่ระบบของพนักงาน?')) return;
            const result = await request('/lock', { method: 'PUT', body: JSON.stringify({ locked }) });
            state.data.locked = result.locked;
            renderLock();
            toast(result.locked ? '🔒 ปิดระบบแล้ว' : '🔓 เปิดระบบแล้ว');
        },
        export() {
            const rows = filtered();
            const header = ['เดือน', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'บริษัท', 'รหัสประกัน', 'แบบฟอร์ม', 'รูป', 'วันที่', 'ลายเซ็น', 'สถานะส่ง', 'ผลตรวจ', 'หมายเหตุ', 'ผู้ตรวจ'];
            const cell = value => `"${String(value ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
            const lines = rows.map(f => [f.month, f.employee_id, f.fullname, f.company, f.insurance_code, TYPE_LABEL[f.form_type] || f.form_type,
                `${f.images}/${f.required?.slots}`, `${f.dates}/${f.required?.days}`, f.has_signature ? 'มี' : 'ไม่มี', f.complete ? 'ส่งครบ' : 'ยังไม่ครบ',
                (REVIEW[f.review_status] || REVIEW.pending)[0], f.review_note, f.reviewed_by].map(cell).join(','));
            const blob = new Blob(['﻿' + [header.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
            const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ออกกำลังกาย-${state.data?.month || ''}.csv` });
            document.body.append(link); link.click(); link.remove();
        }
    };
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button || !actions[button.dataset.action]) return;
        button.disabled = true;
        try { await actions[button.dataset.action](); } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    });

    load('');
})();
