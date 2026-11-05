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
    // ปุ่มลูกกลมลอยมุมขวาล่าง (มีตัวเลขเรื่องค้าง) → กดแล้วขยายเป็นแผงรายการ
    box.innerHTML = `<button type="button" class="intake-fab" data-intake-toggle aria-label="พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ" title="พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ">
            <span class="intake-fab-icon" aria-hidden="true">📥</span><span class="intake-fab-badge" id="intakeFabBadge" hidden>0</span></button>
        <div class="intake-panel" role="dialog" aria-label="พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ">
            <header class="intake-panel-head"><div><b>📥 พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ</b><span class="intake-count" id="intakeCount">…</span></div>
                <span class="intake-head-actions"><button type="button" class="intake-bulk-btn" data-bulk-toggle>📢 ส่งข้อความแบบหมู่</button>
                <button type="button" class="intake-close" data-intake-toggle aria-label="ปิด">×</button></span></header>
            <div class="intake-bulk" id="intakeBulk" hidden></div>
            <div class="intake-list" id="intakeList"></div>
        </div>`;
    const form = document.getElementById('claimForm');
    if (!form) return;
    box.classList.add('is-fab');
    document.body.append(box);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && state.open) toggle(false); });
    document.addEventListener('click', event => { if (state.open && event.target.isConnected && !box.contains(event.target) && !event.target.closest('.intake-viewer, .intake-alert')) toggle(false); });

    // รอรับเคส = ยังไม่มีเลขเคส (รวมรายการที่ถูกกดสถานะไปก่อนเปิดเคส)
    const pending = () => state.records.filter(r => r.type !== 'medical' && !r.case_id && !['billed', 'deleted'].includes(r.status));
    const isAnnual = r => r.type === 'annual';
    // สถานะสำเร็จรูปที่ GA เลือกแจ้งกลับให้พนักงาน
    const NOTICES = r => isAnnual(r)
        ? [`เปิดเคส #${r.case_id} แล้ว — ส่งเรื่องให้ประกันพิจารณาเบิก`, 'เอกสารครบ ส่งเบิกประกันเรียบร้อย รอประกันโอนเงินคืน', 'เอกสารไม่ครบ กรุณาส่งเอกสารเพิ่ม / ติดต่อ GA']
        : ['แจ้งประกันเรียบร้อย เข้ารักษาตามเวลาที่แจ้งได้เลย', 'แจ้งประกันเรียบร้อย ประกันจ่ายตรงกับโรงพยาบาล ไม่ต้องสำรองจ่าย', 'แจ้งประกันแล้ว รอประกันตอบกลับ — GA จะแจ้งอีกครั้ง', 'กรุณาติดต่อ GA ด่วน'];
    // ---------------------------------------------------------------- ส่งข้อความแบบหมู่ (เลือกคน + เลือกแพทเทิร์น)
    const BULK_PATTERNS = [
        'เอกสารไม่ครบ กรุณาอัปโหลดเอกสารเพิ่มในระบบจัดการองค์กร (รายการเดิม)',
        'รูปใบเสร็จ / ใบรับรองแพทย์ไม่ชัด กรุณาถ่ายใหม่ให้เห็นชัดทั้งใบ แล้วส่งอีกครั้ง',
        'ข้อมูลบัญชีรับเงินคืนไม่ถูกต้อง กรุณาตรวจสอบเลขบัญชี / ชื่อบัญชี แล้วแจ้ง GA',
        'กรุณาเก็บบิลตัวจริงไว้ GA จะเรียกเก็บภายหลัง',
        'กรุณาติดต่อ GA ด่วน'
    ];
    const bulk = { filter: 'all', picks: new Set() };
    const catOf = r => r.type === 'medical' ? 'bill' : isAnnual(r) ? 'annual' : !r.case_id ? 'pending' : 'opened';
    const CATS = { all: 'ทั้งหมด', pending: 'รอรับเคส', opened: 'เปิดเคสแล้ว', bill: 'ส่งบิลแล้ว', annual: 'ตรวจสุขภาพ' };
    function bulkPeople() {
        const latest = new Map();
        state.records.filter(r => r.status !== 'deleted').forEach(r => {
            const key = String(r.employee_id || r.insurance_code || '').toUpperCase();
            if (key && (!latest.has(key) || latest.get(key).id < r.id)) latest.set(key, r);
        });
        return [...latest.entries()].map(([key, r]) => ({ key, r, cat: catOf(r) })).sort((a, b) => b.r.id - a.r.id);
    }
    function renderBulk() {
        const el = document.getElementById('intakeBulk');
        const people = bulkPeople();
        const shown = people.filter(p => bulk.filter === 'all' || p.cat === bulk.filter);
        el.innerHTML = `
            <div class="ib-row ib-chips">${Object.entries(CATS).map(([k, v]) => `<button type="button" class="ib-chip${bulk.filter === k ? ' is-on' : ''}" data-bulk-filter="${k}">${v} (${k === 'all' ? people.length : people.filter(p => p.cat === k).length})</button>`).join('')}
                <span class="ib-gap"></span><button type="button" class="ib-link" data-bulk-all>เลือกทั้งหมดที่แสดง</button><button type="button" class="ib-link" data-bulk-none>ล้าง</button></div>
            <div class="ib-people">${shown.map(p => `<label class="ib-person"><input type="checkbox" data-bulk-pick="${esc(p.key)}" ${bulk.picks.has(p.key) ? 'checked' : ''}>
                <b>${esc(p.r.fullname)}</b><small>${esc(CATS[p.cat])} · เลขที่ ${p.r.id}${p.r.case_id ? ` · เคส #${esc(p.r.case_id)}` : ''}</small></label>`).join('') || '<p class="intake-empty">ไม่มีรายชื่อ</p>'}</div>
            <div class="ib-row"><select data-bulk-pattern><option value="">— เลือกแพทเทิร์นข้อความ —</option>${BULK_PATTERNS.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
            <textarea class="ib-text" data-bulk-text rows="2" maxlength="300" placeholder="ข้อความที่จะแจ้งพนักงาน (เลือกแพทเทิร์นด้านบน หรือพิมพ์เอง)"></textarea>
            <div class="ib-row ib-opts">
                <label><input type="checkbox" checked disabled> แจ้งในหน้าระบบจัดการองค์กร (🔔 + สถานะ)</label>
                <label title="บิลค่ารักษา / ตรวจสุขภาพ: พนักงานเห็นปุ่ม '＋ ส่งเอกสารเพิ่ม' ที่รายการเดิม"><input type="checkbox" data-bulk-more> ขอเอกสารเพิ่มในรายการเดิม</label>
                <label title="ส่งผ่านคิว LINE OA ถึงห้องแชทที่จับคู่กับพนักงานไว้แล้ว (สิทธิ์ ส่งข้อความ LINE แบบหมู่)"><input type="checkbox" data-bulk-line> ส่ง LINE ด้วย</label>
                <span class="ib-gap"></span><span class="ib-count">เลือก ${bulk.picks.size} คน</span>
                <button type="button" class="intake-take" data-bulk-send>ส่งข้อความ</button></div>
            <p class="ib-msg" data-bulk-msg></p>`;
    }
    async function sendBulk(button) {
        const el = document.getElementById('intakeBulk');
        const text = el.querySelector('[data-bulk-text]').value.trim();
        const out = el.querySelector('[data-bulk-msg]');
        if (!bulk.picks.size) { out.textContent = 'กรุณาเลือกพนักงานอย่างน้อย 1 คน'; return; }
        if (!text) { out.textContent = 'กรุณาเลือกแพทเทิร์นหรือพิมพ์ข้อความ'; return; }
        const people = bulkPeople().filter(p => bulk.picks.has(p.key));
        const more = el.querySelector('[data-bulk-more]').checked;
        const viaLine = el.querySelector('[data-bulk-line]').checked;
        if (!confirm(`ส่งข้อความถึงพนักงาน ${people.length} คน?\n\n"${text}"${viaLine ? '\n\n(ส่ง LINE ด้วย)' : ''}`)) return;
        button.disabled = true;
        let ok = 0; const failed = [];
        for (const p of people) {
            out.textContent = `กำลังแจ้งในหน้าเว็บ ${ok + failed.length + 1}/${people.length}…`;
            try {
                const res = await window.authFetch(`${API()}/records/${p.r.id}/notice`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, request_more: more }) });
                const d = await res.json().catch(() => ({}));
                if (!res.ok || d.success === false) throw new Error(d.message || 'ไม่สำเร็จ');
                ok++;
            } catch (error) { failed.push(`${p.r.fullname}: ${error.message}`); }
        }
        let lineNote = '';
        if (viaLine) {
            try {
                out.textContent = 'กำลังหาห้อง LINE ของพนักงาน…';
                const staffApi = path => `${window.APP_CONFIG.API_BASE_URL}/api/staff${path}`;
                const call = async (path, body) => { const res = await window.authFetch(staffApi(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const d = await res.json().catch(() => ({})); if (!res.ok || d.success === false) throw new Error(d.message || (res.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ส่ง LINE แบบหมู่' : 'ส่ง LINE ไม่สำเร็จ')); return d; };
                const { targets } = await call('/line-targets', { keys: people.map(p => p.key) });
                const ready = targets.filter(t => t.selected).map(t => ({ key: t.key, room: t.selected, roomName: (() => { const s = (t.suggestions || []).find(x => `${x.channelId}|${x.conversationId}` === t.selected); return s ? (s.customName || s.managerName || s.lineName || '') : ''; })() }));
                const result = ready.length ? await call('/line-broadcast', { text, targets: ready }) : { people: 0 };
                lineNote = ` · LINE ส่งแล้ว ${result.people || 0} คน${targets.length - ready.length ? ` (ยังไม่ได้จับคู่ห้อง LINE ${targets.length - ready.length} คน)` : ''}`;
            } catch (error) { lineNote = ` · LINE: ${error.message}`; }
        }
        out.textContent = `แจ้งในหน้าเว็บแล้ว ${ok} คน${lineNote}${failed.length ? ` · ไม่สำเร็จ ${failed.length}: ${failed.join(', ')}` : ''}`;
        button.disabled = false;
        if (ok) { bulk.picks.clear(); load(); }
    }
    async function sendNotice(id, button) {
        const pick = box.querySelector(`[data-notice-pick="${id}"]`);
        let message = pick?.value || '';
        if (message === '__custom') {
            const input = box.querySelector(`[data-notice-text="${id}"]`);
            message = (input?.value || '').trim();
            if (!message) { input?.focus(); return; }
        }
        if (!message) return;
        button.disabled = true;
        try {
            const response = await window.authFetch(`${API()}/records/${id}/notice`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.message || 'แจ้งสถานะไม่สำเร็จ');
            await load();
        } catch (error) { alert(error.message); button.disabled = false; }
    }
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
        const billWait = state.records.filter(r => r.type === 'medical' && ['pending', 'rejected', 'approved'].includes(r.status)).length;
        count.textContent = [list.length ? `รอรับเคส ${list.length}` : '', urgent ? `ด่วน ${urgent}` : '', billWait ? `บิลรอปิดเคส ${billWait}` : ''].filter(Boolean).join(' · ') || 'ไม่มีเรื่องค้าง';
        count.className = `intake-count${urgent ? ' is-urgent' : list.length || billWait ? ' is-wait' : ''}`;
        const fabBadge = document.getElementById('intakeFabBadge');
        fabBadge.textContent = list.length + billWait;
        fabBadge.hidden = !(list.length + billWait);
        box.classList.toggle('has-wait', Boolean(list.length + billWait));
        box.classList.toggle('has-urgent', Boolean(urgent));
        // เปิดเคสแล้ว (ยังไม่ส่งบิล) → GA เลือกสถานะแจ้งกลับให้พนักงาน
        const recent = state.records.filter(r => r.type !== 'medical' && r.case_id && !['billed', 'deleted', 'waiting', 'insurance', 'refunded', 'done'].includes(r.status)).slice(0, 15);
        // บิลค่ารักษาที่พนักงานส่งจากเคส → GA บันทึกลงเคส แล้วกด "ปิดเคสแล้ว"
        const bills = state.records.filter(r => r.type === 'medical' && ['pending', 'rejected', 'approved'].includes(r.status)).slice(0, 30);
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
            + (recent.length ? `<div class="intake-sub">✅ เปิดเคสแล้ว — แจ้งสถานะกลับให้พนักงาน <small>(พนักงานเห็นที่หน้าระบบจัดการองค์กร)</small></div>
            <table class="intake-table"><thead><tr><th>ประเภท</th><th>พนักงาน</th><th>เคส</th><th>สถานะที่พนักงานเห็นตอนนี้</th><th>แจ้งสถานะใหม่</th></tr></thead><tbody>
            ${recent.map(r => `<tr>
                <td><span class="intake-tag${isAnnual(r) ? ' is-annual' : ''}">${isAnnual(r) ? 'ตรวจสุขภาพ' : 'เข้ารักษา'}</span></td>
                <td><b>${esc(r.fullname)}</b><small>${esc(r.company || '')} · ${esc(r.insurance_code || r.employee_id || '')}</small></td>
                <td class="nowrap">#${esc(r.case_id)} <button type="button" class="intake-fixcase" data-fix-case="${r.id}" title="แก้เลขเคสที่ผูกกับเรื่องนี้">✏️</button></td>
                <td class="clip" title="${esc(r.admin_note || '')}">${esc(r.admin_note || '-')}</td>
                <td class="nowrap"><select data-notice-pick="${r.id}">${NOTICES(r).map(n => `<option>${esc(n)}</option>`).join('')}<option value="__custom">✏️ พิมพ์เอง…</option></select>
                    <input type="text" class="intake-notice-text" data-notice-text="${r.id}" maxlength="300" placeholder="พิมพ์ข้อความที่จะแจ้งพนักงาน" hidden>
                    <button type="button" class="intake-take" data-notice-send="${r.id}">แจ้ง</button>
                    <button type="button" class="intake-end" data-step="${r.id}" data-step-to="${isAnnual(r) ? 'insurance' : 'waiting'}" title="${isAnnual(r) ? 'จบงานนี้ — ส่งเบิกประกันแล้ว' : 'แจ้งพนักงานแล้ว ซ่อนไว้ — กลับมาแสดงเมื่อพนักงานส่งบิลค่ารักษา'}">สิ้นสุด</button></td>
            </tr>`).join('')}</tbody></table>` : '')
            + (bills.length ? `<div class="intake-sub is-bill">🧾 ส่งบิลค่ารักษาแล้ว — บันทึกยอดลงเคส แล้วกด "ปิดเคสแล้ว"</div>
            <table class="intake-table"><thead><tr><th>พนักงาน</th><th>เคส</th><th>ประเภทการรักษา</th><th>วันที่</th><th>โรงพยาบาล</th><th class="num">ยอด (฿)</th><th>รับเงิน</th><th>เอกสาร</th><th></th></tr></thead><tbody>
            ${bills.map(r => `<tr>
                <td><b>${esc(r.fullname)}</b><small>${esc(r.company || '')} · ${esc(r.insurance_code || r.employee_id || '')}</small></td>
                <td class="nowrap">#${esc(r.case_id)}</td>
                <td>${esc(val(r, 'treat_type') || '-')}</td>
                <td class="nowrap">${esc(thDate(val(r, 'treat_date')))}</td>
                <td class="clip">${esc(val(r, 'hospital') || '-')}</td>
                <td class="num">${esc(money(val(r, 'amount')))}</td>
                <td class="nowrap">${esc(val(r, 'pay') || '-')}${val(r, 'refund_account_no') ? `<small>${esc(val(r, 'refund_bank'))} ${esc(val(r, 'refund_account_no'))}</small>` : ''}</td>
                <td>${r.files.length ? `<button type="button" class="intake-docbtn" data-intake-docs="${r.id}">📎 ${r.files.length}</button>` : '-'}</td>
                <td><button type="button" class="intake-take" data-step="${r.id}" data-step-to="insurance" title="บันทึกยอดลงเคสในประวัติการรักษาแล้ว — ซ่อนจากรายการ (พนักงานเห็น 'รอประกันตรวจสอบและโอนเงินคืน')">ปิดเคสแล้ว</button></td>
            </tr>
            <tr class="intake-docrow" data-docrow="${r.id}" hidden><td colspan="9"><div class="intake-files">${r.files.map(x => `<button type="button" data-intake-file="${r.id}/${x.n}" data-mime="${esc(x.mime)}">${esc(x.field_label)} ${x.index}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table>` : '');
        if (urgent && !state.open) toggle(true);
    }
    function toggle(force) {
        state.open = force ?? !state.open;
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
        pop.addEventListener('click', event => { if (event.target.closest('[data-intake-alert-ok]') || event.target === pop) { pop.remove(); toggle(true); } });
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
        toggle(false);   // ปิดแผงให้เห็นฟอร์มเปิดเคส
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
            { const notes = document.getElementById('notesInput'); if (notes) notes.value = ''; }   // หมายเหตุเพิ่มเติม: ไม่กรอกข้อความให้ (GA กรอกเองถ้าต้องการ)
        } else {
            setField('symptomsInput', `${val(r, 'symptom')}${val(r, 'treat_type') ? ` (${val(r, 'treat_type')})` : ''}`);
            setField('contactInput', contactOf(r));
            { const notes = document.getElementById('notesInput'); if (notes) notes.value = ''; }   // หมายเหตุเพิ่มเติม: ไม่กรอกข้อความให้ (GA กรอกเองถ้าต้องการ)
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

    box.addEventListener('change', event => {
        const bp = event.target.closest('[data-bulk-pick]');
        if (bp) { if (bp.checked) bulk.picks.add(bp.dataset.bulkPick); else bulk.picks.delete(bp.dataset.bulkPick); box.querySelector('.ib-count').textContent = `เลือก ${bulk.picks.size} คน`; return; }
        const pattern = event.target.closest('[data-bulk-pattern]');
        if (pattern) { if (pattern.value) box.querySelector('[data-bulk-text]').value = pattern.value; box.querySelector('[data-bulk-more]').checked = /เอกสารไม่ครบ|ไม่ชัด/.test(pattern.value); return; }
        const pick = event.target.closest('[data-notice-pick]');
        if (!pick) return;
        const input = box.querySelector(`[data-notice-text="${pick.dataset.noticePick}"]`);
        if (input) { input.hidden = pick.value !== '__custom'; if (!input.hidden) input.focus(); }
    });
    box.addEventListener('keydown', event => {
        const input = event.target.closest('[data-notice-text]');
        if (input && event.key === 'Enter') { event.preventDefault(); box.querySelector(`[data-notice-send="${input.dataset.noticeText}"]`)?.click(); }
    });
    box.addEventListener('click', event => {
        if (event.target.closest('[data-intake-toggle]')) return toggle();
        if (event.target.closest('[data-bulk-toggle]')) { const el = document.getElementById('intakeBulk'); el.hidden = !el.hidden; if (!el.hidden) renderBulk(); return; }
        const bf = event.target.closest('[data-bulk-filter]');
        if (bf) { bulk.filter = bf.dataset.bulkFilter; return renderBulk(); }
        if (event.target.closest('[data-bulk-all]')) { bulkPeople().filter(p => bulk.filter === 'all' || p.cat === bulk.filter).forEach(p => bulk.picks.add(p.key)); return renderBulk(); }
        if (event.target.closest('[data-bulk-none]')) { bulk.picks.clear(); return renderBulk(); }
        const bs = event.target.closest('[data-bulk-send]');
        if (bs) return sendBulk(bs);
        const fix = event.target.closest('[data-fix-case]');
        if (fix) {
            const r = state.records.find(x => x.id === Number(fix.dataset.fixCase));
            const next = (prompt(`แก้เลขเคสของ ${r?.fullname || ''} (ตอนนี้ #${r?.case_id || '-'})\nใส่เลขเคสที่ถูกต้องจากประวัติการรักษา`, r?.case_id || '') || '').trim().replace(/^#/, '');
            if (!next || next === r?.case_id) return;
            fix.disabled = true;
            window.authFetch(`${API()}/records/${fix.dataset.fixCase}/case`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: next }) })
                .then(res => res.json().then(d => { if (!res.ok || d.success === false) throw new Error(d.message || 'แก้เลขเคสไม่สำเร็จ'); }))
                .then(load).catch(error => { alert(error.message); fix.disabled = false; });
            return;
        }
        const stepBtn = event.target.closest('[data-step]');
        if (stepBtn) {
            const r = state.records.find(x => x.id === Number(stepBtn.dataset.step));
            const msg = stepBtn.dataset.stepTo === 'waiting'
                ? `สิ้นสุดการแจ้งของ ${r?.fullname || ''} (เคส #${r?.case_id || '-'})?\n\nเรื่องนี้จะหายจากรายการ และกลับมาที่ "ส่งบิลค่ารักษาแล้ว" เมื่อพนักงานอัปโหลดบิลค่ารักษา`
                : `ยืนยัน${r?.type === 'medical' ? 'บันทึกบิลลงเคสแล้ว' : 'จบงาน'}ของ ${r?.fullname || ''} (เคส #${r?.case_id || '-'})?\n\nพนักงานจะเห็นสถานะ "รอประกันตรวจสอบและโอนเงินคืน"`;
            if (!confirm(msg)) return;
            stepBtn.disabled = true;
            window.authFetch(`${API()}/records/${stepBtn.dataset.step}/step`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: stepBtn.dataset.stepTo }) })
                .then(res => res.json().then(d => { if (!res.ok || d.success === false) throw new Error(d.message || 'บันทึกไม่สำเร็จ'); }))
                .then(load).catch(error => { alert(error.message); stepBtn.disabled = false; });
            return;
        }
        const notice = event.target.closest('[data-notice-send]');
        if (notice) return sendNotice(notice.dataset.noticeSend, notice);
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
    setInterval(() => { if (!document.hidden) load(); }, 15000);   // อัปเดตเองทุก 15 วินาที (ไม่ต้องรีเฟรช)
})();
