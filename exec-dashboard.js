// แดชบอร์ดผู้บริหาร — อ่านอย่างเดียว · ข้อมูลจาก /api/exec/* (สิทธิ์ ViewExecutive)
// บัญชีผู้บริหารควรมีสิทธิ์ "ดูแดชบอร์ดผู้บริหาร" อย่างเดียว — เข้าได้เฉพาะหน้านี้ ไม่มีลิงก์ไประบบ GA
(() => {
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/exec`;
    const PAL = ['#4f46e5', '#0d9488', '#d97706', '#db2777', '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#0891b2', '#64748b'];
    const state = { summary: null, view: 'overview', ins: null, assets: null, welfare: null, rooms: null, loading: {}, errors: {},
        report: { area: '', person: '', status: '', q: '', sort: 'at', dir: -1 }, insF: { person: '', status: '', q: '' }, asF: { area: '', q: '' }, rmF: { filter: 'all', q: '' } };
    const num = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
    const baht = n => `${num(n)} บาท`;
    const pct = r => r === null || r === undefined ? '–' : `${Math.round(r * 100)}%`;
    const share = (n, t) => t ? `${Math.round(n / t * 1000) / 10}%` : '0%';
    const hours = h => h === null || h === undefined ? '–' : (h < 1 ? `${Math.round(h * 60)} นาที` : (h < 48 ? `${h.toFixed(1)} ชม.` : `${(h / 24).toFixed(1)} วัน`));
    const when = iso => iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '–';
    const dayLabel = d => { const [, m, dd] = d.split('-'); return `${Number(dd)}/${Number(m)}`; };
    const areaOf = key => state.summary?.areas.find(a => a.key === key);
    const color = key => areaOf(key)?.color || '#64748b';
    const areaTitle = key => areaOf(key)?.title || key;
    const rateClass = r => r === null || r === undefined ? '' : (r >= 0.8 ? 'ex-good' : (r >= 0.5 ? 'ex-warn' : 'ex-bad'));

    // ---------------------------------------------------------------- เรียก API
    async function call(path) {
        const response = await window.authFetch(`${API}${path}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ดูแดชบอร์ดผู้บริหาร — ให้ ADMIN เพิ่มสิทธิ์ "ดูแดชบอร์ดผู้บริหาร"');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วรีเฟรช');
        if (!response.ok || data.success === false) throw new Error(data.message || `โหลดไม่สำเร็จ (${response.status})`);
        return data;
    }
    function rangeQuery() {
        const q = new URLSearchParams();
        const preset = $('exPreset').value;
        const iso = d => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
        const today = new Date();
        if (preset === 'custom') { if ($('exFrom').value) q.set('from', $('exFrom').value); if ($('exTo').value) q.set('to', $('exTo').value); }
        else if (preset === 'month') { q.set('from', `${iso(today).slice(0, 8)}01`); q.set('to', iso(today)); }
        else { q.set('from', iso(new Date(today.getTime() - (Number(preset) - 1) * 86400000))); q.set('to', iso(today)); }
        return q;
    }
    // แต่ละส่วนโหลดแยกกัน — ส่วนหนึ่งล้มไม่กระทบส่วนอื่น
    const LOADERS = {
        summary: refresh => call(`/summary?${rangeQuery()}${refresh ? '&refresh=1' : ''}`),
        insurance: () => call('/insurance'),
        assets: () => call('/assets'),
        welfare: () => call(`/welfare?${rangeQuery()}`),
        rooms: refresh => call(`/rooms${refresh ? '?refresh=1' : ''}`)
    };
    const KEY = { summary: 'summary', insurance: 'ins', assets: 'assets', welfare: 'welfare', rooms: 'rooms' };
    const NEEDS = { overview: ['summary'], insurance: ['insurance', 'summary'], assets: ['assets', 'summary'], welfare: ['welfare', 'summary', 'rooms'], rooms: ['rooms'], people: ['summary'], report: ['summary'] };
    const REQUIRED = { overview: ['summary'], insurance: ['insurance'], assets: ['assets'], welfare: ['welfare'], rooms: ['rooms'], people: ['summary'], report: ['summary'] };
    async function ensure(name, refresh) {
        const k = KEY[name];
        if (state[k] && !refresh) return;
        if (state.loading[name]) return state.loading[name];
        state.errors[name] = '';
        state.loading[name] = LOADERS[name](refresh).then(d => { state[k] = d; }).catch(e => { state.errors[name] = e.message; }).finally(() => { state.loading[name] = null; });
        return state.loading[name];
    }
    async function show(view, refresh) {
        state.view = view;
        document.querySelectorAll('#exNav button').forEach(b => b.classList.toggle('is-on', b.dataset.view === view));
        document.querySelectorAll('.ex-pane').forEach(p => { p.hidden = p.id !== `v-${view}`; });
        $('exRangeBox').hidden = view === 'rooms';
        const needs = NEEDS[view];
        if (needs.some(n => !state[KEY[n]]) || refresh) {
            $(`v-${view}`).innerHTML = '<p class="ex-empty">กำลังโหลดข้อมูล…</p>';
            await Promise.all(needs.map(n => ensure(n, refresh)));
        }
        if (state.view !== view) return;
        render(view);
    }
    function status() {
        const s = state.summary, el = $('exStatus');
        const errs = Object.values(state.errors).filter(Boolean);
        el.className = `ex-status${errs.length ? ' is-error' : ''}`;
        el.textContent = errs.length ? errs[0] : (s ? `ช่วงข้อมูล ${new Date(s.range.from).toLocaleDateString('th-TH', { dateStyle: 'medium' })} – ${new Date(s.range.to).toLocaleDateString('th-TH', { dateStyle: 'medium' })} · อัปเดต ${when(s.generated_at)}` : '');
        $('exFoot').innerHTML = s ? `<b>แหล่งข้อมูลงาน</b>${s.sources.map(x => `<span>${x.error ? '⚠️' : '✓'} ${esc(x.name)}${x.error ? ` — โหลดไม่ได้ (${esc(x.error)})` : ` · ${num(x.count)} รายการ`}</span>`).join('')}
            <span>เกณฑ์: "ค้างนาน" = ยังไม่เสร็จเกิน ${s.sla_hours / 24} วัน · "เสร็จทันกำหนด" = เสร็จภายใน ${s.sla_hours / 24} วันนับจากรับเรื่อง</span>` : '';
    }
    function render(view) {
        status();
        const pane = $(`v-${view}`);
        const missing = REQUIRED[view].find(n => !state[KEY[n]]);
        if (missing) { pane.innerHTML = `<p class="ex-status is-error">${esc(state.errors[missing] || 'ไม่มีข้อมูล')}</p>`; return; }
        ({ overview: vOverview, insurance: vInsurance, assets: vAssets, welfare: vWelfare, rooms: vRooms, people: vPeople, report: vReport })[view]();
    }

    // ---------------------------------------------------------------- ส่วนประกอบ
    const kpi = (label, value, sub, c, cls = '') => `<div class="ex-kpi" style="--c:${c || 'var(--brand)'}"><span>${esc(label)}</span><b class="${cls}">${value}</b><small>${sub || '&nbsp;'}</small></div>`;
    const meter = (r, c) => `<div class="ex-meter" style="--c:${c || 'var(--ok)'}"><i style="width:${Math.round((r || 0) * 100)}%"></i></div>`;
    const pill = (text, c) => `<span class="ex-pill" style="--c:${c}">${esc(text)}</span>`;
    function table(head, rows, numCols = [], clickKeys = null, attr = 'data-person') {
        if (!rows.length) return '<p class="ex-empty">ไม่มีข้อมูล</p>';
        return `<div class="ex-table-wrap"><table class="ex-table"><thead><tr>${head.map((h, i) => `<th class="${numCols.includes(i) ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${
            rows.map((r, ri) => `<tr${clickKeys ? ` class="is-click" ${attr}="${esc(clickKeys[ri])}"` : ''}>${r.map((c, i) => `<td class="${numCols.includes(i) ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    // แผนภูมิวงกลม + คำอธิบาย (รวมส่วนที่เล็กเป็น "อื่นๆ")
    function donut(list, { center = '', sub = '', max = 8, fmt = v => num(v) } = {}) {
        let items = list.filter(i => i.value > 0).map((i, k) => ({ ...i, c: i.c || PAL[k % PAL.length] }));
        if (items.length > max) { const rest = items.slice(max - 1); items = [...items.slice(0, max - 1), { name: `อื่นๆ (${rest.length})`, value: rest.reduce((n, x) => n + x.value, 0), c: '#94a3b8' }]; }
        const total = items.reduce((n, i) => n + i.value, 0);
        if (!total) return '<p class="ex-empty">ไม่มีข้อมูล</p>';
        let off = 0;
        const arcs = items.map(i => { const len = i.value / total * 100; const e = `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${i.c}" stroke-width="7" stroke-dasharray="${len.toFixed(3)} ${(100 - len).toFixed(3)}" stroke-dashoffset="${(-off).toFixed(3)}"><title>${esc(i.name)}: ${esc(fmt(i.value))} (${share(i.value, total)})</title></circle>`; off += len; return e; }).join('');
        return `<div class="ex-chart"><div class="ex-donut"><svg viewBox="0 0 42 42" role="img" aria-label="แผนภูมิสัดส่วน"><circle r="15.9155" cx="21" cy="21" fill="none" stroke="var(--line)" stroke-width="7"/>${arcs}</svg>
            <div class="ex-dc"><b>${esc(center)}</b><small>${esc(sub)}</small></div></div>
            <div class="ex-legend">${items.map(i => `<div class="ex-leg" style="--c:${i.c}"><i></i><span title="${esc(i.name)}">${esc(i.name)}</span><em>${esc(fmt(i.value))}<small>${share(i.value, total)}</small></em></div>`).join('')}</div></div>`;
    }
    function hbars(list, { fmt = v => num(v), c = 'var(--brand)', limit = 12, attr = '', sub } = {}) {
        const items = list.slice(0, limit);
        const max = Math.max(1, ...items.map(i => i.value));
        if (!items.length) return '<p class="ex-empty">ไม่มีข้อมูล</p>';
        return `<div class="ex-bars">${items.map(i => `<div class="ex-bar-row${attr ? ' is-click' : ''}" ${attr ? `${attr}="${esc(i.key ?? i.name)}"` : ''}><b title="${esc(i.name)}">${esc(i.name)}${sub && sub(i) ? `<small>${esc(sub(i))}</small>` : ''}</b>
            <div class="ex-stack" style="width:${Math.max(3, i.value / max * 100)}%">${(i.parts || [{ v: 1, c: i.c || c }]).map(p => `<i style="--c:${p.c};flex:${p.v}" title="${esc(p.t || '')}"></i>`).join('')}</div><em>${esc(fmt(i.value))}</em></div>`).join('')}</div>`;
    }
    function trendSvg(areas) {
        const map = new Map();
        for (const a of areas) for (const t of a.trend) { const m = map.get(t.d) || { d: t.d, created: 0, done: 0 }; m.created += t.created; m.done += t.done; map.set(t.d, m); }
        const days = [...map.values()].sort((x, y) => x.d.localeCompare(y.d));
        if (!days.length) return '<p class="ex-empty">ไม่มีข้อมูลในช่วงนี้</p>';
        const W = 900, H = 200, L = 34, B = 24, T = 8, max = Math.max(1, ...days.map(d => Math.max(d.created, d.done)));
        const bw = (W - L) / days.length, y = v => T + (H - T - B) * (1 - v / max);
        const bars = days.map((d, i) => {
            const x = L + i * bw, w = Math.max(2, bw * 0.38);
            return `<rect x="${(x + bw * 0.08).toFixed(1)}" y="${y(d.created).toFixed(1)}" width="${w.toFixed(1)}" height="${(H - B - y(d.created)).toFixed(1)}" fill="#94a3b8"><title>${esc(dayLabel(d.d))} เปิดงาน ${d.created}</title></rect><rect x="${(x + bw * 0.08 + w + 1).toFixed(1)}" y="${y(d.done).toFixed(1)}" width="${w.toFixed(1)}" height="${(H - B - y(d.done)).toFixed(1)}" fill="#4f46e5"><title>${esc(dayLabel(d.d))} งานเสร็จ ${d.done}</title></rect>`;
        }).join('');
        const step = Math.ceil(days.length / 12);
        const labels = days.map((d, i) => i % step === 0 ? `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(dayLabel(d.d))}</text>` : '').join('');
        const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${W}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}" stroke="var(--line)"/><text x="${L - 4}" y="${(y(max * f) + 3).toFixed(1)}" text-anchor="end">${Math.round(max * f)}</text>`).join('');
        return `<svg class="ex-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟงานที่เปิดและงานที่เสร็จรายวัน">${grid}${bars}${labels}</svg>`;
    }
    const statsKpis = (s, c) => `<div class="ex-kpis">
        ${kpi('งานทั้งหมด', num(s.total), 'ในช่วงที่เลือก', c)}
        ${kpi('เสร็จแล้ว', num(s.done), `คิดเป็น <span class="${rateClass(s.doneRate)}">${pct(s.doneRate)}</span>`, c, 'ex-good')}
        ${kpi('ยังค้างอยู่', num(s.open), s.overdue ? `<span class="ex-bad">ค้างเกิน ${state.summary.sla_hours / 24} วัน ${num(s.overdue)} งาน</span>` : 'ไม่มีงานค้างนาน', c, s.open ? 'ex-warn' : '')}
        ${kpi('ใช้เวลาเฉลี่ยต่องาน', hours(s.avgHours), 'จากรับเรื่องถึงเสร็จ', c)}
        ${kpi('เสร็จทันกำหนด', pct(s.onTimeRate), `ภายใน ${state.summary.sla_hours / 24} วัน`, c, rateClass(s.onTimeRate))}</div>`;
    function itemsTable(list) {
        return list.length ? table(['รับเรื่อง', 'ส่วนงาน', 'ประเภท', 'รายการ', 'ผู้ทำ', 'สถานะ', 'ใช้เวลา'], list.map(i => [when(i.at), pill(areaTitle(i.a), color(i.a)), esc(i.c),
            esc(i.t) + (i.s ? `<br><small class="ex-help">${esc(i.s)}</small>` : ''), esc(i.bn || '–'), `<span class="${i.d ? 'ex-good' : (i.o ? 'ex-bad' : 'ex-warn')}">${esc(i.st)}</span>`, hours(i.h)])) : '<p class="ex-empty">ไม่มีรายการ</p>';
    }
    // รายงานการทำงานของส่วนงาน (ช่วงวันที่ที่เลือก): ตัวเลขคุณภาพ + ใครทำเท่าไร + ประเภท + รายการล่าสุด
    function workReport(areaKey) {
        const a = areaOf(areaKey);
        if (!state.summary) return `<div class="ex-card"><h2>รายงานการทำงาน</h2><p class="ex-empty">${esc(state.errors.summary || 'ไม่มีข้อมูล')}</p></div>`;
        if (!a) return '<div class="ex-card"><h2>รายงานการทำงาน</h2><p class="ex-empty">ยังไม่มีงานของส่วนงานนี้ในช่วงที่เลือก</p></div>';
        const recent = state.summary.items.filter(i => i.a === areaKey).slice(0, 40);
        return `<h3 class="ex-sec-title">รายงานการทำงาน · ${esc(a.title)} <span style="font-weight:400">(ช่วงเวลาที่เลือกด้านบน)</span></h3>
        ${statsKpis(a, a.color)}
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>ใครทำงานนี้บ้าง <small>กดชื่อเพื่อดูรายละเอียด</small></h2>${table(['ผู้รับผิดชอบ', 'ทั้งหมด', 'เสร็จ', 'ค้าง', 'เสร็จ %', 'เวลาเฉลี่ย'],
                a.people.map(p => [`${esc(p.name)}<br><small class="ex-help">${esc(p.position)}</small>`, num(p.total), num(p.done), num(p.open), `<span class="${rateClass(p.doneRate)}">${pct(p.doneRate)}</span>`, hours(p.avgHours)]), [1, 2, 3, 4, 5], a.people.map(p => p.username))}</div>
            <div class="ex-card"><h2>แยกตามประเภทงาน</h2>${table(['ประเภทงาน', 'ทั้งหมด', 'เสร็จ', 'ค้างนาน', 'เสร็จ %', 'เวลาเฉลี่ย'],
                a.categories.map(c => [esc(c.name), num(c.total), num(c.done), c.overdue ? `<span class="ex-bad">${num(c.overdue)}</span>` : '0', `<span class="${rateClass(c.doneRate)}">${pct(c.doneRate)}</span>`, hours(c.avgHours)]), [1, 2, 3, 4, 5])}</div>
        </div>
        <div class="ex-card"><h2>รายการล่าสุด <small>${num(recent.length)} รายการ · ดูทั้งหมดที่เมนู "รายงาน"</small></h2><div class="ex-scroll">${itemsTable(recent)}</div></div>`;
    }

    // ---------------------------------------------------------------- ภาพรวม
    function vOverview() {
        const d = state.summary;
        $('v-overview').innerHTML = `
        ${statsKpis(d.overall)}
        <div class="ex-areas">${d.areas.map(a => `<button type="button" class="ex-area" style="--c:${a.color}" data-go="${a.key}">
            <h3>${esc(a.title)}</h3><div class="ex-big">${num(a.total)} <small style="font-size:13px;font-weight:400;color:var(--muted)">งาน</small></div>${meter(a.doneRate, a.color)}
            <dl><dt>เสร็จแล้ว</dt><dd>${num(a.done)} (${pct(a.doneRate)})</dd><dt>ยังค้าง</dt><dd>${num(a.open)}${a.overdue ? ` · <span class="ex-bad">ค้างนาน ${num(a.overdue)}</span>` : ''}</dd>
            <dt>ใช้เวลาเฉลี่ย</dt><dd>${hours(a.avgHours)}</dd><dt>ผู้รับผิดชอบ</dt><dd>${num(a.people.filter(p => p.username).length)} คน</dd></dl></button>`).join('')}</div>
        <div class="ex-grid ex-split">
            <div class="ex-card"><h2>งานที่เปิดและงานที่เสร็จรายวัน <small>เทา = เปิดงาน · น้ำเงิน = เสร็จ</small></h2>${trendSvg(d.areas)}</div>
            <div class="ex-card"><h2>สัดส่วนงานตามส่วนงาน</h2>${donut(d.areas.map(a => ({ name: a.title, value: a.total, c: a.color })), { center: num(d.overall.total), sub: 'งานทั้งหมด' })}</div>
        </div>
        <div class="ex-card"><h2>ปริมาณงานของแต่ละคน <small>กดชื่อเพื่อดูว่าทำอะไรบ้าง</small></h2>
            <div class="ex-legend-inline">${d.areas.map(a => `<span><i style="background:${a.color}"></i>${esc(a.title)}</span>`).join('')}</div>
            ${hbars(d.people.map(p => ({ key: p.username, name: p.name, value: p.total, parts: d.areas.filter(a => p.areas[a.key]).map(a => ({ v: p.areas[a.key].total, c: a.color, t: `${a.title}: ${p.areas[a.key].total}` })) })), { attr: 'data-person', limit: 15 })}</div>`;
    }

    // ---------------------------------------------------------------- ประกัน
    function vInsurance() {
        const d = state.ins, f = state.insF;
        const stCol = new Map(d.byStatus.map((s, i) => [s.name, PAL[i % PAL.length]]));
        const person = f.person ? d.persons.find(p => p.name === f.person) : null;
        const q = f.q.trim().toLowerCase();
        const list = d.cases.filter(c => (!f.person || c.by === f.person) && (!f.status || c.status === f.status) && (!q || `${c.id} ${c.company} ${c.status} ${c.by}`.toLowerCase().includes(q)));
        const scope = person ? { total: person.count, closed: person.closed, open: person.open } : d;
        const statusItems = (person ? person.statuses : d.byStatus).map(s => ({ name: s.name, value: s.count, c: stCol.get(s.name) }));
        $('v-insurance').innerHTML = `
        <div class="ex-kpis">
            ${kpi('เคสทั้งหมด', num(scope.total), person ? `ของ ${esc(person.name)} · ทั้งระบบ ${num(d.total)} เคส` : 'ทุกเคสในประวัติการรักษา', '#7c3aed')}
            ${kpi('ปิดเคสแล้ว', num(scope.closed), `คิดเป็น ${share(scope.closed, scope.total)}`, '#16a34a', 'ex-good')}
            ${kpi('ยังเปิดอยู่', num(scope.open), `คิดเป็น ${share(scope.open, scope.total)}`, '#d97706', scope.open ? 'ex-warn' : '')}
            ${kpi('ผู้รับเคส', num(d.persons.length), 'คนที่บันทึก/เปิดเคส', '#4f46e5')}</div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>สัดส่วนสถานะเคส ${person ? `<small>ของ ${esc(person.name)}</small>` : ''}</h2>${donut(statusItems, { center: num(scope.total), sub: 'เคส', max: 7 })}</div>
            <div class="ex-card"><h2>ใครรับเคสกี่เคส <small>กดชื่อเพื่อดูเฉพาะคนนั้น${person ? ' · กดซ้ำเพื่อดูทั้งหมด' : ''}</small></h2>${hbars(d.persons.map(p => ({ key: p.name, name: p.name, value: p.count,
                parts: p.statuses.map(s => ({ v: s.count, c: stCol.get(s.name), t: `${s.name}: ${s.count}` })) })), { attr: 'data-ins-person', limit: 14, sub: p => { const x = d.persons.find(y => y.name === p.name); return `ปิด ${x.closed} · เปิดอยู่ ${x.open} · ${share(x.count, d.total)} ของเคสทั้งหมด`; } })}</div>
        </div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>เคสใหม่รายเดือน <small>12 เดือนล่าสุด</small></h2>${hbars(d.byMonth.slice(-12).map(m => ({ name: m.name, value: m.count })), { c: '#7c3aed', limit: 12 })}</div>
            <div class="ex-card"><h2>สัดส่วนตามบริษัท</h2>${donut(d.byCompany.map(c => ({ name: c.name, value: c.count })), { center: num(d.total), sub: 'เคส', max: 7 })}</div>
        </div>
        <div class="ex-card"><h2>รายการเคสทั้งหมด <small>${num(list.length)} เคส${d.cases.length < d.total ? ` · มี ${num(d.cases.length)} เคสล่าสุด` : ''}</small></h2>
            <div class="ex-filters"><select id="insStatus"><option value="">ทุกสถานะ</option>${d.byStatus.map(s => `<option${f.status === s.name ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
                <input id="insQ" type="search" placeholder="ค้นหาเลขเคส / บริษัท / ผู้รับเคส" value="${esc(f.q)}">${person ? `<button type="button" class="ex-btn" data-ins-person="${esc(person.name)}">ล้างตัวกรองคน (${esc(person.name)})</button>` : ''}</div>
            <div class="ex-scroll">${table(['เคส', 'วันที่รักษา', 'บริษัท', 'สถานะล่าสุด', 'ผู้รับเคส', 'ผู้บันทึกล่าสุด', 'ขั้นตอน'], list.slice(0, 300).map(c => [`<b>#${esc(c.id)}</b>`, c.d ? new Date(c.d).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '–', esc(c.company), pill(c.status, stCol.get(c.status) || '#64748b'), esc(c.by), esc(c.last), num(c.steps)]), [6])}</div>
            ${list.length > 300 ? '<p class="ex-help">แสดง 300 เคสแรกตามตัวกรอง</p>' : ''}</div>
        ${workReport('insurance')}`;
    }

    // ---------------------------------------------------------------- ทรัพย์สิน
    function vAssets() {
        const d = state.assets, f = state.asF;
        const stCol = new Map(d.byStatus.map((s, i) => [s.name, PAL[i % PAL.length]]));
        const q = f.q.trim().toLowerCase();
        const list = d.items.filter(i => (!f.area || i.area === f.area) && (!q || `${i.code} ${i.name} ${i.category} ${i.location} ${i.status}`.toLowerCase().includes(q)));
        $('v-assets').innerHTML = `
        <div class="ex-kpis">
            ${kpi('ทรัพย์สินทั้งหมด', num(d.total), 'ชิ้น (ไม่รวมที่ถูกลบ)', '#2563eb')}
            ${kpi('มูลค่าตามราคาซื้อ', num(d.value), 'บาท (เฉพาะชิ้นที่ระบุราคา)', '#4f46e5')}
            ${kpi('พื้นที่ที่เก็บ', num(d.byArea.length), 'พื้นที่ทำงาน/อาคาร', '#0d9488')}
            ${kpi('หมวดทรัพย์สิน', num(d.byCategory.length), 'หมวด', '#d97706')}</div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>สัดส่วนทรัพย์สินแต่ละพื้นที่</h2>${donut(d.byArea.map(a => ({ name: a.name, value: a.count })), { center: num(d.total), sub: 'ชิ้น', max: 9 })}</div>
            <div class="ex-card"><h2>สัดส่วนตามสถานะ</h2>${donut(d.byStatus.map(s => ({ name: s.name, value: s.count, c: stCol.get(s.name) })), { center: num(d.total), sub: 'ชิ้น', max: 8 })}</div>
        </div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>แต่ละพื้นที่ มีกี่ชิ้น <small>แยกสีตามสถานะ · กดเพื่อกรองรายการด้านล่าง</small></h2>
                <div class="ex-legend-inline">${d.byStatus.slice(0, 8).map(s => `<span><i style="background:${stCol.get(s.name)}"></i>${esc(s.name)}</span>`).join('')}</div>
                ${hbars(d.byArea.map(a => ({ key: a.name, name: a.name, value: a.count, value2: a.value, parts: a.statuses.map(s => ({ v: s.count, c: stCol.get(s.name) || '#94a3b8', t: `${s.name}: ${s.count}` })) })), { attr: 'data-asset-area', limit: 16, sub: a => a.value2 ? `มูลค่า ${num(a.value2)} บาท` : '' })}</div>
            <div class="ex-card"><h2>สัดส่วนตามหมวดทรัพย์สิน</h2>${donut(d.byCategory.map(c => ({ name: c.name, value: c.count })), { center: num(d.byCategory.length), sub: 'หมวด', max: 9 })}</div>
        </div>
        <div class="ex-card"><h2>ทรัพย์สินทุกชิ้น <small>${num(list.length)} ชิ้น${d.items.length < d.total ? ` · มี ${num(d.items.length)} ชิ้นแรก` : ''}</small></h2>
            <div class="ex-filters"><select id="asArea"><option value="">ทุกพื้นที่</option>${d.byArea.map(a => `<option value="${esc(a.name)}"${f.area === a.name ? ' selected' : ''}>${esc(a.name)} (${a.count})</option>`).join('')}</select>
                <input id="asQ" type="search" placeholder="ค้นหารหัส / ชื่อ / หมวด / สถานที่" value="${esc(f.q)}"></div>
            <div class="ex-scroll">${table(['รหัส', 'ทรัพย์สิน', 'หมวด', 'พื้นที่', 'สถานที่', 'สถานะ', 'ราคา'], list.slice(0, 300).map(i => [esc(i.code), esc(i.name), esc(i.category), esc(i.area), esc(i.location), pill(i.status, stCol.get(i.status) || '#64748b'), i.price ? num(i.price) : '–']), [6])}</div>
            ${list.length > 300 ? '<p class="ex-help">แสดง 300 ชิ้นแรกตามตัวกรอง — เลือกพื้นที่หรือค้นหาเพื่อดูเฉพาะที่ต้องการ</p>' : ''}</div>
        ${workReport('assets')}`;
    }

    // ---------------------------------------------------------------- สวัสดิการ
    function vWelfare() {
        const w = state.welfare;
        const r = state.rooms;
        const rooms = w.rooms || (r ? { total: r.counts.total, contracted: r.counts.contracted, rentContracted: r.rent.contracted, rentAll: r.rent.all } : null);
        const rent = rooms?.rentAll || 0;
        const expense = [...w.categories.filter(c => c.value > 0).map(c => ({ name: c.name, value: c.value })), ...(rent ? [{ name: 'ค่าเช่าห้องพัก (ต่อเดือน)', value: rent }] : []), ...(w.repairs?.cost ? [{ name: 'ค่าซ่อมห้องพัก', value: w.repairs.cost }] : [])];
        const expenseTotal = expense.reduce((n, e) => n + e.value, 0);
        const items = [...w.categories.map(c => ({ name: c.name, value: c.count })), ...(rooms ? [{ name: 'ห้องพักพนักงาน (จำนวนห้อง)', value: rooms.total }] : []), ...(w.repairs?.count ? [{ name: 'แจ้งซ่อมห้องพัก', value: w.repairs.count }] : [])];
        $('v-welfare').innerHTML = `
        <div class="ex-kpis">
            ${kpi('ค่าสวัสดิการรวม', num(expenseTotal), 'บาท · ยอดเบิก + ค่าเช่าห้อง/เดือน' + (w.repairs?.cost ? ' + ซ่อม' : ''), '#db2777')}
            ${kpi('รายการเบิกในช่วงนี้', num(w.claimsCount), `ยอดเบิก ${baht(w.claimsTotal)}`, '#4f46e5')}
            ${kpi('ห้องพักพนักงาน', rooms ? num(rooms.total) : '–', rooms ? `ทำสัญญาแล้ว ${num(rooms.contracted)} · ค่าเช่า ${baht(rooms.rentContracted)}/เดือน` : 'ไม่มีข้อมูล', '#0d9488')}
            ${kpi('แจ้งซ่อมห้อง', w.repairs ? num(w.repairs.count) : '–', w.repairs ? `ซ่อมเสร็จ ${num(w.repairs.done)}${w.repairs.cost ? ` · ${baht(w.repairs.cost)}` : ''}` : 'ไม่มีข้อมูล', '#475569')}</div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>สัดส่วนค่าใช้จ่ายสวัสดิการ <small>ที่บริษัทออกให้ (บาท)</small></h2>${donut(expense, { center: num(expenseTotal), sub: 'บาท' })}</div>
            <div class="ex-card"><h2>มีสวัสดิการอะไรให้พนักงานบ้าง <small>จำนวนรายการ/ห้อง</small></h2>${donut(items, { center: num(items.reduce((n, i) => n + i.value, 0)), sub: 'รายการ' })}</div>
        </div>
        <div class="ex-card"><h2>รายละเอียดแต่ละสวัสดิการ <small>ช่วงที่เลือก (ห้องพักเป็นภาพรวมปัจจุบัน)</small></h2>
            ${table(['สวัสดิการ', 'จำนวนรายการ', 'ตรวจ/เสร็จแล้ว', 'ยอด (บาท)'], [
                ...w.categories.map(c => [esc(c.name), num(c.count), num(c.done), c.value ? num(c.value) : '–']),
                ...(rooms ? [[`ห้องพักพนักงาน <small class="ex-help">(ทำสัญญาแล้ว ${num(rooms.contracted)} จาก ${num(rooms.total)} ห้อง)</small>`, num(rooms.total), num(rooms.contracted), `${num(rooms.rentAll)} <small class="ex-help">ค่าเช่า/เดือน</small>`]] : []),
                ...(w.repairs ? [['แจ้งซ่อมห้องพัก', num(w.repairs.count), num(w.repairs.done), w.repairs.cost ? num(w.repairs.cost) : '–']] : [])], [1, 2, 3])}
            <p class="ex-help" style="margin-top:8px">เบิกเงินเคลมประกันไม่รวมในส่วนนี้ (ดูที่เมนู "ประกัน") · ยอดเบิกคิดจากช่อง "จำนวนเงิน" ที่พนักงานกรอกในแบบฟอร์ม</p></div>
        ${workReport('welfare')}`;
    }

    // ---------------------------------------------------------------- ห้องพัก
    function vRooms() {
        const d = state.rooms, f = state.rmF;
        const q = f.q.trim().toLowerCase();
        const list = d.rooms.filter(r => (f.filter === 'all' || (f.filter === 'contracted') === r.contracted) && (!q || `${r.project} ${r.unit} ${r.status} ${r.type}`.toLowerCase().includes(q)));
        const rent = list.reduce((n, r) => n + r.rent, 0);
        const seg = (k, l, n) => `<button type="button" data-room-filter="${k}" class="${f.filter === k ? 'is-on' : ''}">${l} ${n}</button>`;
        const km = v => { const t = String(v ?? '').trim(); return t && t !== '-' ? `${esc(t)} กม.` : '–'; };
        const steps = Object.entries(d.counts.processByStatus || {}).map(([s, n]) => `${esc(s)} ${n}`).join(' · ') || 'รอทำสัญญา/วางจอง';
        $('v-rooms').innerHTML = `
        <div class="ex-kpis">
            ${kpi('ห้องที่ทำสัญญาแล้ว', num(d.counts.contracted), `ค่าเช่า ${baht(d.rent.contracted)}/เดือน`, '#0d9488')}
            ${kpi('ห้องที่กำลังอยู่ในกระบวนการ', num(d.counts.process), steps, '#d97706')}
            ${kpi('รวมห้องทั้งหมด', num(d.counts.total), 'ห้อง', '#2563eb')}
            ${kpi('ค่าเช่ารวมทั้งหมดต่อเดือน', num(d.rent.all), `บาท · เฉพาะที่ทำสัญญาแล้ว ${baht(d.rent.contracted)}`, '#4f46e5')}</div>
        <div class="ex-card"><h2>ภาพรวมห้องพักทั้งหมด <small>จากทะเบียนห้องพัก · อัปเดต ${when(d.at)}</small></h2>
            <div class="ex-filters"><div class="ex-seg">${seg('all', 'ทั้งหมด', d.counts.total)}${seg('contracted', 'ทำสัญญาแล้ว', d.counts.contracted)}${seg('process', 'กำลังดำเนินการ', d.counts.process)}</div>
                <input id="rmQ" type="search" placeholder="ค้นหาที่พัก ยูนิต สถานะ…" value="${esc(f.q)}"><button type="button" class="ex-btn" id="rmRefresh">รีเฟรช</button></div>
            <p class="ex-help">ระยะทางเป็นกิโลเมตร ตามทะเบียนห้องพัก (MT = Mireka Tower · OR = Orion City)</p>
            ${list.length ? `<div class="ex-scroll ex-table-wrap"><table class="ex-table"><thead><tr><th>#</th><th>ที่พัก / ยูนิต</th><th>สถานะ</th><th>ประเภทห้อง</th><th class="num">ค่าเช่า/เดือน</th><th class="num">ห่าง Mireka Tower</th><th class="num">ห่าง Orion City</th><th>สัญญา</th></tr></thead><tbody>${list.map(r => `<tr>
                <td>${esc(r.no)}</td><td><b>${esc(r.project)}</b><br><small class="ex-help">${esc(r.unit)}</small></td><td>${pill(r.status || '–', r.contracted ? '#0d9488' : '#d97706')}</td><td>${esc(r.type || '–')}</td>
                <td class="num">${r.rent ? num(r.rent) : '–'}</td><td class="num">${km(r.mt)}</td><td class="num">${km(r.or)}</td>
                <td>${r.start || r.end ? `${esc(r.start || '?')} – ${esc(r.end || '?')}` : '–'}${r.remaining ? `<br><small class="ex-help">${esc(r.remaining)}</small>` : ''}</td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="4"><b>รวม ${num(list.length)} ห้อง</b></td><td class="num"><b>${num(rent)}</b></td><td colspan="3"><small class="ex-help">ค่าเช่ารวมต่อเดือน (${esc(baht(rent))})</small></td></tr></tfoot></table></div>` : '<p class="ex-empty">ไม่พบห้อง</p>'}</div>`;
    }

    // ---------------------------------------------------------------- ทีม GA
    function vPeople() {
        const d = state.summary;
        $('v-people').innerHTML = `<div class="ex-card"><h2>เจ้าหน้าที่ GA ทุกคน <small>กดแถวเพื่อดูว่าแต่ละคนรับผิดชอบ/ทำอะไรบ้าง</small></h2>
        <p class="ex-help">ผู้ทำ = ผู้ที่ดำเนินการในระบบ (ตรวจเอกสาร มอบหมายงาน กดเสร็จขั้นตอน บันทึกเคส ดำเนินการทรัพย์สิน/ซ่อมห้อง) · "ยังไม่ระบุผู้ทำ" = งานที่ยังไม่มีใครรับ</p>
        ${table(['เจ้าหน้าที่', 'งานทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เสร็จ %', 'เวลาเฉลี่ย', ...d.areas.map(a => a.title)],
            d.people.map(p => [`<b>${esc(p.name)}</b><br><small class="ex-help">${esc(p.position || p.username)}</small>`, num(p.total), num(p.done), num(p.open), p.overdue ? `<span class="ex-bad">${num(p.overdue)}</span>` : '0',
                `<span class="${rateClass(p.doneRate)}">${pct(p.doneRate)}</span>`, hours(p.avgHours), ...d.areas.map(a => p.areas[a.key] ? num(p.areas[a.key].total) : '–')]),
            [1, 2, 3, 4, 5, 6, ...d.areas.map((_, i) => 7 + i)], d.people.map(p => p.username))}</div>`;
    }
    function openPerson(username) {
        const d = state.summary, p = d.people.find(x => x.username === username);
        if (!p) return;
        const mine = d.items.filter(i => i.by === username);
        $('exDetail').innerHTML = `
        <div class="ex-dhead"><div><h2>${esc(p.name)}</h2><small>${esc(p.position || p.username)}</small></div><button type="button" class="ex-btn" data-close>ปิด</button></div>
        ${statsKpis(p)}
        <div class="ex-card"><h2>แยกตามส่วนงาน</h2>${table(['ส่วนงาน', 'ทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เวลาเฉลี่ย'], d.areas.filter(a => p.areas[a.key]).map(a => { const s = p.areas[a.key]; return [pill(a.title, a.color), num(s.total), num(s.done), num(s.open), num(s.overdue), hours(s.avgHours)]; }), [1, 2, 3, 4, 5])}</div>
        <div class="ex-card"><h2>ทำงานอะไรบ้าง <small>แยกตามประเภท</small></h2>${table(['ประเภทงาน', 'ส่วนงาน', 'ทั้งหมด', 'เสร็จ'], p.categories.slice(0, 40).map(c => [esc(c.name), pill(areaTitle(c.area), color(c.area)), num(c.total), num(c.done)]), [2, 3])}</div>
        <div class="ex-card"><h2>รายการล่าสุด <small>${num(Math.min(60, mine.length))} จาก ${num(mine.length)} รายการ</small></h2><div class="ex-scroll">${itemsTable(mine.slice(0, 60))}</div></div>`;
        $('exDialog').showModal();
    }

    // ---------------------------------------------------------------- รายงาน
    function filtered() {
        const f = state.report, q = f.q.trim().toLowerCase();
        const list = state.summary.items.filter(i => (!f.area || i.a === f.area) && (!f.person || i.by === f.person) &&
            (!f.status || (f.status === 'done' ? i.d : f.status === 'open' ? !i.d : i.o)) && (!q || `${i.t} ${i.c} ${i.s} ${i.bn} ${i.r} ${i.st}`.toLowerCase().includes(q)));
        return list.sort((x, y) => ((x[f.sort] ?? '') > (y[f.sort] ?? '') ? 1 : -1) * f.dir);
    }
    function vReport() {
        const d = state.summary, f = state.report, list = filtered();
        const done = list.filter(i => i.d).length;
        $('v-report').innerHTML = `<div class="ex-card">
        <div class="ex-filters">
            <select id="rfArea"><option value="">ทุกส่วนงาน</option>${d.areas.map(a => `<option value="${a.key}"${f.area === a.key ? ' selected' : ''}>${esc(a.title)}</option>`).join('')}</select>
            <select id="rfPerson"><option value="">ทุกคน</option>${d.people.map(p => `<option value="${esc(p.username)}"${f.person === p.username ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
            <select id="rfStatus"><option value="">ทุกสถานะ</option><option value="done"${f.status === 'done' ? ' selected' : ''}>เสร็จแล้ว</option><option value="open"${f.status === 'open' ? ' selected' : ''}>ยังค้าง</option><option value="late"${f.status === 'late' ? ' selected' : ''}>ค้างนาน</option></select>
            <input id="rfQ" type="search" placeholder="ค้นหา ชื่อ/รายการ/เลขเคส" value="${esc(f.q)}">
            <button type="button" class="ex-btn" id="rfCsv">ดาวน์โหลด CSV</button><button type="button" class="ex-btn ex-btn-primary" id="rfPrint">พิมพ์ / PDF</button>
        </div>
        <p class="ex-help">${num(list.length)} รายการ · เสร็จ ${num(done)} · ค้าง ${num(list.length - done)}${d.truncated ? ' · แสดงเฉพาะ 3,000 รายการล่าสุด' : ''}</p>
        ${list.length ? `<div class="ex-scroll ex-table-wrap"><table class="ex-table"><thead><tr>${[['at', 'รับเรื่อง'], ['a', 'ส่วนงาน'], ['c', 'ประเภท'], ['t', 'รายการ'], ['bn', 'ผู้ทำ'], ['st', 'สถานะ'], ['dn', 'เสร็จเมื่อ'], ['h', 'ใช้เวลา']].map(([k, l]) =>
            `<th data-sort="${k}">${l}${f.sort === k ? (f.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('')}</tr></thead><tbody>${list.slice(0, 500).map(i => `<tr><td>${when(i.at)}</td><td>${pill(areaTitle(i.a), color(i.a))}</td><td>${esc(i.c)}</td>
            <td>${esc(i.t)}${i.s ? `<br><small class="ex-help">${esc(i.s)}</small>` : ''}</td><td>${esc(i.bn || '–')}</td><td><span class="${i.d ? 'ex-good' : (i.o ? 'ex-bad' : 'ex-warn')}">${esc(i.st)}</span></td><td>${i.dn ? when(i.dn) : '–'}</td><td class="num">${hours(i.h)}</td></tr>`).join('')}</tbody></table></div>
        ${list.length > 500 ? '<p class="ex-help">แสดง 500 รายการแรก — ดาวน์โหลด CSV เพื่อดูทั้งหมด</p>' : ''}` : '<p class="ex-empty">ไม่พบรายการตามตัวกรอง</p>'}</div>`;
    }
    function csv() {
        const rows = [['รับเรื่อง', 'ส่วนงาน', 'ประเภท', 'รายการ', 'ผู้ขอ/ผู้เกี่ยวข้อง', 'ผู้ทำ', 'สถานะ', 'เสร็จเมื่อ', 'ใช้เวลา(ชม.)', 'อ้างอิง'],
            ...filtered().map(i => [i.at, areaTitle(i.a), i.c, i.t, i.s, i.bn, i.st, i.dn, i.h ?? '', i.r])];
        const text = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = `รายงานงาน-GA-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // ---------------------------------------------------------------- ควบคุม
    const redraw = () => render(state.view);
    function keepFocus(id, fn) { const el = $(id), pos = el.selectionStart; fn(); const b = $(id); if (!b) return; b.focus(); try { b.setSelectionRange(pos, pos); } catch { /* ignore */ } }

    document.addEventListener('click', event => {
        const t = event.target;
        const nav = t.closest('#exNav button'); if (nav) return show(nav.dataset.view);
        if (t.closest('[data-close]')) return $('exDialog').close();
        const insP = t.closest('[data-ins-person]'); if (insP) { state.insF.person = state.insF.person === insP.dataset.insPerson ? '' : insP.dataset.insPerson; return redraw(); }
        const asA = t.closest('[data-asset-area]'); if (asA) { state.asF.area = state.asF.area === asA.dataset.assetArea ? '' : asA.dataset.assetArea; return redraw(); }
        const person = t.closest('[data-person]'); if (person && state.summary) return openPerson(person.dataset.person);
        const go = t.closest('[data-go]'); if (go) return show(['insurance', 'assets', 'welfare'].includes(go.dataset.go) ? go.dataset.go : 'report');
        const rf = t.closest('[data-room-filter]'); if (rf) { state.rmF.filter = rf.dataset.roomFilter; return redraw(); }
        const th = t.closest('th[data-sort]'); if (th) { const f = state.report; f.dir = f.sort === th.dataset.sort ? -f.dir : -1; f.sort = th.dataset.sort; return redraw(); }
        if (t.id === 'rmRefresh') { state.rooms = null; return show('rooms', true); }
        if (t.id === 'rfCsv') return csv();
        if (t.id === 'rfPrint') return window.print();
    });
    document.addEventListener('change', event => {
        const id = event.target.id, v = event.target.value;
        const map = { rfArea: () => { state.report.area = v; }, rfPerson: () => { state.report.person = v; }, rfStatus: () => { state.report.status = v; }, insStatus: () => { state.insF.status = v; }, asArea: () => { state.asF.area = v; } };
        if (!map[id]) return; map[id](); redraw();
    });
    document.addEventListener('input', event => {
        const id = event.target.id, v = event.target.value;
        const map = { rfQ: () => { state.report.q = v; }, insQ: () => { state.insF.q = v; }, asQ: () => { state.asF.q = v; }, rmQ: () => { state.rmF.q = v; } };
        if (map[id]) keepFocus(id, () => { map[id](); redraw(); });
    });
    const reloadRange = () => { state.summary = null; state.welfare = null; show(state.view); };
    $('exPreset').addEventListener('change', () => { $('exCustom').hidden = $('exPreset').value !== 'custom'; if ($('exPreset').value !== 'custom') reloadRange(); });
    $('exFrom').addEventListener('change', reloadRange); $('exTo').addEventListener('change', reloadRange);
    $('exRefresh').addEventListener('click', () => { state.summary = state.ins = state.assets = state.welfare = state.rooms = null; show(state.view, true); });
    $('exDialog').addEventListener('click', event => { if (event.target === $('exDialog')) $('exDialog').close(); });
    $('exLogout').addEventListener('click', async () => {
        if (!confirm('ยืนยันการออกจากระบบหรือไม่')) return;
        if (typeof window.performSecureLogout === 'function') { await window.performSecureLogout(); return; }
        sessionStorage.clear(); window.location.replace('index.html');
    });

    // ตรวจสิทธิ์ก่อนแสดงผล: ไม่ได้ล็อกอิน → หน้าเข้าสู่ระบบ · ไม่มีสิทธิ์ผู้บริหาร → ออกจากหน้านี้
    (async () => {
        try {
            const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.user) throw new Error('SESSION');
            const isAdmin = String(data.user.role || '').toUpperCase() === 'ADMIN';
            if (!isAdmin && data.permissions?.ViewExecutive !== true) { alert('บัญชีนี้ไม่มีสิทธิ์ดูแดชบอร์ดผู้บริหาร'); sessionStorage.clear(); window.location.replace('index.html'); return; }
            $('exUser').textContent = data.user.name || data.user.username || '';
        } catch (error) { sessionStorage.clear(); window.location.replace('index.html'); return; }
        show('overview');
    })();
})();
