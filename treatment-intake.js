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
    let closeContext = null;
    const filePreviews = new Map();
    function billReadiness(r) {
        const info = r.close_readiness;
        if (info?.closed) return '<div class="intake-close-readiness">บันทึกปิดเคสแล้ว</div>';
        const missing = [...(info?.missing || ['กำลังตรวจเงื่อนไขจากกล่องงาน'])];
        if (!r.case_id) missing.unshift('เลขเคสที่ผูกกับบิล');
        return `<div class="intake-close-readiness">${info?.ready && !missing.length ? `<button type="button" class="intake-take" data-bill-close="${r.id}">สามารถปิดเคสได้</button>` : `ยังขาด: ${missing.map(esc).join(' · ')}`}</div>`;
    }
    function closeBillFromButton(button) {
        const r = state.records.find(r => String(r.id) === button.dataset.billClose);
        if (!r?.close_readiness?.ready || !r.case_id || button.disabled) return;
        if (!confirm(`ปิดเคส #${r.case_id} ของ ${r.fullname} และบันทึกเอกสารเข้าเคส?`)) return;
        return saveBillStatus(button.parentElement, r, button, 'ปิดเคส เอกสารและบัญชีครบถ้วน');
    }
    function evidenceGallery(r) {
        return `<div class="intake-evidence-gallery">${r.files.map(f => `<button type="button" class="intake-evidence-tile" data-annual-file="${r.id}/${f.n}" data-mime="${esc(f.mime)}">${/^image\//.test(f.mime) ? `<img data-intake-preview="${r.id}/${f.n}" alt="${esc(f.field_label)} ${f.index}" loading="lazy">` : '<span class="intake-file-icon">PDF / ไฟล์แนบ</span>'}<span>${esc(f.field_label)} ${f.index}</span></button>`).join('')}</div>`;
    }
    function hydratePreviews() {
        document.querySelectorAll('[data-intake-preview]').forEach(async img => {
            const ref = img.dataset.intakePreview;
            try {
                if (!filePreviews.has(ref)) filePreviews.set(ref, window.authFetch(`${API()}/file/${ref}`).then(async res => { if (!res.ok) throw new Error('โหลดรูปไม่ได้'); return URL.createObjectURL(await res.blob()); }).catch(e => { filePreviews.delete(ref); throw e; }));
                img.src = await filePreviews.get(ref);
            } catch { img.alt = 'โหลดรูปไม่ได้ กดเพื่อเปิดอีกครั้ง'; }
        });
    }
    function renderCloseReadiness() {
        const panel = document.getElementById('intakeCloseReadiness');
        if (!panel) return;
        const r = state.records.find(r => r.id === closeContext?.id);
        const insurance = document.getElementById('hiddenInsuranceId')?.value;
        panel.hidden = !r || String(insurance || '').toUpperCase() !== String(r.insurance_code || '').toUpperCase();
        if (panel.hidden) return;
        const info = r.close_readiness;
        const missing = [...(info?.missing || ['กำลังตรวจเงื่อนไขล่าสุดจากกล่องงาน'])];
        if (!closeContext.caseId) missing.unshift('บันทึกเปิดเคสพร้อมรูปหลักฐานให้สำเร็จก่อน');
        const choices = ['ปิดเคส เอกสารและบัญชีครบถ้วน', 'ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม'];
        const selected = panel.querySelector('[data-intake-final-status]')?.value || r.case_status_text || choices[0];
        panel.innerHTML = `<b>ตรวจเอกสารและข้อมูลจากระบบจัดการองค์กร · ${esc(r.fullname)}</b>${missing.length ? `<p>ยังขาด: ${missing.map(esc).join(' · ')}</p>` : `<p>เอกสารและข้อมูลครบ · เคส #${esc(closeContext.caseId)}</p><label>เลือกสถานะ <select data-intake-final-status>${choices.map(value => `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`).join('')}</select></label><button type="button" class="intake-take" data-intake-close-ready>บันทึกสถานะ</button>`}`;
    }
    document.addEventListener('click', async event => {
        const billClose = event.target.closest('[data-bill-close]');
        if (billClose) return closeBillFromButton(billClose);
        const button = event.target.closest('[data-intake-close-ready]');
        if (!button) return;
        const r = state.records.find(r => r.id === closeContext?.id);
        if (!r?.close_readiness?.ready || !closeContext.caseId) return;
        const statusText = document.querySelector('[data-intake-final-status]')?.value;
        if (!['ปิดเคส เอกสารและบัญชีครบถ้วน', 'ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม'].includes(statusText)) return;
        if (!confirm(`บันทึกเคส #${closeContext.caseId} ของ ${r.fullname} เป็นสถานะ "${statusText}"?`)) return;
        button.disabled = true;
        try {
            const info = r.close_readiness;
            const annual = info.type === 'annual';
            const res = await window.authFetch(`${API()}/records/${info.recordId}/${annual ? 'attach-case' : 'step'}`, { method: annual ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(annual ? { case_id: closeContext.caseId, status_text: statusText } : { step: 'insurance', status_text: statusText }) });
            const data = await res.json();
            if (!res.ok || data.success === false) throw new Error(data.message || 'ปิดเคสไม่สำเร็จ');
            await load();
            await loadHistoryFor(r.insurance_code || r.employee_id);
            renderCloseReadiness();
            window.showInsuranceToast?.(`บันทึกสถานะ "${statusText}" แล้ว`, 'success');
        } catch (e) { alert(e.message); button.disabled = false; }
    });
    document.addEventListener('change', renderCloseReadiness);

    const box = document.createElement('section');
    box.className = 'intake-box';
    // ปุ่มลูกกลมลอยมุมขวาล่าง (มีตัวเลขเรื่องค้าง) → กดแล้วขยายเป็นแผงรายการ
    box.innerHTML = `<button type="button" class="intake-fab" data-intake-toggle aria-label="พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ" title="พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ">
            <span class="intake-fab-icon" aria-hidden="true">📥</span><span class="intake-fab-badge" id="intakeFabBadge" hidden>0</span></button>
        <div class="intake-panel" role="dialog" aria-label="พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ">
            <header class="intake-panel-head"><div><b>📥 พนักงานแจ้งเข้ารักษา / ตรวจสุขภาพ</b><span class="intake-count" id="intakeCount">…</span></div>
                <span class="intake-head-actions"><button type="button" class="intake-bulk-btn" data-bill-backfill hidden>🧩 ลงรูปบิลเข้าเคสย้อนหลัง</button><button type="button" class="intake-bulk-btn" data-bulk-toggle>📢 ส่งข้อความแบบหมู่</button>
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
    const pending = () => state.records.filter(r => r.type !== 'medical' && !r.case_id && !['billed', 'deleted', 'cancelled'].includes(r.status));
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
    function runStep(stepBtn) {
        const r = state.records.find(x => x.id === Number(stepBtn.dataset.step));
        const msg = stepBtn.dataset.stepTo === 'waiting'
            ? `สิ้นสุดการแจ้งของ ${r?.fullname || ''} (เคส #${r?.case_id || '-'})?\n\nเรื่องนี้จะหายจากรายการ และกลับมาที่ "พนักงานส่งบิลแล้ว" เมื่อพนักงานอัปโหลดบิลค่ารักษา`
            : r?.type === 'medical'
                ? `ปิดเคส #${r?.case_id || '-'} ของ ${r?.fullname || ''}?\n\n• คัดลอกใบเสร็จ / ใบรับรองแพทย์ / เอกสารอื่นที่พนักงานส่ง เข้าโฟลเดอร์เคสด้วยชื่อมาตรฐาน\n• เพิ่มรายการ "ปิดเคส เอกสารและบัญชีครบถ้วน" ในประวัติ (ยอดวงเงินคงตามที่บันทึกไว้ในเคส)\n• พนักงานเห็นสถานะ "รอประกันตรวจสอบและโอนเงินคืน"`
                : `ยืนยันจบงานของ ${r?.fullname || ''} (เคส #${r?.case_id || '-'})?\n\nพนักงานจะเห็นสถานะ "รอประกันตรวจสอบและโอนเงินคืน"`;
        if (!confirm(msg)) return;
        stepBtn.disabled = true;
        window.authFetch(`${API()}/records/${stepBtn.dataset.step}/step`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: stepBtn.dataset.stepTo }) })
            .then(res => res.json().then(d => { if (!res.ok || d.success === false) throw new Error(d.message || 'บันทึกไม่สำเร็จ'); }))
            .then(load).catch(error => { alert(error.message); stepBtn.disabled = false; });
    }

    // ---------------------------------------------------------------- กระดาน "พนักงานส่งบิลแล้ว — รอปิดเคส" (ด้านบนกล่องประวัติการรักษา)
    const keyOf = r => String(r.insurance_code || r.employee_id || '').toUpperCase();
    let lastBills = [];
    let loadSequence = 0;
    function renderBillBoard(bills) {
        lastBills = bills;
        const wrap = historyBoards();
        if (!wrap) return;
        const board = wrap.querySelector('#billBoard');
        const groups = new Map();
        bills.forEach(r => { const k = keyOf(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
        board.hidden = !bills.length;
        board.innerHTML = `<header><b>🧾 พนักงานส่งบิลค่ารักษาแล้ว — รอปิดเคส</b><span class="bill-board-count">${bills.length}</span><small>กดชื่อเพื่อเปิดประวัติของพนักงานคนนั้น · เคสที่มีบิลใหม่จะขึ้นป้ายแจ้งเตือน</small></header>
            <div class="bill-board-list">${[...groups.entries()].map(([k, list]) => `
                <div class="bill-item-group"><button type="button" class="bill-item" data-bill-open="${esc(k)}">
                    <span class="bill-item-badge">${list.length}</span>
                    <b>${esc(list[0].fullname)}</b>
                    <small>${esc(list[0].company || '')} · ${esc(list[0].insurance_code || list[0].employee_id || '')}</small>
                    <span class="bill-item-cases">${list.map(r => `เคส #${esc(r.case_id)} · ${esc(String(val(r, 'treat_type') || '').split(' ')[0] || '-')} · ${esc(money(val(r, 'amount')))} ฿`).join('<br>')}</span>
                </button><div class="bill-item-actions">${list.map(r => `<div>${billReadiness(r)}<button type="button" class="bill-status-cancel" data-cancel-open="${r.id}">ยกเลิกบิลเคส #${esc(r.case_id)}</button></div>`).join('')}</div></div>`).join('')}</div>`;
        markCards();
    }
    // ที่ห่อกระดานบนกล่องประวัติ: ตรวจสุขภาพ (บน) + บิลรอปิดเคส (ล่าง)
    function historyBoards() {
        let wrap = document.getElementById('historyBoards');
        if (wrap) return wrap;
        const title = document.querySelector('#table-box-placeholder .insurance-panel-shell > h2');
        if (!title) return null;
        wrap = document.createElement('div');
        wrap.id = 'historyBoards';
        wrap.innerHTML = '<section id="annualBoard" class="bill-board is-annual" hidden></section><section id="billBoard" class="bill-board" hidden></section>';
        title.after(wrap);
        return wrap;
    }

    // ---------------------------------------------------------------- กระดาน "พนักงานแจ้งเข้ารักษา" (บนสุดของหน้าเปิดเคส) — กดแล้วกรอกฟอร์มเปิดเคสให้
    function renderTreatBoard(items) {
        const card = document.querySelector('.open-case-combined-card');
        if (!card) return;
        let board = document.getElementById('treatBoard');
        if (!board) { board = document.createElement('section'); board.id = 'treatBoard'; board.className = 'bill-board is-treat'; card.before(board); }
        board.hidden = !items.length;
        board.innerHTML = `<header><b>🚑 พนักงานแจ้งเข้ารักษา — รอรับเคส</b><span class="bill-board-count">${items.length}</span><small>กดชื่อเพื่อกรอกฟอร์มเปิดเคสให้อัตโนมัติ</small></header>
            <div class="bill-board-list">${items.map(r => `
                <button type="button" class="bill-item${r.urgent ? ' is-hot' : ''}${window.__treatmentIntake?.id === r.id ? ' is-on' : ''}" data-board-take="${r.id}">
                    ${r.urgent ? '<span class="bill-item-badge">ด่วน</span>' : ''}
                    <span class="bill-item-x" role="button" data-cancel-open="${r.id}" title="ยกเลิกเรื่องนี้">✕ ยกเลิก</span>
                    <b>${esc(r.fullname)}</b>
                    <small>${esc(r.company || '')} · ${esc(r.insurance_code || r.employee_id || '')}</small>
                    <span class="bill-item-cases">${esc(`${thDate(val(r, 'treat_date'))} ${val(r, 'treat_time')}`.trim())} · ${esc(val(r, 'hospital') || '-')}</span>
                </button>`).join('')}</div>`;
    }

    // ---------------------------------------------------------------- กระดาน "ตรวจสุขภาพประจำปี (เบิกย้อนหลัง)" (บนกล่องประวัติ)
    let annualItems = [];
    let annualPicked = null;
    function renderAnnualBoard(items) {
        annualItems = items;
        const board = historyBoards()?.querySelector('#annualBoard');
        if (!board) return;
        if (annualPicked && !items.some(r => r.id === annualPicked)) annualPicked = null;
        board.hidden = !items.length;
        const picked = items.find(r => r.id === annualPicked);
        board.innerHTML = `<header><b>🩺 ตรวจสุขภาพประจำปี (เบิกย้อนหลัง) — รอบันทึก</b><span class="bill-board-count">${items.length}</span><small>กดชื่อเพื่อเปิดประวัติ แล้วเลือก เปิดเคสใหม่ หรือ บันทึกเข้าเคสที่มีอยู่แล้ว</small></header>
            <div class="bill-board-list">${items.map(r => `
                <button type="button" class="bill-item${r.id === annualPicked ? ' is-on' : ''}" data-annual-open="${r.id}">
                    <span class="bill-item-x" role="button" data-cancel-open="${r.id}" title="ยกเลิกเรื่องนี้">✕ ยกเลิก</span>
                    <b>${esc(r.fullname)}</b>
                    <small>${esc(r.company || '')} · ${esc(r.insurance_code || r.employee_id || '')}</small>
                    <span class="bill-item-cases">ตรวจ ${esc(thDate(val(r, 'check_date')))} · ${esc(money(val(r, 'amount')))} ฿</span>
                </button>`).join('')}</div>
            ${picked ? annualPanel(picked) : ''}`;
        hydratePreviews();
    }
    function annualPanel(r) {
        const cases = [...document.querySelectorAll('#tableBodyResult .txt-case-id')].map(c => c.textContent.trim()).filter(Boolean);
        return `<div class="annual-panel">
            <div class="annual-facts"><b>${esc(r.fullname)}</b> · ตรวจเมื่อ ${esc(thDate(val(r, 'check_date')))} · ${esc(val(r, 'hospital') || '-')} · ยอด <b>${esc(money(val(r, 'amount')))} บาท</b> · ${esc(val(r, 'pay') || '-')}${val(r, 'refund_account_no') ? ` (${esc(val(r, 'refund_bank'))} ${esc(val(r, 'refund_account_no'))})` : ''}
                </div>
            ${evidenceGallery(r)}
            <div class="annual-actions">
                <button type="button" class="intake-take" data-annual-new="${r.id}">🆕 เปิดเคส</button>
                <span class="annual-or">หรือ</span>
                <label>📂 มีเคสอยู่แล้ว <select data-annual-case>${cases.length ? cases.map(c => `<option value="${esc(c)}">เคส #${esc(c)}</option>`).join('') : '<option value="">— ยังไม่พบเคสในประวัติ —</option>'}</select></label>
                <button type="button" class="intake-end" data-annual-attach="${r.id}" ${cases.length && r.close_readiness?.ready ? '' : 'disabled'}>บันทึกเข้าเคสนี้และปิดเคส</button>
            </div>
            ${r.close_readiness?.ready ? '' : `<p>ยังขาด: ${(r.close_readiness?.missing || ['กำลังตรวจเงื่อนไขจากกล่องงาน']).map(esc).join(' · ')}</p>`}
            <p class="ib-msg" data-annual-msg></p></div>`;
    }
    function busy(el, text) {
        let bar = document.getElementById('intakeLoading');
        if (!bar) { bar = document.createElement('div'); bar.id = 'intakeLoading'; bar.className = 'intake-loading'; document.body.append(bar); }
        bar.innerHTML = `<span class="intake-spin" aria-hidden="true"></span>${esc(text)}`;
        bar.hidden = false;
        el?.classList.add('is-loading');
        return () => { bar.hidden = true; el?.classList.remove('is-loading'); document.querySelectorAll('.bill-item.is-loading').forEach(n => n.classList.remove('is-loading')); };
    }
    async function loadHistoryFor(code) {
        const input = document.getElementById('caseSearchInput');
        const body = document.getElementById('tableBodyResult');
        if (!input || !body || typeof window.performCaseSearch !== 'function') return;
        body.innerHTML = '';   // ล้างประวัติของคนก่อน — ไม่ให้เลขเคสเก่าค้างในช่องเลือก
        const picked = document.getElementById('hiddenInsuranceId');
        if (picked) picked.value = '';
        input.value = code;
        window.performCaseSearch();
        // รอจน "เลือกพนักงานคนนี้แล้ว" (ไม่ใช่แถวว่างตอนเริ่มค้นหา) แล้วประวัติวาดเสร็จ — หรือพบหลายคนให้เลือกเอง
        const want = String(code || '').toUpperCase();
        await waitFor(() => (picked && String(picked.value || '').toUpperCase() === want && body.children.length)
            || document.querySelectorAll('#resultsList .employee-result-option').length > 1, 25000);
        await wait(300);
    }
    async function openAnnual(id) {
        const r = annualItems.find(x => x.id === Number(id));
        if (!r) return;
        annualPicked = null;
        renderAnnualBoard(annualItems);
        const done = busy(document.querySelector(`[data-annual-open="${r.id}"]`), `กำลังโหลดประวัติการรักษาของ ${r.fullname}…`);
        try { await loadHistoryFor(r.insurance_code || r.employee_id); } finally { done(); }
        annualPicked = r.id;
        renderAnnualBoard(annualItems);   // ใส่รายการเคสของคนนี้ในช่องเลือก (หลังโหลดเสร็จเท่านั้น)
        document.getElementById('annualBoard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    async function attachAnnual(id, button) {
        const board = document.getElementById('annualBoard');
        const caseId = board.querySelector('[data-annual-case]')?.value;
        const out = board.querySelector('[data-annual-msg]');
        const r = annualItems.find(x => x.id === Number(id));
        if (!caseId || !r) return;
        if (!confirm(`บันทึกตรวจสุขภาพของ ${r.fullname} เข้าเคส #${caseId} และปิดเคส?\n\n• คัดลอกเอกสารเข้าโฟลเดอร์เคสด้วยชื่อมาตรฐาน (ใบเสร็จ / ใบรับรองแพทย์ / รูปเพิ่มเติม)\n• ใส่ยอด ${money(val(r, 'amount'))} บาท ในวงเงินอื่นๆ\n• สถานะ "ปิดเคส เอกสารและบัญชีครบถ้วน"`)) return;
        button.disabled = true;
        out.textContent = 'กำลังคัดลอกเอกสารและบันทึกเข้าเคส…';
        try {
            const res = await window.authFetch(`${API()}/records/${id}/attach-case`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseId }) });
            const d = await res.json().catch(() => ({}));
            if (!res.ok || d.success === false) throw new Error(d.message || (res.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลการรักษา' : 'บันทึกไม่สำเร็จ'));
            out.textContent = `✓ บันทึกเข้าเคส #${caseId} และปิดเคสแล้ว (เอกสาร ${d.copied || 0} ไฟล์)`;
            annualPicked = null;
            await load();
            if (typeof window.performCaseSearch === 'function') window.performCaseSearch();   // อ่านประวัติใหม่
        } catch (error) { out.textContent = '⚠️ ' + error.message; button.disabled = false; }
    }
    // ---------------------------------------------------------------- ยกเลิก (ต้องใส่สาเหตุ)
    function openCancel(id) {
        const r = state.records.find(x => x.id === Number(id));
        if (!r) return;
        document.getElementById('intakeCancel')?.remove();
        const pop = document.createElement('div');
        pop.id = 'intakeCancel';
        pop.className = 'intake-alert';
        pop.innerHTML = `<div class="intake-cancel">
            <h3>🚫 ยกเลิก${r.type === 'medical' ? 'บิล' : 'เรื่อง'}ของ ${esc(r.fullname)}</h3>
            ${r.type === 'medical' ? `<p>บิลเลขที่ ${r.id} · ผูกเคส #${esc(r.case_id)} · รหัสประกัน ${esc(r.insurance_code || '-')} · ยอด ${esc(money(val(r, 'amount')))} บาท</p><p>ยกเลิกเฉพาะบิลรายการนี้ โดยคงประวัติการรักษาของเคสไว้ หากผูกเลขเคสผิด ให้ส่งบิลใหม่โดยเลือกเคสที่ถูกต้อง</p>` : ''}
            <p class="intake-meta">${isAnnual(r) ? `ตรวจสุขภาพ · ตรวจเมื่อ ${esc(thDate(val(r, 'check_date')))} · ${esc(money(val(r, 'amount')))} บาท` : `แจ้งเข้ารักษา · ${esc(thDate(val(r, 'treat_date')))} ${esc(val(r, 'treat_time'))} · ${esc(val(r, 'hospital'))}`} · เลขที่ ${r.id}</p>
            <label>สาเหตุที่ยกเลิก <span style="color:#e11d48">*</span>
                <select data-cancel-pick><option value="">— เลือกสาเหตุ —</option><option>พนักงานแจ้งซ้ำ</option><option>ผูกเลขเคสผิด ให้ส่งบิลใหม่</option><option>พนักงานไม่ได้ไปรักษา / ยกเลิกเอง</option><option>ข้อมูลไม่ถูกต้อง ให้พนักงานแจ้งใหม่</option><option>ไม่อยู่ในเงื่อนไขการเบิก</option><option>ทดสอบระบบ</option></select></label>
            <textarea data-cancel-reason rows="2" maxlength="300" placeholder="หรือพิมพ์สาเหตุเพิ่มเติม"></textarea>
            <p class="ib-msg" data-cancel-msg></p>
            <div class="intake-cancel-actions"><button type="button" class="intake-end" data-cancel-close>ไม่ยกเลิก</button><button type="button" class="intake-cancel-go" data-cancel-go="${r.id}">ยืนยันยกเลิก</button></div></div>`;
        pop.addEventListener('change', e => { if (e.target.matches('[data-cancel-pick]') && e.target.value) pop.querySelector('[data-cancel-reason]').value = e.target.value; });
        pop.addEventListener('click', async e => {
            if (e.target === pop || e.target.closest('[data-cancel-close]')) return pop.remove();
            const go = e.target.closest('[data-cancel-go]');
            if (!go) return;
            const reason = pop.querySelector('[data-cancel-reason]').value.trim();
            const out = pop.querySelector('[data-cancel-msg]');
            if (!reason) { out.textContent = 'กรุณาเลือกหรือพิมพ์สาเหตุที่ยกเลิก'; return; }
            go.disabled = true;
            try {
                const res = await window.authFetch(`${API()}/records/${r.id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
                const d = await res.json().catch(() => ({}));
                if (!res.ok || d.success === false) throw new Error(d.message || 'ยกเลิกไม่สำเร็จ');
                pop.remove();
                window.showInsuranceToast?.(d.notification?.queued ? 'ยกเลิกแล้ว แจ้งในหน้าพนักงานและเข้าคิว LINE แล้ว' : `ยกเลิกและแจ้งหน้าพนักงานแล้ว · ${d.notification?.message || 'LINE รอส่ง ระบบจะลองใหม่อัตโนมัติ'}`, d.notification?.queued ? 'success' : 'warning', 6000);
                if (annualPicked === r.id) annualPicked = null;
                load();
            } catch (error) { out.textContent = '⚠️ ' + error.message; go.disabled = false; }
        });
        document.body.append(pop);
        pop.querySelector('[data-cancel-pick]').focus();
    }

    document.addEventListener('click', event => {
        const t = event.target;
        const cancelOpen = t.closest('[data-cancel-open]');
        if (cancelOpen) { event.stopPropagation(); return openCancel(cancelOpen.dataset.cancelOpen); }
        const boardTake = t.closest('[data-board-take]');
        if (boardTake) {
            const r = state.records.find(x => x.id === Number(boardTake.dataset.boardTake));
            const done = busy(boardTake, `กำลังค้นหา ${r?.fullname || 'พนักงาน'} และกรอกฟอร์มเปิดเคส…`);
            return take(boardTake.dataset.boardTake).finally(done);
        }
        const ao = t.closest('[data-annual-open]');
        if (ao) return openAnnual(ao.dataset.annualOpen);
        const an = t.closest('[data-annual-new]');
        if (an) { const done = busy(an, 'กำลังกรอกฟอร์มเปิดเคสจากข้อมูลตรวจสุขภาพ…'); return take(an.dataset.annualNew).finally(done); }
        const aa = t.closest('[data-annual-attach]');
        if (aa) return attachAnnual(aa.dataset.annualAttach, aa);
        const af = t.closest('[data-annual-file]');
        if (af) return openFile(af.dataset.annualFile, af.dataset.mime);
    });

    // ป้ายบนการ์ดเคสในประวัติ: "🧾 พนักงานส่งบิลแล้ว" + เอกสาร + ปุ่มปิดเคสแล้ว
    function markCards() {
        document.querySelectorAll('.bill-flag').forEach(n => n.remove());
        document.querySelectorAll('#tableBodyResult tr.has-bill').forEach(n => n.classList.remove('has-bill'));
        const cells = [...document.querySelectorAll('#tableBodyResult .txt-case-id')];
        lastBills.forEach(r => {
            const cell = cells.find(c => c.textContent.trim() === String(r.case_id));
            const host = cell?.closest('td');
            if (!host) return;
            const flag = document.createElement('div');
            flag.className = 'bill-flag';
            flag.innerHTML = `<span class="bill-flag-dot">1</span><b>🧾 พนักงานส่งบิลแล้ว</b> เลขที่ ${r.id} · ${esc(val(r, 'treat_type') || '-')} · ยอด ${esc(money(val(r, 'amount')))} ฿ · ${esc(val(r, 'pay') || '')}
                <button type="button" class="intake-take" data-bill-status="${r.id}">✓ บันทึกลงเคส / เลือกสถานะ ▾</button>${billReadiness(r)}${evidenceGallery(r)}`;
            flag.addEventListener('click', event => {
                event.stopPropagation();   // ไม่ให้การ์ดพับ/กาง
                const close = event.target.closest('[data-bill-close]');
                if (close) return closeBillFromButton(close);
                const file = event.target.closest('[data-intake-file], [data-annual-file]');
                if (file) return openFile(file.dataset.intakeFile || file.dataset.annualFile, file.dataset.mime);
                const pick = event.target.closest('[data-bill-status]');
                if (pick) return openBillStatus(flag, r);
                const go = event.target.closest('[data-bill-go]');
                if (go) return saveBillStatus(flag, r, go);
                if (event.target.closest('[data-bill-cancel]')) flag.querySelector('.bill-status-pop')?.remove();
            });
            host.append(flag);
            host.closest('tr')?.classList.add('has-bill');
        });
        hydratePreviews();
    }
    // เลือกสถานะของรายการที่จะเพิ่มในเคส (ค่าเริ่มต้น = ปิดเคส) · รูปจากพนักงานลงเคสด้วยชื่อมาตรฐานเหมือนเดิม
    function statusOptions() {
        const list = [...(document.getElementById('ocStatusSelect')?.options || [])].map(o => o.value).filter(v => v && v !== 'อื่นๆ');
        const close = 'ปิดเคส เอกสารและบัญชีครบถ้วน';
        return list.includes(close) ? list : [...list, close];
    }
    function openBillStatus(flag, r) {
        flag.querySelector('.bill-status-pop')?.remove();
        const pop = document.createElement('div');
        pop.className = 'bill-status-pop';
        pop.innerHTML = `<label>สถานะของเคส #${esc(r.case_id)} หลังลงบิลนี้</label>
            <select data-bill-select>${statusOptions().map(v => `<option value="${esc(v)}"${v === 'ปิดเคส เอกสารและบัญชีครบถ้วน' ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
            <small>ระบบคัดลอกใบเสร็จ / ใบรับรองแพทย์ / เอกสารอื่นที่พนักงานส่ง เข้าเคสด้วยชื่อมาตรฐาน และเพิ่มรายการตามสถานะที่เลือก (ยอดวงเงินคงตามเดิม) · พนักงานเห็นสถานะ "รอประกันตรวจสอบและโอนเงินคืน"</small>
            <span><button type="button" class="intake-take" data-bill-go>บันทึก</button><button type="button" class="bill-status-cancel" data-bill-cancel>ยกเลิก</button></span>`;
        flag.append(pop);
    }
    async function saveBillStatus(flag, r, button, forcedStatus) {
        if (button.disabled) return;
        const statusText = forcedStatus || flag.querySelector('[data-bill-select]')?.value || '';
        button.disabled = true; button.textContent = '⏳ กำลังบันทึก…';
        let data;
        try {
            const res = await window.authFetch(`${API()}/records/${r.id}/step`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'insurance', status_text: statusText }) });
            data = await res.json();
            if (!res.ok || data.success === false) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
        } catch (error) {
            alert(error.message); button.disabled = false; button.textContent = 'บันทึก';
            return;
        }
        // Apply only the confirmed bill; another pending bill for this employee must stay visible.
        ++loadSequence; // Ignore polling responses started before the successful save.
        state.records = state.records.map(item => String(item.id) === String(r.id) ? { ...item, status: 'insurance' } : item);
        render();
        window.showInsuranceToast?.(`บันทึกเข้าเคส #${r.case_id} แล้ว (เอกสาร ${data.copied || 0} ไฟล์)`, 'success');
        const refreshHistory = async () => {
            if (window.historyDisplayMode === 'filtered' && typeof window.loadFilteredAllHistory === 'function') {
                await window.loadFilteredAllHistory();
            } else {
                await loadHistoryFor(r.insurance_code || r.employee_id || String(r.case_id));
            }
        };
        const results = await Promise.allSettled([load(), refreshHistory()]);
        markCards();
        if (results.some(result => result.status === 'rejected')) {
            window.showInsuranceToast?.('บันทึกสำเร็จแล้ว แต่โหลดประวัติล่าสุดไม่สำเร็จ กรุณาค้นหาเคสอีกครั้ง', 'warning');
        }
    }
    async function openBillHistory(key) {
        const bills = lastBills.filter(r => keyOf(r) === key);
        if (!bills.length) return;
        const done = busy(document.querySelector(`[data-bill-open="${key}"]`), `กำลังโหลดประวัติการรักษาของ ${bills[0].fullname}…`);
        try { await loadHistoryFor(bills[0].insurance_code || bills[0].employee_id); } finally { done(); }
        const card = [...document.querySelectorAll('#tableBodyResult .txt-case-id')].find(c => bills.some(b => c.textContent.trim() === String(b.case_id)));
        markCards();
        (card?.closest('tr') || document.getElementById('billBoard'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!card) window.showInsuranceToast?.(`ไม่พบเคส ${bills.map(b => '#' + b.case_id).join(', ')} ในประวัติของพนักงานนี้ กรุณาตรวจเลขเคส หากเป็นรายการผิดหรือทดสอบ ให้กดยกเลิกบิลบนกระดาน`, 'warning', 10000);
    }
    document.addEventListener('click', event => {
        const item = event.target.closest('[data-bill-open]');
        if (item) openBillHistory(item.dataset.billOpen);
    });
    // ประวัติวาดใหม่ (ค้นหา/กรอง) → ติดป้ายบิลใหม่อีกครั้ง
    (function watchHistory() {
        const body = document.getElementById('tableBodyResult');
        if (!body) return setTimeout(watchHistory, 1000);
        new MutationObserver(() => { if (!body.querySelector('.bill-flag') && lastBills.length) markCards(); }).observe(body, { childList: true });
        if (!document.getElementById('historyBoards')) { renderBillBoard(lastBills); renderAnnualBoard(annualItems); }
    })();

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
        const sequence = ++loadSequence;
        try {
            const response = await window.authFetch(`${API()}/list`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (sequence !== loadSequence) return;
            if (!response.ok || data.success === false) { document.getElementById('intakeCount').textContent = response.status === 404 ? 'หลังบ้านยังไม่อัปเดต' : '—'; return; }
            state.records = data.records || [];
            state.billBackfill = Number(data.bill_backfill || 0);
            state.billBackfillList = data.bill_backfill_list || [];
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
        const backfill = box.querySelector('[data-bill-backfill]');
        if (backfill) { backfill.hidden = !state.billBackfill; backfill.textContent = `🧩 ลงรูปบิลเข้าเคสย้อนหลัง (${state.billBackfill})`; backfill.title = (state.billBackfillList || []).map(x => `${x.fullname} — เคส #${x.case_id}`).join(String.fromCharCode(10)); }
        const fabBadge = document.getElementById('intakeFabBadge');
        fabBadge.textContent = list.length;
        fabBadge.hidden = !list.length;
        box.classList.toggle('has-wait', Boolean(list.length));
        box.classList.toggle('has-urgent', Boolean(urgent));
        // เปิดเคสแล้ว (ยังไม่ส่งบิล) → GA เลือกสถานะแจ้งกลับให้พนักงาน
        const recent = state.records.filter(r => r.type !== 'medical' && r.case_id && !['billed', 'deleted', 'waiting', 'insurance', 'refunded', 'done', 'cancelled'].includes(r.status)).slice(0, 15);
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
            </tr>`).join('')}</tbody></table>` : '');
        renderBillBoard(bills);
        renderTreatBoard(list.filter(r => r.type === 'treatment'));
        renderAnnualBoard(list.filter(r => isAnnual(r)));
        renderCloseReadiness();
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
        // Annual result/receipt files are imported when saving treatment, not as opening evidence.
        window.__treatmentIntake = { id: r.id, links: isAnnual(r) ? [] : r.files.map(f => f.link).filter(Boolean), name: r.fullname };
        closeContext = { id: r.id, caseId: null };
        renderCloseReadiness();
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
                const res = await window.authFetch(`${API()}/records/${intake.id}/case`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: String(caseId) }) });
                const data = await res.json();
                if (!res.ok || data.success === false) throw new Error(data.message || 'ผูกเคสไม่สำเร็จ');
                closeContext = { id: intake.id, caseId: String(caseId) };
                if (data.record) state.records = state.records.map(r => r.id === intake.id ? data.record : r);
                renderCloseReadiness();
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
        view.innerHTML = `<div class="intake-viewer-tools"><button type="button" data-view-zoom>ย่อ / ขยาย</button><button type="button" data-view-close>ปิด</button></div><img src="${url}" alt="รูปเอกสาร">`;
        view.addEventListener('click', event => { if (event.target.tagName === 'IMG' || event.target.closest('[data-view-zoom]')) view.querySelector('img').classList.toggle('is-zoom'); else { URL.revokeObjectURL(url); view.remove(); } });
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
        const bfill = event.target.closest('[data-bill-backfill]');
        if (bfill) {
            if (!confirm(`ลงรูปใบเสร็จ / ใบรับรองแพทย์ของบิลที่ปิดเคสไปแล้ว ${state.billBackfill} รายการ เข้าเคสในประวัติการรักษา?

${(state.billBackfillList || []).map(x => `• ${x.fullname} — เคส #${x.case_id} (บิลเลขที่ ${x.id})`).join(String.fromCharCode(10))}\n\n(คัดลอกไฟล์เข้าโฟลเดอร์เคสด้วยชื่อมาตรฐาน + เพิ่มรายการปิดเคส · ยอดวงเงินคงเดิม)`)) return;
            bfill.disabled = true; bfill.textContent = '⏳ กำลังลงรูปเข้าเคส…';
            window.authFetch(`${API()}/bills/backfill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                .then(res => res.json().then(d => { if (!res.ok || d.success === false) throw new Error(d.message || 'ไม่สำเร็จ'); return d; }))
                .then(d => { alert(`ลงรูปเข้าเคสแล้ว ${d.ok} รายการ (${d.copied} ไฟล์)${d.failed?.length ? `\n\nไม่สำเร็จ:\n${d.failed.join('\n')}` : ''}`); load(); })
                .catch(error => alert(error.message)).finally(() => { bfill.disabled = false; });
            return;
        }
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
        if (stepBtn) return runStep(stepBtn);
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
