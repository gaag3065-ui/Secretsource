// ติดตามขั้นตอนการดำเนินงานที่พักใหม่ — ผัง Flow chart ของยูนิตที่ยังไม่ขึ้น "ทำสัญญาแล้ว"
// • ขั้นตอนหลักอ่านจากคอลัมน์วันที่ H–Q ในทะเบียนห้องพัก (แก้วันที่แล้วเขียนกลับทะเบียน)
// • กดที่กล่องขั้นตอนเพื่อกำหนดวันที่ / หมายเหตุ / แนบหลักฐาน (รูป, PDF) / ให้ทำคู่ขนานกับขั้นอื่น
// • กดปุ่ม ＋ ระหว่างขั้นเพื่อแทรกขั้นตอนเสริม · ข้อสี่เหลี่ยมข้าวหลามตัด "สัญญาต้องแก้ไขไหม?" เพิ่มรอบแก้สัญญา (ส่งกลับเจ้าของบ้าน → ส่งส่วนกลางอีกครั้ง)
// ข้อมูลเสริม/หลักฐานเก็บที่หลังบ้าน /api/accommodation-rooms/flow
(() => {
    const host = document.getElementById('accommodationFlow');
    if (!host) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const KEYS = ['dH', 'dI', 'dJ', 'dK', 'dL', 'dM', 'dN', 'dO', 'dP', 'dQ'];
    const FALLBACK = ['วันตรวจสอบ', 'วันที่ตั้งเบิกค่ามัดจำ', 'วันที่จ่ายค่ามัดจำ', 'วันที่ได้รับสัญญา', 'วันที่ส่งสัญญาไปตรวจสอบ', 'วันที่ตรวจสอบเสร็จ', 'วันที่ตั้งเบิกค่าเช่าล่วงหน้า', 'วันที่ได้รับเงินตั้งเบิก', 'วันที่ตรวจสอบก่อนเซ็นสัญญา', 'วันที่เซ็นสัญญา'];
    const DEFAULT_SIDE = { dP: 'dL' };   // ตรวจบ้านก่อนเซ็นสัญญา ทำไปพร้อมกับส่งสัญญาให้ส่วนกลางตรวจ (ปรับได้ในหน้าต่างขั้นตอน)
    const DONE = 'ทำสัญญาแล้ว', DAY = 86400000;
    const state = { data: null, flow: new Map(), filter: 'all', query: '', error: '', view: 'chart' };

    const parseDmy = text => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim()); if (!m) return null; const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); };
    const todayUtc = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
    const days = (a, b) => Math.round((b - a) / DAY);
    const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thDate = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(2)}`;
    const span = n => n < 0 ? 'ลำดับวันที่ไม่ตรง' : n === 0 ? 'วันเดียวกัน' : n >= 60 ? `${n} วัน (≈ ${(n / 30).toFixed(1)} เดือน)` : `${n} วัน`;
    const toInput = text => { const d = parseDmy(text); return d ? d.toISOString().slice(0, 10) : ''; };
    const fromInput = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? `${+m[3]}/${+m[2]}/${m[1]}` : ''; };
    const idNum = id => parseInt(String(id).slice(1), 36) || 0;
    const labels = () => KEYS.map((k, i) => String(state.data?.dateHeaders?.[k] || FALLBACK[i]).replace(/\s*\(.*?\)\s*$/, ''));

    // ---------------------------------------------------------------- ข้อมูลเสริม (หลังบ้าน)
    async function call(path, method = 'GET', body, status) {
        const run = async () => {
            const response = await window.authFetch(`${API}${path}`, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
            if (method !== 'GET') absorb(data);   // อัปเดตเฉพาะขั้นที่เพิ่งบันทึก — ไม่ต้องโหลดทุกบ้านใหม่
            return data;
        };
        return status && window.GA_LOADING ? window.GA_LOADING.run(status, run()) : run();
    }
    const setFlow = steps => { state.flow = new Map((steps || []).map(s => [`${s.no}|${s.id}`, s])); };
    // รับผลจากหลังบ้าน: step = ขั้นที่บันทึก (ลบแล้ว → เอาออก) · files = รายการไฟล์ใหม่ของขั้น · steps = ทั้งตาราง (ทางเดิม)
    function absorb(data) {
        if (data.step) { const k = `${data.step.no}|${data.step.id}`; if (data.step.deleted) state.flow.delete(k); else state.flow.set(k, data.step); }
        else if (data.files && data.id) {
            const k = `${data.no}|${data.id}`, old = state.flow.get(k);
            state.flow.set(k, old ? { ...old, files: data.files } : { no: Number(data.no), id: data.id, label: '', date: '', note: '', files: data.files, lane: '', anchor: '', kind: '', custom: false, deleted: false });
        } else if (data.steps) setFlow(data.steps);
    }
    // วาดใหม่เฉพาะการ์ดบ้านที่แก้ (บ้านอื่น/ตัวกรอง/ช่องค้นหาไม่ถูกแตะ) — ถ้าไม่พบการ์ดค่อยวาดทั้งหน้า
    function renderRoom(no) {
        const room = roomOf(no), old = host.querySelector(`[data-card="${Number(no)}"]`);
        if (!room || !old) return render();
        const t = document.createElement('div'); t.innerHTML = card(build(room)); old.replaceWith(t.firstElementChild);
        const kpi = host.querySelector('.fl-kpis');   // ตัวเลข KPI ด้านบนคำนวณใหม่จากข้อมูลล่าสุดทันที
        if (kpi) { const open = (state.data.rooms || []).filter(r => r.status !== DONE); kpi.innerHTML = kpiHtml(open, open.map(build)); }
    }
    async function loadFlow() { try { setFlow((await call('/flow')).steps); state.error = ''; } catch (error) { state.error = error.message; } render(); }
    const rec = (no, id) => state.flow.get(`${no}|${id}`) || null;

    // ---------------------------------------------------------------- สร้างผังของยูนิตหนึ่ง
    function build(room) {
        const L = labels();
        const customs = [...state.flow.values()].filter(s => s.no === room.no && s.custom);
        const all = new Map();   // id → ข้อมูลขั้น
        KEYS.forEach((k, i) => {
            const r = rec(room.no, k) || {};
            const lane = r.lane || (DEFAULT_SIDE[k] ? 'side' : 'main');
            all.set(k, { id: k, label: L[i], text: room[k] || '', date: parseDmy(room[k]), note: r.note || '', files: r.files || [], lane, anchor: r.anchor || (lane === 'side' ? DEFAULT_SIDE[k] || '' : ''), kind: '', custom: false });
        });
        customs.forEach(c => all.set(c.id, { id: c.id, label: c.label, text: c.date, date: parseDmy(c.date), note: c.note, files: c.files, lane: c.lane || 'main', anchor: c.anchor, kind: c.kind, custom: true }));
        const byId = (a, b) => idNum(a.id) - idNum(b.id);
        const main = [], side = new Map();
        const mainCustoms = [...all.values()].filter(s => s.custom && s.lane === 'main').sort(byId);
        const place = id => { main.push(all.get(id)); mainCustoms.filter(c => c.anchor === id).forEach(c => place(c.id)); };
        KEYS.filter(k => all.get(k).lane === 'main').forEach(place);
        mainCustoms.filter(c => !main.includes(c)).forEach(c => main.push(c));
        const lastMain = main[main.length - 1];
        for (const s of [...all.values()].filter(x => x.lane === 'side').sort((a, b) => (a.custom - b.custom) || byId(a, b))) {
            let a = s.anchor && main.some(m => m.id === s.anchor) ? s.anchor : (main.some(m => m.id === 'dL') ? 'dL' : lastMain?.id);
            if (!a) continue;
            (side.get(a) || side.set(a, []).get(a)).push(s);
        }
        // ยกเลิกสัญญา: มีขั้น kind=cancel หรือสถานะในทะเบียนมีคำว่า "ยกเลิก" → จบสายงานที่ข้อสี่เหลี่ยม (ซ่อนขั้นหลักที่ตามมา) กล่อง "ยกเลิกสัญญา" ปิดท้ายกลุ่มวนแก้สัญญา
        let cancelled = [...all.values()].some(x => x.kind === 'cancel' && x.lane === 'side');
        if (!cancelled && /ยกเลิก/.test(String(room.status || ''))) {
            const virtual = { id: '_cancel', label: 'ยกเลิกสัญญา', text: '', date: null, note: 'ตามสถานะในทะเบียน: ' + room.status, files: [], lane: 'side', anchor: 'dL', kind: 'cancel', custom: true, virtual: true };
            (side.get('dL') || side.set('dL', []).get('dL')).push(virtual); cancelled = true;
        }
        for (const list of side.values()) list.sort((x, y) => (x.kind === 'cancel') - (y.kind === 'cancel'));   // กล่องยกเลิกสัญญาอยู่ท้ายสุดเสมอ
        // ระยะเวลา: ขั้นหลักนับจากขั้นหลักที่มีวันที่ก่อนหน้า · ขั้นคู่ขนานนับจากขั้นที่มันทำไปพร้อมกัน
        let prev = null;
        for (const m of main) { if (m.date) { m.gap = prev ? days(prev.date, m.date) : null; m.from = prev ? prev.label : ''; prev = m; } }
        for (const [a, list] of side) { const anchor = all.get(a); let p = anchor?.date ? anchor : null; for (const s of list) { if (s.date) { s.gap = p ? days(p.date, s.date) : null; s.from = p ? p.label : ''; p = s; } } }
        const dated = [...all.values()].filter(s => s.date).sort((a, b) => a.date - b.date);
        const first = dated[0] || null, lastMainDated = [...main].reverse().find(m => m.date) || null;
        const now = todayUtc();
        const rework = [...all.values()].filter(s => s.kind === 'rework');
        return { room, main, side, all, first, last: lastMainDated, rework, cancelled, total: first && lastMainDated ? days(first.date, lastMainDated.date) : null, waiting: lastMainDated ? days(lastMainDated.date, now) : null };
    }

    // ---------------------------------------------------------------- แสดงผล
    function node(s, room, dot = '', wait = null) {
        const cls = s.date ? 'is-done' : 'is-todo';
        const gap = s.date && s.gap != null ? `<span class="fl-gap${s.gap < 0 ? ' is-bad' : s.gap >= 14 ? ' is-slow' : ''}" title="จาก “${esc(s.from)}”">⏱ +${s.gap < 0 ? '?' : s.gap} วัน</span>` : '';
        const waiting = wait != null && wait > 0 ? `<span class="fl-wait" title="ค้างอยู่ที่ขั้นนี้ถึงวันนี้">ค้าง ${wait} วัน</span>` : '';
        const attrs = ` type="button" data-step="${esc(s.id)}" data-no="${room.no}"`;
        const body = `<b class="fl-label">${s.kind === 'rework' ? '↩ ' : s.kind === 'cancel' ? '✖ ' : ''}${esc(s.label)}</b>
            ${s.date ? `<span class="fl-date">${esc(thDate(s.date))}</span><small>${esc(s.text)}</small>` : '<span class="fl-date is-empty">ยังไม่มีวันที่</span>'}
            ${s.note ? `<small class="fl-note">📝 ${esc(s.note)}</small>` : ''}`;
        const main = s.virtual ? `<div class="fl-main">${body}</div>` : `<button${attrs} class="fl-main" title="กดเพื่อกำหนดวันที่ / แนบหลักฐาน">${body}</button>`;
        const evidence = s.virtual ? '' : `<button${attrs} class="fl-ev${s.files.length ? '' : ' is-none'}" title="กดเพื่อกำหนดวันที่ / แนบหลักฐาน">${s.files.length ? `📎 ${s.files.length} หลักฐาน` : '＋ แนบหลักฐาน'}</button>`;
        return `<div class="fl-row ${cls}${s.kind === 'rework' ? ' is-rework' : ''}${s.kind === 'cancel' ? ' is-cancel' : ''}"><span class="fl-dot">${esc(dot)}</span>${main}<div class="fl-act">${evidence}${gap}${waiting}</div></div>`;
    }
    const plus = (room, after, lane = 'main') => `<button type="button" class="fl-plus" data-add="${esc(after)}" data-lane="${lane}" data-no="${room.no}" title="เพิ่มขั้นตอนเสริมตรงนี้">＋ เพิ่มขั้นตอนต่อจากข้อนี้</button>`;

    // ผังเป็นแนวตั้ง (Vertical Stepper): ทุกขั้นเป็นแถว Grid [จุด | รายละเอียด | ปุ่มแนบหลักฐาน/จำนวนวัน] — ไม่ใช้ตำแหน่งแบบ absolute และไม่มีการวัด/ขยับตำแหน่งด้วย JS
    function flowOf(b) {
        const { room, side } = b;
        const main = b.cancelled ? b.main.slice(0, Math.max(0, b.main.findIndex(m => m.id === 'dL')) + 1) : b.main;
        const groupsOf = sides => [['⇉ ทำไปพร้อมกัน', sides.filter(x => x.kind !== 'rework' && x.kind !== 'cancel')], ['↩ วนแก้สัญญา (ส่งกลับเจ้าของบ้าน → ส่งส่วนกลางอีกครั้ง)', sides.filter(x => x.kind === 'rework' || x.kind === 'cancel')]]
            .filter(g => g[1].length)
            .map(([tag, list]) => `<div class="fl-group${list[0].kind === 'rework' || list[0].kind === 'cancel' ? ' is-rw' : ''}"><span class="fl-group-tag">${tag}</span><ol class="fl-sub">${list.map(x => `<li>${node(x, room, x.kind === 'rework' || x.kind === 'cancel' ? '↩' : '⇉')}${x.kind === 'rework' && /ส่งสัญญาให้ส่วนกลางอีกครั้ง/.test(x.label) ? '<span class="fl-loopback">↺ วนกลับไปตรวจสัญญาที่ส่วนกลาง</span>' : ''}</li>`).join('')}</ol></div>`).join('');
        const items = main.map((m, i) => `<li class="fl-step-item">${node(m, room, String(i + 1), m === b.last ? b.waiting : null)}
            ${b.cancelled && m.id === 'dL' ? '' : `<div class="fl-addrow">${plus(room, m.id)}</div>`}
            ${m.id === 'dL' ? diamond(b) : ''}${groupsOf(side.get(m.id) || [])}</li>`).join('');
        return `<div class="fl-chart"><span class="fl-start">เริ่ม</span><ol class="fl-steps">${items}</ol>${b.cancelled ? '' : '<span class="fl-end">เซ็นสัญญา ✔</span>'}</div>`;
    }
    function diamond(b) {
        const rounds = b.rework.filter(x => /ส่งกลับให้เจ้าของบ้าน/.test(x.label)).length;
        return `<div class="fl-decision${rounds ? ' has-rework' : ''}"><button type="button" class="fl-decide" data-decision="${b.room.no}" title="กดเพื่อเพิ่มรอบแก้สัญญา">❓ สัญญาต้องแก้ไข?</button><span class="fl-decide-info">${rounds ? `แก้ไปแล้ว ${rounds} รอบ` : 'ยังไม่มีรอบแก้'}${b.cancelled ? ' · ยกเลิกสัญญาแล้ว — ผังจบที่ข้อนี้' : ' · ไม่ต้องแก้ → ไปขั้นตอนถัดไป'}</span></div>`;
    }

    function card(b) {
        const { room } = b;
        const hot = b.waiting != null && b.waiting >= 30;
        const summary = b.first
            ? `<span>เริ่ม <b>${esc(thDate(b.first.date))}</b></span>${b.last ? `<span>ขั้นล่าสุด <b>${esc(b.last.label)}</b> · ${esc(thDate(b.last.date))}</span><span>ใช้เวลาตั้งแต่เริ่มถึงขั้นล่าสุด <b>${esc(span(b.total))}</b></span><span class="${hot ? 'is-hot' : ''}">ค้างอยู่ที่ขั้นนี้มา <b>${esc(span(b.waiting))}</b> (ถึงวันนี้)</span>` : ''}${b.rework.length ? `<span class="is-hot">แก้สัญญา <b>${b.rework.filter(s => /ส่งกลับให้เจ้าของบ้าน/.test(s.label)).length}</b> รอบ</span>` : ''}`
            : '<span class="is-hot">ยังไม่มีวันที่ในทะเบียนเลย — กดที่กล่องขั้นตอนเพื่อกำหนดวันที่</span>';
        return `<article class="fl-card${hot ? ' is-hot' : ''}" data-card="${room.no}">
            <header><div><h3>${esc(room.project)} <small>${esc(room.unit)}</small></h3><span class="fl-status">${esc(room.status)}</span></div><div class="fl-meta">${room.rent ? `ค่าเช่า ${num(room.rent)}/เดือน` : ''}${room.type ? ` · ${esc(room.type)}` : ''}</div></header>
            <div class="fl-summary">${summary}</div>
            ${state.view === 'list' || !window.AccFlowChart ? flowOf(b) : window.AccFlowChart.html(b, { esc, thDate })}
        </article>`;
    }

    function kpiHtml(openRooms, builds) {
        const withDates = builds.filter(x => x.last);
        const avgWait = withDates.length ? Math.round(withDates.reduce((n, x) => n + x.waiting, 0) / withDates.length) : 0;
        const longest = withDates.slice().sort((a, b) => b.waiting - a.waiting)[0];
        return `<span><small>ยูนิตที่กำลังดำเนินการ</small><b>${num(openRooms.length)}</b></span><span><small>ค้างขั้นล่าสุดเฉลี่ย</small><b>${num(avgWait)} วัน</b></span>${longest ? `<span class="is-hot"><small>ค้างนานสุด</small><b>${num(longest.waiting)} วัน</b><em>${esc(longest.room.project)} ${esc(longest.room.unit)}</em></span>` : ''}`;
    }
    function render() {
        if (!state.data) { host.innerHTML = window.AccSkeleton ? window.AccSkeleton.html(6, 'กำลังโหลดข้อมูลทะเบียนห้องพัก') : '<p class="fl-empty">กำลังโหลดข้อมูลทะเบียนห้องพัก…</p>'; return; }
        const openRooms = (state.data.rooms || []).filter(r => r.status !== DONE);
        const builds = openRooms.map(build);
        const statuses = [...new Set(openRooms.map(r => r.status))];
        const q = state.query.trim().toLowerCase();
        const shown = builds.filter(b => (state.filter === 'all' || b.room.status === state.filter) && (!q || `${b.room.project} ${b.room.unit} ${b.room.status}`.toLowerCase().includes(q))).sort((a, b) => (b.waiting ?? -1) - (a.waiting ?? -1));
        const chip = (key, label, n) => `<button type="button" data-fl-filter="${esc(key)}" class="${state.filter === key ? 'is-on' : ''}">${esc(label)} <b>${n}</b></button>`;
        const typing = document.activeElement?.matches?.('[data-fl-q]');
        host.innerHTML = `<div class="fl-top">
            <div><h2>🧭 ติดตามขั้นตอนการดำเนินงานที่พักใหม่</h2><p>ยูนิตที่ยังไม่ขึ้น “ทำสัญญาแล้ว” ${num(openRooms.length)} ยูนิต · กดกล่องขั้นตอนเพื่อใส่วันที่และแนบหลักฐาน · กด ＋ เพื่อแทรกขั้นตอนเสริม · เรียงตามที่ค้างนานสุดก่อน</p></div>
            <div class="fl-kpis">${kpiHtml(openRooms, builds)}</div>
        </div>
        ${state.error ? `<p class="fl-warn">⚠️ โหลดหลักฐาน/ขั้นตอนเสริมไม่ได้: ${esc(state.error)} (ยังดูผังตามทะเบียนได้)</p>` : ''}
        <div class="fl-filters"><span class="fl-view" role="group" aria-label="มุมมอง"><button type="button" data-fl-view="chart" class="${state.view === 'chart' ? 'is-on' : ''}">🔀 ผัง Flow chart</button><button type="button" data-fl-view="list" class="${state.view === 'list' ? 'is-on' : ''}">☰ รายการแนวตั้ง</button></span>${chip('all', 'ทั้งหมด', openRooms.length)}${statuses.map(s => chip(s, s, openRooms.filter(r => r.status === s).length)).join('')}<input type="search" data-fl-q placeholder="ค้นหาที่พัก / ยูนิต…" value="${esc(state.query)}"></div>
        ${shown.length ? shown.map(card).join('') : '<p class="fl-empty">ไม่พบยูนิตที่ตรงเงื่อนไข</p>'}`;
        if (typing) { const input = host.querySelector('[data-fl-q]'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
    // ---------------------------------------------------------------- หน้าต่างกำหนดขั้นตอน / แนบหลักฐาน
    const dialog = Object.assign(document.createElement('dialog'), { className: 'fl-dialog' });
    document.body.append(dialog);
    dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-fl-close]')) dialog.close(); });
    const ctx = { no: 0, id: '', add: null };
    const roomOf = no => (state.data?.rooms || []).find(r => r.no === Number(no));

    function anchorOptions(b, selected, skipId) {
        return b.main.filter(m => m.id !== skipId).map(m => `<option value="${esc(m.id)}"${m.id === selected ? ' selected' : ''}>${esc(m.label)}</option>`).join('');
    }
    function filesHtml(no, id, files) {
        return files.length ? files.map(f => `<span class="fl-file" data-file="${esc(f.id)}"><button type="button" class="fl-thumb" data-open="${esc(f.id)}" title="${esc(f.name)}">${f.mime === 'application/pdf' ? '<span class="fl-pdf">📄 PDF</span>' : `<img alt="" data-img="${esc(f.id)}">`}</button><button type="button" class="fl-rm" data-rmfile="${esc(f.id)}" aria-label="เอาออก" title="เอาออกจากขั้นตอน (ไฟล์ยังอยู่ใน Drive)">✕</button></span>`).join('') : '<small class="fl-none">ยังไม่มีหลักฐาน</small>';
    }
    async function loadThumbs() {
        for (const img of dialog.querySelectorAll('img[data-img]')) {
            try { const r = await window.authFetch(`${API}/expenses/file/${img.dataset.img}`); if (r.ok) img.src = URL.createObjectURL(await r.blob()); } catch { /* ไม่มีรูปย่อ */ }
        }
    }
    function openStep(no, id) {
        const room = roomOf(no); if (!room) return;
        const b = build(room); const s = b.all.get(id); if (!s) return;
        Object.assign(ctx, { no: room.no, id, add: null });
        const isSide = s.lane === 'side';
        dialog.innerHTML = `<form class="fl-form" data-fl-form>
            <header><div><h3>${esc(s.label)}</h3><p>${esc(room.project)} ${esc(room.unit)}${s.custom ? ' · ขั้นตอนเสริม' : ''}</p></div><button type="button" class="fl-x" data-fl-close aria-label="ปิด">×</button></header>
            ${s.custom ? `<label>ชื่อขั้นตอน<input name="label" value="${esc(s.label)}" maxlength="80"></label>` : ''}
            <label>วันที่ <small>กดไอคอนปฏิทินเพื่อเลือก</small><input type="date" name="date" value="${esc(toInput(s.text))}"></label>
            <label>หมายเหตุ<textarea name="note" rows="2" maxlength="400" placeholder="เช่น ส่งให้ทนายส่วนกลางทางอีเมล / ผู้รับเรื่อง">${esc(s.note)}</textarea></label>
            <fieldset class="fl-lane"><legend>การทำงาน</legend>
                <label class="fl-inline"><input type="radio" name="lane" value="main"${isSide ? '' : ' checked'}> เรียงต่อในสายหลัก</label>
                <label class="fl-inline"><input type="radio" name="lane" value="side"${isSide ? ' checked' : ''}> ทำคู่ขนาน ไปพร้อมกับ</label>
                <select name="anchor">${anchorOptions(b, s.anchor || 'dL', s.id)}</select>
            </fieldset>
            <section class="fl-evidence"><h4>📎 หลักฐานของขั้นตอนนี้ <span data-count>${s.files.filter(f => !f.lease).length}</span></h4>
                <div class="fl-files" data-files>${filesHtml(room.no, id, s.files.filter(f => !f.lease))}</div>
                <label class="fl-upload">＋ แนบรูป / PDF<input type="file" accept="image/*,application/pdf" multiple hidden data-upload></label></section>
            ${id === 'dQ' ? `<section class="fl-evidence fl-lease"><h4>📄 สัญญาเช่าที่เซ็นแล้ว (PDF) <span data-lcount>${s.files.filter(f => f.lease).length}</span></h4>
                <p class="fl-hint">แนบไฟล์สัญญาฉบับเซ็นแล้ว — จะแสดงในหน้า “ยูนิตและสถานะ” ให้กดเปิดดูได้</p>
                <div class="fl-files" data-lfiles>${filesHtml(room.no, id, s.files.filter(f => f.lease))}</div>
                <label class="fl-upload">＋ แนบสัญญาเช่า (PDF)<input type="file" accept="application/pdf" multiple hidden data-upload-lease></label></section>` : ''}
            <p class="fl-error" data-error hidden></p>
            <footer>${s.custom ? '<button type="button" class="fl-danger" data-del>ลบขั้นตอนนี้</button>' : '<span></span>'}<span><button type="button" data-fl-close>ปิด</button><button type="submit" class="fl-primary">บันทึก</button></span></footer></form>`;
        dialog.showModal(); loadThumbs();
    }
    function openAdd(no, after, lane) {
        const room = roomOf(no); if (!room) return;
        const b = build(room);
        Object.assign(ctx, { no: room.no, id: '', add: { after, lane } });
        dialog.innerHTML = `<form class="fl-form" data-fl-form>
            <header><div><h3>＋ เพิ่มขั้นตอนเสริม</h3><p>${esc(room.project)} ${esc(room.unit)} · แทรกต่อจาก “${esc(b.all.get(after)?.label || '')}”</p></div><button type="button" class="fl-x" data-fl-close aria-label="ปิด">×</button></header>
            <label>ชื่อขั้นตอน<input name="label" maxlength="80" required placeholder="เช่น ตรวจบ้านก่อนเซ็นสัญญา / นัดเจ้าของบ้าน"></label>
            <label>วันที่ <small>ใส่ภายหลังได้</small><input type="date" name="date"></label>
            <label>หมายเหตุ<textarea name="note" rows="2" maxlength="400"></textarea></label>
            <fieldset class="fl-lane"><legend>การทำงาน</legend>
                <label class="fl-inline"><input type="radio" name="lane" value="main"${lane === 'side' ? '' : ' checked'}> เรียงต่อจากขั้นนี้</label>
                <label class="fl-inline"><input type="radio" name="lane" value="side"${lane === 'side' ? ' checked' : ''}> ทำคู่ขนาน ไปพร้อมกับ</label>
                <select name="anchor">${anchorOptions(b, after)}</select>
            </fieldset>
            <p class="fl-hint">เพิ่มแล้วกดที่กล่องใหม่เพื่อแนบหลักฐานได้</p>
            <p class="fl-error" data-error hidden></p>
            <footer><span></span><span><button type="button" data-fl-close>ยกเลิก</button><button type="submit" class="fl-primary">เพิ่มขั้นตอน</button></span></footer></form>`;
        dialog.showModal();
    }
    function openDecision(no) {
        const room = roomOf(no); if (!room) return;
        const b = build(room);
        const rounds = b.rework.filter(s => /ส่งกลับให้เจ้าของบ้าน/.test(s.label)).length;
        Object.assign(ctx, { no: room.no, id: '', add: null });
        dialog.innerHTML = `<div class="fl-form"><header><div><h3>สัญญาต้องแก้ไขไหม?</h3><p>${esc(room.project)} ${esc(room.unit)}</p></div><button type="button" class="fl-x" data-fl-close aria-label="ปิด">×</button></header>
            <p class="fl-hint">ถ้าทนาย/ส่วนกลางตรวจแล้วสัญญาต้องแก้ไข → ส่งกลับให้เจ้าของบ้านแก้ แล้ววนกลับมาส่งให้ส่วนกลางตรวจอีกครั้ง ${rounds ? `<br>ตอนนี้แก้ไปแล้ว <b>${rounds}</b> รอบ` : ''}</p>
            ${b.cancelled ? '<p class="fl-hint"><b>บ้านนี้ยกเลิกสัญญาแล้ว</b> — ผังจบที่ข้อนี้ · กดกล่อง "ยกเลิกสัญญา" เพื่อแก้วันที่/หมายเหตุ หรือลบ (ลบ = กลับมาดำเนินการต่อ)</p>' : ''}
            <p class="fl-error" data-error hidden></p>
            <footer><span>${b.cancelled ? '' : '<button type="button" class="fl-danger" data-cancel-contract>✖ ยกเลิกสัญญา</button>'}</span><span><button type="button" data-fl-close>ไม่ต้องแก้ (ปิด)</button><button type="button" class="fl-primary" data-rework>↩ สัญญาต้องแก้ไข — เพิ่มรอบที่ ${rounds + 1}</button></span></footer></div>`;
        dialog.showModal();
    }
    const showError = msg => { const el = dialog.querySelector('[data-error]'); if (el) { el.textContent = msg; el.hidden = !msg; } };
    const busy = on => dialog.querySelectorAll('button, input, textarea, select').forEach(el => { el.disabled = on; });

    async function mutate(fn) {
        busy(true); showError('');
        try { await fn(); return true; } catch (error) { showError(error.message); return false; } finally { busy(false); }
    }
    const bodyOf = form => { const f = new FormData(form); return { date: fromInput(f.get('date')), note: String(f.get('note') || ''), lane: f.get('lane'), anchor: f.get('anchor') }; };
    function applyDateLocally(no, id, date) { const r = roomOf(no); if (r && KEYS.includes(id)) r[id] = date; }

    dialog.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target, b = bodyOf(form), label = String(new FormData(form).get('label') || '').trim();
        const ok = await mutate(async () => {
            if (ctx.add) return call('/flow', 'PUT', { no: ctx.no, label, ...b, anchor: b.anchor || ctx.add.after }, 'กำลังบันทึก…');
            const payload = { no: ctx.no, id: ctx.id, ...b };
            if (!KEYS.includes(ctx.id)) payload.label = label;
            const data = await call('/flow', 'PUT', payload, 'กำลังบันทึก…');
            applyDateLocally(ctx.no, ctx.id, b.date);
            return data;
        });
        if (ok) { dialog.close(); renderRoom(ctx.no); }
    });
    function refreshLists() {
        const all = rec(ctx.no, ctx.id)?.files || [], ev = all.filter(f => !f.lease), ls = all.filter(f => f.lease);
        const box = dialog.querySelector('[data-files]'); if (box) { box.innerHTML = filesHtml(ctx.no, ctx.id, ev); dialog.querySelector('[data-count]').textContent = ev.length; }
        const lbox = dialog.querySelector('[data-lfiles]'); if (lbox) { lbox.innerHTML = filesHtml(ctx.no, ctx.id, ls); dialog.querySelector('[data-lcount]').textContent = ls.length; }
        loadThumbs();
    }
    const readUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('อ่านไฟล์ไม่ได้')); r.readAsDataURL(blob); });
    // ย่อรูปก่อนส่ง (ด้านยาวสุด 1800px · JPEG 0.8) ผ่านอุโมงค์ได้เร็วขึ้นมาก — PDF และรูปที่เล็กอยู่แล้วส่งตามเดิม · ย่อไม่ได้ก็ส่งไฟล์เดิม
    async function packFile(file) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 300 * 1024) return readUrl(file);
        try {
            const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
            const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
            const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
            const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.8));
            return blob && blob.size < file.size ? readUrl(blob) : readUrl(file);
        } catch { return readUrl(file); }
    }
    dialog.addEventListener('change', async e => {
        if (!e.target.matches('[data-upload], [data-upload-lease]')) return;
        const lease = e.target.matches('[data-upload-lease]');
        const files = [...e.target.files]; e.target.value = '';
        if (lease && files.some(f => f.type !== 'application/pdf')) { showError('สัญญาเช่าต้องเป็นไฟล์ PDF เท่านั้น'); return; }
        for (const file of files) {
            const ok = await mutate(async () => {
                const dataUrl = await window.GA_LOADING.run('กำลังเตรียมรูป…', packFile(file));
                return call('/flow/files', 'POST', { no: ctx.no, id: ctx.id, name: file.name, dataUrl, ...(lease ? { lease: true } : {}) }, 'กำลังอัปโหลด…');
            });
            if (!ok) break;
        }
        refreshLists();
        renderRoom(ctx.no);
    });
    dialog.addEventListener('click', async e => {
        const open = e.target.closest('[data-open]');
        if (open) { try { const r = await window.authFetch(`${API}/expenses/file/${open.dataset.open}`); if (r.ok) window.open(URL.createObjectURL(await r.blob()), '_blank'); } catch { showError('เปิดไฟล์ไม่ได้'); } return; }
        const rm = e.target.closest('[data-rmfile]');
        if (rm) {
            if (!confirm('เอาหลักฐานนี้ออกจากขั้นตอน? (ไฟล์ยังอยู่ใน Google Drive)')) return;
            const ok = await mutate(() => call('/flow/files', 'DELETE', { no: ctx.no, id: ctx.id, fileId: rm.dataset.rmfile }));
            if (ok) { refreshLists(); renderRoom(ctx.no); }
            return;
        }
        if (e.target.closest('[data-del]')) {
            if (!confirm('ลบขั้นตอนเสริมนี้? (หลักฐานที่แนบจะไม่แสดงอีก)')) return;
            if (await mutate(() => call('/flow', 'PUT', { no: ctx.no, id: ctx.id, remove: true }, 'กำลังลบ…'))) { dialog.close(); renderRoom(ctx.no); }
            return;
        }
        if (e.target.closest('[data-cancel-contract]')) {
            const room = roomOf(ctx.no);
            if (!room || !confirm(`ยกเลิกสัญญา ${room.project} ${room.unit}?\nผังจะจบที่ข้อ "สัญญาต้องแก้ไข?" และซ่อนขั้นตอนที่ตามมา (กู้คืนได้โดยลบกล่อง "ยกเลิกสัญญา")`)) return;
            const d = todayUtc(), today = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
            if (await mutate(() => call('/flow', 'PUT', { no: ctx.no, label: 'ยกเลิกสัญญา', date: today, lane: 'side', anchor: 'dL', kind: 'cancel' }, 'กำลังบันทึก…'))) { dialog.close(); renderRoom(ctx.no); }
            return;
        }
        if (e.target.closest('[data-rework]')) {
            const room = roomOf(ctx.no), b = build(room);
            const n = b.rework.filter(s => /ส่งกลับให้เจ้าของบ้าน/.test(s.label)).length + 1;
            const ok = await mutate(async () => {
                await call('/flow', 'PUT', { no: ctx.no, label: `ส่งกลับให้เจ้าของบ้านแก้สัญญา (รอบ ${n})`, lane: 'side', anchor: 'dL', kind: 'rework' }, 'กำลังบันทึก…');
                return call('/flow', 'PUT', { no: ctx.no, label: `ส่งสัญญาให้ส่วนกลางอีกครั้ง (รอบ ${n})`, lane: 'side', anchor: 'dL', kind: 'rework' }, 'กำลังบันทึก…');
            });
            if (ok) { dialog.close(); renderRoom(ctx.no); }
        }
    });

    host.addEventListener('click', e => {
        const v = e.target.closest('[data-fl-view]'); if (v) { state.view = v.dataset.flView; render(); return; }
        const f = e.target.closest('[data-fl-filter]'); if (f) { state.filter = f.dataset.flFilter; render(); return; }
        const step = e.target.closest('[data-step]'); if (step) return openStep(step.dataset.no, step.dataset.step);
        const add = e.target.closest('[data-add]'); if (add) return openAdd(add.dataset.no, add.dataset.add, add.dataset.lane);
        const dec = e.target.closest('[data-decision]'); if (dec) openDecision(dec.dataset.decision);
    });
    host.addEventListener('input', e => { if (e.target.matches('[data-fl-q]')) { state.query = e.target.value; render(); } });
    window.addEventListener('ro-data', e => { state.data = e.detail; render(); });
    state.data = window.__roData || null;
    render();
    loadFlow();
})();
