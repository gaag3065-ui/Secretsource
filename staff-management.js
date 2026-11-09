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
    const state = { data: null, byKey: new Map(), current: null, drafts: new Map() };
    // สิทธิ์ย่อยของบัญชีนี้ (จาก /employees) — ไม่มีข้อมูล (หลังบ้านเก่า) = แสดงปุ่มตามเดิม
    const can = key => state.data?.can ? Boolean(state.data.can[key]) : true;

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
        $('smRows').innerHTML = '<tr><td colspan="7" class="fa-empty">กำลังโหลด…</td></tr>';
        try {
            const [data, records] = await Promise.all([request(`/employees${refresh ? '?refresh=1' : ''}`), loadRecords(), loadClaimed()]);
            state.data = { ...data, boxes: workBoxes(data.boxes) };
            state.records = records.filter(r => !INSURANCE_BOXES.has(r.type));
            state.byKey = new Map(state.data.employees.map(e => [e.key, e]));
            $('smUpdated').textContent = `· อัปเดต ${new Date(state.data.updatedAt).toLocaleTimeString('th-TH')}`;
            fillFilters();
            render();
        } catch (error) {
            $('smRows').innerHTML = `<tr><td colspan="7" class="fa-empty">${esc(error.message)}</td></tr>`;
        }
    }

    // ---------------------------------------------------------------- เอกสารที่พนักงานส่งเองจากหน้าระบบจัดการองค์กร (ไม่ต้องมีงานมอบหมาย)
    // เช่น กล่องตรวจ 4 โรค: พนักงานกดส่งเอง → ขึ้นที่นี่ว่า "รอตรวจ" ให้ GA เปิดดูและเปลี่ยนสถานะได้
    // งานประกัน (แจ้งเข้ารักษา / บิลค่ารักษา) ดูที่หน้างานประกันที่เดียว — หน้านี้เป็นงานอื่น ๆ
    // งานหลักแยกไปอยู่หน้าของตัวเอง: รักษาพยาบาล/บิล → งานประกันและการรักษา · รูปออกกำลังกาย → ออกกำลังกายและฟิตเนส 15 ครั้ง
    const INSURANCE_BOXES = new Set(['treatment', 'medical', 'exercise']);
    const workBoxes = list => (list || []).filter(b => !INSURANCE_BOXES.has(b.key));
    const docsApi = path => `${window.APP_CONFIG.API_BASE_URL}/api/ga-docs/admin${path}`;
    async function loadRecords() {
        try {
            const response = await window.authFetch(docsApi('/list'));
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) return [];
            state.docStatuses = data.statuses || {};
            state.docDestinations = data.destinations || {};
            return data.records || [];
        } catch { return []; }
    }
    // ---------------------------------------------------------------- พนักงานที่ "ส่งเบิกไปแล้ว" (นำเข้าจากไฟล์เดิมนอกระบบ) — แสดงป้ายยอด + เตือนก่อนยืนยันลงรายงานซ้ำ
    const HEALTH_BOXES = new Set(['disease4', 'annual']);
    const CLAIM_FILE = { 1: 'ไฟล์ 1 (30/10)', 2: 'ไฟล์ 2 (31/10)', 3: 'ไฟล์ 3 (31/10 ชุด 2)' };
    const claimNameKey = v => String(v || '').normalize('NFC').replace(/[​-‍﻿ ]/g, ' ').replace(/\s+/g, '').toLowerCase();
    const claimCodeKey = v => { const t = String(v || '').replace(/\s+/g, '').toUpperCase(); const m = /^(IC|NSN|OP|NS)0*(\d+)$/.exec(t); return m ? m[1] + Number(m[2]) : t; };
    const baht = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
    async function loadClaimed() {
        try {
            const response = await window.authFetch(docsApi('/claimed'));
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) return;
            state.claimedByName = new Map();
            state.claimedByCode = new Map();
            (data.people || []).forEach(p => { state.claimedByName.set(claimNameKey(p.name), p); if (p.code) state.claimedByCode.set(claimCodeKey(p.code), p); });
        } catch { /* ยังไม่มีรายชื่อ — ไม่แสดงป้าย */ }
    }
    // จับคู่ตามชื่อ (หลัก) หรือรหัสประกัน — บางคนรหัสในไฟล์เดิมไม่ตรงทะเบียน
    const claimedOf = e => e ? (state.claimedByName?.get(claimNameKey(e.fullname)) || (e.insuranceCode ? state.claimedByCode?.get(claimCodeKey(e.insuranceCode)) : null) || null) : null;
    const claimText = c => c.entries.map(x => `${CLAIM_FILE[x.file] || 'ไฟล์ ' + x.file}: ${baht(x.amount)} บาท${x.ref ? ' (อ้างอิงซ้ำ ไม่นับ)' : ''}${x.note && !x.ref ? ` — ${x.note}` : ''}`).join('\n');
    // การ์ด "ส่งเบิกแล้ว" ในช่องงานของพนักงานคนนั้น (หน้าตาเดียวกับการ์ดกล่องงาน) — บอกยอดรวม และยอดแต่ละไฟล์
    const claimCard = e => {
        const c = claimedOf(e);
        if (!c) return '';
        const parts = c.entries.filter(x => !x.ref).map(x => `<span class="sm-step is-done" title="${esc(x.note || '')}">${esc(CLAIM_FILE[x.file] || 'ไฟล์ ' + x.file)} · ${esc(baht(x.amount))}</span>`).join('');
        return `<span class="sm-link sm-link-claimed" title="${esc(claimText(c))}"><span class="sm-link-head">💸 ส่งเบิกค่าตรวจสุขภาพแล้ว</span><span class="sm-link-steps"><b class="sm-claim-total">${esc(baht(c.total))} บาท</b>${parts}</span></span>`;
    };
    const recEmployee = r => { const ids = [r.employee_id, r.insurance_code].filter(Boolean).map(x => String(x).toUpperCase()); return (state.data?.employees || []).find(e => recIds(e).some(id => ids.includes(id))); };
    const claimBanner = e => { const c = claimedOf(e); return c ? `<div class="sm-claim-banner"><b>💸 คนนี้ส่งเบิกไปแล้ว ${esc(baht(c.total))} บาท</b><small>${esc(claimText(c)).replace(/\n/g, '<br>')}</small><span>ไม่ต้องกด "ยืนยันลงรายงาน" ซ้ำ เว้นแต่เป็นการเบิกคนละครั้ง</span></div>` : ''; };
    async function importClaimed(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const json = JSON.parse(await file.text());
            const people = Array.isArray(json.people) ? json.people : [];
            if (!people.length) throw new Error('ไฟล์นี้ไม่มีรายชื่อ');
            const total = people.reduce((sum, p) => sum + Number(p.total || 0), 0);
            if (!confirm(`นำเข้ารายชื่อที่ส่งเบิกแล้ว ${people.length} คน ยอดรวม ${baht(total)} บาท\n(แทนที่รายชื่อเดิมทั้งหมด) ตกลงไหม?`)) return;
            await ensureCsrf();
            const response = await window.authFetch(docsApi('/claimed'), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ people, source: json.source || file.name }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.message || (response.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ (ReviewGaDocs)' : 'นำเข้าไม่สำเร็จ'));
            toast(`นำเข้าแล้ว ${data.count} คน · ยอดรวม ${baht(data.total)} บาท`);
            await loadClaimed();
            render();
        } catch (error) { toast(error.message, true); }
    }
    $('smClaimFile').addEventListener('change', importClaimed);

    const REVIEW = new Set(['pending']);
    const recIds = e => [e.employeeId, e.centralId, e.insuranceCode, e.key].filter(Boolean).map(x => String(x).toUpperCase());
    const recordsOf = e => { const ids = recIds(e); return (state.records || []).filter(r => ids.includes(String(r.employee_id || '').toUpperCase()) || ids.includes(String(r.insurance_code || '').toUpperCase())); };

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
            const recs = recordsOf(e);
            if (state.box && !tasks.some(t => t.box === state.box && t.status !== 'cancelled') && !recs.some(r => r.type === state.box)) return false;
            if (taskMode === 'review' && !recs.some(r => REVIEW.has(r.status)) && !tasks.some(t => t.status === 'submitted')) return false;
            if (taskMode === 'open' && !tasks.some(t => OPEN.has(t.status))) return false;
            if (taskMode === 'none' && tasks.some(t => t.status !== 'cancelled')) return false;
            if (taskMode === 'done' && !tasks.some(t => t.status === 'done')) return false;
            const stage = $('smStage')?.value || '';
            if (stage && !boxGroupsOf(tasks, recs).filter(g => !state.box || g.key === state.box).some(g => g.stage === stage)) return false;
            const claim = $('smClaim')?.value || '';
            if (claim === 'yes' && !claimedOf(e)) return false;
            if (claim === 'no' && claimedOf(e)) return false;
            if (q && ![e.fullname, e.nickname, e.employeeId, e.centralId, e.insuranceCode, e.company, e.building, e.room, ...tasks.map(t => t.title),
                ...recs.flatMap(r => [r.type_title, r.status_label])]
                .some(v => String(v || '').toLowerCase().includes(q))) return false;
            return true;
        });
    }

    // ---------------------------------------------------------------- กล่องงานทั้งหมด (นับทุกคน ไม่ขึ้นกับตัวกรอง)
    function renderBoxes() {
        const active = (state.data.tasks || []).filter(t => t.status !== 'cancelled');
        $('smBoxes').innerHTML = (state.data.boxes || []).map(b => {
            const list = active.filter(t => t.box === b.key);
            const people = new Set(list.map(t => t.employee_key)).size;
            const open = new Set(list.filter(t => OPEN.has(t.status)).map(t => t.employee_key)).size;
            const titles = [...new Set(list.map(t => t.title))];
            const recs = (state.records || []).filter(r => r.type === b.key);
            const waiting = recs.filter(r => REVIEW.has(r.status)).length;
            const submitters = new Set(recs.map(r => String(r.employee_id).toUpperCase()));
            list.forEach(t => submitters.delete(String(t.employee_key).toUpperCase()));
            const total = people + submitters.size;
            return `<button type="button" class="sm-box${total ? '' : ' is-empty'}${state.box === b.key ? ' is-on' : ''}" data-box="${esc(b.key)}"
                title="${esc(titles.length ? `งาน: ${titles.join(' · ')}` : 'ยังไม่มีงานในกล่องนี้')}">
                <span class="sm-box-count${waiting ? ' is-wait' : ''}" aria-label="ได้รับงาน/ส่งเอกสาร ${total} คน">${total}</span>
                ${b.key !== 'quests' ? `<span class="sm-box-edit" data-edit-tpl="${esc(b.key)}" role="button" title="แก้ไขแม่พิมพ์ของกล่อง (หัวเรื่อง รายละเอียด ช่องกรอก/อัปโหลด)">✏️</span>` : ''}
                ${b.key !== 'quests' && can('deleteWork') ? `<span class="sm-box-del" data-del-box="${esc(b.key)}" role="button" title="ลบกล่องงานนี้ (ลบงาน เอกสาร และไฟล์ที่เกี่ยวข้องทั้งหมด)">🗑</span>` : ''}
                <span class="sm-box-icon">${esc(b.icon || '📌')}</span>
                <b>${esc(b.title)}</b>
                ${state.docDestinations?.[b.key] ? `<span class="sm-box-review" role="link" tabindex="0" data-doc-destination="${esc(b.key)}" data-doc-destination-kind="sheet">📊 เปิดรายงานข้อมูล</span><span class="sm-box-review" role="link" tabindex="0" data-doc-destination="${esc(b.key)}" data-doc-destination-kind="folder">📁 โฟลเดอร์รูปและข้อมูล</span>` : ''}
                <i class="sm-box-scope is-${b.scope === 'personal' ? 'personal' : 'main'}">${b.scope === 'personal' ? '👤 เฉพาะบุคคล' : '🌐 งานหลัก'}</i>
                <small>${titles.length ? `${titles.length} งาน · ค้าง ${open} คน` : recs.length ? '' : 'ยังไม่มีงาน'}</small>
                ${recs.length ? `<span class="sm-box-review${waiting ? ' is-wait' : ''}" data-review-box="${esc(b.key)}" title="เอกสารที่พนักงานส่งมาในกล่องนี้ — กดเพื่อดู/ตรวจ">📥 ส่งมา ${recs.length}${waiting ? ` · รอตรวจ ${waiting}` : ''}</span>` : ''}
            </button>`;
        }).join('') + ((state.data.removedBoxes || []).length ? `<button type="button" class="sm-box sm-box-add sm-box-restore" data-restore-list title="หัวข้อแบบฟอร์มที่ลบไปแล้ว — กดเพื่อคืนให้พนักงานเห็นอีกครั้ง"><span class="sm-box-icon">♻️</span><b>หัวข้อที่ลบ (${state.data.removedBoxes.length})</b><small>กดเพื่อคืนหัวข้อ</small></button>` : '') + '<button type="button" class="sm-box sm-box-add" data-action="create-task" title="สร้างงานใหม่ แล้วเลือกพนักงานที่จะได้รับงาน"><span class="sm-box-icon">＋</span><b>สร้างงาน</b><small>ตั้งงานแล้วเลือกคน</small></button>';
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
            + stat(all.filter(e => e.contracts > 0).length, 'เคยเซ็นสัญญาเช่าบ้าน SL')
            + stat((state.records || []).filter(r => REVIEW.has(r.status)).length, 'เอกสารส่งมา รอตรวจ');
        renderBoxes();
        document.querySelectorAll('.sm-toolbar select').forEach(s => s.classList.toggle('is-set', Boolean(s.value)));
        $('smCount').textContent = `แสดง ${rows.length.toLocaleString('th-TH')} จาก ${all.length.toLocaleString('th-TH')} คน`;
        // คอลัมน์: บริษัท · สถานะ · ชื่อเล่น · ชื่อจริง · [ช่องที่เลือกตัวกรอง] · งานที่มอบหมาย · ปุ่ม
        const extra = FILTERS.filter(f => !f.always && pick(f.key));
        const cell = (e, key) => {
            if (key === 'contractText') return `<span class="fa-badge ${e.contracts ? 'ok' : 'dim'}">${esc(e.contractText)}</span>`;
            const v = key === 'room' ? roomOf(e) : e[key];
            return `<span class="sm-wrap">${esc(v || '-')}</span>`;
        };
        // งานของคนที่แสดงอยู่ รวมตามหัวเรื่อง (มุมขวา = จำนวนคน) — กดเข้าไปดู/ลบทั้งกลุ่มได้
        const groups = new Map();
        rows.forEach(e => tasksOf(e.key).filter(t => t.status !== 'cancelled').forEach(t => {
            const g = groups.get(t.title) || { title: t.title, tasks: [] };
            g.tasks.push(t);
            groups.set(t.title, g);
        }));
        state.groups = [...groups.values()].sort((a, b) => b.tasks.length - a.tasks.length);
        const groupChips = state.groups.map((g, i) => `<button type="button" class="sm-group" data-group="${i}" title="${esc(`${g.title} · ${g.tasks.length} คน`)}"><span>${esc(g.title)}</span><i>${g.tasks.length}</i></button>`).join('');
        $('smHead').innerHTML = `<th class="sm-no">ลำดับ</th><th>บริษัท</th><th>สถานะปัจจุบัน</th><th>ชื่อเล่น</th><th>ชื่อพนักงาน</th>${extra.map(f => `<th>${esc(f.label)}</th>`).join('')}<th class="sm-tasks-head">งานที่มอบหมาย ${groupChips ? `<span class="sm-groups">${groupChips}</span>` : ''}</th><th class="sm-bulk-head">${can('broadcast') ? `<button type="button" class="fa-btn sm-broadcast" data-action="broadcast" title="ส่งข้อความถึงพนักงานที่แสดงอยู่ทั้งหมด ผ่านคิว LINE OA">📢 ส่งข้อความแบบหมู่ (${rows.length})</button>` : ''}</th>`;
        const span = 7 + extra.length;
        if (!rows.length) { $('smRows').innerHTML = `<tr><td colspan="${span}" class="fa-empty">ไม่พบพนักงานตามตัวกรอง</td></tr>`; return; }
        $('smRows').innerHTML = rows.map((e, index) => {
            const list = tasksOf(e.key).filter(t => t.status !== 'cancelled');
            const pills = claimCard(e) + boxGroupsOf(list, recordsOf(e)).map(boxLinkHtml).join('');
            return `<tr>
                <td class="sm-no">${index + 1}</td>
                <td>${esc(e.company || '-')}</td>
                <td><span class="fa-badge ${isOnWork(e) ? 'ok' : 'dim'}">${esc(e.status || '-')}</span></td>
                <td class="sm-nick">${esc(e.nickname || '-')}</td>
                <td><b>${esc(e.fullname)}</b><small>${esc([e.employeeId || e.centralId, e.insuranceCode].filter(Boolean).join(' · '))}</small></td>
                ${extra.map(f => `<td>${cell(e, f.key)}</td>`).join('')}
                <td class="sm-tasks-cell"><div class="sm-tasks">${pills || '<span class="fa-badge dim">ยังไม่มีงาน</span>'}</div></td>
                <td class="sm-actions">${(() => {
                    // ปุ่มตรวจ: งานที่มอบหมาย (มีข้อมูลให้ส่ง) → หน้าตรวจงาน · ไม่มีงานแต่ส่งเอกสารเองมา → เปิดเอกสารที่รอตรวจ
                    const recs = recordsOf(e).sort((x, y) => (REVIEW.has(y.status) - REVIEW.has(x.status)) || y.id - x.id);
                    const hasTask = list.some(t => (t.fields || []).length || (t.uploads || []).length || t.submitted_at);
                    const dot = list.some(t => t.status === 'submitted') || recs.some(r => REVIEW.has(r.status)) ? ' <i class="sm-dot"></i>' : '';
                    // มีให้ตรวจมากกว่า 1 อย่าง (เช่น ตรวจ 4 โรค + ตรวจสุขภาพประจำปี) → ให้เลือกก่อนว่าจะตรวจอะไร
                    if (recs.length + (hasTask ? 1 : 0) > 1) return `<button type="button" class="fa-btn sm-check" data-check-pick="${esc(e.key)}" title="เลือกว่าจะตรวจกล่องไหน">ตรวจ ▾${dot}</button>`;
                    if (hasTask) return `<button type="button" class="fa-btn sm-check" data-check="${esc(e.key)}">ตรวจ${dot}</button>`;
                    if (recs.length) return `<button type="button" class="fa-btn sm-check" data-record="${recs[0].id}">ตรวจ${dot}</button>`;
                    return '<button type="button" class="fa-btn sm-check" disabled title="ยังไม่มีงานที่ต้องส่งข้อมูล">ตรวจ</button>';
                })()}<button type="button" class="fa-btn sm-plan" data-plan="${esc(e.key)}">จัดงาน</button></td>
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
                    ${templatesHtml()}
                    <form class="sm-form" id="smNewTask">${taskFields()}
                        <div class="sm-wide sm-target" data-target>
                            <b>มอบหมายให้</b>
                            <label><input type="radio" name="target" value="one" checked> เฉพาะ ${esc(e.fullname)}</label>
                            <label><input type="radio" name="target" value="missing"> คนที่กรองอยู่ ที่<u>ยังไม่มี</u>งานนี้ (<span data-n="missing">0</span> คน)</label>
                            <label><input type="radio" name="target" value="all"> คนที่กรองอยู่ทั้งหมด (${visible.length} คน) — คนที่มีงานนี้แล้ว <span data-n="has">0</span> คน จะได้งานซ้ำอีก 1 งาน</label>
                            <label><input type="radio" name="target" value="pick"> เลือกเป็นรายคน…</label>
                            <div class="sm-target-picks" data-target-picks hidden>
                                <div class="sm-target-tools"><input type="search" data-tp-search placeholder="ค้นหาชื่อ ชื่อเล่น รหัสพนักงาน…">
                                    <button type="button" class="fa-btn fa-btn-ghost" data-tp="missing">เลือกคนที่ยังไม่มีงานนี้</button>
                                    <button type="button" class="fa-btn fa-btn-ghost" data-tp="all">เลือกทั้งหมด</button>
                                    <button type="button" class="fa-btn fa-btn-ghost" data-tp="none">ล้าง</button>
                                    <span class="sm-meta" data-tp-count></span></div>
                                <div class="sm-pick-list" data-tp-list></div>
                            </div>
                        </div>
                        <div class="sm-form-foot">
                            <span class="sm-meta" data-target-sum></span>
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
        // ข้อมูลที่กรอกค้างไว้ของพนักงานคนนี้ (ปิดหน้าต่างไปก่อนส่ง) → ใส่คืน
        const draft = state.drafts.get(key);
        state.targetPicks = new Set();
        if (draft) fillForm($('smNewTask'), draft);
        else syncBuilder($('smNewTask'));
        syncTarget($('smNewTask'));
        const dialog = $('smDialog');
        if (!dialog.open) dialog.showModal();
    }
    // ช่องของฟอร์มสร้างงาน (หัวเรื่อง กล่อง ประเภท ช่องกรอก/อัปโหลด)
    function taskFields(boxKey = 'quests') {
        const opt = list => list.map(v => `<option>${esc(v)}</option>`).join('');
        return `
                        <label class="sm-wide sm-f-title">หัวเรื่องงาน <span class="sm-req">*</span><input name="title" maxlength="150" required placeholder="เช่น ส่งเอกสารตรวจสุขภาพประจำปี"></label>
                        <div class="sm-wide sm-kinds">
                            <span class="sm-kinds-title">ใครเห็นกล่องงานนี้</span>
                            <label><input type="radio" name="scope" value="main"> งานหลัก (ทุกคนเห็นในเมนู)</label>
                            <label><input type="radio" name="scope" value="personal"> งานส่วนบุคคล (เฉพาะคนที่เลือก · แถบ &quot;รายการเฉพาะคุณ&quot;)</label>
                        </div>
                        <label class="sm-wide sm-f-detail">รายละเอียด<textarea name="detail" maxlength="3000" placeholder="สิ่งที่ต้องทำ ขั้นตอน เอกสารที่ต้องใช้ ผู้ประสานงาน"></textarea></label>
                        <label class="sm-wide">ลงกล่องงาน (หน้าระบบจัดการองค์กร)<select name="box">
                            ${(state.data.boxes || []).map(b => `<option value="${esc(b.key)}" ${b.key === boxKey ? 'selected' : ''}>${esc(`${b.icon} ${b.title}`)}</option>`).join('')}
                            <option value="__new">＋ สร้างกล่องใหม่…</option></select></label>
                        <div class="sm-wide sm-tpl-summary" data-tpl-summary hidden></div>
                        <div class="sm-wide sm-boxform" data-boxform></div>
                        <label class="sm-newbox sm-wide" hidden>ชื่อกล่องใหม่ <span class="sm-req">*</span><input name="new_box_title" maxlength="80" placeholder="เช่น เอกสารเดินทางไป SL"></label>
                        <label>ความสำคัญ<select name="priority">${opt(state.data.priorities)}</select></label>
                        <label>กำหนดเสร็จ<input type="date" name="due_date"></label>
                        <div class="sm-wide sm-kinds sm-f-kind">
                            <span class="sm-kinds-title" data-kinds-title>ประเภทงาน</span>
                            <label><input type="radio" name="kind" value="notice" checked> แจ้งให้รับทราบอย่างเดียว</label>
                            <label><input type="radio" name="kind" value="info"> งานเก็บข้อมูล (ให้กรอกข้อมูล)</label>
                            <label><input type="radio" name="kind" value="info_upload"> งานเก็บข้อมูลและอัปโหลดเอกสาร</label>
                        </div>
                        <label class="sm-wide sm-section-pick" data-section hidden>เก็บข้อมูลไว้ที่ส่วนงาน <span class="sm-req">*</span>
                            <select name="section"><option value="">— เลือกส่วนงาน —</option>${Object.entries(state.data.sections || {}).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
                            <small>ระบบสร้าง Google Sheet เก็บข้อมูลที่พนักงานกรอก${'' /* และ */} และโฟลเดอร์เก็บไฟล์ (รูป / PDF) ไว้ในโฟลเดอร์ของส่วนงานนี้ให้ทันทีเมื่อมอบหมายงาน</small></label>
                        <div class="sm-wide sm-builder" data-builder="fields" hidden>
                            <b>ช่องกรอกข้อมูล</b><small>ตั้งหัวเรื่องของแต่ละช่อง เช่น เบอร์โทรศัพท์, เลขบัญชี</small>
                            <div class="sm-builder-rows"></div>
                            <button type="button" class="fa-btn fa-btn-ghost" data-add="fields">＋ เพิ่มช่องกรอกข้อมูล</button>
                        </div>
                        <div class="sm-wide sm-builder" data-builder="uploads" hidden>
                            <b>ช่องอัปโหลด</b><small>เขียนว่าให้อัปโหลดอะไร และเลือกชนิดไฟล์ — ไฟล์ PDF พนักงานกรอกรหัสเปิดไฟล์ได้ (ถ้ามี)</small>
                            <div class="sm-builder-rows"></div>
                            <button type="button" class="fa-btn fa-btn-ghost" data-add="uploads">＋ เพิ่มช่องอัปโหลด</button>
                        </div>
`;
    }

    // ---------------------------------------------------------------- สร้างงานก่อน แล้วเลือกคนทีหลัง (ปุ่ม ＋ ในแถวกล่องงาน)
    const CREATE = '__create';
    function openCreate(boxKey) {
        state.mode = 'create';
        state.current = CREATE;
        state.picks ||= new Set();
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>＋ สร้างงานใหม่</h2><p>ตั้งงานก่อน แล้วเลือกพนักงานที่จะได้รับงานนี้ด้านล่าง</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <section class="sm-section">
                    <h3>1. รายละเอียดงาน</h3>
                    ${templatesHtml()}
                    <form class="sm-form" id="smNewTask" data-create="1">${taskFields(boxKey)}
                        <div class="sm-wide sm-pick">
                            <h3>2. เลือกพนักงาน <span class="sm-meta" id="smPickCount"></span></h3>
                            <div class="sm-pick-tools">
                                <input type="search" id="smPickSearch" placeholder="ค้นหาชื่อ ชื่อเล่น รหัสพนักงาน บริษัท ตึก…" autocomplete="off">
                                <button type="button" class="fa-btn fa-btn-ghost" data-pick-all>เลือกทั้งหมดที่แสดง</button>
                                <button type="button" class="fa-btn fa-btn-ghost" data-pick-none>ล้างที่เลือก</button>
                            </div>
                            <small class="sm-meta">รายชื่อตามตัวกรองของตารางตอนนี้ (${filtered().length} คน) — ปิดหน้าต่างไปกรองตารางก่อนได้ งานที่กรอกไว้จะยังอยู่</small>
                            <div class="sm-pick-list" id="smPickList"></div>
                        </div>
                        <div class="sm-form-foot">
                            <span class="sm-meta">งานจะขึ้นในหน้าระบบจัดการองค์กรของพนักงานที่เลือก</span>
                            <button type="submit" class="fa-btn fa-btn-primary">มอบหมายงาน</button>
                        </div>
                    </form>
                </section>
            </div>`;
        const draft = state.drafts.get(CREATE);
        if (draft) fillForm($('smNewTask'), { ...draft, box: boxKey || draft.box });
        else syncBuilder($('smNewTask'));
        renderPicks();
        if (!$('smDialog').open) $('smDialog').showModal();
    }
    function pickPool() {
        const q = ($('smPickSearch')?.value || '').trim().toLowerCase();
        return filtered().filter(e => !q || [e.fullname, e.nickname, e.employeeId, e.centralId, e.insuranceCode, e.company, e.building, e.area]
            .some(v => String(v || '').toLowerCase().includes(q)));
    }
    function renderPicks() {
        const list = pickPool();
        $('smPickCount').textContent = `เลือกแล้ว ${state.picks.size} คน`;
        $('smPickList').innerHTML = list.length ? list.slice(0, 500).map(e => `
            <label class="sm-pick-row"><input type="checkbox" data-pick="${esc(e.key)}" ${state.picks.has(e.key) ? 'checked' : ''}>
                <b>${esc(e.fullname)}</b>${e.nickname ? ` <span class="fa-type">${esc(e.nickname)}</span>` : ''}
                <small>${esc([e.employeeId || e.centralId, e.company, e.status].filter(Boolean).join(' · '))}</small></label>`).join('')
            + (list.length > 500 ? `<p class="sm-meta">แสดง 500 จาก ${list.length} คน — พิมพ์ค้นหาเพื่อหาคนอื่น หรือกด "เลือกทั้งหมดที่แสดง"</p>` : '')
            : '<p class="fa-empty">ไม่พบพนักงาน</p>';
    }
    $('smDialog').addEventListener('input', event => { if (event.target.id === 'smPickSearch') renderPicks(); });
    $('smDialog').addEventListener('change', event => {
        const box = event.target.closest('[data-pick]');
        if (!box) return;
        if (box.checked) state.picks.add(box.dataset.pick); else state.picks.delete(box.dataset.pick);
        $('smPickCount').textContent = `เลือกแล้ว ${state.picks.size} คน`;
    });
    $('smDialog').addEventListener('click', event => {
        if (event.target.closest('[data-pick-all]')) { pickPool().forEach(e => state.picks.add(e.key)); renderPicks(); }
        if (event.target.closest('[data-pick-none]')) { state.picks.clear(); renderPicks(); }
    });

    // หัวเรื่องงานที่เคยสร้าง → ปุ่มให้กดใช้ซ้ำ (กรอกทุกช่องเหมือนเดิม ไม่ต้องตั้งใหม่)
    function templates() {
        const seen = new Set();
        return [...state.data.tasks].sort((a, b) => b.id - a.id).filter(t => {
            const k = t.title.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 15);
    }
    function templatesHtml() {
        const list = templates();
        if (!list.length) return '';
        return `<div class="sm-templates"><span>ใช้หัวเรื่องที่เคยสร้าง:</span>${list.map(t =>
            `<button type="button" class="sm-template" data-template="${t.id}" title="${esc(`${t.box_title || ''} · ${t.kind_label || ''}`)}">${esc(t.title)}</button>`).join('')}</div>`;
    }
    // "งานนี้" = หัวเรื่องเดียวกันในกล่องเดียวกัน (ที่ยังไม่ยกเลิก/ลบ)
    function hasThisTask(form, key) {
        const title = form.title.value.trim();
        if (!title) return false;
        return tasksOf(key).some(t => t.title === title && t.box === form.box.value && !['cancelled', 'deleted'].includes(t.status));
    }
    function targetKeys(form, target) {
        if (target === 'one') return [state.current];
        if (target === 'pick') return [...(state.targetPicks || [])];
        const pool = filtered().map(e => e.key);
        return target === 'missing' ? pool.filter(k => !hasThisTask(form, k)) : pool;
    }
    function syncTarget(form) {
        const box = form?.querySelector('[data-target]');
        if (!box) return;
        const pool = filtered();
        const has = pool.filter(e => hasThisTask(form, e.key)).length;
        box.querySelector('[data-n=missing]').textContent = pool.length - has;
        box.querySelector('[data-n=has]').textContent = has;
        const target = form.querySelector('[name=target]:checked')?.value || 'one';
        const panel = box.querySelector('[data-target-picks]');
        panel.hidden = target !== 'pick';
        state.targetPicks ||= new Set();
        if (target === 'pick') {
            const q = (panel.querySelector('[data-tp-search]').value || '').trim().toLowerCase();
            const list = pool.map((e, i) => ({ e, n: i + 1 })).filter(({ e }) => !q || [e.fullname, e.nickname, e.employeeId, e.centralId, e.insuranceCode].some(v => String(v || '').toLowerCase().includes(q)));
            panel.querySelector('[data-tp-list]').innerHTML = list.map(({ e, n }) => `
                <label class="sm-pick-row"><input type="checkbox" data-tp-pick="${esc(e.key)}" ${state.targetPicks.has(e.key) ? 'checked' : ''}>
                    <span class="sm-no">${n}</span><b>${esc(e.fullname)}</b>${e.nickname ? ` <span class="fa-type">${esc(e.nickname)}</span>` : ''}
                    ${hasThisTask(form, e.key) ? '<span class="sm-has-task">มีงานนี้แล้ว</span>' : ''}
                    <small>${esc([e.employeeId || e.centralId, e.company].filter(Boolean).join(' · '))}</small></label>`).join('') || '<p class="fa-empty">ไม่พบพนักงาน</p>';
            panel.querySelector('[data-tp-count]').textContent = `เลือกแล้ว ${state.targetPicks.size} คน`;
        }
        const keys = targetKeys(form, target);
        const dup = keys.filter(k => hasThisTask(form, k)).length;
        form.querySelector('[data-target-sum]').textContent = `จะมอบหมาย ${keys.length} คน${dup ? ` (ซ้ำ ${dup} คน)` : ''}`;
    }
    $('smDialog').addEventListener('input', event => { const form = event.target.closest('#smNewTask'); if (form && (event.target.name === 'title' || event.target.matches('[data-tp-search]'))) syncTarget(form); });
    $('smDialog').addEventListener('change', event => {
        const form = event.target.closest('#smNewTask');
        if (!form) return;
        const pick = event.target.closest('[data-tp-pick]');
        if (pick) { state.targetPicks ||= new Set(); if (pick.checked) state.targetPicks.add(pick.dataset.tpPick); else state.targetPicks.delete(pick.dataset.tpPick); }
        if (event.target.matches('[name=target], [name=box], [data-tp-pick]')) syncTarget(form);
    });
    $('smDialog').addEventListener('click', event => {
        const btn = event.target.closest('[data-tp]');
        if (!btn) return;
        const form = btn.closest('#smNewTask');
        const pool = filtered().map(e => e.key);
        state.targetPicks = new Set(btn.dataset.tp === 'none' ? [] : btn.dataset.tp === 'missing' ? pool.filter(k => !hasThisTask(form, k)) : pool);
        syncTarget(form);
    });
    function readForm(form) {
        const rows = type => [...form.querySelectorAll(`[data-builder="${type}"] .sm-builder-row`)];
        return {
            title: form.title.value, detail: form.detail.value, box: form.box.value, new_box_title: form.new_box_title.value,
            priority: form.priority.value, due_date: form.due_date.value, section: form.section?.value || "", kind: form.querySelector('[name=kind]:checked')?.value || 'notice',
            target: form.querySelector('[name=target]:checked')?.value || 'one',
            fields: rows('fields').map(r => ({ label: r.querySelector('[data-label]').value })),
            uploads: rows('uploads').map(r => ({ label: r.querySelector('[data-label]').value, type: r.querySelector('[data-type]').value }))
        };
    }
    function fillForm(form, d) {
        ['title', 'detail', 'new_box_title', 'priority', 'due_date', 'section'].forEach(k => { if (d[k] !== undefined && form[k]) form[k].value = d[k]; });
        if (d.box && [...form.box.options].some(o => o.value === d.box)) form.box.value = d.box;
        const kind = form.querySelector(`[name=kind][value="${d.kind || 'notice'}"]`);
        if (kind) kind.checked = true;
        const target = form.querySelector(`[name=target][value="${d.target || 'one'}"]`);
        if (target) target.checked = true;
        [['fields', d.fields || []], ['uploads', d.uploads || []]].forEach(([type, list]) => {
            const rows = form.querySelector(`[data-builder="${type}"] .sm-builder-rows`);
            rows.replaceChildren(...list.map(item => {
                const row = builderRow(type);
                row.querySelector('[data-label]').value = item.label || '';
                if (type === 'uploads') row.querySelector('[data-type]').value = item.type === 'pdf' ? 'pdf' : 'image';
                return row;
            }));
        });
        syncBuilder(form);
        syncTarget(form);
    }
    function useTemplate(id) {
        const t = state.data.tasks.find(x => x.id === Number(id));
        if (!t) return;
        fillForm($('smNewTask'), { title: t.title, detail: t.detail || '', box: t.box || 'quests', new_box_title: '', priority: t.priority || 'ปกติ',
            due_date: t.due_date || '', section: t.section || '', kind: t.kind || 'notice', fields: t.fields || [], uploads: t.uploads || [] });
        toast(`ใช้หัวเรื่อง "${t.title}" แล้ว — แก้ไขได้ก่อนกดมอบหมาย`);
    }
    // ตัวสร้างแบบฟอร์มงาน: เพิ่ม/ลบช่องกรอกข้อมูลและช่องอัปโหลด
    function builderRow(type) {
        const row = document.createElement('div');
        row.className = 'sm-builder-row';
        row.innerHTML = type === 'fields'
            ? '<input data-label maxlength="150" placeholder="หัวเรื่องช่องกรอกข้อมูล"><button type="button" class="fa-btn fa-btn-ghost" data-remove title="ลบช่องนี้">×</button>'
            : '<input data-label maxlength="150" placeholder="ให้อัปโหลดอะไร เช่น ผลตรวจ 4 โรค"><select data-type><option value="image">รูปภาพ</option><option value="pdf">PDF (มีช่องกรอกรหัส ถ้ามี)</option></select><button type="button" class="fa-btn fa-btn-ghost" data-remove title="ลบช่องนี้">×</button>';
        return row;
    }
    // ช่องของแบบฟอร์มในกล่องที่เลือก — ให้เห็นว่าพนักงานต้องกรอก/อัปโหลดอะไรในกล่องนี้อยู่แล้ว
    const FIELD_TYPES = { text: 'ข้อความ', textarea: 'ข้อความยาว', number: 'ตัวเลข', date: 'วันที่', time: 'เวลา', tel: 'เบอร์โทร', select: 'เลือก 1 ข้อ', radio: 'เลือก 1 ข้อ', files: 'อัปโหลดรูป/PDF' };
    function renderBoxForm(form) {
        const box = (state.data.boxes || []).find(b => b.key === form.box.value);
        const slot = form.querySelector('[data-boxform]');
        if (slot.dataset.editing && slot.dataset.editing === form.box.value) return;   // กำลังแก้ช่องอยู่
        delete slot.dataset.editing;
        const fields = box?.form || [];
        const title = form.querySelector('[data-kinds-title]');
        if (title) title.textContent = fields.length || box?.link ? 'สิ่งที่ขอเพิ่มเติมนอกจากแบบฟอร์มของกล่อง (ถ้ามี)' : 'ประเภทงาน';
        if (!box || (!fields.length && !box.link)) { slot.hidden = true; slot.innerHTML = ''; return; }
        slot.hidden = false;
        slot.innerHTML = box.link
            ? `<b>${esc(box.icon)} ${esc(box.title)}</b><p>${esc(box.description)} — พนักงานกดจากกล่องนี้ไปที่ระบบแยก (ไม่มีช่องกรอกในกล่อง)</p>`
            : `<b>${esc(box.icon)} แบบฟอร์มในกล่อง "${esc(box.title)}" — พนักงานต้องกรอก/อัปโหลด ${fields.length} ช่อง</b>
                <ol>${fields.map(f => `<li class="${f.type === 'files' ? 'is-file' : ''}">
                    <span>${f.type === 'files' ? '📎' : '✏️'} ${esc(f.label)}${f.required ? ' <i class="sm-req">*</i>' : ' <small>(ถ้ามี)</small>'}</span>
                    <small>${esc(FIELD_TYPES[f.type] || f.type)}${f.type === 'files' && f.max ? ` · ได้ถึง ${f.max} ไฟล์` : ''}${f.options?.length ? `: ${esc(f.options.join(' / '))}` : ''}${f.when ? ` · ${esc(f.when)}` : ''}</small></li>`).join('')}</ol>
                <p>งานนี้จะขึ้นเหนือแบบฟอร์มในกล่องนี้ — ถ้าต้องการข้อมูลอื่นนอกจากนี้ ให้เลือกด้านล่าง</p>
                ${box.editable ? `<div class="sm-boxform-tools"><button type="button" class="fa-btn fa-btn-ghost" data-form-edit>✏️ แก้ไขช่องของแบบฟอร์ม</button>
                    ${box.edited ? '<button type="button" class="fa-btn fa-btn-ghost" data-form-reset>↺ คืนค่าเริ่มต้น</button><small>แก้ไขแล้ว</small>' : ''}</div>` : ''}`;
    }
    // ตัวแก้ช่องของแบบฟอร์ม — บันทึกแล้วหน้าระบบจัดการองค์กรใช้ช่องชุดใหม่ทันที
    const EDIT_TYPES = [['text', 'ข้อความ'], ['textarea', 'ข้อความยาว'], ['number', 'ตัวเลข / จำนวนเงิน'], ['date', 'วันที่'], ['time', 'เวลา'], ['tel', 'เบอร์โทร'], ['select', 'เลือก 1 ข้อ (รายการ)'], ['radio', 'เลือก 1 ข้อ (ปุ่ม)'], ['files', 'อัปโหลดรูป/PDF']];
    function formEditRow(f = { label: '', type: 'text' }) {
        const row = document.createElement('div');
        row.className = 'sm-fe-row';
        row.dataset.name = f.name || '';
        row.innerHTML = `<input data-fe="label" maxlength="120" placeholder="หัวข้อช่อง เช่น ใบเสร็จ" value="${esc(f.label)}">
            <select data-fe="type">${EDIT_TYPES.map(([v, l]) => `<option value="${v}" ${v === f.type ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <label class="sm-fe-req"><input type="checkbox" data-fe="required" ${f.required ? 'checked' : ''}> บังคับ</label>
            <input data-fe="max" type="number" min="1" max="20" value="${f.max || 5}" title="จำนวนไฟล์สูงสุด" ${f.type === 'files' ? '' : 'hidden'}>
            <span class="sm-fe-move"><button type="button" data-fe-up title="เลื่อนขึ้น">↑</button><button type="button" data-fe-down title="เลื่อนลง">↓</button><button type="button" data-fe-del title="ลบช่อง">×</button></span>
            <input data-fe="options" placeholder="ตัวเลือก คั่นด้วย , เช่น เงินสด, เงินโอน" value="${esc((f.options || []).join(', '))}" ${/select|radio/.test(f.type) ? '' : 'hidden'}>`;
        return row;
    }
    function openFormEditor(form) {
        const box = (state.data.boxes || []).find(b => b.key === form.box.value);
        const slot = form.querySelector('[data-boxform]');
        slot.dataset.editing = form.box.value;
        slot.innerHTML = `<b>✏️ แก้ไขช่องของแบบฟอร์ม "${esc(box.title)}"</b>
            <p>เพิ่ม ลบ เรียงลำดับ หรือแก้หัวข้อช่อง — บันทึกแล้วหน้าระบบจัดการองค์กรและชีตปลายทางใช้ช่องชุดนี้ทันที (ข้อมูลที่ส่งมาแล้วไม่หาย)</p>
            <div class="sm-fe-rows"></div>
            <div class="sm-boxform-tools"><button type="button" class="fa-btn fa-btn-ghost" data-fe-add>＋ เพิ่มช่อง</button>
                <button type="button" class="fa-btn fa-btn-ghost" data-fe-cancel>ยกเลิก</button>
                <button type="button" class="fa-btn fa-btn-primary" data-fe-save>บันทึกแบบฟอร์ม</button></div>`;
        slot.querySelector('.sm-fe-rows').append(...box.form.map(formEditRow));
    }
    async function saveFormEditor(form, button, reset = false) {
        const key = form.box.value;
        const fields = [...form.querySelectorAll('.sm-fe-row')].map(r => ({
            name: r.dataset.name || undefined, label: r.querySelector('[data-fe=label]').value.trim(), type: r.querySelector('[data-fe=type]').value,
            required: r.querySelector('[data-fe=required]').checked, max: Number(r.querySelector('[data-fe=max]').value) || 5,
            options: r.querySelector('[data-fe=options]').value.split(',').map(s => s.trim()).filter(Boolean)
        })).filter(f => f.label);
        if (!reset && !fields.length) return toast('แบบฟอร์มต้องมีอย่างน้อย 1 ช่อง', true);
        if (reset && !confirm('คืนค่าแบบฟอร์มนี้เป็นช่องเริ่มต้นของระบบ?')) return;
        button.disabled = true;
        try {
            const { boxes } = await request(`/boxes/${encodeURIComponent(key)}/form`, { method: 'PUT', body: JSON.stringify(reset ? { reset: true } : { fields }) });
            state.data.boxes = workBoxes(boxes);
            delete form.querySelector('[data-boxform]').dataset.editing;
            renderBoxForm(form);
            toast(reset ? 'คืนค่าเริ่มต้นแล้ว' : 'บันทึกแบบฟอร์มแล้ว — หน้าระบบจัดการองค์กรเปลี่ยนตามแล้ว');
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    $('smDialog').addEventListener('click', event => {
        const form = event.target.closest('#smNewTask');
        if (!form) return;
        if (event.target.closest('[data-form-edit]')) return openFormEditor(form);
        if (event.target.closest('[data-form-reset]')) return saveFormEditor(form, event.target.closest('button'), true);
        if (event.target.closest('[data-fe-cancel]')) { delete form.querySelector('[data-boxform]').dataset.editing; return renderBoxForm(form); }
        if (event.target.closest('[data-fe-save]')) return saveFormEditor(form, event.target.closest('button'));
        if (event.target.closest('[data-fe-add]')) { const row = formEditRow(); form.querySelector('.sm-fe-rows').append(row); row.querySelector('input').focus(); return; }
        const row = event.target.closest('.sm-fe-row');
        if (!row) return;
        if (event.target.closest('[data-fe-del]')) row.remove();
        if (event.target.closest('[data-fe-up]') && row.previousElementSibling) row.after(row.previousElementSibling);
        if (event.target.closest('[data-fe-down]') && row.nextElementSibling) row.before(row.nextElementSibling);
    });
    $('smDialog').addEventListener('change', event => {
        const type = event.target.closest('[data-fe=type]');
        if (!type) return;
        const row = type.closest('.sm-fe-row');
        row.querySelector('[data-fe=max]').hidden = type.value !== 'files';
        row.querySelector('[data-fe=options]').hidden = !/select|radio/.test(type.value);
    });
    // ---------------------------------------------------------------- แม่พิมพ์กล่องงาน
    function tplOf(box) {
        if (!box || box.key === '__new') return null;
        if (box.template?.title) return { ...box.template, saved: true };
        if (box.key === 'quests') return null;
        const first = (state.data.tasks || []).filter(t => t.box === box.key && !['deleted', 'cancelled'].includes(t.status)).sort((a, b) => a.id - b.id)[0];
        return first ? { title: first.title, detail: first.detail || '', priority: first.priority || 'ปกติ', kind: first.kind || 'notice',
            fields: (first.fields || []).map(x => x.label), uploads: (first.uploads || []).map(u => ({ label: u.label, type: u.type })), section: first.section || '', saved: false } : null;
    }
    const KIND_TEXT = { notice: 'แจ้งให้รับทราบ', info: 'เก็บข้อมูล', info_upload: 'เก็บข้อมูล + อัปโหลด' };
    function applyTemplate(form, box) {
        const tpl = tplOf(box);
        const sum = form.querySelector('[data-tpl-summary]');
        form.classList.toggle('is-tpl', Boolean(tpl));
        if (sum) sum.hidden = !tpl;
        if (!tpl) return;
        form.dataset.filling = '1';
        fillForm(form, { title: tpl.title, detail: tpl.detail, box: box.key, new_box_title: '', priority: tpl.priority || 'ปกติ', due_date: form.due_date.value,
            section: tpl.section || '', kind: tpl.kind || 'notice', fields: (tpl.fields || []).map(label => ({ label })), uploads: tpl.uploads || [],
            target: form.querySelector('[name=target]:checked')?.value });
        delete form.dataset.filling;
        form.dataset.scopeBox = box.key;
        sum.innerHTML = `<div><b>📋 ใช้แม่พิมพ์ของกล่องนี้</b> — ทุกคนได้งานเหมือนกัน<small>${tpl.saved ? 'แม่พิมพ์ที่บันทึกไว้' : 'จากงานแรกในกล่อง'}</small></div>
            <dl><dt>หัวเรื่อง</dt><dd>${esc(tpl.title)}</dd>
                ${tpl.detail ? `<dt>รายละเอียด</dt><dd>${esc(tpl.detail)}</dd>` : ''}
                <dt>ประเภทงาน</dt><dd>${esc(KIND_TEXT[tpl.kind] || '-')}${(tpl.fields || []).length ? ` · ช่องกรอก ${tpl.fields.length}: ${esc(tpl.fields.join(', '))}` : ''}${(tpl.uploads || []).length ? ` · อัปโหลด ${tpl.uploads.length}: ${esc(tpl.uploads.map(u => u.label).join(', '))}` : ''}</dd></dl>
            <button type="button" class="fa-btn fa-btn-ghost" data-edit-tpl="${esc(box.key)}">✏️ แก้ไขแม่พิมพ์ของกล่อง</button>`;
        syncTarget(form);
    }
    function openTplEditor(key) {
        const box = (state.data.boxes || []).find(b => b.key === key);
        if (!box) return;
        const tpl = tplOf(box);
        state.mode = 'template';
        state.current = null;
        const open = (state.data.tasks || []).filter(t => t.box === key && !t.submitted_at && !['deleted', 'cancelled', 'done', 'submitted'].includes(t.status)).length;
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>✏️ แม่พิมพ์กล่อง · ${esc(box.icon || '📌')} ${esc(box.title)}</h2><p>ตั้งครั้งเดียว — มอบหมายกล่องนี้ให้ใคร ทุกคนได้หัวเรื่อง รายละเอียด และช่องกรอก/อัปโหลดเหมือนกัน</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body"><section class="sm-section">
                <form class="sm-form sm-tpl-form" id="smTplForm" data-key="${esc(key)}">${taskFields(key)}
                    <div class="sm-form-foot">
                        <label><input type="checkbox" name="apply_existing" ${open ? 'checked' : ''}> ใช้กับงานเดิมในกล่องนี้ที่พนักงานยังไม่ส่งด้วย (${open} คน)</label>
                        <button type="submit" class="fa-btn fa-btn-primary">บันทึกแม่พิมพ์</button>
                    </div>
                </form></section></div>`;
        const form = $('smTplForm');
        if (tpl) { form.dataset.filling = '1'; fillForm(form, { title: tpl.title, detail: tpl.detail, box: key, new_box_title: '', priority: tpl.priority || 'ปกติ', due_date: '', section: tpl.section || '', kind: tpl.kind || 'notice', fields: (tpl.fields || []).map(label => ({ label })), uploads: tpl.uploads || [] }); delete form.dataset.filling; }
        else { form.title.value = box.title; syncBuilder(form); }
        if (!$('smDialog').open) $('smDialog').showModal();
    }
    async function saveTemplate(form) {
        const d = readForm(form);
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
            const result = await request(`/boxes/${encodeURIComponent(form.dataset.key)}/template`, { method: 'PUT', body: JSON.stringify({
                title: d.title, detail: d.detail, priority: d.priority, kind: d.kind, section: d.section,
                fields: d.fields.filter(x => x.label.trim()), uploads: d.uploads.filter(x => x.label.trim()), apply_existing: form.apply_existing.checked }) });
            state.data.boxes = workBoxes(result.boxes);
            if (result.tasks) state.data.tasks = result.tasks;
            $('smDialog').close();
            render();
            toast(`บันทึกแม่พิมพ์แล้ว${result.updated ? ` · อัปเดตงานเดิม ${result.updated} คน` : ''}`);
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }
    function syncBuilder(form) {
        // เปลี่ยนกล่อง → ตั้งประเภทงานตามกล่องนั้น (กล่องใหม่ = ส่วนบุคคล)
        if (form.box && form.dataset.scopeBox !== form.box.value) {
            const changedByUser = !form.dataset.filling && form.id === 'smNewTask';
            form.dataset.scopeBox = form.box.value;
            const box = (state.data.boxes || []).find(b => b.key === form.box.value);
            // ฟอร์มมอบหมายงาน: กล่องที่มีแม่พิมพ์ → ล็อกตามแม่พิมพ์ (เลือกแค่คน) · กล่องใหม่/ไม่มีแม่พิมพ์ → กรอกเอง
            if (changedByUser) applyTemplate(form, box);
            const scope = form.box.value === '__new' ? 'personal' : box?.scope || 'main';
            const radio = form.querySelector(`[name=scope][value="${scope}"]`);
            if (radio) radio.checked = true;
            // กล่องที่มีแบบฟอร์มอยู่แล้ว → ใช้แบบฟอร์มของกล่อง ไม่ต้องขออะไรเพิ่ม (เลือกเพิ่มเองได้)
            const notice = form.querySelector('[name=kind][value=notice]');
            if (notice && ((box?.form || []).length || box?.link)) notice.checked = true;
        }
        const kind = form.querySelector('[name=kind]:checked').value;
        form.querySelector('.sm-newbox').hidden = form.box.value !== '__new';
        const sectionPick = form.querySelector('[data-section]');
        if (sectionPick) sectionPick.hidden = kind === 'notice';
        renderBoxForm(form);
        [['fields', kind !== 'notice'], ['uploads', kind === 'info_upload']].forEach(([type, on]) => {
            const box = form.querySelector(`[data-builder="${type}"]`);
            box.hidden = !on;
            const rows = box.querySelector('.sm-builder-rows');
            if (on && !rows.children.length && (type === 'uploads' || kind === 'info')) rows.append(builderRow(type));
        });
    }
    function renderTasks() {
        const list = tasksOf(state.current);
        const statuses = state.data.statuses;
        $('smTaskList').innerHTML = list.length ? list.map(t => `
            <article class="sm-task ${esc(t.status)}" data-task="${t.id}">
                <header>
                    <div><b>${esc(t.title)}</b> <span class="sm-prio ${PRIO_CLASS[t.priority] || ''}">${esc(t.priority)}</span> <span class="fa-type">${esc(t.box_title || t.category)}</span> <span class="fa-type">${esc(t.kind_label || '')}</span>
                        ${t.acknowledged_at ? `<span class="fa-badge ok">รับทราบแล้ว ${esc(when(t.acknowledged_at))}</span>` : '<span class="fa-badge wait">ยังไม่รับทราบ</span>'}</div>
                    <span class="sm-meta">#${t.id} · มอบหมายโดย ${esc(t.created_by)} ${esc(when(t.created_at))}${t.due_date ? ` · กำหนดเสร็จ ${esc(thDate(t.due_date))}` : ''}</span>
                </header>
                ${t.detail ? `<p>${esc(t.detail)}</p>` : ''}
                ${responseHtml(t)}
                <div class="sm-task-actions">
                    <select data-field="status">${Object.entries(statuses).map(([k, v]) => `<option value="${k}" ${k === t.status ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
                    <input data-field="note" value="${esc(t.note)}" placeholder="บันทึกติดตามงาน">
                    <button type="button" class="fa-btn" data-save="${t.id}">บันทึก</button>
                    ${t.status === 'done' ? (t.report_confirmed_at ? `<button type="button" class="fa-btn" data-report-task="${t.id}" data-confirmed="0">↩ ยกเลิกยืนยันลงรายงาน</button>` : `<button type="button" class="fa-btn fa-btn-primary" data-report-task="${t.id}" data-confirmed="1">✅ ยืนยันลงรายงาน</button>`) : '<span class="sm-meta">ตรวจสอบเป็น "เสร็จสิ้น" ก่อน จึงยืนยันลงรายงานได้</span>'}
                    ${(t.fields || []).length || (t.uploads || []).length ? `<button type="button" class="fa-btn" data-goto-check="${esc(t.employee_key)}" title="ดู/ตรวจข้อมูลและเอกสารที่พนักงานส่ง">ตรวจ</button>` : ''}
                    <button type="button" class="fa-btn fa-btn-ghost" data-delete="${t.id}" title="ลบงานนี้เฉพาะพนักงานคนนี้">ลบ</button>
                </div>
                ${t.updated_by && t.updated_at !== t.created_at ? `<span class="sm-meta">แก้ไขล่าสุดโดย ${esc(t.updated_by)} ${esc(when(t.updated_at))}</span>` : ''}
            </article>`).join('') : '<p class="fa-empty">ยังไม่มีงาน — สร้างงานใหม่ด้านบน</p>';
    }

    // ---------------------------------------------------------------- งานกลุ่มเดียวกัน (หัวเรื่องเดียวกัน) / งานรายคน → ดูและลบ
    const personOf = t => state.byKey.get(t.employee_key) || { fullname: t.fullname, nickname: '', company: t.company };
    function openGroup(index) {
        const g = state.groups?.[index];
        if (!g) return;
        state.current = null;
        state.mode = 'group';
        state.groupTitle = g.title;
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>${esc(g.title)}</h2><p>มอบหมายให้ ${g.tasks.length} คน (ในรายการที่กรองอยู่)</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <div class="sm-group-actions">
                    <button type="button" class="fa-btn fa-btn-primary" data-add-people>＋ เพิ่มพนักงานในงานนี้</button>
                    <button type="button" class="fa-btn sm-danger" data-del-group>🗑 ลบงานนี้ทั้งหมด (${g.tasks.length} คน)</button>
                    <span class="sm-meta">ลบแล้วงานจะหายจากหน้าระบบจัดการองค์กรของพนักงานด้วย</span>
                </div>
                <div class="sm-add-people" id="smAddPeople" hidden></div>
                ${[...new Map(g.tasks.filter(t => t.dest).map(t => [t.dest.sheet, t.dest])).values()].map(d => `<div class="sm-dest">📊 รายงานงานนี้ (${esc(d.section_title)}): <a href="${esc(d.sheet)}" target="_blank" rel="noopener">เปิด Google Sheet ↗</a> · <a href="${esc(d.folder)}" target="_blank" rel="noopener">โฟลเดอร์ไฟล์ ↗</a></div>`).join('')}
                <table class="sm-group-table"><thead><tr><th>พนักงาน</th><th>บริษัท</th><th>ขั้นตอน</th><th></th></tr></thead><tbody>
                ${g.tasks.map(t => {
                    const p = personOf(t);
                    return `<tr><td><b>${esc(p.fullname)}</b>${p.nickname ? ` <span class="fa-type">${esc(p.nickname)}</span>` : ''}</td><td>${esc(p.company || '-')}</td>
                        <td><div class="sm-stages">${stagesOf(t).map(([cls, text]) => `<i class="sm-ack ${cls}">${text}</i>`).join('')}</div></td>
                        <td><button type="button" class="fa-btn fa-btn-ghost" data-del-task="${t.id}">ลบออก</button></td></tr>`;
                }).join('')}
                </tbody></table>
            </div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
    }
    // ---------------------------------------------------------------- เพิ่มพนักงานเข้างานเดิม (ตัวกรองย่อย + เลือกรายคน)
    const addState = { picks: new Set(), filters: {}, q: '', hideHas: true };
    function groupSource() {
        const g = state.groups?.find(x => x.title === state.groupTitle);
        return g ? [...g.tasks].sort((a, b) => a.id - b.id)[0] : null;
    }
    const hasTitle = (key, src) => tasksOf(key).some(t => t.title === src.title && t.box === src.box && !['deleted', 'cancelled'].includes(t.status));
    function addPool(src) {
        const q = addState.q.trim().toLowerCase();
        return state.data.employees.filter(e => FILTERS.every(f => !addState.filters[f.key] || ((f.key === 'room' ? roomOf(e) : e[f.key]) || '(ว่าง)') === addState.filters[f.key])
            && (!q || [e.fullname, e.nickname, e.employeeId, e.centralId, e.insuranceCode, e.company, e.building].some(v => String(v || '').toLowerCase().includes(q)))
            && (!addState.hideHas || !hasTitle(e.key, src)));
    }
    function renderAddPeople() {
        const box = $('smAddPeople');
        const src = groupSource();
        if (!box || !src) return;
        const sortTh = (a, b) => a.localeCompare(b, 'th', { numeric: true });
        const pool = addPool(src);
        const selects = FILTERS.map(f => {
            const counts = new Map();
            state.data.employees.forEach(e => { const v = (f.key === 'room' ? roomOf(e) : e[f.key]) || '(ว่าง)'; counts.set(v, (counts.get(v) || 0) + 1); });
            return `<select data-add-filter="${f.key}" title="${esc(f.label)}"><option value="">${esc(f.label)}: ทั้งหมด</option>${[...counts.keys()].sort(sortTh).map(v => `<option value="${esc(v)}" ${addState.filters[f.key] === v ? 'selected' : ''}>${esc(v)} (${counts.get(v)})</option>`).join('')}</select>`;
        }).join('');
        box.innerHTML = `
            <div class="sm-add-head"><b>＋ เพิ่มพนักงานในงาน "${esc(src.title)}"</b><small>ได้งานเหมือนคนเดิมทุกอย่าง และรายงานรวมอยู่ชีตเดิม</small></div>
            <div class="sm-add-filters">${selects}</div>
            <div class="sm-add-tools"><input type="search" data-add-q placeholder="ค้นหาชื่อ ชื่อเล่น รหัส…" value="${esc(addState.q)}">
                <label><input type="checkbox" data-add-hide ${addState.hideHas ? 'checked' : ''}> ซ่อนคนที่มีงานนี้แล้ว</label>
                <button type="button" class="fa-btn fa-btn-ghost" data-add-all>เลือกทั้งหมดที่แสดง (${pool.length})</button>
                <button type="button" class="fa-btn fa-btn-ghost" data-add-none>ล้าง</button>
                <button type="button" class="fa-btn fa-btn-ghost" data-add-reset>ล้างตัวกรอง</button></div>
            <div class="sm-pick-list sm-add-list">${pool.slice(0, 400).map((e, i) => `<label class="sm-pick-row"><input type="checkbox" data-add-pick="${esc(e.key)}" ${addState.picks.has(e.key) ? 'checked' : ''}>
                <span class="sm-no">${i + 1}</span><b>${esc(e.fullname)}</b>${e.nickname ? ` <span class="fa-type">${esc(e.nickname)}</span>` : ''}${hasTitle(e.key, src) ? '<span class="sm-has-task">มีงานนี้แล้ว</span>' : ''}
                <small>${esc([e.company, e.area, e.building, e.status].filter(Boolean).join(' · '))}</small></label>`).join('') || '<p class="fa-empty">ไม่พบพนักงานตามตัวกรอง</p>'}
                ${pool.length > 400 ? `<p class="sm-meta">แสดง 400 จาก ${pool.length} คน — กรองเพิ่มเพื่อหาคนอื่น</p>` : ''}</div>
            <div class="sm-add-foot"><span class="sm-meta" data-add-count>เลือกแล้ว ${addState.picks.size} คน</span><button type="button" class="fa-btn fa-btn-primary" data-add-go>เพิ่ม ${addState.picks.size} คนเข้างานนี้</button></div>`;
    }
    async function addPeopleGo(button) {
        const src = groupSource();
        if (!src || !addState.picks.size) return toast('กรุณาเลือกพนักงานอย่างน้อย 1 คน', true);
        const keys = [...addState.picks];
        const dup = keys.filter(k => hasTitle(k, src)).length;
        if (!confirm(`เพิ่ม ${keys.length} คนเข้างาน "${src.title}"?${dup ? `\n(ในนี้ ${dup} คนมีงานนี้แล้ว — จะได้ซ้ำอีก 1 งาน)` : ''}`)) return;
        button.disabled = true;
        try {
            const { tasks, boxes, skipped } = await request('/tasks', { method: 'POST', body: JSON.stringify({
                title: src.title, detail: src.detail || '', box: src.box, priority: src.priority || 'ปกติ', due_date: src.due_date || '', kind: src.kind || 'notice', section: src.section || '',
                fields: (src.fields || []).map(f => ({ label: f.label })), uploads: (src.uploads || []).map(u => ({ label: u.label, type: u.type })),
                employee_keys: keys, allow_duplicate: dup > 0, join_group: src.dest_group || '' }) });
            state.data.tasks.push(...tasks);
            if (boxes) state.data.boxes = workBoxes(boxes);
            addState.picks.clear();
            render();
            const again = (state.groups || []).findIndex(x => x.title === src.title);
            if (again >= 0) openGroup(again);
            toast(`เพิ่มแล้ว ${tasks.length} คน${skipped ? ` · ข้าม ${skipped} คนที่มีงานนี้อยู่แล้ว` : ''}`);
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }
    $('smDialog').addEventListener('click', event => {
        if (event.target.closest('[data-add-people]')) { const b = $('smAddPeople'); b.hidden = !b.hidden; if (!b.hidden) renderAddPeople(); return; }
        if (event.target.closest('[data-add-all]')) { addPool(groupSource()).forEach(e => addState.picks.add(e.key)); return renderAddPeople(); }
        if (event.target.closest('[data-add-none]')) { addState.picks.clear(); return renderAddPeople(); }
        if (event.target.closest('[data-add-reset]')) { addState.filters = {}; addState.q = ''; return renderAddPeople(); }
        const go = event.target.closest('[data-add-go]');
        if (go) addPeopleGo(go);
    });
    $('smDialog').addEventListener('change', event => {
        const f = event.target.closest('[data-add-filter]');
        if (f) { addState.filters[f.dataset.addFilter] = f.value; return renderAddPeople(); }
        if (event.target.matches('[data-add-hide]')) { addState.hideHas = event.target.checked; return renderAddPeople(); }
        const p = event.target.closest('[data-add-pick]');
        if (p) {
            if (p.checked) addState.picks.add(p.dataset.addPick); else addState.picks.delete(p.dataset.addPick);
            $('smAddPeople').querySelector('[data-add-count]').textContent = `เลือกแล้ว ${addState.picks.size} คน`;
            $('smAddPeople').querySelector('[data-add-go]').textContent = `เพิ่ม ${addState.picks.size} คนเข้างานนี้`;
        }
    });
    $('smDialog').addEventListener('input', event => {
        if (!event.target.matches('[data-add-q]')) return;
        addState.q = event.target.value;
        const pos = event.target.selectionStart;
        renderAddPeople();
        const q = $('smAddPeople').querySelector('[data-add-q]'); q.focus(); q.setSelectionRange(pos, pos);
    });
    function openTaskInfo(id) {
        const t = state.data.tasks.find(x => x.id === Number(id));
        if (!t) return;
        const p = personOf(t);
        state.current = t.employee_key;
        state.mode = 'task';
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>${esc(t.title)}</h2><p>${esc(p.fullname)}${p.nickname ? ` (${esc(p.nickname)})` : ''} · ${esc(t.box_title || '')} · มอบหมายโดย ${esc(t.created_by || '-')} ${esc(when(t.created_at))}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <div class="sm-stages">${stagesOf(t).map(([cls, text]) => `<i class="sm-ack ${cls}">${text}</i>`).join('')}</div>
                ${t.detail ? `<p class="sm-task-detail">${esc(t.detail)}</p>` : ''}
                ${responseHtml(t)}
                <div class="sm-group-actions">
                    <button type="button" class="fa-btn sm-danger" data-del-task="${t.id}">🗑 ลบงานนี้ออกจาก ${esc(p.fullname)}</button>
                    <button type="button" class="fa-btn" data-goto-plan="${esc(t.employee_key)}">จัดงานของคนนี้</button>
                    ${(t.fields || []).length || (t.uploads || []).length ? `<button type="button" class="fa-btn" data-goto-check="${esc(t.employee_key)}">ตรวจเอกสาร</button>` : ''}
                </div>
            </div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
    }
    function openPersonTasks(key, focusId) {
        const e = state.byKey.get(key) || personOf(state.data.tasks.find(t => t.employee_key === key) || {});
        state.current = key;
        state.mode = 'tasks';
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>งานของ ${esc(e.fullname || key)}${e.nickname ? ` (${esc(e.nickname)})` : ''}</h2><p>${esc([e.company, e.employeeId || e.centralId, e.insuranceCode].filter(Boolean).join(' · '))} — แก้สถานะ บันทึก ลบ หรือตรวจ ได้ที่นี่ (มีผลเฉพาะพนักงานคนนี้)</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <div class="sm-group-actions"><button type="button" class="fa-btn" data-goto-plan="${esc(key)}">＋ จัดงานเพิ่มให้คนนี้</button></div>
                <section class="sm-section"><div class="sm-task-list" id="smTaskList"></div></section>
            </div>`;
        renderTasks();
        if (!$('smDialog').open) $('smDialog').showModal();
        const card = focusId && $('smTaskList').querySelector(`[data-task="${focusId}"]`);
        if (card) { card.classList.add('is-focus'); setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }
    }
    // ลบงาน: ยืนยัน 2 รอบ — งานที่มีไฟล์รายงาน/ไฟล์ที่พนักงานส่ง จะลบไฟล์บน Drive ด้วย
    async function deleteTasks(ids, label, onlyPerson = false) {
        if (!ids.length) return false;
        if (!can('deleteWork')) { toast('บัญชีนี้ไม่มีสิทธิ์ลบงาน (ลบงานและกล่องงาน) — ขอสิทธิ์จากผู้ดูแลระบบ', true); return false; }
        const withFiles = state.data.tasks.some(t => ids.map(Number).includes(t.id) && t.dest);
        if (!confirm(`ต้องการ${label}ใช่ไหม?\n\nพนักงานจะไม่เห็นงานนี้ในหน้าระบบจัดการองค์กรอีก`)) return false;
        if (!confirm(withFiles
            ? '⚠️ ยืนยันอีกครั้ง\n\nถ้าลบ ข้อมูลและไฟล์ทั้งหมดของงานนี้ (ชีตรายงาน รูป PDF ที่พนักงานส่ง) จะหายจากทุกโฟลเดอร์ และอาจกู้คืนไม่ได้\n\nกด "ตกลง" เพื่อลบ'
            : '⚠️ ยืนยันอีกครั้ง\n\nถ้าลบ ข้อมูลงานนี้จะหายและอาจกู้คืนไม่ได้\n\nกด "ตกลง" เพื่อลบ')) return false;
        const { deleted, trashed, trashError } = await request('/tasks/delete', { method: 'POST', body: JSON.stringify({ ids, trashFiles: true, only_person: onlyPerson }) });
        const gone = new Set(ids.map(Number));
        state.data.tasks = state.data.tasks.filter(t => !gone.has(t.id));
        render();
        if (trashError) alert(`ลบงานแล้ว ${deleted} รายการ แต่ลบไฟล์บน Drive ไม่สำเร็จ — ลบโฟลเดอร์ใน Drive เองได้\n\nสาเหตุ: ${trashError}`);
        else toast(`ลบงานแล้ว ${deleted} รายการ${trashed ? ' พร้อมไฟล์บน Drive' : ''}`);
        return true;
    }

    // ---------------------------------------------------------------- ส่งข้อความแบบหมู่ → คิว LINE OA (ยังไม่ส่งจริง — แอดมินกดส่งเองใน LINE OA Manager)
    const VARS = ['{ชื่อ}', '{ชื่อเล่น}', '{รหัสพนักงาน}', '{รหัสประกัน}', '{บริษัท}'];
    const fill = (text, e) => text.replace(/\{ชื่อ\}/g, e.fullname).replace(/\{ชื่อเล่น\}/g, e.nickname || e.fullname)
        .replace(/\{รหัสพนักงาน\}/g, e.employeeId || e.centralId || '').replace(/\{รหัสประกัน\}/g, e.insuranceCode || '').replace(/\{บริษัท\}/g, e.company || '');
    const roomLabel = r => `${r.customName || r.managerName || r.lineName || 'ไม่มีชื่อ'}${r.managerName && r.managerName !== (r.customName || r.managerName) ? ` [OA: ${r.managerName}]` : ''}${r.lineName ? ` (LINE: ${r.lineName})` : ''} · ${r.channelName}`;
    async function openBroadcast() {
        const people = filtered();
        if (!people.length) return toast('ไม่มีพนักงานในรายการ', true);
        state.mode = 'broadcast';
        state.current = null;
        state.broadcast = { people, rooms: [], targets: [], file: null };
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>📢 ส่งข้อความแบบหมู่ · ${people.length} คน</h2><p>ข้อความจะเข้าคิว LINE OA (หน้า Monitoring) — ยังไม่ส่งจริง จนกว่าคุณจะกดส่งเองใน LINE OA Manager</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <section class="sm-section">
                    <h3>1. แพทเทิร์นข้อความ</h3>
                    <div class="sm-vars">แทรกข้อมูลของแต่ละคน: ${VARS.map(v => `<button type="button" class="sm-var" data-var="${v}">${v}</button>`).join('')}</div>
                    <textarea id="smBcText" class="sm-bc-text" maxlength="4000" placeholder="เช่น เรียนคุณ{ชื่อเล่น} ({รหัสพนักงาน}) กรุณาส่งเอกสารตรวจ 4 โรคภายในวันที่ 15/11 ค่ะ"></textarea>
                    <label class="sm-bc-file">📎 แนบรูปหรือไฟล์ (ถ้ามี · ไม่เกิน 10 MB) <input id="smBcFile" type="file" accept="image/jpeg,image/png,application/pdf,.doc,.docx,.xls,.xlsx"></label>
                    <div id="smBcFileInfo" class="sm-meta"></div>
                    <div class="sm-bc-preview"><small>ตัวอย่างข้อความของ ${esc(people[0].fullname)}</small><div id="smBcPreview">—</div></div>
                </section>
                <section class="sm-section">
                    <h3>2. ห้องแชท LINE ของแต่ละคน <span class="sm-meta" id="smBcMatchInfo">กำลังจับคู่…</span></h3>
                    <div class="sm-bc-list" id="smBcList"><p class="fa-empty">กำลังค้นหาห้องแชทที่ตรงกับพนักงาน…</p></div>
                </section>
                <div class="sm-group-actions">
                    <button type="button" class="fa-btn fa-btn-primary" data-bc-send>ส่งเข้าคิว LINE OA</button>
                    <span class="sm-meta">ไปกดส่งจริงที่ LINE OA Manager (ส่วนขยาย "ผู้ช่วยส่งข้อความ" — ปิดโหมดอัตโนมัติเพื่อกดส่งเอง)</span>
                </div>
            </div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
        try {
            const data = await request('/line-targets', { method: 'POST', body: JSON.stringify({ keys: people.map(e => e.key) }) });
            state.broadcast.rooms = data.rooms;
            state.broadcast.targets = data.targets;
            renderBroadcastTargets();
        } catch (error) { $('smBcList').innerHTML = `<p class="fa-empty">${esc(error.message)}</p>`; }
    }
    function renderBroadcastTargets() {
        const b = state.broadcast;
        const matched = b.targets.filter(t => t.selected).length;
        $('smBcMatchInfo').textContent = `จับคู่ได้ ${matched}/${b.targets.length} คน — ตรวจชื่อห้องให้ถูกก่อนส่ง`;
        $('smBcList').innerHTML = `<table class="sm-group-table"><thead><tr><th><input type="checkbox" data-bc-all checked></th><th>พนักงาน</th><th>ห้องแชท LINE</th></tr></thead><tbody>
            ${b.targets.map((t, i) => `<tr class="${t.selected ? '' : 'sm-bc-none'}">
                <td><input type="checkbox" data-bc-pick="${i}" ${t.selected ? 'checked' : 'disabled'}></td>
                <td><b>${esc(t.fullname)}</b>${t.nickname ? ` <span class="fa-type">${esc(t.nickname)}</span>` : ''}<small>${esc([t.employeeId, t.company].filter(Boolean).join(' · '))}</small></td>
                <td><select data-bc-room="${i}">
                    <option value="">— ไม่ส่ง (ยังไม่พบห้อง) —</option>
                    ${t.suggestions.map(r => `<option value="${esc(`${r.channelId}|${r.conversationId}`)}" ${t.selected === `${r.channelId}|${r.conversationId}` ? 'selected' : ''}>${t.linked && r.score === 999 ? '✓ ' : ''}${esc(roomLabel(r))}</option>`).join('')}
                    <option value="__search">🔍 ค้นหาห้องอื่น…</option>
                </select>${t.linked ? '<small class="sm-ok">ห้องที่เคยยืนยันแล้ว</small>' : ''}</td></tr>`).join('')}
        </tbody></table>`;
    }
    function updateBroadcastPreview() {
        const b = state.broadcast;
        const text = $('smBcText').value;
        $('smBcPreview').textContent = text ? fill(text, b.people[0]) : '—';
    }
    async function sendBroadcast(button) {
        const b = state.broadcast;
        const text = $('smBcText').value.trim();
        if (!text && !b.file) return toast('กรุณาพิมพ์ข้อความหรือแนบไฟล์', true);
        const targets = b.targets.map((t, i) => ({ t, i })).filter(({ t, i }) => t.selected && $('smBcList').querySelector(`[data-bc-pick="${i}"]`)?.checked)
            .map(({ t }) => {
                const room = b.rooms.find(r => `${r.channelId}|${r.conversationId}` === t.selected);
                return { key: t.key, room: t.selected, roomName: room ? (room.customName || room.lineName) : '' };
            });
        if (!targets.length) return toast('ยังไม่ได้เลือกห้องแชทของใครเลย', true);
        if (!confirm(`ส่งข้อความเข้าคิว LINE OA ให้ ${targets.length} คน?\nข้อความยังไม่ถูกส่งจริง จนกว่าจะกดส่งใน LINE OA Manager`)) return;
        button.disabled = true;
        button.textContent = 'กำลังเข้าคิว…';
        try {
            const result = await request('/line-broadcast', { method: 'POST', body: JSON.stringify({ text, file: b.file, targets }) });
            toast(`เข้าคิวแล้ว ${result.people} คน (${result.queued} ข้อความ)${result.failed.length ? ` · ไม่สำเร็จ ${result.failed.length}` : ''}`, Boolean(result.failed.length));
            if (result.failed.length) alert(`เข้าคิวไม่สำเร็จ:\n${result.failed.join('\n')}`);
            else $('smDialog').close();
        } catch (error) { toast(error.message, true); }
        finally { button.disabled = false; button.textContent = 'ส่งเข้าคิว LINE OA'; }
    }

    // ---------------------------------------------------------------- จับคู่ห้องแชท LINE ↔ พนักงาน → แท็ก = รหัสพนักงาน (ส่วนกลาง) + ชื่อในหน้า Monitoring
    const LM_GROUPS = [['sure', '✅ ตรงแน่นอน', true], ['check', '⚠️ ต้องตรวจ (ชื่อใกล้กันหลายคน / หลายห้องชี้คนเดียว)', false], ['none', '❔ หาคนไม่เจอ (เลือกเองได้)', false]];
    const roomName = r => r.customName || r.managerName || r.lineName || 'ไม่มีชื่อ';
    const personLabel = p => `${p.employeeId} · ${p.fullname}${p.nickname ? ` (${p.nickname})` : ''}`;
    async function openLineMatch() {
        state.mode = 'line-match';
        state.current = null;
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>🔗 จับคู่ห้อง LINE กับพนักงาน</h2><p>เทียบชื่อห้องในหน้า Monitoring กับแท็บ "ข้อมูลเบื้องต้น" แล้วใส่แท็ก = รหัสพนักงาน (ส่วนกลาง) ให้แต่ละห้อง</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body" id="smLmBody"><p class="fa-empty">กำลังจับคู่ห้องแชททั้งหมด…</p></div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
        try {
            state.lineMatch = await request('/line-match', { method: 'POST', body: '{}' });
            renderLineMatch();
        } catch (error) { $('smLmBody').innerHTML = `<p class="fa-empty">${esc(error.message)}</p>`; }
    }
    function renderLineMatch() {
        const { rows, people } = state.lineMatch;
        const withId = Object.values(people).filter(p => p.employeeId);
        const tagged = rows.filter(x => x.status === 'tagged').length;
        $('smLmBody').innerHTML = `
            <p class="sm-meta">ห้องทั้งหมด ${rows.length} · มีแท็กรหัสพนักงานแล้ว ${tagged} · พนักงานที่มีรหัส (ส่วนกลาง) ${withId.length} คน</p>
            <datalist id="smLmPeople">${withId.map(p => `<option value="${esc(personLabel(p))}"></option>`).join('')}</datalist>
            ${LM_GROUPS.map(([status, title, on]) => {
                const list = rows.map((x, i) => ({ x, i })).filter(({ x }) => x.status === status);
                if (!list.length) return '';
                return `<section class="sm-section"><h3>${title} · ${list.length} ห้อง <label class="sm-meta"><input type="checkbox" data-lm-all="${status}" ${on ? 'checked' : ''}> เลือกทั้งกลุ่ม</label></h3>
                    <table class="sm-group-table"><thead><tr><th></th><th>ห้องแชท (Monitoring)</th><th>พนักงาน (รหัสส่วนกลาง · ชื่อ)</th></tr></thead><tbody>
                    ${list.map(({ x, i }) => { const p = x.best && people[x.best.key]; return `<tr>
                        <td><input type="checkbox" data-lm-pick="${i}" data-lm-group="${status}" ${on && p ? 'checked' : ''}></td>
                        <td><div class="sm-lm-room">${x.picture ? `<img src="${esc(x.picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="sm-lm-noimg">👤</span>'}<div>
                            <b>${esc(roomName(x.room))}</b><small>${esc([x.room.managerName && x.room.customName ? `OA: ${x.room.managerName}` : '', (x.room.customName || x.room.managerName) && x.room.lineName ? `LINE: ${x.room.lineName}` : '', x.room.channelName].filter(Boolean).join(' · '))}</small>
                            ${x.note ? `<small class="sm-lm-note">📝 ${esc(x.note)}</small>` : ''}
                            ${(x.recent || []).map(t => `<small class="sm-lm-msg">💬 ${esc(t)}</small>`).join('')}
                            <a class="sm-lm-open" href="monitoring.html?conversation=${encodeURIComponent(x.room.conversationId)}&channel=${encodeURIComponent(x.room.channelId)}" target="_blank" rel="noopener">เปิดอ่านแชททั้งหมด ↗</a>
                        </div></div></td>
                        <td><input class="sm-lm-person" list="smLmPeople" data-lm-person="${i}" value="${p ? esc(personLabel(p)) : ''}" placeholder="พิมพ์รหัสหรือชื่อเพื่อค้นหา">${x.dup ? '<small>มีห้องอื่นชี้คนนี้ด้วย</small>' : ''}
                            ${(x.hints || []).filter(h => people[h.key]).map(h => `<button type="button" class="sm-lm-hint" data-lm-hint="${i}" data-label="${esc(personLabel(people[h.key]))}" title="${esc(h.quote)}">💡 ${esc(people[h.key].fullname)} <small>${esc(h.why)}</small></button>`).join('')}</td></tr>`; }).join('')}
                    </tbody></table></section>`;
            }).join('')}
            <div class="sm-group-actions">
                <label class="sm-meta"><input type="checkbox" id="smLmSetName" checked> ตั้งชื่อห้องในหน้า Monitoring เป็นชื่อพนักงานด้วย</label>
                <button type="button" class="fa-btn fa-btn-primary" data-lm-apply>ยืนยันใส่แท็ก</button>
            </div>`;
    }
    async function applyLineMatch(button) {
        const { rows, people } = state.lineMatch;
        const byLabel = new Map(Object.values(people).filter(p => p.employeeId).map(p => [personLabel(p), p.key]));
        const pairs = [], bad = [];
        $('smLmBody').querySelectorAll('[data-lm-pick]:checked').forEach(box => {
            const x = rows[box.dataset.lmPick];
            const label = $('smLmBody').querySelector(`[data-lm-person="${box.dataset.lmPick}"]`).value.trim();
            const key = byLabel.get(label);
            if (!key) return bad.push(roomName(x.room));
            pairs.push({ key, room: `${x.room.channelId}|${x.room.conversationId}`, roomName: roomName(x.room) });
        });
        if (bad.length) return toast(`เลือกพนักงานจากรายการให้ถูกต้อง: ${bad.slice(0, 3).join(', ')}${bad.length > 3 ? '…' : ''}`, true);
        if (!pairs.length) return toast('ยังไม่ได้เลือกห้อง', true);
        const setName = $('smLmSetName').checked;
        if (!confirm(`ใส่แท็กรหัสพนักงาน${setName ? ' และตั้งชื่อ' : ''}ให้ ${pairs.length} ห้อง?`)) return;
        button.disabled = true;
        button.textContent = 'กำลังบันทึก…';
        try {
            const result = await request('/line-match/apply', { method: 'POST', body: JSON.stringify({ pairs, setName }) });
            toast(`ใส่แท็กแล้ว ${result.linked} ห้อง${result.failed.length ? ` · ไม่สำเร็จ ${result.failed.length}` : ''}`, Boolean(result.failed.length));
            if (result.failed.length) alert(`ไม่สำเร็จ:\n${result.failed.join('\n')}`);
            openLineMatch();
        } catch (error) { toast(error.message, true); button.disabled = false; button.textContent = 'ยืนยันใส่แท็ก'; }
    }
    document.addEventListener('change', event => {
        const all = event.target.closest('[data-lm-all]');
        if (all) $('smLmBody').querySelectorAll(`[data-lm-group="${all.dataset.lmAll}"]`).forEach(b => { b.checked = all.checked; });
        const person = event.target.closest('[data-lm-person]');
        if (person && person.value) { const b = $('smLmBody').querySelector(`[data-lm-pick="${person.dataset.lmPerson}"]`); if (b) b.checked = true; }
    });

    // ขั้นตอนของงาน: ยังไม่รับทราบ → รับทราบแล้ว → ส่งข้อมูลแล้ว → ตรวจสอบแล้ว
    // ---------------------------------------------------------------- ขั้นตอนของแต่ละกล่อง (เชื่อมกัน) + ยืนยันลงรายงาน
    const CHECKED_REC = new Set(['approved', 'insurance', 'refunded', 'done']);
    const STEP_LABEL = { unread: 'ยังไม่รับทราบ', read: 'รับทราบแล้ว', sent: 'ส่งข้อมูลแล้ว', more: 'ขอเอกสารเพิ่ม', checked: 'ตรวจสอบแล้ว', reported: 'ยืนยันลงรายงานแล้ว' };
    // รวมงานและเอกสารที่ส่งเองของคนหนึ่งคน ตามกล่อง → ขั้นตอนล่าสุดของกล่องนั้น
    function boxGroupsOf(tasks, recs) {
        const map = new Map();
        const get = key => { if (!map.has(key)) map.set(key, { key, tasks: [], recs: [] }); return map.get(key); };
        tasks.forEach(t => get(t.box || 'quests').tasks.push(t));
        recs.forEach(r => get(r.type).recs.push(r));
        return [...map.values()].map(g => {
            const ts = g.tasks, rs = g.recs;
            const received = ts.some(t => t.acknowledged_at || t.submitted_at || t.status === 'done');
            const sent = ts.some(t => t.submitted_at || t.status === 'done') || rs.length > 0;
            const checked = ts.some(t => t.status === 'done') || rs.some(r => CHECKED_REC.has(r.status));
            const reported = ts.some(t => t.report_confirmed_at) || rs.some(r => r.report_confirmed_at);
            const more = rs.some(r => r.status === 'rejected') && !checked;
            const stage = reported ? 'reported' : checked ? 'checked' : more ? 'more' : sent ? 'sent' : received ? 'read' : ts.length ? 'unread' : '';
            return { ...g, received, sent, checked, reported, stage };
        });
    }
    // การ์ดกล่องเดียวกัน: ① รับงาน → ② ส่งข้อมูล → ③ ตรวจสอบ → ④ ยืนยันรายงาน (ขั้นที่ยังไม่ทำ = สีอำพัน)
    function boxLinkHtml(group) {
        const box = (state.data.boxes || []).find(b => b.key === group.key);
        const title = box?.title || group.tasks[0]?.box_title || group.recs[0]?.type_title || group.key;
        // ① รับงาน → เปิดงานที่มอบหมาย · ②③④ → เปิดหน้าตรวจเอกสารที่พนักงานส่ง (ตั้งสถานะ + ยืนยันลงรายงานได้ที่เดียว)
        const latestRec = [...group.recs].sort((a, b) => b.id - a.id)[0];
        const taskAttr = group.tasks.length ? `data-task-open="${group.tasks[0].id}"` : '';
        const recAttr = latestRec ? `data-record="${latestRec.id}"` : '';
        const steps = [
            { label: '① รับงาน', done: group.received, show: group.tasks.length > 0, attr: taskAttr, tip: 'เปิดงานที่มอบหมาย' },
            { label: '② ส่งข้อมูล', done: group.sent, show: true, attr: recAttr || taskAttr, tip: recAttr ? 'เปิดเอกสารที่พนักงานส่ง' : 'เปิดงานที่มอบหมาย' },
            { label: '③ ตรวจสอบ', done: group.checked, show: true, attr: recAttr || taskAttr, tip: recAttr ? 'ตรวจเอกสาร / ตั้งสถานะ' : 'ตั้งสถานะงานเป็นเสร็จสิ้น' },
            { label: '④ ยืนยันรายงาน', done: group.reported, show: true, attr: recAttr || taskAttr, tip: 'กดยืนยันลงรายงาน (ต้องตรวจสอบผ่านก่อน)' }
        ].filter(s => s.show);
        const cur = steps.findIndex(s => !s.done);
        return `<span class="sm-link" title="${esc(title)}"><span class="sm-link-head">${esc(box?.icon || '📌')} ${esc(title)}</span><span class="sm-link-steps">${steps.map((s, i) => `${i ? '<i class="sm-link-arrow">›</i>' : ''}<button type="button" class="sm-step ${s.done ? 'is-done' : i === cur ? 'is-current' : 'is-todo'}" ${s.attr} title="${esc(s.tip)}">${s.done ? '✓ ' : ''}${esc(s.label)}</button>`).join('')}</span></span>`;
    }
    async function setReport(button) {
        const confirmed = button.dataset.confirmed === '1';
        const taskId = button.dataset.reportTask, recId = button.dataset.reportRecord;
        let claimedWarn = '';
        if (confirmed) {
            const rec = recId ? (state.records || []).find(r => String(r.id) === String(recId)) : null;
            const task = taskId ? (state.data.tasks || []).find(t => String(t.id) === String(taskId)) : null;
            const emp = rec ? recEmployee(rec) : task ? state.byKey.get(task.employee_key) : null;
            const health = rec ? HEALTH_BOXES.has(rec.type) : task ? HEALTH_BOXES.has(task.box) : false;
            const c = health ? claimedOf(emp) : null;
            if (c) claimedWarn = `⚠️ ${emp.fullname} ส่งเบิกไปแล้ว ${baht(c.total)} บาท\n${claimText(c)}\n\nถ้ายืนยันลงรายงานอีก อาจเบิกซ้ำ\n\n`;
        }
        if (confirmed && !confirm(claimedWarn + 'ยืนยันว่าตรวจสอบผ่านแล้ว และให้นำข้อมูลนี้ลงชีตรายงาน?')) return;
        button.disabled = true;
        try {
            if (taskId) {
                await request(`/tasks/${taskId}/report`, { method: 'PUT', body: JSON.stringify({ confirmed }) });
            } else {
                const response = await window.authFetch(docsApi(`/records/${recId}/report`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed }) });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.success === false) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
            }
            toast(confirmed ? 'ยืนยันลงรายงานแล้ว' : 'ยกเลิกการยืนยันแล้ว');
            await load();
            if (taskId) { if ($('smTaskList')) renderTasks(); } else openRecord(recId);
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }

    function stagesOf(t) {
        if (!t.acknowledged_at && !t.submitted_at) return [['unread', 'ยังไม่รับทราบ']];
        const out = [['read', '✓ รับทราบแล้ว']];
        if (t.submitted_at || t.status === 'done') out.push(['sent', '✓ ส่งข้อมูลแล้ว']);
        if (t.status === 'done') out.push(['checked', '✓ ตรวจสอบแล้ว']);
        return out;
    }

    // ---------------------------------------------------------------- ตรวจเอกสารที่พนักงานส่ง (ครบ/ไม่ครบ + ดูรูป/ไฟล์บนเว็บ)
    const blobCache = new Map();
    // ---------------------------------------------------------------- ลบกล่องงาน (ยืนยัน 2 รอบ) — งาน เอกสารที่ส่งมา และไฟล์บน Drive ทั้งหมด
    async function deleteBox(key) {
        const box = (state.data.boxes || []).find(b => b.key === key);
        if (!box) return;
        const tasks = (state.data.tasks || []).filter(t => t.box === key);
        const people = new Set(tasks.map(t => t.employee_key)).size;
        const recs = (state.records || []).filter(r => r.type === key);
        if (!confirm(`ต้องการลบกล่องงาน "${box.title}" ใช่ไหม?`)) return;
        const detail = [
            tasks.length ? `• งานที่มอบหมาย ${tasks.length} งาน (${people} คน) — พนักงานจะไม่เห็นงานนี้อีก` : '',
            recs.length ? `• เอกสารที่พนักงานส่งมา ${recs.length} รายการ พร้อมรูป/ไฟล์` : '',
            '• ชีตรายงานและโฟลเดอร์ไฟล์บน Google Drive ที่ระบบสร้าง',
            box.custom ? '• กล่องนี้ในหน้าระบบจัดการองค์กร' : '• หัวข้อนี้ในหน้าระบบจัดการองค์กร (คืนหัวข้อได้ภายหลัง แต่ข้อมูลที่ลบจะไม่กลับมา)'
        ].filter(Boolean).join('\n');
        if (!confirm(`⚠️ ยืนยันอีกครั้ง\n\nถ้าลบ ข้อมูลต่อไปนี้จะหายจากทุกส่วนและทุกโฟลเดอร์ และอาจกู้คืนไม่ได้:\n${detail}\n\nกด "ตกลง" เพื่อลบ`)) return;
        try {
            const result = await request(`/boxes/${encodeURIComponent(key)}/delete`, { method: 'POST', body: JSON.stringify({ trashFiles: true }) });
            state.data.boxes = workBoxes(result.boxes);
            state.data.removedBoxes = result.removedBoxes;
            state.data.tasks = state.data.tasks.filter(t => t.box !== key);
            state.records = (state.records || []).filter(r => r.type !== key);
            if (state.box === key) state.box = '';
            render();
            if (result.trashError) alert(`ลบกล่องงานแล้ว แต่ลบไฟล์บน Drive บางส่วนไม่สำเร็จ — ลบโฟลเดอร์ใน Drive เองได้\n\nสาเหตุ: ${result.trashError}`);
            else toast(`ลบกล่อง "${box.title}" แล้ว · งาน ${result.tasks} · เอกสาร ${result.records} · ไฟล์ ${result.trashed}`);
        } catch (error) { toast(error.message, true); }
    }
    function openRestore() {
        state.mode = 'restore';
        state.current = null;
        $('smDetail').innerHTML = `
            <header class="fa-detail-head"><div><h2>♻️ หัวข้อที่ลบไปแล้ว</h2><p>คืนหัวข้อให้พนักงานเห็นในหน้าระบบจัดการองค์กรอีกครั้ง (ข้อมูลที่ลบไปแล้วจะไม่กลับมา)</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button></header>
            <div class="fa-detail-body"><div class="sm-restore-list">${(state.data.removedBoxes || []).map(b => `<div class="sm-restore"><span>${esc(b.icon || '📌')} <b>${esc(b.title)}</b></span><button type="button" class="fa-btn fa-btn-primary" data-restore-box="${esc(b.key)}">คืนหัวข้อ</button></div>`).join('') || '<p class="fa-empty">ไม่มีหัวข้อที่ลบ</p>'}</div></div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
    }
    async function restoreBox(key) {
        try {
            const result = await request(`/boxes/${encodeURIComponent(key)}/restore`, { method: 'POST', body: '{}' });
            state.data.boxes = workBoxes(result.boxes);
            state.data.removedBoxes = result.removedBoxes;
            render();
            openRestore();
            toast('คืนหัวข้อแล้ว — พนักงานเห็นในหน้าระบบจัดการองค์กรอีกครั้ง');
        } catch (error) { toast(error.message, true); }
    }

    const recBlob = new Map();
    async function recordFileUrl(id, n) {
        const key = `${id}/${n}`;
        if (recBlob.has(key)) return recBlob.get(key);
        const response = await window.authFetch(docsApi(`/file/${id}/${n}`));
        if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
        const url = URL.createObjectURL(await response.blob());
        recBlob.set(key, url);
        return url;
    }
    function openReviewList(boxKey) {
        const box = (state.data.boxes || []).find(b => b.key === boxKey);
        const recs = (state.records || []).filter(r => r.type === boxKey).sort((a, b) => (REVIEW.has(b.status) - REVIEW.has(a.status)) || b.id - a.id);
        state.mode = 'review';
        state.current = null;
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>📥 ${esc(box?.title || boxKey)}</h2><p>เอกสารที่พนักงานส่งเองจากหน้าระบบจัดการองค์กร · ${recs.length} รายการ · รอตรวจ ${recs.filter(r => REVIEW.has(r.status)).length}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <table class="sm-group-table"><thead><tr><th>เลขที่</th><th>พนักงาน</th><th>ส่งเมื่อ</th><th>สถานะ</th><th></th></tr></thead><tbody>
                ${recs.map(r => `<tr><td>#${r.id}</td><td><b>${esc(r.fullname)}</b><small>${esc([r.employee_id, r.insurance_code, r.company].filter(Boolean).join(' · '))}</small></td>
                    <td>${esc(when(r.submitted_at))}</td><td><span class="fa-badge ${REVIEW.has(r.status) ? 'warn' : 'ok'}">${esc(r.status_label)}</span></td>
                    <td><button type="button" class="fa-btn fa-btn-primary" data-record="${r.id}">ตรวจ</button></td></tr>`).join('') || '<tr><td colspan="5" class="fa-empty">ยังไม่มีรายการ</td></tr>'}
                </tbody></table>
            </div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
    }
    // แพทเทิร์นแจ้งประกัน (รูปแบบเดียวกับหน้าเปิดเคส)
    function claimPattern(r) {
        const e = [...state.byKey.values()].find(x => recIds(x).includes(String(r.employee_id).toUpperCase())) || {};
        const f = r.fields || {};
        const [y, m, d] = String(f.treat_date || '').split('-');
        return `ระบุเวลาที่เข้ารับการรักษา : ${d ? `${d}/${m}/${y}` : '-'} ${f.treat_time || ''}
บริษัท : ${r.company || e.company || '-'}
ชื่อ : ${r.fullname || '-'}
SIZE : ${e.size || '-'}
InsuranceId : ${r.insurance_code || e.insuranceCode || '-'}
อาการป่วย : ${f.symptom || '-'}
คลินิกหรือสถานพยาบาล : ${f.hospital || '-'}
เบอร์โทรติดต่อพนักงานหรือ ID Line : ${[f.line_id, f.phone && `เบอร์ ${f.phone}`].filter(Boolean).join(' ') || f.contact || '-'}
หมายเหตุ : ${[f.cost_level && /เกิน/.test(f.cost_level) ? 'ค่าใช้จ่ายอาจเกิน 5,000 บาท ขอให้ประกันจ่ายตรง' : '', f.note].filter(Boolean).join(' · ') || '-'}`;
    }    function treatmentSteps(r) {
        const text = claimPattern(r);
        const opened = r.case_id || ['received', 'billed'].includes(r.status);
        return `<section class="sm-section sm-intake-steps"><h3>ขั้นตอนของ GA</h3>
            <ol>
                <li class="${opened ? 'is-done' : ''}"><b>1. แจ้งประกัน</b> — กดคัดลอกข้อความ แล้วไปวาง (Ctrl+V) ส่งในกลุ่ม LINE ประกันเอง
                    <pre class="sm-pattern">${esc(text)}</pre>
                    <div class="sm-pattern-actions"><button type="button" class="fa-btn" data-copy-pattern>📋 คัดลอกข้อความ</button>
</div></li>
                <li class="${opened ? 'is-done' : ''}"><b>2. เปิดเคสในระบบงานประกัน</b> — ระบบกรอกฟอร์มเปิดเคสให้ แนบรูปหลักฐานที่แจ้งประกันแล้ว (แคปแชท) แล้วกดบันทึก → เรื่องนี้จะเปลี่ยนเป็น "รับเรื่องแล้ว · เคส #" และพนักงานเห็นว่า GA เปิดเคสแล้ว
                    ${opened ? `<p class="sm-meta">✓ เปิดเคสแล้ว${r.case_id ? ` เลขเคส #${esc(r.case_id)}` : ''}</p>` : `<div class="sm-pattern-actions"><button type="button" class="fa-btn fa-btn-primary" data-open-intake="${r.id}">🛡️ เปิดเคสในหน้างานประกัน →</button></div>`}</li>
                <li class="${r.status === 'billed' ? 'is-done' : ''}"><b>3. รอพนักงานรักษาเสร็จ</b> — พนักงานกด "บันทึกค่ารักษา" ที่เคสนี้ บิลจะเข้ากล่อง "ส่งบิลค่ารักษาพยาบาล" ให้ตรวจ${r.status === 'billed' ? ' · ✓ ส่งบิลแล้ว' : ''}</li>
            </ol></section>`;
    }
    // ปุ่ม "ตรวจ ▾" — เลือกว่าจะตรวจเอกสารกล่องไหน (หรือข้อมูลในงานที่มอบหมาย)
    function openCheckPick(key) {
        const e = state.byKey.get(key);
        if (!e) return;
        const list = tasksOf(key).filter(t => t.status !== 'cancelled');
        const recs = recordsOf(e).sort((x, y) => (REVIEW.has(y.status) - REVIEW.has(x.status)) || y.id - x.id);
        const hasTask = list.some(t => (t.fields || []).length || (t.uploads || []).length || t.submitted_at);
        const boxOf = k => (state.data.boxes || []).find(b => b.key === k);
        state.mode = 'pick';
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>เลือกสิ่งที่จะตรวจ · ${esc(e.fullname)}${e.nickname ? ` (${esc(e.nickname)})` : ''}</h2><p>${esc([e.employeeId || e.centralId, e.insuranceCode, e.company].filter(Boolean).join(' · '))}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="sm-pick-list">
                ${recs.map(r => `<button type="button" class="sm-pick-item${REVIEW.has(r.status) ? ' is-wait' : ''}" data-record="${r.id}">
                    <span class="sm-pick-icon">${esc(boxOf(r.type)?.icon || '📥')}</span>
                    <span><b>${esc(r.type_title)}</b><small>#${r.id} · ${esc(r.status_label || r.status)}${r.report_confirmed_at ? ' · ✓ ยืนยันลงรายงานแล้ว' : ''}</small></span></button>`).join('')}
                ${hasTask ? `<button type="button" class="sm-pick-item" data-check="${esc(key)}"><span class="sm-pick-icon">📝</span><span><b>ข้อมูลที่ส่งในงานที่มอบหมาย</b><small>${list.length} งาน</small></span></button>` : ''}
            </div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
    }

    function openRecord(id) {
        const r = (state.records || []).find(x => x.id === Number(id));
        if (!r) return;
        const box = (state.data.boxes || []).find(b => b.key === r.type);
        const labelOf = name => box?.form?.find(f => f.name === name)?.label || name;
        const money = v => Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 });
        const rows = Object.entries(r.fields || {}).filter(([k, v]) => v && !k.startsWith('__')).map(([k, v]) => `<div><small>${esc(labelOf(k))}</small><b>${esc(/amount/.test(k) ? `${money(v)} บาท` : v)}</b></div>`).join('');
        const groups = new Map();
        r.files.forEach(f => { if (!groups.has(f.field_label)) groups.set(f.field_label, []); groups.get(f.field_label).push(f); });
        state.mode = 'record';
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>📥 ${esc(r.type_title)} · #${r.id}</h2><p>${esc(r.fullname)} · ${esc([r.employee_id, r.insurance_code, r.company].filter(Boolean).join(' · '))} · ส่งเมื่อ ${esc(when(r.submitted_at))}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                <div class="sm-info sm-rec-info">${rows || '<p class="fa-empty">ไม่มีข้อมูลที่กรอก</p>'}</div>
                ${r.type === 'treatment' ? treatmentSteps(r) : ''}
                <div class="sm-rec-groups">${[...groups.entries()].map(([label, files]) => `<section class="sm-rec-group${label === 'สลิปโอนเงินคืน' ? ' is-slip' : ''}"><h3>${esc(label)} <small>(${files.length})</small></h3><div class="sm-rec-files">
                    ${files.map(f => `<button type="button" class="sm-rec-file" data-rec-file="${r.id}/${f.n}" data-mime="${esc(f.mime)}" title="กดเพื่อดูขยาย">${/^image\//.test(f.mime) ? `<img alt="" data-rec-img="${r.id}/${f.n}">` : '<span>📄 PDF</span>'}<small>ไฟล์ ${f.index}</small></button>`).join('')}</div></section>`).join('')}</div>
                <section class="sm-section"${r.type === 'treatment' ? ' hidden' : ''}><h3>ผลการตรวจ</h3>
                    ${claimBanner(recEmployee(r))}<form class="sm-form" id="smRecForm" data-id="${r.id}">
                        <label>สถานะ<select name="status">${Object.entries(state.docStatuses || {}).filter(([k]) => k !== 'draft').map(([k, v]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
                        <div class="sm-wide sm-rec-slip" data-slip hidden><b>🧾 แนบสลิปการโอนคืน</b><small>พนักงานจะเห็นปุ่ม "ดูสลิปโอนเงินคืน" ในหน้าระบบจัดการองค์กร (รายการที่ฉันส่ง)</small>
                            <input type="file" name="slip" accept="image/*,application/pdf" multiple></div>
                        <p class="sm-wide sm-rec-hint" data-reject-hint hidden>📎 เลือก "ขอเอกสารเพิ่ม" แล้ว พนักงานจะเห็นหมายเหตุนี้ และปุ่ม <b>"＋ ส่งเอกสารเพิ่ม"</b> ที่รายการนี้ในหน้าระบบจัดการองค์กร → เลือกหัวข้อ (เช่น ใบเสร็จ) แล้วแนบไฟล์ ไฟล์ใหม่จะมาต่อท้ายหัวข้อเดิมในหน้านี้ จากนั้นพนักงานกด "ส่งกลับให้ GA ตรวจ" รายการจะกลับมาเป็น "รอตรวจ"</p>
                        <label class="sm-wide">หมายเหตุถึงพนักงาน (เช่น ขอใบเสร็จตัวจริงเพิ่ม)<textarea name="note" maxlength="1000">${esc(r.admin_note || '')}</textarea></label>
                        <div class="sm-form-foot"><span class="sm-meta">${r.handled_by ? `ตรวจล่าสุดโดย ${esc(r.handled_by)} ${esc(when(r.handled_at))}` : 'ยังไม่ได้ตรวจ'}</span><button type="button" class="fa-btn ${r.report_confirmed_at ? '' : 'fa-btn-primary'}" data-report-record="${r.id}" data-confirmed="${r.report_confirmed_at ? '0' : '1'}" ${CHECKED_REC.has(r.status) ? '' : 'disabled title="ต้องตรวจสอบผ่านก่อน"'}>${r.report_confirmed_at ? '↩ ยกเลิกยืนยันลงรายงาน' : '✅ ยืนยันลงรายงาน'}</button>
                            <button type="submit" class="fa-btn fa-btn-primary">บันทึกผลการตรวจ</button></div>
                    </form></section>
                ${can('deleteDocs') ? `<div class="sm-rec-danger"><button type="button" class="fa-btn sm-btn-danger" data-del-record="${r.id}">🗑️ ลบรายการนี้</button><small>ลบออกจากทุกหน้า (พนักงานจะไม่เห็นแล้ว) และย้ายไฟล์แนบไปถังขยะ Drive</small></div>` : ''}
            </div>`;
        if (!$('smDialog').open) $('smDialog').showModal();
        syncRecForm($('smRecForm'));
        $('smDetail').querySelectorAll('[data-rec-img]').forEach(img => {
            const [rid, n] = img.dataset.recImg.split('/');
            recordFileUrl(rid, n).then(url => { img.src = url; }).catch(() => { img.alt = 'เปิดไม่ได้'; });
        });
    }
    async function deleteRecord(id, button) {
        const r = (state.records || []).find(x => x.id === Number(id));
        if (!r) return;
        if (!confirm(`ลบรายการ "${r.type_title}" #${r.id} ของ ${r.fullname} ?

รายการจะหายจากหน้าจัดการพนักงาน หน้างานประกัน และหน้าของพนักงาน`)) return;
        if (!confirm(`ยืนยันอีกครั้ง — ลบรายการ #${r.id} และย้ายไฟล์แนบ ${r.files.length} ไฟล์ไปถังขยะ Drive
(กู้คืนไฟล์ได้จากถังขยะ Drive ภายใน 30 วัน)`)) return;
        button.disabled = true;
        try {
            await ensureCsrf();
            const response = await window.authFetch(docsApi(`/records/${r.id}/delete`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.message || (response.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ตรวจเอกสาร (ReviewGaDocs)' : 'ลบไม่สำเร็จ'));
            state.records = state.records.filter(x => x.id !== r.id);
            $('smDialog').close();
            render();
            toast(`ลบรายการ #${r.id} แล้ว${data.trashed ? ` · ไฟล์ ${data.trashed} ไฟล์ไปถังขยะ` : ''}`);
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }
    function syncRecForm(form) {
        if (!form) return;
        form.querySelector('[data-slip]').hidden = form.status.value !== 'refunded';
        form.querySelector('[data-reject-hint]').hidden = form.status.value !== 'rejected';
    }
    const toDataUrl = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่ได้`)); r.readAsDataURL(file); });
    async function saveRecord(form) {
        const button = form.querySelector('[type=submit]');
        button.disabled = true;
        try {
            await ensureCsrf();
            const slips = form.status.value === 'refunded' ? [...form.slip.files] : [];
            if (form.status.value === 'rejected' && !form.note.value.trim()) throw new Error('กรุณาเขียนหมายเหตุว่าต้องการเอกสารอะไรเพิ่ม');
            for (let i = 0; i < slips.length; i++) {
                if (slips[i].size > 8 * 1024 * 1024) throw new Error(`${slips[i].name} ใหญ่เกิน 8 MB`);
                button.textContent = `กำลังอัปโหลดสลิป ${i + 1}/${slips.length}…`;
                const response = await window.authFetch(docsApi(`/records/${form.dataset.id}/slip`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: await toDataUrl(slips[i]) }) });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data.success === false) throw new Error(data.message || 'อัปโหลดสลิปไม่สำเร็จ');
            }
            button.textContent = 'กำลังบันทึก…';
            const response = await window.authFetch(docsApi(`/records/${form.dataset.id}/status`), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: form.status.value, note: form.note.value }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.success === false) throw new Error(data.message || (response.status === 403 ? 'บัญชีนี้ไม่มีสิทธิ์ตรวจเอกสาร (ReviewGaDocs)' : 'บันทึกไม่สำเร็จ'));
            const i = state.records.findIndex(x => x.id === data.record.id);
            if (i >= 0) state.records[i] = data.record;
            render();
            openRecord(data.record.id);
            toast('บันทึกผลการตรวจแล้ว');
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; button.textContent = 'บันทึกผลการตรวจ'; }
    }
    // ดูรูปขยาย (ซูมเข้า-ออก) ในหน้าเดียวกัน — PDF เปิดแท็บใหม่เหมือนเดิม
    function openViewer(url) {
        let zoom = 1;
        const box = document.createElement('div');
        box.className = 'sm-viewer';
        box.innerHTML = `<div class="sm-viewer-tools"><button type="button" data-z="-">－</button><button type="button" data-z="0">พอดีจอ</button><button type="button" data-z="+">＋</button><button type="button" data-z="x" aria-label="ปิด">×</button></div><div class="sm-viewer-stage"><img src="${url}" alt=""></div>`;
        const img = box.querySelector('img');
        const apply = () => { img.style.transform = `scale(${zoom})`; img.classList.toggle('is-zoomed', zoom > 1); };
        box.addEventListener('click', event => {
            const z = event.target.closest('[data-z]')?.dataset.z;
            if (z === '+') zoom = Math.min(5, zoom + .5);
            else if (z === '-') zoom = Math.max(.5, zoom - .5);
            else if (z === '0') zoom = 1;
            else if (z === 'x' || event.target === box || event.target.classList.contains('sm-viewer-stage')) return box.remove();
            else if (event.target === img) zoom = zoom > 1 ? 1 : 2.5;
            apply();
        });
        box.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.min(5, Math.max(.5, zoom + (event.deltaY < 0 ? .25 : -.25))); apply(); }, { passive: false });
        const onKey = event => { if (event.key === 'Escape') { box.remove(); document.removeEventListener('keydown', onKey); } };
        document.addEventListener('keydown', onKey);
        $('smDialog').append(box);
    }

    async function fileUrl(ref) {
        if (blobCache.has(ref)) return blobCache.get(ref);
        const [id, n] = ref.split('/');
        const response = await window.authFetch(api(`/tasks/${id}/file/${n}`));
        if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
        const url = URL.createObjectURL(await response.blob());
        blobCache.set(ref, url);
        return url;
    }
    function openCheck(key) {
        const e = state.byKey.get(key);
        if (!e) return;
        state.current = key;
        state.mode = 'check';
        const list = tasksOf(key).filter(t => (t.fields || []).length || (t.uploads || []).length || t.submitted_at);
        const check = t => {
            const files = t.files || [];
            const missingFields = (t.fields || []).filter(f => !t.response?.[f.id]);
            const missingUploads = (t.uploads || []).filter(u => !files.some(f => f.slot === u.id));
            const complete = Boolean(t.submitted_at) && !missingFields.length && !missingUploads.length;
            return { files, missingFields, missingUploads, complete };
        };
        $('smDetail').innerHTML = `
            <header class="fa-detail-head">
                <div><h2>ตรวจเอกสาร · ${esc(e.fullname)}${e.nickname ? ` (${esc(e.nickname)})` : ''}</h2><p>${esc([e.employeeId || e.centralId, e.insuranceCode, e.company].filter(Boolean).join(' · '))}</p></div>
                <button type="button" class="fa-close" data-close aria-label="ปิด">×</button>
            </header>
            <div class="fa-detail-body">
                ${list.length ? list.map(t => {
                    const c = check(t);
                    return `<article class="sm-check-task ${c.complete ? 'is-ok' : 'is-wait'}" data-task="${t.id}">
                        <header>
                            <div><b>${esc(t.title)}</b> <span class="fa-type">${esc(t.box_title || '')}</span></div>
                            <div class="sm-stages">${stagesOf(t).map(([cls, text]) => `<i class="sm-ack ${cls}">${text}</i>`).join('')}</div>
                        </header>
                        <p class="sm-check-sum">${!t.submitted_at ? '⏳ พนักงานยังไม่ส่งข้อมูล' : c.complete ? '✅ ข้อมูลและเอกสารครบถ้วน' : `⚠️ ไม่ครบ: ${[...c.missingFields.map(f => f.label), ...c.missingUploads.map(u => u.label)].map(esc).join(', ')}`}
                            ${t.submitted_at ? ` · ส่งเมื่อ ${esc(when(t.submitted_at))}` : ''}</p>
                        ${(t.fields || []).length ? `<div class="sm-check-fields">${t.fields.map(f => `<div class="${t.response?.[f.id] ? '' : 'is-missing'}"><small>${esc(f.label)}</small><b>${esc(t.response?.[f.id] || 'ยังไม่กรอก')}</b></div>`).join('')}</div>` : ''}
                        ${(t.uploads || []).map(u => {
                            const files = c.files.filter(f => f.slot === u.id);
                            return `<div class="sm-check-slot ${files.length ? '' : 'is-missing'}"><small>${esc(u.label)} · ${u.type === 'pdf' ? 'PDF' : 'รูปภาพ'} · ${files.length ? `${files.length} ไฟล์` : 'ยังไม่อัปโหลด'}</small>
                                <div class="sm-check-files">${files.map(f => f.mime === 'application/pdf'
                                    ? `<button type="button" class="sm-pdf" data-file="${t.id}/${f.n}">📄 เปิด PDF ${f.n + 1}${f.password ? `<span>รหัส: ${esc(f.password)}</span>` : ''}</button>`
                                    : `<button type="button" class="sm-thumb" data-view="${t.id}/${f.n}"><img data-src="${t.id}/${f.n}" alt="${esc(u.label)}"></button>`).join('')}</div></div>`;
                        }).join('')}
                        <div class="sm-check-actions">
                            <input data-field="note" value="${esc(t.note || '')}" placeholder="หมายเหตุถึงพนักงาน / บันทึกการตรวจ">
                            <button type="button" class="fa-btn fa-btn-primary" data-review="done" ${t.submitted_at ? '' : 'disabled'}>✓ ตรวจสอบแล้ว</button>
                            <button type="button" class="fa-btn" data-review="reopen" ${t.submitted_at || t.status === 'done' ? '' : 'disabled'}>↩ ให้ส่งใหม่</button>
                        </div>
                    </article>`;
                }).join('') : '<p class="fa-empty">ยังไม่มีงานที่ให้พนักงานส่งข้อมูล</p>'}
            </div>`;
        const dialog = $('smDialog');
        if (!dialog.open) dialog.showModal();
        // โหลดภาพย่อจากหลังบ้าน (ต้องแนบสิทธิ์ล็อกอิน — ใช้ลิงก์ Drive ตรงไม่ได้)
        $('smDetail').querySelectorAll('img[data-src]').forEach(async img => {
            try { img.src = await fileUrl(img.dataset.src); } catch { img.alt = 'เปิดรูปไม่ได้'; }
        });
    }
    async function reviewTask(button) {
        const card = button.closest('[data-task]');
        const id = card.dataset.task;
        const note = card.querySelector('[data-field=note]').value;
        const reopen = button.dataset.review === 'reopen';
        if (reopen && !confirm('ให้พนักงานแก้ไขและส่งข้อมูลงานนี้ใหม่?')) return;
        button.disabled = true;
        try {
            await updateTask(id, reopen ? { reopen: true, note } : { status: 'done', note }, reopen ? 'ส่งกลับให้พนักงานแก้ไขแล้ว' : 'บันทึกว่าตรวจสอบแล้ว');
            openCheck(state.current);
        } catch (error) { toast(error.message, true); button.disabled = false; }
    }

    // สิ่งที่ GA ขอ + สิ่งที่พนักงานตอบกลับ (ข้อมูลที่กรอก / ไฟล์ที่ส่ง)
    function responseHtml(t) {
        const fields = t.fields || [], uploads = t.uploads || [];
        if (!fields.length && !uploads.length) return '';
        const files = t.files || [];
        return `<div class="sm-response">
            ${t.submitted_at ? `<span class="fa-badge ok">พนักงานส่งแล้ว ${esc(when(t.submitted_at))}</span>` : '<span class="fa-badge dim">พนักงานยังไม่ส่ง</span>'}
            ${fields.map(f => `<div><small>${esc(f.label)}</small><b>${esc(t.response?.[f.id] || '-')}</b></div>`).join('')}
            ${uploads.map(u => `<div><small>${esc(u.label)} (${u.type === 'pdf' ? 'PDF' : 'รูปภาพ'})</small>${files.filter(f => f.slot === u.id).map(f =>
                `<button type="button" class="fa-btn fa-btn-ghost sm-file" data-file="${t.id}/${f.n}">เปิดไฟล์ ${f.n + 1}</button>${f.password ? ` <span class="fa-type">รหัส PDF: ${esc(f.password)}</span>` : ''}`).join(' ') || '<b>-</b>'}</div>`).join('')}
        </div>`;
    }
    async function openFile(ref) {
        const win = window.open('', '_blank');
        try {
            const response = await window.authFetch(api(`/tasks/${ref.split('/')[0]}/file/${ref.split('/')[1]}`));
            if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
            const url = URL.createObjectURL(await response.blob());
            if (win) win.location.href = url; else window.open(url, '_blank');
        } catch (error) { if (win) win.close(); toast(error.message, true); }
    }

    async function createTask(form) {
        const fd = Object.fromEntries(new FormData(form));
        if (!fd.title?.trim()) return toast('กรุณากรอกหัวเรื่องงาน', true);
        if (fd.box === '__new' && !fd.new_box_title?.trim()) return toast('กรุณาตั้งชื่อกล่องใหม่', true);
        const rowsOf = type => [...form.querySelectorAll(`[data-builder="${type}"] .sm-builder-row`)];
        fd.fields = fd.kind === 'notice' ? [] : rowsOf('fields').map(r => ({ label: r.querySelector('[data-label]').value.trim() })).filter(f => f.label);
        fd.uploads = fd.kind !== 'info_upload' ? [] : rowsOf('uploads').map(r => ({ label: r.querySelector('[data-label]').value.trim(), type: r.querySelector('[data-type]').value })).filter(u => u.label);
        // เลือก "เก็บข้อมูลและอัปโหลด" แต่ไม่ได้ตั้งช่องอัปโหลด → เป็นงานเก็บข้อมูล
        if (fd.kind === 'info_upload' && !fd.uploads.length && fd.fields.length) fd.kind = 'info';
        // กล่องที่มีแบบฟอร์มอยู่แล้ว: ไม่ได้ตั้งช่องเพิ่มเติม → ใช้แบบฟอร์มของกล่องอย่างเดียว (ไม่ต้องเลือกส่วนงาน)
        const pickedBox = (state.data.boxes || []).find(b => b.key === fd.box);
        if (((pickedBox?.form || []).length || pickedBox?.link) && !fd.fields.length && !fd.uploads.length) { fd.kind = 'notice'; fd.section = ''; }
        if (fd.kind !== 'notice' && !fd.section) return toast('กรุณาเลือกส่วนงานที่จะเก็บข้อมูลที่ขอเพิ่ม', true);
        if (fd.kind === 'info' && !fd.fields.length) return toast('งานเก็บข้อมูลต้องมีช่องกรอกข้อมูลอย่างน้อย 1 ช่อง', true);
        if (fd.kind === 'info_upload' && !fd.uploads.length) return toast('กรุณาเพิ่มช่องอัปโหลดอย่างน้อย 1 ช่อง', true);
        const creating = form.dataset.create === '1';
        const target = creating ? 'create' : fd.target || 'one';
        const keys = creating ? [...state.picks] : targetKeys(form, target);
        if (!keys.length) return toast(target === 'missing' ? 'ทุกคนที่กรองอยู่มีงานนี้แล้ว' : 'กรุณาเลือกพนักงานอย่างน้อย 1 คน', true);
        const dup = keys.filter(k => hasThisTask(form, k)).length;
        if ((creating || target !== 'one') && !confirm(`มอบหมายงาน "${fd.title}" ให้พนักงาน ${keys.length} คน?${dup ? `\n(ในนี้มี ${dup} คนที่มีงานนี้แล้ว — จะได้งานซ้ำอีก 1 งาน)` : ''}`)) return;
        if (target === 'one' && dup && !confirm(`พนักงานคนนี้มีงาน "${fd.title}" อยู่แล้ว — มอบหมายซ้ำอีก 1 งานไหม?`)) return;
        const button = form.querySelector('button[type=submit]');
        button.disabled = true;
        try {
            const { tasks, boxes, destError, skipped } = await request('/tasks', { method: 'POST', body: JSON.stringify({ ...fd, target: undefined, employee_keys: keys, allow_duplicate: target !== 'missing', use_template: form.classList.contains('is-tpl') && tplOf((state.data.boxes || []).find(b => b.key === fd.box))?.saved === true }) });
            if (destError) alert(destError);
            else if (tasks[0]?.dest) toast(`สร้างชีตเก็บข้อมูลใน "${tasks[0].dest.section_title}" แล้ว`);
            state.data.tasks.push(...tasks);
            if (boxes) state.data.boxes = workBoxes(boxes);
            state.drafts.delete(state.current);
            if (creating) { state.picks.clear(); $('smDialog').close(); }
            else openPlan(state.current);      // วาดฟอร์มใหม่ (มีกล่องที่เพิ่งสร้างให้เลือก)
            if ($('smTaskList')) renderTasks();
            render();
            toast(`มอบหมายงานแล้ว ${tasks.length} คน${skipped ? ` · ข้าม ${skipped} คนที่มีงานนี้อยู่แล้ว` : ''}`);
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    }
    async function updateTask(id, patch, done) {
        const { task } = await request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
        const i = state.data.tasks.findIndex(t => t.id === task.id);
        if (patch.status === 'deleted') state.data.tasks.splice(i, 1); else state.data.tasks[i] = task;
        if ($('smTaskList')) renderTasks();
        render();
        toast(done);
    }

    // ---------------------------------------------------------------- เหตุการณ์
    // ตัวกรองถูกสร้างใหม่ตอนโหลด → ฟังที่แถบเครื่องมือแทน
    document.querySelector('.sm-toolbar').addEventListener('change', event => { if (event.target.matches('select')) render(); });
    $('smSearch').addEventListener('input', render);
    $('smDialog').addEventListener('change', event => { if (event.target.closest('#smRecForm') && event.target.name === 'status') syncRecForm(event.target.form); });
    $('smDialog').addEventListener('submit', event => {
        if (event.target.id === 'smNewTask') { event.preventDefault(); createTask(event.target); }
        if (event.target.id === 'smTplForm') { event.preventDefault(); saveTemplate(event.target); }
        if (event.target.id === 'smRecForm') { event.preventDefault(); saveRecord(event.target); }
    });
    // ปิดหน้าต่าง (ปุ่ม × / Esc) → เก็บข้อมูลที่กรอกไว้ เปิดพนักงานคนเดิมอีกครั้งจะกรอกคืนให้
    $('smDialog').addEventListener('close', () => {
        const form = $('smNewTask');
        if (!form || !state.current) return;
        const d = readForm(form);
        const filled = d.title.trim() || d.detail.trim() || d.fields.some(f => f.label.trim()) || d.uploads.some(u => u.label.trim());
        if (filled) state.drafts.set(state.current, d); else state.drafts.delete(state.current);
    });
    $('smDialog').addEventListener('input', event => { if (event.target.id === 'smBcText') updateBroadcastPreview(); });
    $('smDialog').addEventListener('change', async event => {
        const b = state.broadcast;
        if (!b || state.mode !== 'broadcast') return;
        if (event.target.id === 'smBcFile') {
            const file = event.target.files?.[0];
            if (!file) { b.file = null; $('smBcFileInfo').textContent = ''; return; }
            if (file.size > 10 * 1024 * 1024) { event.target.value = ''; b.file = null; return toast('ไฟล์ต้องไม่เกิน 10 MB', true); }
            const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
            b.file = { name: file.name, data };
            $('smBcFileInfo').textContent = `แนบแล้ว: ${file.name} (${(file.size / 1048576).toFixed(1)} MB)${/^image\/(jpeg|png)$/.test(file.type) ? ' — ส่งเป็นรูป' : ' — ส่งเป็นลิงก์ดาวน์โหลด'}`;
            return;
        }
        const all = event.target.closest('[data-bc-all]');
        if (all) { $('smBcList').querySelectorAll('[data-bc-pick]:not(:disabled)').forEach(c => { c.checked = all.checked; }); return; }
        const sel = event.target.closest('[data-bc-room]');
        if (sel) {
            const t = b.targets[Number(sel.dataset.bcRoom)];
            if (sel.value === '__search') {
                const q = (prompt(`ค้นหาห้องแชทของ ${t.fullname} (พิมพ์ชื่อ / รหัส)`) || '').trim().toLowerCase();
                if (q) {
                    const found = b.rooms.filter(r => `${r.customName} ${r.lineName}`.toLowerCase().includes(q)).slice(0, 15);
                    if (!found.length) toast('ไม่พบห้องที่ตรงคำค้น', true);
                    found.forEach(r => { if (!t.suggestions.some(s => s.channelId === r.channelId && s.conversationId === r.conversationId)) t.suggestions.push({ ...r, score: 0 }); });
                    if (found[0]) t.selected = `${found[0].channelId}|${found[0].conversationId}`;
                }
                return renderBroadcastTargets();
            }
            t.selected = sel.value;
            return renderBroadcastTargets();
        }
    });
    $('smDialog').addEventListener('change', event => { const form = event.target.closest('#smNewTask, #smTplForm'); if (form && event.target.matches('[name=kind], [name=box]')) syncBuilder(form); });
    $('smDialog').addEventListener('click', async event => {
        // คลิกพื้นที่ว่างนอกหน้าต่างไม่ปิด (กันข้อมูลที่กรอกหาย) — ปิดด้วยปุ่ม × เท่านั้น
        if (event.target.closest('[data-close]')) return $('smDialog').close();
        const editTpl = event.target.closest('[data-edit-tpl]');
        if (editTpl) { event.stopPropagation(); return openTplEditor(editTpl.dataset.editTpl); }
        const template = event.target.closest('[data-template]');
        if (template) return useTemplate(template.dataset.template);
        const add = event.target.closest('[data-add]');
        if (add) return add.previousElementSibling.append(builderRow(add.dataset.add));
        if (event.target.closest('[data-remove]')) return event.target.closest('.sm-builder-row').remove();
        const review = event.target.closest('[data-review]');
        if (review) return reviewTask(review);
        const varBtn = event.target.closest('[data-var]');
        if (varBtn) {
            const area = $('smBcText');
            const at = area.selectionStart ?? area.value.length;
            area.value = area.value.slice(0, at) + varBtn.dataset.var + area.value.slice(area.selectionEnd ?? at);
            area.focus();
            area.selectionStart = area.selectionEnd = at + varBtn.dataset.var.length;
            return updateBroadcastPreview();
        }
        const bcSend = event.target.closest('[data-bc-send]');
        if (bcSend) return sendBroadcast(bcSend);
        const delGroup = event.target.closest('[data-del-group]');
        const delTask = event.target.closest('[data-del-task]');
        if (delGroup || delTask) {
            const button = delGroup || delTask;
            button.disabled = true;
            try {
                const group = state.mode === 'group' ? state.groups.find(g => g.title === state.groupTitle) : null;
                const ids = delGroup ? group.tasks.map(t => t.id) : [Number(delTask.dataset.delTask)];
                const label = delGroup ? `ลบงาน "${state.groupTitle}" ทั้งหมด ${ids.length} คน` : 'ลบงานนี้ออกจากพนักงานคนนี้';
                if (await deleteTasks(ids, label, !delGroup)) {
                    const again = state.mode === 'group' && state.groups.findIndex(g => g.title === state.groupTitle);
                    if (state.mode === 'group' && again >= 0) openGroup(again); else $('smDialog').close();
                }
            } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
            return;
        }
        const gotoPlan = event.target.closest('[data-goto-plan]');
        if (gotoPlan) { state.mode = 'plan'; return openPlan(gotoPlan.dataset.gotoPlan); }
        const gotoCheck = event.target.closest('[data-goto-check]');
        if (gotoCheck) return openCheck(gotoCheck.dataset.gotoCheck);
        const view = event.target.closest('[data-view]');
        if (view) { try { const url = await fileUrl(view.dataset.view); window.open(url, '_blank'); } catch (error) { toast(error.message, true); } return; }
        const file = event.target.closest('[data-file]');
        if (file) return openFile(file.dataset.file);
        const save = event.target.closest('[data-save]'), del = event.target.closest('[data-delete]');
        if (!save && !del) return;
        const button = save || del;
        const card = button.closest('[data-task]');
        button.disabled = true;
        try {
            if (del) {
                const t = state.data.tasks.find(x => x.id === Number(del.dataset.delete));
                if (!confirm(`ลบงาน "${t?.title || ''}" ของ ${t?.fullname || 'พนักงานคนนี้'} ?\n\nมีผลเฉพาะคนนี้ — กล่องงาน งานของคนอื่น และชีตรายงานรวมไม่ถูกลบ`)) return;
                await updateTask(del.dataset.delete, { status: 'deleted' }, 'ลบงานแล้ว');
            } else {
                await updateTask(save.dataset.save, { status: card.querySelector('[data-field=status]').value, note: card.querySelector('[data-field=note]').value }, 'บันทึกแล้ว');
            }
        } catch (error) { toast(error.message, true); } finally { button.disabled = false; }
    });
    document.addEventListener('keydown', event => {
        const destination = event.target.closest('[data-doc-destination]');
        if (destination && ['Enter', ' '].includes(event.key)) { event.preventDefault(); destination.click(); }
    });
    document.addEventListener('click', event => {
        const destination = event.target.closest('[data-doc-destination]');
        if (destination) {
            event.stopPropagation();
            const url = state.docDestinations?.[destination.dataset.docDestination]?.[destination.dataset.docDestinationKind];
            if (url) window.open(url, '_blank', 'noopener');
            return;
        }
        const plan = event.target.closest('[data-plan]');
        if (plan) { state.mode = 'plan'; return openPlan(plan.dataset.plan); }
        const checkBtn = event.target.closest('[data-check]');
        if (checkBtn) return openCheck(checkBtn.dataset.check);
        const groupBtn = event.target.closest('[data-group]');
        if (groupBtn) return openGroup(Number(groupBtn.dataset.group));
        const taskPill = event.target.closest('[data-task-open]');
        if (taskPill) { const t = state.data.tasks.find(x => x.id === Number(taskPill.dataset.taskOpen)); if (t) return openPersonTasks(t.employee_key, t.id); return; }
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'refresh') load(true);
        if (action === 'broadcast') openBroadcast();
        if (action === 'line-match') openLineMatch();
        if (action === 'create-task') return openCreate();
        const hint = event.target.closest('[data-lm-hint]');
        if (hint) {
            $('smLmBody').querySelector(`[data-lm-person="${hint.dataset.lmHint}"]`).value = hint.dataset.label;
            $('smLmBody').querySelector(`[data-lm-pick="${hint.dataset.lmHint}"]`).checked = true;
            return;
        }
        const lmApply = event.target.closest('[data-lm-apply]');
        if (lmApply) return applyLineMatch(lmApply);
        const editTplBox = event.target.closest('[data-edit-tpl]');
        if (editTplBox && !editTplBox.closest('#smDialog')) { event.stopPropagation(); return openTplEditor(editTplBox.dataset.editTpl); }
        const delBox = event.target.closest('[data-del-box]');
        if (delBox) { event.stopPropagation(); return deleteBox(delBox.dataset.delBox); }
        if (event.target.closest('[data-restore-list]')) return openRestore();
        const restoreBtn = event.target.closest('[data-restore-box]');
        if (restoreBtn) return restoreBox(restoreBtn.dataset.restoreBox);
        const reviewBox = event.target.closest('[data-review-box]');
        if (reviewBox) { event.stopPropagation(); return openReviewList(reviewBox.dataset.reviewBox); }
        const pickBtn = event.target.closest('[data-check-pick]');
        if (pickBtn) return openCheckPick(pickBtn.dataset.checkPick);
        const reportBtn = event.target.closest('[data-report-record], [data-report-task]');
        if (reportBtn && !reportBtn.disabled) { event.stopPropagation(); return setReport(reportBtn); }
        const recordBtn = event.target.closest('[data-record]');
        if (recordBtn) return openRecord(recordBtn.dataset.record);
        const copyPattern = event.target.closest('[data-copy-pattern]');
        if (copyPattern) { const pre = $('smDetail').querySelector('.sm-pattern'); if (pre) navigator.clipboard?.writeText(pre.textContent).then(() => toast('คัดลอกข้อความแจ้งประกันแล้ว')).catch(() => {}); if (copyPattern.tagName === 'BUTTON') return; }
        const delRecord = event.target.closest('[data-del-record]');
        if (delRecord) return deleteRecord(delRecord.dataset.delRecord, delRecord);
        const openIntake = event.target.closest('[data-open-intake]');
        if (openIntake) { $('smDialog').close(); window.parent.postMessage({ type: 'open-insurance-intake', id: openIntake.dataset.openIntake }, location.origin); return; }
        const recFile = event.target.closest('[data-rec-file]');
        if (recFile) {
            const [rid, n] = recFile.dataset.recFile.split('/');
            if (/^image\//.test(recFile.dataset.mime)) { recordFileUrl(rid, n).then(openViewer).catch(error => toast(error.message, true)); return; }
            const win = window.open('', '_blank');
            recordFileUrl(rid, n).then(url => { if (win) win.location.href = url; else window.open(url, '_blank'); }).catch(error => { if (win) win.close(); toast(error.message, true); });
            return;
        }
        const boxTile = event.target.closest('[data-box]');
        if (boxTile) { state.box = state.box === boxTile.dataset.box ? '' : boxTile.dataset.box; return render(); }
        if (action === 'import-claimed') { $('smClaimFile').click(); return; }
        if (action === 'clear-filters') {
            state.box = '';
            document.querySelectorAll('.sm-toolbar select').forEach(s => { s.value = ''; });
            $('smSearch').value = '';
            render();
        }
    });

    load();
})();
