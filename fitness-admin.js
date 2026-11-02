// หลังบ้าน "ออกกำลังกายและฟิตเนส 15 ครั้ง": รายการแบบฟอร์มของพนักงานรายเดือน → เปิดดูรูป/วันที่/ลายเซ็น → ตรวจรูปและให้ผลตรวจ
// ข้อมูลจาก /api/fitness/admin (สิทธิ์ ManageFitness) — ทั้งหมดเก็บบน Google Drive (ชีต "ฐานข้อมูลออกกำลังกาย")
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/fitness/admin${path}`;
    const TYPE_LABEL = { 'กิจกรรม30วัน': 'กิจกรรม 30 วัน', 'ออกกำลังกายทั่วไป15ครั้ง': 'ทั่วไป 15 ครั้ง', 'ค่าฟิตเนสรายเดือน': 'ฟิตเนสรายเดือน' };
    const REVIEW = { pending: ['รอตรวจ', 'wait'], approved: ['ผ่าน', 'ok'], rejected: ['ไม่ผ่าน', 'bad'] };
    // source: 'new' = ระบบใหม่ (ฐานข้อมูลบน Drive), 'legacy' = อ่านจากชีตรายคนของระบบเดิม (Apps Script)
    const state = { data: null, legacy: null, source: 'new', type: '', images: new Map(), detail: null };

    // หน้านี้เปิดตรง/ฝังใน iframe ได้โดยไม่ผ่านหน้าที่เก็บ csrfToken ไว้ → ขอจาก /api/session ก่อนส่ง POST ครั้งแรก
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
        if (state.source === 'legacy') return loadLegacy();
        try {
            state.data = await request(`/forms${month ? `?month=${encodeURIComponent(month)}` : ''}`);
            $('faMonth').innerHTML = state.data.months.map(m => `<option value="${m}" ${m === state.data.month ? 'selected' : ''}>${m}</option>`).join('');
            renderLock();
            $('faUpdated').textContent = `· อัปเดต ${new Date().toLocaleTimeString('th-TH')}`;
            render();
        } catch (error) {
            $('faRows').innerHTML = `<tr><td colspan="9" class="fa-empty">${esc(error.message)}</td></tr>`;
            $('faLock').textContent = 'สถานะระบบไม่ทราบ';
        }
    }
    async function loadLegacy(refresh = false) {
        $('faRows').innerHTML = '<tr><td colspan="9" class="fa-empty">กำลังอ่านชีตเดิม… (ครั้งแรกอาจใช้เวลาสักครู่)</td></tr>';
        try {
            state.legacy = await request(refresh ? '/legacy?refresh=1' : '/legacy');
            $('faSourceNote').innerHTML = 'ไฟล์ <a href="' + esc(state.legacy.url) + '" target="_blank" rel="noopener">' + esc(state.legacy.title) + ' ↗</a> · อ่านเมื่อ '
                + new Date(state.legacy.fetchedAt).toLocaleTimeString('th-TH') + ' · ไม่แก้ไฟล์เดิม ผลตรวจเก็บในชีตฐานข้อมูลใหม่';
            render();
        } catch (error) {
            state.legacy = null;
            $('faStats').innerHTML = '';
            $('faRows').innerHTML = '<tr><td colspan="9" class="fa-empty">' + esc(error.message) + '</td></tr>';
        }
    }
    const currentForms = () => (state.source === 'legacy' ? state.legacy?.forms : state.data?.forms) || [];
    function setSource(source) {
        state.source = source;
        $('faSource').querySelectorAll('[data-source]').forEach(b => b.classList.toggle('is-on', b.dataset.source === source));
        $('faMonthLabel').hidden = source === 'legacy';
        $('faReloadLegacy').hidden = source !== 'legacy';
        if (source === 'new') $('faSourceNote').textContent = '';
        if (source === 'legacy' && !state.legacy) loadLegacy(); else render();
    }

    function renderLock() {
        const locked = state.data.locked;
        $('faLock').textContent = locked ? '🔒 ปิดรับพนักงานอยู่ — กดเพื่อเปิด' : '🔓 เปิดรับพนักงานอยู่ — กดเพื่อปิด';
        $('faLock').className = `fa-btn ${locked ? 'is-locked' : 'is-open'}`;
    }
    function filtered() {
        const status = $('faStatus').value;
        const query = $('faSearch').value.trim().toLowerCase();
        const company = $('faCompany').value;
        return currentForms().filter(f => (!state.type || f.form_type === state.type) && (!company || f.company === company)
            && (!status || (status === 'complete' ? f.complete : status === 'incomplete' ? !f.complete : f.review_status === status))
            && (!query || [f.fullname, f.employee_id, f.company, f.insurance_code].some(v => String(v || '').toLowerCase().includes(query))));
    }
    // ฟิตเนสรายเดือนที่ผ่าน → ฟอร์มออกกำลังกายทั่วไป 15 ครั้งที่ระบบสร้างให้ (ใช้รูปเดียวกัน)
    function companionChip(f) {
        if (state.source === 'legacy') return '';
        if (f.form_type === 'ค่าฟิตเนสรายเดือน') {
            if (f.companion_id) return '<span class="fa-companion is-ok" title="ระบบสร้างแบบฟอร์มออกกำลังกายทั่วไป 15 ครั้งจากรูปชุดเดียวกันแล้ว">✓ สร้างฟอร์ม 15 ครั้งแล้ว</span>';
            if (f.review_status === 'approved' && f.companion_reason) return `<span class="fa-companion is-wait" title="${esc(f.companion_reason)}">ยังไม่สร้างฟอร์ม 15 ครั้ง</span>`;
            return '';
        }
        if (f.source_form_id) return `<span class="fa-companion ${f.source_ok ? 'is-ok' : 'is-wait'}" title="สร้างอัตโนมัติจากฟิตเนสรายเดือน แบบฟอร์มเลขที่ ${esc(f.source_form_id)}">สร้างจากฟิตเนสรายเดือน</span>`;
        return '';
    }
    function companionToast(result) {
        if (!result) return;
        if (result.created) toast('สร้างฟอร์มออกกำลังกายทั่วไป 15 ครั้งแล้ว (ใช้รูปชุดเดียวกัน)');
        else if (result.reason && document.querySelector('input[name="faReview"]:checked')?.value === 'approved') toast(`ยังไม่สร้างฟอร์ม 15 ครั้ง: ${result.reason}`, true);
    }

    function render() {
        // รายชื่อบริษัทในตัวกรอง = บริษัทที่มีในเดือนนี้ (คงค่าที่เลือกไว้)
        const companies = [...new Set(currentForms().map(f => f.company).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
        const picked = $('faCompany').value;
        $('faCompany').innerHTML = '<option value="">ทุกบริษัท</option>' + companies.map(c => `<option value="${esc(c)}" ${c === picked ? 'selected' : ''}>${esc(c)}</option>`).join('');
        const all = currentForms().filter(f => (!state.type || f.form_type === state.type) && (!$('faCompany').value || f.company === $('faCompany').value));
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
                <td><b>${esc(f.fullname)}</b><small>${esc(f.employee_id || f.insurance_code || '')} · ${esc(f.company)}</small></td>
                <td><span class="fa-type">${esc(TYPE_LABEL[f.form_type] || f.form_type)}</span></td>
                <td>${f.images}/${req.slots}${bar(f.images, req.slots)}${f.bad_images ? `<small style="color:var(--fa-bad)">ติดธง ${f.bad_images} รูป</small>` : ''}</td>
                <td>${f.dates}/${req.days}${bar(f.dates, req.days)}</td>
                <td>${f.has_signature ? '✔' : '<span class="fa-badge dim">ยังไม่ลงชื่อ</span>'}</td>
                <td>${f.complete ? '<span class="fa-badge ok">ส่งครบ</span>' : '<span class="fa-badge dim">ยังไม่ครบ</span>'}</td>
                <td><span class="fa-badge ${cls}">${label}</span>${companionChip(f)}${f.reviewed_by ? `<small>${esc(f.reviewed_by)}</small>` : ''}</td>
                <td><small>${state.source === 'legacy' ? esc(f.status_text || '-') : when(f.updated_at)}</small></td>
                <td><button type="button" class="fa-btn fa-btn-primary" data-open="${esc(state.source === 'legacy' ? f.key : f.id)}">ตรวจ</button></td>
            </tr>`;
        }).join('') : '<tr><td colspan="9" class="fa-empty">ไม่มีแบบฟอร์มตามเงื่อนไข</td></tr>';
    }

    // ---------------------------------------------------------------- รูป (ดึงผ่าน authFetch เพราะต้องแนบสิทธิ์)
    // key: "<เลขฟอร์ม>/<ช่อง>/<เวลา>" (ระบบใหม่) หรือ "L:<Drive file id>" (ชีตเดิม)
    function imageUrl(key) {
        if (!state.images.has(key)) {
            const path = key.startsWith('L:') ? '/legacy/image/' + encodeURIComponent(key.slice(2)) : '/image/' + key.split('/').slice(0, 2).join('/');
            state.images.set(key, window.authFetch(api(path))
                .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
                .then(blob => URL.createObjectURL(blob))
                .catch(() => { state.images.delete(key); return ''; }));
        }
        return state.images.get(key);
    }
    function hydrate(root) {
        root.querySelectorAll('img[data-src]').forEach(async img => {
            const src = await imageUrl(img.dataset.src);
            if (src) img.src = src; else img.replaceWith(Object.assign(document.createElement('div'), { className: 'fa-missing', textContent: 'เปิดรูปไม่ได้' }));
        });
    }

    // ---------------------------------------------------------------- รายละเอียด / ตรวจ
    // ปุ่มเปลี่ยนรูป: อัปโหลดแทนในแบบฟอร์มเดียวกับที่พนักงานส่ง (พนักงานเห็นรูปใหม่ด้วย)
    const replaceButton = (slot, text) => state.source === 'legacy' ? ''
        : `<label class="fa-replace" title="${esc(text)}">${esc(text)}<input type="file" accept="image/jpeg,image/png,image/webp" data-replace="${slot}"></label>`;
    function shot(form, slots, slot, caption) {
        const s = slots.get(slot);
        if (!s) return `<div class="fa-shot"><div class="fa-missing">${esc(caption)}: ยังไม่อัปโหลด</div>${replaceButton(slot, '＋ อัปโหลดรูป')}</div>`;
        return `<div class="fa-shot ${s.review_flag || ''}" title="${esc(caption)} · อัปโหลด ${esc(when(s.uploaded_at))}">
            <img data-src="${esc(s.file_id ? 'L:' + s.file_id : form.id + '/' + slot + '/' + s.stamp)}" data-zoom alt="${esc(caption)}">
            ${replaceButton(slot, '⟳ เปลี่ยนรูป')}
            <div class="fa-flags"><button type="button" class="${s.review_flag === 'ok' ? 'on-ok' : ''}" data-flag="ok" data-slot="${slot}">ผ่าน</button><button type="button" class="${s.review_flag === 'bad' ? 'on-bad' : ''}" data-flag="bad" data-slot="${slot}">ไม่ผ่าน</button></div>
        </div>`;
    }
    async function openDetail(id) {
        try {
            const data = await request(state.source === 'legacy' ? '/legacy/form?key=' + encodeURIComponent(id) : '/forms/' + id);
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
        const dayCards = Array.from({ length: req.maxDays || req.days }, (_, i) => {
            const d = days.get(i + 1) || {};
            const done = slots.has(i * 2 + 1) && slots.has(i * 2 + 2) && d.date;
            const iso = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.date || '');
            const dateCell = state.source === 'legacy'
                ? `<span>${esc(d.date || 'ยังไม่ระบุวันที่')}</span>`
                : `<input type="date" class="fa-date-input" data-day="${i + 1}" value="${iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : ''}" title="แก้วันที่ ${label} ${i + 1}">`;
            return `<article class="fa-day ${done ? 'is-done' : ''}"><header><b>${label} ${i + 1}</b>${dateCell}</header>
                ${req.details ? `<p>${esc(d.description || '—')}</p>` : ''}
                <div class="fa-shots">${shot(form, slots, i * 2 + 1, 'รูปที่ 1')}${shot(form, slots, i * 2 + 2, 'รูปที่ 2')}</div></article>`;
        }).join('');
        // ใบเสร็จ + ยอดตามบิล (ผู้ดูแลแก้ได้ — เบิกได้ไม่เกิน 1,500 บาท)
        const billAmount = form.bill_amount ? Number(form.bill_amount) : '';
        const bill = form.form_type === 'ค่าฟิตเนสรายเดือน' ? `<div><h3>🧾 ใบเสร็จค่าฟิตเนส</h3>${shot(form, slots, req.billSlot || 31, 'ใบเสร็จ')}${state.source === 'legacy' ? '' : `<label class="fa-bill">ยอดตามบิล (บาท) <input id="faBillAmount" type="number" min="0" step="0.01" value="${esc(billAmount)}"> <button type="button" class="fa-btn fa-btn-ghost" data-action="save-bill">บันทึกยอด</button></label><small class="fa-bill-pay">เบิกได้ ${billAmount ? Math.min(billAmount, 1500).toLocaleString('th-TH') : '-'} บาท (ตามบิล ไม่เกิน 1,500)</small>`}</div>` : '';
        const signature = form.has_signature
            ? `<div class="fa-shot" style="background:#fff"><img data-src="${esc(form.signature ? 'L:' + form.signature : form.id + '/0/' + form.signature_stamp)}" data-zoom alt="ลายเซ็น" style="object-fit:contain"></div>`
            : '<div class="fa-shot"><div class="fa-missing">ยังไม่ลงชื่อ</div></div>';
        $('faDetail').innerHTML = `<div class="fa-detail-head">
                <div><h2>${esc(form.fullname)} · <span class="fa-type">${esc(TYPE_LABEL[form.form_type] || form.form_type)}</span></h2>
                <p>${state.source === 'legacy'
                    ? 'ข้อมูลจากชีตเดิม "' + esc(form.key) + '" · ' + esc(form.company) + ' · รหัสประกัน ' + esc(form.insurance_code || '-') + ' · ' + esc(form.status_text || '') + ' · ' + (form.complete ? 'ส่งครบ' : 'ยังส่งไม่ครบ')
                    : `${esc(form.employee_id)} · ${esc(form.company)} · รหัสประกัน ${esc(form.insurance_code || '-')} · เดือน ${esc(form.month)} · ${form.completed_at ? `ส่งครบเมื่อ ${esc(when(form.completed_at))}` : 'ยังส่งไม่ครบ'}`}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </div>
            <div class="fa-detail-body">
                <section class="fa-review"><h3>ผลการตรวจ</h3>
                    <div class="fa-review-row">
                        ${Object.entries(REVIEW).map(([key, [text]]) => `<label><input type="radio" name="faReview" value="${key}" ${form.review_status === key ? 'checked' : ''}> ${text}${key === 'approved' ? companionChip(form) : ''}</label>`).join('')}
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
                const result = await (state.source === 'legacy'
                    ? request('/legacy/flag', { method: 'PUT', body: JSON.stringify({ key: form.key, slot, flag: next }) })
                    : request(`/forms/${form.id}/slots/${slot}`, { method: 'PUT', body: JSON.stringify({ flag: next }) }));
                item.review_flag = next;
                if (result.companion?.created && !form.companion_id) { form.companion_id = result.companion.id; companionToast(result.companion); load(); }
                if (result.companion && !result.companion.created && form.companion_id) { form.companion_id = null; form.companion_reason = result.companion.reason; load(); }
                renderDetail();
            } catch (error) { toast(error.message, true); }
            return;
        }
        if (t.closest('[data-action="save-bill"]')) {
            try {
                const form = state.detail.form, amount = $('faBillAmount').value;
                await request(`/forms/${form.id}/bill-amount`, { method: 'PUT', body: JSON.stringify({ amount }) });
                form.bill_amount = amount;
                toast('บันทึกยอดบิลแล้ว');
                renderDetail();
                load();
            } catch (error) { toast(error.message, true); }
            return;
        }
        if (t.closest('[data-action="save-review"]')) {
            const status = document.querySelector('input[name="faReview"]:checked')?.value;
            if (!status) return toast('เลือกผลการตรวจก่อน', true);
            try {
                const form = state.detail.form, note = $('faReviewNote').value;
                const result = await (state.source === 'legacy'
                    ? request('/legacy/review', { method: 'PUT', body: JSON.stringify({ key: form.key, status, note }) })
                    : request(`/forms/${form.id}/review`, { method: 'PUT', body: JSON.stringify({ status, note }) }));
                toast('บันทึกผลตรวจแล้ว');
                companionToast(result.companion);
                $('faDialog').close();
                load();
            } catch (error) { toast(error.message, true); }
        }
    });
    // ย่อรูปด้านยาวไม่เกิน 1600px เป็น JPEG ก่อนส่ง (หลังบ้านรับไม่เกิน 6 MB)
    async function shrinkImage(file) {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        return canvas.toDataURL('image/jpeg', 0.88);
    }
    $('faDetail').addEventListener('change', async event => {
        const t = event.target;
        const form = state.detail?.form;
        if (!form || state.source === 'legacy') return;
        if (t.matches('.fa-date-input')) {
            if (!t.value) return;
            t.disabled = true;
            try {
                const result = await request(`/forms/${form.id}/days/${t.dataset.day}`, { method: 'PUT', body: JSON.stringify({ date: t.value }) });
                const day = Number(t.dataset.day);
                const item = state.detail.days.find(d => d.day === day);
                if (item) item.date = result.date; else state.detail.days.push({ day, date: result.date, description: '' });
                toast(`บันทึกวันที่ ${result.date} แล้ว`);
                renderDetail(); load();
            } catch (error) { toast(error.message, true); renderDetail(); }
            return;
        }
        const input = t.closest('[data-replace]');
        if (input && input.files[0]) {
            const slot = Number(input.dataset.replace);
            const file = input.files[0];
            input.value = '';
            if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return toast('รูป HEIC ต้องแปลงเป็น JPG ก่อน', true);
            if (!confirm(`เปลี่ยนรูปตำแหน่งที่ ${slot} ของ ${form.fullname}?
รูปเดิมจะถูกย้ายไปถังขยะ Google Drive และผลตรวจรูปนี้จะเริ่มใหม่`)) return;
            toast('กำลังอัปโหลดรูป…');
            try {
                const image = await shrinkImage(file);
                const result = await request(`/forms/${form.id}/images/${slot}`, { method: 'PUT', body: JSON.stringify({ image }) });
                const list = state.detail.slots;
                const item = list.find(s => s.slot === slot);
                const next = { slot, uploaded_at: result.uploaded_at, stamp: result.stamp, review_flag: '', review_note: '' };
                if (item) Object.assign(item, next); else list.push(next);
                toast('เปลี่ยนรูปแล้ว');
                renderDetail(); load();
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
    // ข้อมูลระบบเดิมนำเข้าฐานข้อมูลใหม่แล้ว — ไม่มีปุ่มสลับไปอ่านชีตเดิมอีก
    $('faSource')?.addEventListener('click', event => { const button = event.target.closest('[data-source]'); if (button) setSource(button.dataset.source); });
    $('faStatus').addEventListener('change', render);
    $('faCompany').addEventListener('change', render);
    $('faSearch').addEventListener('input', render);
    $('faMonth').addEventListener('change', event => load(event.target.value));
    $('faPublicLink').href = publicUrl();

    const actions = {
        async 'toggle-lock'() {
            const locked = !state.data?.locked;
            if (!confirm(locked ? 'ปิดรับการเข้าสู่ระบบของพนักงานชั่วคราว?' : 'เปิดรับการเข้าสู่ระบบของพนักงาน?')) return;
            const result = await request('/lock', { method: 'PUT', body: JSON.stringify({ locked }) });
            state.data.locked = result.locked;
            renderLock();
            toast(result.locked ? '🔒 ปิดระบบแล้ว' : '🔓 เปิดระบบแล้ว');
        },
        'reload-legacy'() { return loadLegacy(true); },
        'export-pdf'() { return chooseExport('pdf'); },
        'export-xlsx'() { return chooseExport('xlsx'); }
    };
    // ดาวน์โหลด PDF/XLSX ของรายการที่แสดงอยู่: หลังบ้านสร้างไฟล์เบื้องหลัง (ดึงรูปจาก Drive) แล้วหน้าเว็บถามความคืบหน้าทุก 2 วินาที
    // ผู้จัดเตรียมเอกสาร (ใบปะหน้า): รูปลายเซ็น + วันที่ — จำลายเซ็นไว้ในเครื่องนี้ ไม่ต้องแนบใหม่ทุกครั้ง
    const PREP_KEY = 'fitnessPreparerSignature';
    const preparer = { signature: '' };
    try { preparer.signature = localStorage.getItem(PREP_KEY) || ''; } catch { /* ไม่มีที่เก็บก็แนบใหม่ได้ */ }
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    function renderPreparer() {
        const box = $('faPrepPreview');
        box.replaceChildren();
        if (preparer.signature) box.append(Object.assign(document.createElement('img'), { src: preparer.signature, alt: 'ลายเซ็นผู้จัดเตรียมเอกสาร' }));
        else box.textContent = '+ แนบรูปลายเซ็น';
        $('faPrepClear').hidden = !preparer.signature;
    }
    // ย่อรูปลายเซ็นให้กว้างไม่เกิน 800px (PNG คงพื้นโปร่งใส) เพื่อให้ส่งไปหลังบ้านได้เร็ว
    function shrinkSignature(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 800 / img.width, 400 / img.height);
                const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดรูปลายเซ็นไม่ได้')); };
            img.src = url;
        });
    }
    $('faPrepSign').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            preparer.signature = await shrinkSignature(file);
            try { localStorage.setItem(PREP_KEY, preparer.signature); } catch { /* เก็บไม่ได้ก็ใช้ครั้งนี้ */ }
            renderPreparer();
        } catch (error) { toast(error.message, true); }
    });
    $('faPrepClear').addEventListener('click', () => {
        preparer.signature = '';
        try { localStorage.removeItem(PREP_KEY); } catch { /* ไม่เป็นไร */ }
        renderPreparer();
    });
    const preparerPayload = () => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec($('faPrepDate').value || '');
        return { signature: preparer.signature, date: m ? `${m[3]}/${m[2]}/${m[1]}` : '' };
    };

    // เลือกสิ่งที่จะดาวน์โหลด: ใบปะหน้า / เอกสารรายคน / ทั้งคู่
    function chooseExport(format) {
        const rows = filtered();
        if (!rows.length) return toast('ไม่มีแบบฟอร์มในรายการ', true);
        const dialog = $('faExportDialog');
        $('faExportTitle').textContent = `ดาวน์โหลด ${format.toUpperCase()}`;
        $('faExportInfo').textContent = `ตามรายการที่แสดงอยู่ ${rows.length} แบบฟอร์ม${$('faCompany').value ? ` · บริษัท ${$('faCompany').value}` : ''}`;
        if (!$('faPrepDate').value) $('faPrepDate').value = today();
        renderPreparer();
        // ไม่พึ่งเหตุการณ์ close ของ dialog (บางเบราว์เซอร์ไม่ส่ง) — จัดการที่การกดปุ่มโดยตรง
        dialog.onclick = event => {
            if (event.target.closest('.fa-preparer')) return;
            const button = event.target.closest('button[value]');
            if (!button) { if (event.target === dialog) dialog.close(); return; }
            event.preventDefault();
            dialog.close();
            if (button.value) exportFile(format, button.value);
        };
        dialog.showModal();
    }
    async function exportFile(format, part = 'forms') {
        const rows = filtered();
        if (!rows.length) return toast('ไม่มีแบบฟอร์มในรายการ', true);
        if (rows.length > 80) return toast('ดาวน์โหลดได้ครั้งละไม่เกิน 80 แบบฟอร์ม — กรองรายการให้น้อยลงก่อน', true);
        const legacy = state.source === 'legacy';
        const label = legacy ? 'ชีตเดิม' : state.data?.month || '';
        const company = $('faCompany').value ? `-${$('faCompany').value}` : '';
        const prefix = part === 'cover' ? 'ใบปะหน้า-ออกกำลังกาย' : part === 'both' ? 'ใบปะหน้าและเอกสาร-ออกกำลังกาย' : 'ออกกำลังกาย';
        const name = rows.length === 1 && part === 'forms' ? `${prefix}-${rows[0].fullname}-${label}` : `${prefix}-${label}${company}-${rows.length}คน`;
        const busy = (title, text, pct) => { $('faBusy').hidden = !title; if (title) { $('faBusyTitle').textContent = title; $('faBusyText').textContent = text || ''; $('faBusyBar').style.width = (pct || 0) + '%'; } };
        busy(`กำลังสร้าง ${format.toUpperCase()}…`, `${rows.length} แบบฟอร์ม`, 2);
        try {
            let { job } = await request('/export', { method: 'POST', body: JSON.stringify({ format, part, company: $('faCompany').value, source: state.source, ids: rows.map(f => legacy ? f.key : f.id), name, preparer: part === 'forms' ? null : preparerPayload() }) });
            while (job.status === 'running') {
                await new Promise(r => setTimeout(r, 2000));
                ({ job } = await request(`/export/${job.id}`));
                const pct = job.total ? Math.round(job.done / job.total * 90) : 5;
                busy(`กำลังสร้าง ${format.toUpperCase()}…`, `${job.stage} ${job.total ? `(รูป ${job.done}/${job.total})` : ''}`, job.status === 'running' && job.done >= job.total && job.total ? 95 : pct);
            }
            if (job.status !== 'done') throw new Error(job.error || 'สร้างไฟล์ไม่สำเร็จ');
            // ไฟล์ที่มีรูปหลายร้อยรูปใหญ่หลายสิบ MB — แสดงความคืบหน้าระหว่างรับไฟล์จากเครื่องหลังบ้าน
            busy(`กำลังดาวน์โหลด ${format.toUpperCase()}…`, 'สร้างไฟล์เสร็จแล้ว กำลังส่งไฟล์มาที่เครื่องนี้…', 96);
            const response = await window.authFetch(api(`/export/${job.id}/file`));
            if (!response.ok) throw new Error('ดาวน์โหลดไฟล์ไม่สำเร็จ');
            const size = Number(response.headers.get('content-length')) || 0;
            const mb = n => (n / 1048576).toFixed(1);
            const chunks = [];
            let received = 0;
            const reader = response.body?.getReader();
            if (reader) {
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value); received += value.length;
                    busy(`กำลังดาวน์โหลด ${format.toUpperCase()}…`, size ? `${mb(received)} / ${mb(size)} MB` : `${mb(received)} MB`, size ? Math.round(received / size * 100) : 97);
                }
            }
            const blob = reader ? new Blob(chunks, { type: response.headers.get('content-type') || '' }) : await response.blob();
            const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: job.name });
            document.body.append(link); link.click(); link.remove();
            toast(`ดาวน์โหลด ${job.name} แล้ว${job.missing ? ` (เปิดรูปไม่ได้ ${job.missing} รูป)` : ''}`);
        } finally { busy(''); }
    }

    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-action]');
        if (!button || !actions[button.dataset.action]) return;
        button.disabled = true;
        try { await actions[button.dataset.action](); } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    });

    load('');
})();
