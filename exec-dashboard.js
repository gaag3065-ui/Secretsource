// แดชบอร์ดผู้บริหาร — อ่านอย่างเดียว · ข้อมูลจาก /api/exec/* (สิทธิ์ ViewExecutive)
// บัญชีผู้บริหารควรมีสิทธิ์ "ดูแดชบอร์ดผู้บริหาร" อย่างเดียว — เข้าได้เฉพาะหน้านี้ ไม่มีลิงก์ไประบบ GA
(() => {
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/exec`;
    const PAL = ['#4f46e5', '#0d9488', '#d97706', '#db2777', '#2563eb', '#7c3aed', '#16a34a', '#dc2626', '#0891b2', '#64748b'];
    const state = { summary: null, view: 'overview', ins: null, assets: null, welfare: null, rooms: null, workflows: null, loading: {}, errors: {},
        wTab: 'main', insF: { person: '', status: '', q: '' }, asF: { area: '', q: '' }, rmF: { filter: 'all', q: '' } };
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
    let token = '';
    try { token = sessionStorage.getItem('execToken') || ''; } catch { token = ''; }
    const lock = message => {
        token = ''; try { sessionStorage.removeItem('execToken'); } catch { /* ignore */ }
        state.workflows = null; window.ExecWorkflow.render(null); $('exDialog').close();
        document.body.classList.add('is-locked'); $('exLock').hidden = false; $('exLockMsg').textContent = message || '';
        setTimeout(() => $('exCode').focus(), 50);
    };
    async function call(path) {
        const url = API + path + (token ? (path.includes('?') ? '&' : '?') + 't=' + encodeURIComponent(token) : '');
        const response = token ? await fetch(url, { cache: 'no-store', credentials: 'omit' }) : await window.authFetch(url, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (token && response.status === 401) { lock(data.message); throw new Error(data.message || 'บัตรผ่านหมดอายุ'); }
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
        rooms: refresh => call(`/rooms${refresh ? '?refresh=1' : ''}`),
        workflows: () => call('/workflows')
    };
    const KEY = { summary: 'summary', insurance: 'ins', assets: 'assets', welfare: 'welfare', rooms: 'rooms', workflows: 'workflows' };
    const NEEDS = { overview: ['summary'], insurance: ['insurance', 'summary'], assets: ['assets', 'summary'], welfare: ['welfare', 'summary', 'rooms'] };
    const REQUIRED = { overview: ['summary'], insurance: ['insurance'], assets: ['assets'], welfare: ['welfare'] };
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
        const needs = [...NEEDS[view], ...(view === 'overview' ? ['workflows'] : [])];
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
        // Workflow งาน GA อยู่ท้ายหน้า "ภาพรวม" เท่านั้น — หน้าอื่นเสนอเรื่องของตัวเองเรื่องเดียว
        $('exWorkflows').hidden = view !== 'overview'; $('exFoot').hidden = view !== 'overview';
        if (view === 'overview') window.ExecWorkflow.render(state.workflows, state.errors.workflows);
        const pane = $(`v-${view}`);
        const missing = REQUIRED[view].find(n => !state[KEY[n]]);
        if (missing) { pane.innerHTML = `<p class="ex-status is-error">${esc(state.errors[missing] || 'ไม่มีข้อมูล')}</p>`; return; }
        ({ overview: vOverview, insurance: vInsurance, assets: vAssets, welfare: vWelfare })[view]();
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
            ${hbars(d.people.map(p => ({ key: p.username, name: p.name, value: p.total, parts: d.areas.filter(a => p.areas[a.key]).map(a => ({ v: p.areas[a.key].total, c: a.color, t: `${a.title}: ${p.areas[a.key].total}` })) })), { attr: 'data-person', limit: 15 })}</div>
        ${teamCard()}`;
    }
    // ตารางเจ้าหน้าที่ GA ทุกคน (ย้ายมาจากเมนู ทีม GA)
    function teamCard() {
        const d = state.summary;
        return `<div class="ex-card"><h2>เจ้าหน้าที่ GA ทุกคน <small>กดแถวเพื่อดูว่าแต่ละคนรับผิดชอบ/ทำอะไรบ้าง</small></h2>
        <p class="ex-help">ผู้ทำ = ผู้ที่ดำเนินการในระบบ (ตรวจเอกสาร มอบหมายงาน กดเสร็จขั้นตอน บันทึกเคส ดำเนินการทรัพย์สิน/ซ่อมห้อง) · "ยังไม่ระบุผู้ทำ" = งานที่ยังไม่มีใครรับ</p>
        ${table(['เจ้าหน้าที่', 'งานทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เสร็จ %', 'เวลาเฉลี่ย', ...d.areas.map(a => a.title)],
            d.people.map(p => [`<b>${esc(p.name)}</b><br><small class="ex-help">${esc(p.position || p.username)}</small>`, num(p.total), num(p.done), num(p.open), p.overdue ? `<span class="ex-bad">${num(p.overdue)}</span>` : '0',
                `<span class="${rateClass(p.doneRate)}">${pct(p.doneRate)}</span>`, hours(p.avgHours), ...d.areas.map(a => p.areas[a.key] ? num(p.areas[a.key].total) : '–')]),
            [1, 2, 3, 4, 5, 6, ...d.areas.map((_, i) => 7 + i)], d.people.map(p => p.username))}</div>`;
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
    // ภาพรวม = ยอดรวมบนสุด → แยกเป็นกลุ่ม (ห้องพัก/ออกกำลังกาย/เบิกค่ารถ/เบิกอื่นๆ) → รายละเอียดของแต่ละกลุ่มวางต่อกันให้เห็นทันที
    // ปุ่มกลุ่ม = เห็นเฉพาะเรื่องนั้นเรื่องเดียว (เหมาะเสนอผู้บริหารทีละหัวข้อ)
    const WTABS = [['main', '🎁 ภาพรวมสวัสดิการ'], ['rooms', '🏠 ห้องพัก'], ['exercise', '🏃 ออกกำลังกาย'], ['transport', '🚌 เบิกค่ารถ'], ['other', '🧾 เบิกอื่นๆ / แจ้งซ่อม']];
    const secHead = (icon, title, c, note) => `<h3 class="ex-sec-head" style="--c:${c}"><span>${icon} ${esc(title)}</span>${note ? `<small>${note}</small>` : ''}</h3>`;
    const noData = text => `<div class="ex-card"><p class="ex-empty">${esc(text)}</p></div>`;
    const sumBy = (list, k) => list.reduce((n, x) => n + (Number(x[k]) || 0), 0);

    function exerciseHtml() {
        const f = state.welfare?.fitness;
        if (!f) return noData('ยังโหลดข้อมูลออกกำลังกายไม่ได้ (หลังบ้านอาจยังไม่อัปเดต — รอ 1–2 นาทีแล้วกดรีเฟรช)');
        if (!f.types.length) return noData('ไม่มีข้อมูลออกกำลังกายในช่วงที่เลือก');
        const T = f.types, forms = sumBy(T, 'forms'), approved = sumBy(T, 'approved'), pending = sumBy(T, 'pending'), rejected = sumBy(T, 'rejected'), complete = sumBy(T, 'complete'), bill = sumBy(T, 'bill');
        return `<div class="ex-kpis">
            ${kpi('ผู้เข้าร่วมออกกำลังกาย', num(f.people), 'คน (นับคนเดียวครั้งเดียว)', '#db2777')}
            ${kpi('ชุดรูปที่ส่งทั้งหมด', num(forms), 'ฟอร์ม · ทุกประเภทรวมกัน', '#4f46e5')}
            ${kpi('ส่งรูปครบแล้ว', num(complete), `คิดเป็น ${share(complete, forms)} ของฟอร์มทั้งหมด`, '#16a34a', 'ex-good')}
            ${kpi('ตรวจผ่านแล้ว', num(approved), `รอตรวจ ${num(pending)} · ไม่ผ่าน ${num(rejected)}`, '#0d9488')}
            ${kpi('ยอดบิลค่าฟิตเนส', num(bill), 'บาท · จากที่ GA กรอกยอดบิลแล้ว', '#d97706')}</div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>แต่ละประเภท มีกี่คน กี่ฟอร์ม <small>กี่คนเข้าร่วม · ส่งครบกี่ฟอร์ม</small></h2>${table(['ประเภท', 'จำนวนคน', 'ฟอร์ม', 'ส่งครบ', 'ผ่านตรวจ', 'รอตรวจ', 'ไม่ผ่าน', 'ยอดบิล (บาท)'],
                T.map(t => [`<b>${esc(t.title)}</b>`, num(t.people), num(t.forms), num(t.complete), num(t.approved), num(t.pending), t.rejected ? `<span class="ex-bad">${num(t.rejected)}</span>` : '0', t.bill ? num(t.bill) : '–']), [1, 2, 3, 4, 5, 6, 7])}
                <p class="ex-help" style="margin-top:8px">คนหนึ่งคนอาจส่งหลายประเภท จำนวนคนในแต่ละแถวจึงรวมกันไม่เท่ากับ "ผู้เข้าร่วม" ด้านบน</p></div>
            <div class="ex-card"><h2>สัดส่วนผลการตรวจ</h2>${donut([{ name: 'ตรวจผ่านแล้ว', value: approved, c: '#16a34a' }, { name: 'รอตรวจ', value: pending, c: '#d97706' }, { name: 'ไม่ผ่าน', value: rejected, c: '#dc2626' }], { center: num(forms), sub: 'ฟอร์ม' })}</div>
        </div>
        <div class="ex-card"><h2>สัดส่วนตามประเภทการออกกำลังกาย <small>จำนวนคน</small></h2>${donut(T.map(t => ({ name: t.title, value: t.people })), { center: num(f.people), sub: 'คน' })}</div>`;
    }

    function transportHtml() {
        const t = state.welfare?.transport;
        if (!t) return noData('ยังโหลดข้อมูลเบิกค่ารถไม่ได้ (หลังบ้านอาจยังไม่อัปเดต — รอ 1–2 นาทีแล้วกดรีเฟรช)');
        if (!t.count) return noData('ยังไม่มีรายการเบิกค่ารถ');
        const by = n => t.byStatus.find(s => s.name === n)?.count || 0;
        const colors = { 'ตรวจเสร็จแล้ว': '#16a34a', 'พนักงานส่งข้อมูลแล้ว (รอตรวจ)': '#d97706', 'ยังไม่ส่งข้อมูล': '#94a3b8' };
        return `<div class="ex-kpis">
            ${kpi('ผู้เดินทางที่เบิก', num(t.people), 'คน (Orion City)', '#2563eb')}
            ${kpi('รายการเบิกทั้งหมด', num(t.count), 'รายการ (1 คน เบิกได้หลายเที่ยว/หลายวัน)', '#4f46e5')}
            ${kpi('ตรวจเสร็จแล้ว', num(by('ตรวจเสร็จแล้ว')), `คิดเป็น ${share(by('ตรวจเสร็จแล้ว'), t.count)}`, '#16a34a', 'ex-good')}
            ${kpi('รอ GA ตรวจ', num(by('พนักงานส่งข้อมูลแล้ว (รอตรวจ)')), 'พนักงานส่งข้อมูลแล้ว', '#d97706', by('พนักงานส่งข้อมูลแล้ว (รอตรวจ)') ? 'ex-warn' : '')}
            ${kpi('ยังไม่ส่งข้อมูล', num(by('ยังไม่ส่งข้อมูล')), 'รอพนักงานกรอก', '#64748b')}</div>
        <div class="ex-grid ex-g2">
            <div class="ex-card"><h2>สัดส่วนสถานะรายการเบิกค่ารถ</h2>${donut(t.byStatus.map(s => ({ name: s.name, value: s.count, c: colors[s.name] })), { center: num(t.count), sub: 'รายการ' })}</div>
            <div class="ex-card"><h2>สถานะแต่ละกลุ่ม</h2>${table(['สถานะ', 'รายการ', 'สัดส่วน'], t.byStatus.map(s => [esc(s.name), num(s.count), share(s.count, t.count)]), [1, 2])}
                <p class="ex-help" style="margin-top:8px">ยอดเงินเบิกคำนวณตอนทำรายงานเบิกค่ารถ (ตามประเภทรถในบิล) — ระบบยังไม่เก็บยอดเป็นตัวเลข จึงแสดงเฉพาะจำนวนรายการ/คน/สถานะ · นับทุกรายการตั้งแต่เริ่มโครงการ</p></div>
        </div>`;
    }

    function otherHtml() {
        const w = state.welfare, rep = w.repairs;
        if (!w.categories.length && !rep) return noData('ไม่มีรายการเบิกอื่นๆ ในช่วงที่เลือก');
        return `<div class="ex-kpis">
            ${kpi('รายการเบิกอื่นๆ', num(w.claimsCount), `ยอดเบิก ${baht(w.claimsTotal)}`, '#4f46e5')}
            ${kpi('แจ้งซ่อมห้องพัก', rep ? num(rep.count) : '–', rep ? `ซ่อมเสร็จ ${num(rep.done)}${rep.cost ? ` · ${baht(rep.cost)}` : ''}` : 'ไม่มีข้อมูล', '#475569')}</div>
        <div class="ex-card"><h2>รายละเอียด <small>ช่วงที่เลือก</small></h2>${table(['เรื่อง', 'จำนวนรายการ', 'ตรวจ/เสร็จแล้ว', 'ยอด (บาท)'], [
            ...w.categories.map(c => [esc(c.name), num(c.count), num(c.done), c.value ? num(c.value) : '–']),
            ...(rep ? [['แจ้งซ่อมห้องพัก', num(rep.count), num(rep.done), rep.cost ? num(rep.cost) : '–']] : [])], [1, 2, 3])}
            <p class="ex-help" style="margin-top:8px">เบิกเงินเคลมประกันไม่รวมในส่วนนี้ (ดูที่เมนู "ประกัน") · ยอดเบิกคิดจากช่อง "จำนวนเงิน" ที่พนักงานกรอกในแบบฟอร์ม</p></div>`;
    }

    function vWelfare() {
        const sub = `<div class="ex-seg" id="wSub">${WTABS.map(([k, l]) => `<button type="button" data-wtab="${k}" class="${state.wTab === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>`;
        const tab = state.wTab;
        const roomsPart = state.rooms ? roomsHtml(tab === 'rooms') : noData(state.errors.rooms || 'ไม่มีข้อมูลห้องพัก');
        if (tab === 'rooms') { $('v-welfare').innerHTML = sub + roomsPart; return; }
        if (tab === 'exercise') { $('v-welfare').innerHTML = sub + exerciseHtml(); return; }
        if (tab === 'transport') { $('v-welfare').innerHTML = sub + transportHtml(); return; }
        if (tab === 'other') { $('v-welfare').innerHTML = sub + otherHtml(); return; }

        const w = state.welfare, r = state.rooms, f = w.fitness, tr = w.transport, rep = w.repairs;
        const rent = r?.rent.all || 0, fitBill = f ? sumBy(f.types, 'bill') : 0;
        const expense = [
            { name: 'ค่าเช่าห้องพัก (ต่อเดือน)', value: rent, c: '#0d9488' },
            { name: 'ค่าฟิตเนสที่เบิก', value: fitBill, c: '#db2777' },
            ...w.categories.filter(c => c.value > 0).map(c => ({ name: c.name, value: c.value })),
            ...(rep?.cost ? [{ name: 'ค่าซ่อมห้องพัก', value: rep.cost, c: '#475569' }] : [])];
        const expenseTotal = sumBy(expense, 'value');
        const counts = [
            ...(r ? [{ name: 'ห้องพัก (ยูนิต)', value: r.counts.total, c: '#0d9488' }] : []),
            ...(f ? [{ name: 'ออกกำลังกาย (ชุดรูปที่ส่ง)', value: sumBy(f.types, 'forms'), c: '#db2777' }] : []),
            ...(tr ? [{ name: 'เบิกค่ารถ (รายการ)', value: tr.count, c: '#2563eb' }] : []),
            ...(w.claimsCount ? [{ name: 'เบิกอื่นๆ (รายการ)', value: w.claimsCount, c: '#4f46e5' }] : []),
            ...(rep?.count ? [{ name: 'แจ้งซ่อมห้องพัก', value: rep.count, c: '#475569' }] : [])];
        const tile = (tabKey, title, c, big, unit, rows) => `<button type="button" class="ex-area" style="--c:${c}" data-wtab="${tabKey}"><h3>${esc(title)}</h3><div class="ex-big">${big} <small style="font-size:13px;font-weight:400;color:var(--muted)">${esc(unit)}</small></div><dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></button>`;
        const fAll = f ? { forms: sumBy(f.types, 'forms'), complete: sumBy(f.types, 'complete'), approved: sumBy(f.types, 'approved') } : null;
        const waiting = tr ? (tr.byStatus.find(s => s.name.includes('รอตรวจ'))?.count || 0) : 0;
        $('v-welfare').innerHTML = `${sub}
        <div class="ex-kpis">
            ${kpi('ค่าสวัสดิการรวม', num(expenseTotal), 'บาท · ค่าเช่าห้อง/เดือน + ยอดเบิกในช่วงที่เลือก', '#db2777')}
            ${kpi('ห้องพักพนักงาน', r ? num(r.counts.total) : '–', r ? `ยูนิต · ทำสัญญาแล้ว ${num(r.counts.contracted)} · รองรับ ${num(capOf(r.rooms))} คน` : 'ไม่มีข้อมูล', '#0d9488')}
            ${kpi('ออกกำลังกาย', f ? num(f.people) : '–', f ? `คนเข้าร่วม · ส่งรูป ${num(fAll.forms)} ฟอร์ม · ตรวจผ่าน ${num(fAll.approved)}` : 'ไม่มีข้อมูล', '#db2777')}
            ${kpi('เบิกค่ารถ', tr ? num(tr.people) : '–', tr ? `คนเดินทาง · ${num(tr.count)} รายการ · รอตรวจ ${num(waiting)}` : 'ไม่มีข้อมูล', '#2563eb')}</div>
        <div class="ex-areas">
            ${tile('rooms', '🏠 ห้องพัก', '#0d9488', r ? num(r.counts.total) : '–', 'ยูนิต', r ? [['ทำสัญญาแล้ว', num(r.counts.contracted)], ['กำลังดำเนินการ', num(r.counts.process)], ['ค่าเช่า/เดือน', baht(r.rent.all)], ['รองรับ', `${num(capOf(r.rooms))} คน`]] : [])}
            ${tile('exercise', '🏃 ออกกำลังกาย', '#db2777', f ? num(f.people) : '–', 'คน', f ? [['ชุดรูปที่ส่ง', `${num(fAll.forms)} ฟอร์ม`], ['ส่งครบแล้ว', num(fAll.complete)], ['ตรวจผ่านแล้ว', num(fAll.approved)], ['ยอดบิลฟิตเนส', baht(fitBill)]] : [])}
            ${tile('transport', '🚌 เบิกค่ารถ', '#2563eb', tr ? num(tr.people) : '–', 'คน', tr ? [['รายการเบิก', num(tr.count)], ...tr.byStatus.map(s => [esc(s.name), num(s.count)])] : [])}
            ${tile('other', '🧾 เบิกอื่นๆ / แจ้งซ่อม', '#4f46e5', num(w.claimsCount + (rep?.count || 0)), 'รายการ', [['เบิกอื่นๆ', `${num(w.claimsCount)} · ${baht(w.claimsTotal)}`], ['แจ้งซ่อมห้อง', rep ? `${num(rep.count)} · เสร็จ ${num(rep.done)}` : '–']])}</div>
        <div class="ex-grid ex-g3">
            <div class="ex-card"><h2>สัดส่วนค่าใช้จ่ายสวัสดิการ <small>บาท · ค่าเช่าเป็นยอดต่อเดือน</small></h2>${donut(expense, { center: num(expenseTotal), sub: 'บาท' })}</div>
            <div class="ex-card"><h2>ยอดเบิกที่ไม่ใช่ค่าเช่า <small>บาท · ช่วงที่เลือก</small></h2>${donut(expense.filter(e => !e.name.startsWith('ค่าเช่า')), { center: num(expenseTotal - rent), sub: 'บาท' })}</div>
            <div class="ex-card"><h2>สัดส่วนจำนวนงานแต่ละสวัสดิการ <small>จำนวนรายการ/ยูนิต/ฟอร์ม</small></h2>${donut(counts, { center: num(sumBy(counts, 'value')), sub: 'รายการ' })}</div>
        </div>
        ${secHead('🏠', 'ห้องพัก', '#0d9488', '<button type="button" class="ex-btn" data-wtab="rooms">ดูรายชื่อทุกยูนิต →</button>')}
        ${roomsPart}
        ${secHead('🏃', 'ออกกำลังกาย', '#db2777', '<button type="button" class="ex-btn" data-wtab="exercise">ดูเฉพาะเรื่องนี้ →</button>')}
        ${exerciseHtml()}
        ${secHead('🚌', 'เบิกค่ารถ', '#2563eb', '<button type="button" class="ex-btn" data-wtab="transport">ดูเฉพาะเรื่องนี้ →</button>')}
        ${transportHtml()}
        ${secHead('🧾', 'เบิกอื่นๆ / แจ้งซ่อมห้องพัก', '#4f46e5')}
        ${otherHtml()}
        <details class="ex-card ex-fold"><summary>รายงานการทำงานของ GA · งานสวัสดิการ (กดเพื่อดู)</summary>${workReport('welfare')}</details>`;
    }

    // ---------------------------------------------------------------- ห้องพัก
    const bedsOf = t => Number((/(\d+)\s*ห้องนอน/.exec(String(t || '')) || [])[1]) || 0;
    const bathsOf = t => Number((/(\d+)\s*ห้องน้ำ/.exec(String(t || '')) || [])[1]) || 0;
    const sumBeds = rs => rs.reduce((n, r) => n + bedsOf(r.type), 0), sumBaths = rs => rs.reduce((n, r) => n + bathsOf(r.type), 0);
    const PER_BED = 2;   // 1 ห้องนอน อยู่ได้ 2 คน
    const capOf = rs => sumBeds(rs) * PER_BED;
    function roomsHtml(withList = true) {
        const d = state.rooms, f = state.rmF;
        const q = f.q.trim().toLowerCase();
        const list = d.rooms.filter(r => (f.filter === 'all' || (f.filter === 'contracted') === r.contracted) && (!q || `${r.project} ${r.unit} ${r.status} ${r.type}`.toLowerCase().includes(q)));
        const rent = list.reduce((n, r) => n + r.rent, 0);
        const seg = (k, l, n) => `<button type="button" data-room-filter="${k}" class="${f.filter === k ? 'is-on' : ''}">${l} ${n}</button>`;
        const km = v => { const t = String(v ?? '').trim(); return t && t !== '-' ? `${esc(t)} กม.` : '–'; };
        const kinds = new Map();
        for (const r of d.rooms) {
            const b = bedsOf(r.type), t = bathsOf(r.type), key = b || t ? b + '|' + t : 'x';
            const k = kinds.get(key) || { beds: b, baths: t, units: 0, contracted: 0, rent: 0 };
            k.units++; if (r.contracted) k.contracted++; k.rent += r.rent; kinds.set(key, k);
        }
        const kindRows = [...kinds.values()].sort((x, y) => y.units - x.units);
        const steps = Object.entries(d.counts.processByStatus || {}).map(([s, n]) => `${esc(s)} ${n}`).join(' · ') || 'รอทำสัญญา/วางจอง';
        return `
        <div class="ex-kpis">
            ${kpi('ยูนิตที่ทำสัญญาแล้ว', num(d.counts.contracted), `ค่าเช่า ${baht(d.rent.contracted)}/เดือน`, '#0d9488')}
            ${kpi('ยูนิตที่กำลังอยู่ในกระบวนการ', num(d.counts.process), steps, '#d97706')}
            ${kpi('รวมยูนิตทั้งหมด', num(d.counts.total), `ยูนิต · ห้องนอนรวม ${num(sumBeds(d.rooms))} · ห้องน้ำรวม ${num(sumBaths(d.rooms))}`, '#2563eb')}
            ${kpi('รองรับผู้พักอาศัยได้', num(capOf(d.rooms)), `คน · คิด ${PER_BED} คนต่อ 1 ห้องนอน · ยูนิตที่ทำสัญญาแล้ว ${num(capOf(d.rooms.filter(r => r.contracted)))} คน`, '#db2777')}
            ${kpi('ค่าเช่ารวมทั้งหมดต่อเดือน', num(d.rent.all), `บาท · เฉพาะที่ทำสัญญาแล้ว ${baht(d.rent.contracted)}`, '#4f46e5')}</div>
        <div class="ex-card"><h2>สรุปตามประเภทยูนิต <small>แต่ละยูนิตมีกี่ห้องนอน กี่ห้องน้ำ</small></h2>
            ${table(['ประเภทยูนิต', 'จำนวนยูนิต', 'ทำสัญญาแล้ว', 'ห้องนอนรวม', 'ห้องน้ำรวม', 'อยู่ได้ต่อยูนิต (คน)', 'รองรับรวม (คน)', 'ค่าเช่ารวม/เดือน'], kindRows.map(k => [k.beds || k.baths ? `<b>${k.beds} ห้องนอน ${k.baths} ห้องน้ำ</b>` : 'ไม่ระบุประเภท', num(k.units), num(k.contracted), num(k.beds * k.units), num(k.baths * k.units), num(k.beds * PER_BED), num(k.beds * PER_BED * k.units), num(k.rent)]), [1, 2, 3, 4, 5, 6, 7])}
            <p class="ex-help" style="margin-top:8px">รองรับผู้พักอาศัย = จำนวนห้องนอน × ${PER_BED} คน (1 ห้องนอนอยู่ได้ ${PER_BED} คน) รวมทุกยูนิตได้ <b>${num(capOf(d.rooms))} คน</b></p></div>
        ${withList ? `<div class="ex-card"><h2>ภาพรวมยูนิตที่พักทั้งหมด <small>จากทะเบียนห้องพัก · อัปเดต ${when(d.at)}</small></h2>
            <div class="ex-filters"><div class="ex-seg">${seg('all', 'ทั้งหมด', d.counts.total)}${seg('contracted', 'ทำสัญญาแล้ว', d.counts.contracted)}${seg('process', 'กำลังดำเนินการ', d.counts.process)}</div>
                <input id="rmQ" type="search" placeholder="ค้นหาที่พัก ยูนิต สถานะ…" value="${esc(f.q)}"><button type="button" class="ex-btn" id="rmRefresh">รีเฟรช</button></div>
            <p class="ex-help">ระยะทางเป็นกิโลเมตร ตามทะเบียนห้องพัก (MT = Mireka Tower · OR = Orion City)</p>
            ${list.length ? `<div class="ex-scroll ex-table-wrap"><table class="ex-table"><thead><tr><th>#</th><th>ที่พัก / ยูนิต</th><th>สถานะ</th><th class="num">ห้องนอน</th><th class="num">ห้องน้ำ</th><th class="num">อยู่ได้ (คน)</th><th class="num">ค่าเช่า/เดือน</th><th class="num">ห่าง Mireka Tower</th><th class="num">ห่าง Orion City</th><th>สัญญา</th></tr></thead><tbody>${list.map(r => `<tr>
                <td>${esc(r.no)}</td><td><b>${esc(r.project)}</b><br><small class="ex-help">${esc(r.unit)}</small></td><td>${pill(r.status || '–', r.contracted ? '#0d9488' : '#d97706')}${r.statusNote ? `<br><small class="ex-help ex-snote">📝 ${esc(r.statusNote)}</small>` : ''}</td><td class="num">${bedsOf(r.type) || '–'}</td><td class="num">${bathsOf(r.type) || '–'}</td><td class="num">${bedsOf(r.type) ? bedsOf(r.type) * PER_BED : '–'}</td>
                <td class="num">${r.rent ? num(r.rent) : '–'}</td><td class="num">${km(r.mt)}</td><td class="num">${km(r.or)}</td>
                <td>${!r.contracted ? '<small class="ex-help">ยังไม่ได้ทำสัญญา</small>' : r.start || r.end ? `${esc(r.start || '?')} – ${esc(r.end || '?')}${r.end && r.remaining ? `<br><small class="ex-help">${esc(r.remaining)}</small>` : ''}` : '<small class="ex-help">ยังไม่ระบุวันที่สัญญา</small>'}</td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="3"><b>รวม ${num(list.length)} ยูนิต</b></td><td class="num"><b>${num(sumBeds(list))}</b></td><td class="num"><b>${num(sumBaths(list))}</b></td><td class="num"><b>${num(capOf(list))}</b></td><td class="num"><b>${num(rent)}</b></td><td colspan="3"><small class="ex-help">ค่าเช่ารวมต่อเดือน (${esc(baht(rent))})</small></td></tr></tfoot></table></div>` : '<p class="ex-empty">ไม่พบห้อง</p>'}</div>` : `<div class="ex-card"><h2>สถานะการทำสัญญา <small>แต่ละสถานะมีกี่ยูนิต</small></h2>${donut(Object.entries(d.counts.processByStatus || {}).map(([k, n]) => ({ name: k, value: n })).concat([{ name: 'ทำสัญญาแล้ว', value: d.counts.contracted, c: '#0d9488' }]), { center: num(d.counts.total), sub: 'ยูนิต' })}</div>`}`;
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
        const go = t.closest('[data-go]'); if (go) return show(['insurance', 'assets', 'welfare'].includes(go.dataset.go) ? go.dataset.go : 'overview');
        const wt = t.closest('[data-wtab]'); if (wt) { state.wTab = wt.dataset.wtab; if (state.wTab === 'rooms' && !state.rooms) return show('welfare'); return redraw(); }
        const rf = t.closest('[data-room-filter]'); if (rf) { state.rmF.filter = rf.dataset.roomFilter; return redraw(); }
        if (t.id === 'rmRefresh') { state.rooms = null; return show('welfare', true); }
    });
    document.addEventListener('change', event => {
        const id = event.target.id, v = event.target.value;
        const map = { insStatus: () => { state.insF.status = v; }, asArea: () => { state.asF.area = v; } };
        if (!map[id]) return; map[id](); redraw();
    });
    document.addEventListener('input', event => {
        const id = event.target.id, v = event.target.value;
        const map = { insQ: () => { state.insF.q = v; }, asQ: () => { state.asF.q = v; }, rmQ: () => { state.rmF.q = v; } };
        if (map[id]) keepFocus(id, () => { map[id](); redraw(); });
    });
    const reloadRange = () => { state.summary = null; state.welfare = null; show(state.view); };
    $('exPreset').addEventListener('change', () => { $('exCustom').hidden = $('exPreset').value !== 'custom'; if ($('exPreset').value !== 'custom') reloadRange(); });
    $('exFrom').addEventListener('change', reloadRange); $('exTo').addEventListener('change', reloadRange);
    $('exRefresh').addEventListener('click', () => { state.summary = state.ins = state.assets = state.welfare = state.rooms = null; show(state.view, true); });
    $('exDialog').addEventListener('click', event => { if (event.target === $('exDialog')) $('exDialog').close(); });
    // เริ่มต้น: มีบัตรผ่าน (ใส่รหัสแล้ว) → เข้าเลย · ล็อกอินบัญชีที่มีสิทธิ์อยู่ → เข้าเลย · ไม่งั้นแสดงหน้ากรอกรหัสเข้าชม
    const open = () => { document.body.classList.remove('is-locked'); $('exLock').hidden = true; show('overview'); };
    $('exLockForm').addEventListener('submit', async event => {
        event.preventDefault();
        const code = $('exCode').value.trim();
        if (!code) { $('exLockMsg').textContent = 'กรุณากรอกรหัสเข้าชม'; return; }
        $('exLockBtn').disabled = true; $('exLockMsg').textContent = '';
        try {
            const response = await fetch(API + '/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), credentials: 'omit' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.token) { $('exLockMsg').textContent = data.message || 'เข้าสู่ระบบไม่สำเร็จ'; $('exCode').select(); return; }
            token = data.token; try { sessionStorage.setItem('execToken', token); } catch { /* ignore */ }
            $('exCode').value = ''; open();
        } catch { $('exLockMsg').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ลองใหม่อีกครั้ง'; } finally { $('exLockBtn').disabled = false; }
    });
    (async () => {
        if (token) { open(); return; }
        // ตรวจว่าล็อกอินระบบ GA อยู่ไหม (ไม่ใช้ authFetch เพื่อไม่ให้เด้งไปหน้าล็อกอินถ้ายังไม่ได้ล็อกอิน)
        try {
            const accessToken = sessionStorage.getItem('accessToken');
            const response = await fetch(window.APP_CONFIG.API_BASE_URL + '/api/session', { headers: accessToken ? { Authorization: 'Bearer ' + accessToken } : {}, credentials: 'include', cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            const isAdmin = String(data.user?.role || '').toUpperCase() === 'ADMIN';
            if (data.csrfToken) { try { sessionStorage.setItem('csrfToken', data.csrfToken); } catch { /* ignore */ } }
            if (response.ok && data.user && (isAdmin || data.permissions?.ViewExecutive === true)) { open(); return; }
        } catch { /* ไปหน้ากรอกรหัส */ }
        lock('');
    })();
})();
