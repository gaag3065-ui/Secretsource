// แจ้งเข้ารักษาจากพนักงาน (หน้าระบบจัดการองค์กร → หัวข้อ "แจ้งเข้ารักษาพยาบาล") → กล่องรับเรื่องในหน้าเปิดเคส
//   GA กด "รับเคสนี้" → ค้นหาพนักงาน + กรอกฟอร์มเปิดเคสให้ (วันเวลา สถานพยาบาล อาการ เบอร์ติดต่อ)
//   หลักฐานที่พนักงานแนบมาแล้วผูกเข้าเคสอัตโนมัติ (ไม่ต้องอัปโหลดรูปเปิดเคสซ้ำ) → บันทึกแล้วรายการเปลี่ยนเป็น "รับเรื่องแล้ว · เคส #"
//   เคสค่าใช้จ่ายสูง (เกิน 5,000 บาท ให้ประกันจ่ายตรง) → เด้งเตือนด่วน + เสียง
//   ปุ่มส่งข้อความแจ้งประกันผ่าน LINE / Telegram (เปิดหน้าต่างเลือกห้องพร้อมข้อความ แล้วกดส่งเอง)
(() => {
    const API = () => `${window.APP_CONFIG.API_BASE_URL}/api/ga-docs/intake`;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const state = { records: [], open: false, alerted: new Set(JSON.parse(localStorage.getItem('intakeAlerted') || '[]')) };
    window.__treatmentIntake = null;   // รายการที่กำลังเปิดเคส (recordtreatment.js ใช้ตอนบันทึก)

    const box = document.createElement('section');
    box.className = 'intake-box';
    box.innerHTML = '<button type="button" class="intake-head" data-intake-toggle><b>📥 พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ</b><span class="intake-count" id="intakeCount">…</span><span class="intake-caret">▾</span></button><div class="intake-list" id="intakeList" hidden></div>';
    const form = document.getElementById('claimForm');
    if (!form) return;
    // ส่วนแยกด้านบนสุดของหน้าเปิดเคส (เหนือการ์ดค้นหาข้อมูล) — แถบหัวเล็ก กดเพื่อกาง/พับตาราง
    const card = document.querySelector('.open-case-combined-card');
    box.classList.add('is-strip');
    if (card) card.before(box); else form.before(box);

    // รอรับเคส = ยังไม่มีเลขเคส (รวมรายการที่ถูกกดสถานะไปก่อนเปิดเคส)
    const pending = () => state.records.filter(r => !r.case_id && !['billed', 'deleted'].includes(r.status));
    const isAnnual = r => r.type === 'annual';
    const money = v => Number(v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    const val = (r, k) => r.fields?.[k] || '';
    // แพทเทิร์นเดิม: "wowmai285 เบอร์ 0892303860" (รายการเก่าที่กรอกช่องเดียวใช้ contact)
    const contactOf = r => val(r, 'contact') || [val(r, 'line_id'), val(r, 'phone') && `เบอร์ ${val(r, 'phone')}`].filter(Boolean).join(' ');
    const thDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '-'; };
    const when = text => text ? new Date(text).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '';

    async function load() {
        try {
            const response = await window.authFetch(`${API()}/list`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) { document.getElementById('intakeCount').textContent = response.status === 404 ? 'หลังบ้านยังไม่อัปเดต' : '—'; return; }
            state.records = data.records || [];
            render();
            alertUrgent();
        } catch { /* ออฟไลน์ชั่วคราว */ }
    }
    function render() {
        const list = pending().sort((a, b) => (b.urgent - a.urgent) || a.id - b.id);
        const urgent = list.filter(r => r.urgent).length;
        const count = document.getElementById('intakeCount');
        count.textContent = list.length ? `รอรับเคส ${list.length}${urgent ? ` · ด่วน ${urgent}` : ''}` : 'ไม่มีเรื่องค้าง';
        count.className = `intake-count${urgent ? ' is-urgent' : list.length ? ' is-wait' : ''}`;
        const recent = state.records.filter(r => r.case_id).slice(0, 5);
        document.getElementById('intakeList').innerHTML = (list.length ? `<table class="intake-table">
            <thead><tr><th>ประเภท</th><th>พนักงาน</th><th>วันที่</th><th>โรงพยาบาล / อาการ</th><th class="num">ยอด (฿)</th><th>ติดต่อ</th><th>เอกสาร</th><th>แจ้งเมื่อ</th><th></th></tr></thead>
            <tbody>${list.map(r => {
                const on = window.__treatmentIntake?.id === r.id;
                const annual = isAnnual(r);
                const date = annual ? thDate(val(r, 'check_date')) : `${thDate(val(r, 'treat_date'))} ${val(r, 'treat_time')}`.trim();
                const place = annual ? val(r, 'hospital') : [val(r, 'hospital'), val(r, 'symptom')].filter(Boolean).join(' · ');
                return `<tr class="${r.urgent ? 'is-urgent' : ''}${on ? ' is-on' : ''}">
                    <td><span class="intake-tag${annual ? ' is-annual' : r.urgent ? ' is-hot' : ''}">${annual ? 'ตรวจสุขภาพ' : r.urgent ? 'ด่วน >5,000' : 'เข้ารักษา'}</span></td>
                    <td><b>${esc(r.fullname)}</b><small>${esc(r.company || '')} · ${esc(r.insurance_code || r.employee_id || '')}</small></td>
                    <td class="nowrap">${esc(date || '-')}</td>
                    <td class="clip" title="${esc(place)}${val(r, 'note') ? ` — หมายเหตุ: ${esc(val(r, 'note'))}` : ''}">${esc(place || '-')}${val(r, 'note') ? ' <i class="intake-note" aria-label="มีหมายเหตุ">💬</i>' : ''}</td>
                    <td class="num">${annual ? esc(money(val(r, 'amount'))) : '-'}</td>
                    <td class="nowrap">${esc(contactOf(r) || '-')}</td>
                    <td>${r.files.length ? `<button type="button" class="intake-docbtn" data-intake-docs="${r.id}">📎 ${r.files.length}</button>` : '-'}</td>
                    <td class="nowrap muted">${esc(when(r.submitted_at))}</td>
                    <td><button type="button" class="intake-take" data-intake-take="${r.id}" title="ค้นหาพนักงานและกรอกฟอร์มเปิดเคสให้">${on ? '✓ กำลังเปิด' : 'รับเคส'}</button></td>
                </tr>
                <tr class="intake-docrow" data-docrow="${r.id}" hidden><td colspan="9"><div class="intake-files">${r.files.map(x => `<button type="button" data-intake-file="${r.id}/${x.n}" data-mime="${esc(x.mime)}">${esc(x.field_label)} ${x.index}</button>`).join('')}</div></td></tr>`;
            }).join('')}</tbody></table>` : '<p class="intake-empty">ไม่มีเรื่องรอรับเคส ✓</p>')
            + (recent.length ? `<p class="intake-recent">ล่าสุด: ${recent.map(r => `${esc(r.fullname)} ${r.case_id ? `→ เคส #${esc(r.case_id)}` : `(${esc(r.status_label)})`}`).join(' · ')}</p>` : '');
        if (urgent && !state.open) toggle(true);
    }
    function toggle(force) {
        state.open = force ?? !state.open;
        document.getElementById('intakeList').hidden = !state.open;
        box.classList.toggle('is-open', state.open);
    }

    // เคสด่วน (เกิน 5,000) ที่ยังไม่เคยเตือนในเครื่องนี้ → หน้าต่างเด้ง + เสียง
    function alertUrgent() {
        const fresh = pending().filter(r => r.urgent && !state.alerted.has(r.id));
        if (!fresh.length) return;
        fresh.forEach(r => state.alerted.add(r.id));
        localStorage.setItem('intakeAlerted', JSON.stringify([...state.alerted].slice(-200)));
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [0, .25, .5].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.value = .15; o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .18); });
        } catch { /* เบราว์เซอร์ไม่ให้เล่นเสียงก่อนผู้ใช้กด */ }
        const pop = document.createElement('div');
        pop.className = 'intake-alert';
        pop.innerHTML = `<div><h3>🚨 แจ้งเข้ารักษา ค่าใช้จ่ายสูง (ด่วน)</h3>
            ${fresh.map(r => `<p><b>${esc(r.fullname)}</b> · ${esc(val(r, 'treat_type'))} · ${esc(val(r, 'hospital'))}<br><small>${esc(thDate(val(r, 'treat_date')))} ${esc(val(r, 'treat_time'))} · อาการ: ${esc(val(r, 'symptom'))}</small></p>`).join('')}
            <p class="intake-meta">พนักงานแจ้งว่าค่าใช้จ่ายอาจเกิน 5,000 บาท — ประสานประกันให้จ่ายตรงก่อนพนักงานเข้ารักษา</p>
            <button type="button" data-intake-alert-ok>รับทราบ ไปที่รายการ</button></div>`;
        pop.addEventListener('click', event => { if (event.target.closest('[data-intake-alert-ok]') || event.target === pop) { pop.remove(); toggle(true); box.scrollIntoView({ behavior: 'smooth' }); } });
        document.body.append(pop);
    }

    // ---------------------------------------------------------------- รับเคส: ค้นหาพนักงาน + กรอกฟอร์ม
    const wait = ms => new Promise(r => setTimeout(r, ms));
    async function waitFor(fn, timeout = 8000) { const end = Date.now() + timeout; while (Date.now() < end) { const v = fn(); if (v) return v; await wait(150); } return null; }
    function setField(id, value) {
        const el = document.getElementById(id);
        if (!el || !value) return;
        el.disabled = false;
        if (el._flatpickr) el._flatpickr.setDate(value, true, id === 'manualDate' ? 'd/m/Y' : 'H:i');
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    async function take(id) {
        const r = state.records.find(x => x.id === Number(id));
        if (!r) return;
        const keyword = document.getElementById('keywordInput');
        if (!keyword || typeof performEmployeeSearch !== 'function') return alert('บัญชีนี้ไม่มีสิทธิ์ค้นหาพนักงาน — ค้นหาและกรอกเองได้');
        keyword.value = r.insurance_code || r.employee_id;
        performEmployeeSearch();
        const option = await waitFor(() => document.querySelector('#resultsList .employee-result-option'));
        if (!option) return alert(`ไม่พบพนักงาน ${r.fullname} (${keyword.value}) — ค้นหาด้วยชื่อแทนได้`);
        option.click();
        await waitFor(() => document.getElementById('hiddenInsuranceId')?.value);
        await wait(200);
        const [y, m, d] = String(val(r, isAnnual(r) ? 'check_date' : 'treat_date')).split('-');
        setField('manualDate', d ? `${d}/${m}/${y}` : '');
        setField('manualTime', val(r, 'treat_time'));   // ตรวจสุขภาพ: ไม่มีเวลา ให้ GA กรอกเอง
        const hospital = document.getElementById('hospitalSelect');
        if (hospital && val(r, 'hospital')) {
            hospital.disabled = false;
            const name = val(r, 'hospital');
            const match = [...hospital.options].find(o => o.value === name || o.textContent.trim() === name);
            if (!match) hospital.add(new Option(name, name));
            hospital.value = match ? match.value : name;
            hospital.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (isAnnual(r)) {
            setField('symptomsInput', 'ตรวจสุขภาพประจำปี 2026 (เบิกย้อนหลัง)');
            setField('contactInput', val(r, 'phone') ? `เบอร์ ${val(r, 'phone')}` : '');
            setField('notesInput', [`ส่งเอกสารผ่านระบบจัดการองค์กร เลขที่ ${r.id}`, `ยอดตามใบเสร็จ ${money(val(r, 'amount'))} บาท (หักวงเงินอื่นๆ ตอนปิดเคส)`, val(r, 'note')].filter(Boolean).join(' · '));
        } else {
            setField('symptomsInput', `${val(r, 'symptom')}${val(r, 'treat_type') ? ` (${val(r, 'treat_type')})` : ''}`);
            setField('contactInput', contactOf(r));
            setField('notesInput', [`แจ้งผ่านระบบจัดการองค์กร เลขที่ ${r.id}`, r.urgent ? 'ค่าใช้จ่ายอาจเกิน 5,000 บาท — ให้ประกันจ่ายตรง' : '', val(r, 'note')].filter(Boolean).join(' · '));
        }
        window.__treatmentIntake = { id: r.id, links: r.files.map(f => f.link).filter(Boolean), name: r.fullname };
        render();
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // หลังบันทึกเปิดเคสสำเร็จ (recordtreatment.js เรียก) → ผูกเลขเคสกับรายการแจ้ง
    window.TreatmentIntake = {
        async linkCase(caseId) {
            const intake = window.__treatmentIntake;
            if (!intake) return;
            window.__treatmentIntake = null;
            try {
                await window.authFetch(`${API()}/records/${intake.id}/case`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: String(caseId) }) });
            } catch { /* เปิดเคสแล้ว ผูกเลขไม่สำเร็จ — ไม่ขัดการทำงาน */ }
            load();
        }
    };

    async function openFile(ref, mime) {
        const [id, n] = ref.split('/');
        const win = /^image\//.test(mime) ? null : window.open('', '_blank');
        const response = await window.authFetch(`${API()}/file/${id}/${n}`);
        if (!response.ok) { if (win) win.close(); return alert('เปิดไฟล์ไม่ได้'); }
        const url = URL.createObjectURL(await response.blob());
        if (win) { win.location.href = url; return; }
        const view = document.createElement('div');
        view.className = 'intake-alert intake-viewer';
        view.innerHTML = `<img src="${url}" alt="">`;
        view.addEventListener('click', event => { if (event.target.tagName === 'IMG') event.target.classList.toggle('is-zoom'); else view.remove(); });
        document.body.append(view);
    }

    box.addEventListener('click', event => {
        if (event.target.closest('[data-intake-toggle]')) return toggle();
        const docs = event.target.closest('[data-intake-docs]');
        if (docs) { const row = box.querySelector(`[data-docrow="${docs.dataset.intakeDocs}"]`); if (row) row.hidden = !row.hidden; return; }
        const takeBtn = event.target.closest('[data-intake-take]');
        if (takeBtn) { takeBtn.disabled = true; take(takeBtn.dataset.intakeTake).finally(() => { takeBtn.disabled = false; }); return; }
        const file = event.target.closest('[data-intake-file]');
        if (file) openFile(file.dataset.intakeFile, file.dataset.mime);
    });

    // มาจากปุ่ม "เปิดเคส / แจ้งประกัน" ในหน้าจัดการพนักงาน → เปิดรายการและรับเคสนั้นเลย
    const wanted = new URLSearchParams(location.search).get('intake');
    load().then(() => {
        if (!wanted) return;
        toggle(true);
        if (pending().some(r => String(r.id) === wanted)) take(wanted);
    });
    setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
