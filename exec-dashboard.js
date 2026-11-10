// แดชบอร์ดผู้บริหาร — อ่านอย่างเดียว · ข้อมูลจาก /api/exec/summary (สิทธิ์ ViewExecutive)
(() => {
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/exec`;
    const state = { data: null, tab: 'overview', area: null, report: { area: '', person: '', status: '', q: '', sort: 'at', dir: -1 } };
    const num = n => Number(n || 0).toLocaleString('th-TH');
    const pct = r => r === null || r === undefined ? '–' : `${Math.round(r * 100)}%`;
    const hours = h => h === null || h === undefined ? '–' : (h < 1 ? `${Math.round(h * 60)} นาที` : (h < 48 ? `${h.toFixed(1)} ชม.` : `${(h / 24).toFixed(1)} วัน`));
    const when = iso => iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '–';
    const dayLabel = d => { const [y, m, dd] = d.split('-'); return `${Number(dd)}/${Number(m)}`; };
    const areaOf = key => state.data.areas.find(a => a.key === key);
    const color = key => (areaOf(key) || {}).color || '#64748b';
    const areaTitle = key => (areaOf(key) || {}).title || key;
    const rateClass = r => r === null || r === undefined ? '' : (r >= 0.8 ? 'ex-good' : (r >= 0.5 ? 'ex-warn' : 'ex-bad'));

    async function load(refresh) {
        const status = $('exStatus');
        status.className = 'ex-status'; status.textContent = 'กำลังโหลดข้อมูลจากทุกระบบ…';
        const q = new URLSearchParams();
        const preset = $('exPreset').value;
        const iso = d => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
        const today = new Date();
        if (preset === 'custom') { if ($('exFrom').value) q.set('from', $('exFrom').value); if ($('exTo').value) q.set('to', $('exTo').value); }
        else if (preset === 'month') { q.set('from', `${iso(today).slice(0, 8)}01`); q.set('to', iso(today)); }
        else { q.set('from', iso(new Date(today.getTime() - (Number(preset) - 1) * 86400000))); q.set('to', iso(today)); }
        if (refresh) q.set('refresh', '1');
        try {
            const response = await window.authFetch(`${API}/summary?${q}`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ดูแดชบอร์ดผู้บริหาร — ให้ ADMIN เพิ่มสิทธิ์ "ดูแดชบอร์ดผู้บริหาร" ที่หน้าจัดการสิทธิ์');
            if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วรีเฟรช');
            if (!response.ok || !data.success) throw new Error(data.message || `โหลดไม่สำเร็จ (${response.status})`);
            state.data = data;
            if (!state.area || !areaOf(state.area)) state.area = data.areas[0]?.key || null;
            status.textContent = `ช่วงข้อมูล ${new Date(data.range.from).toLocaleDateString('th-TH', { dateStyle: 'medium' })} – ${new Date(data.range.to).toLocaleDateString('th-TH', { dateStyle: 'medium' })} · อัปเดต ${when(data.generated_at)}`;
            render();
        } catch (error) {
            status.className = 'ex-status is-error'; status.textContent = error.message;
        }
    }

    // ---------------------------------------------------------------- ส่วนประกอบ
    const kpi = (label, value, sub, c, cls = '') => `<div class="ex-kpi" style="--c:${c || 'var(--brand)'}"><span>${esc(label)}</span><b class="${cls}">${value}</b><small>${sub || ''}</small></div>`;
    const meter = (r, c) => `<div class="ex-meter" style="--c:${c || 'var(--ok)'}"><i style="width:${Math.round((r || 0) * 100)}%"></i></div>`;
    const statsKpis = (s, c) => `<div class="ex-kpis">
        ${kpi('งานทั้งหมด', num(s.total), 'ในช่วงที่เลือก', c)}
        ${kpi('เสร็จแล้ว', num(s.done), `คิดเป็น <b class="${rateClass(s.doneRate)}">${pct(s.doneRate)}</b>`, c, 'ex-good')}
        ${kpi('ยังค้างอยู่', num(s.open), s.overdue ? `<span class="ex-bad">ค้างเกิน ${state.data.sla_hours / 24} วัน ${num(s.overdue)} งาน</span>` : 'ไม่มีงานค้างนาน', c, s.open ? 'ex-warn' : '')}
        ${kpi('ใช้เวลาเฉลี่ยต่องาน', hours(s.avgHours), 'นับจากรับเรื่องถึงเสร็จ', c)}
        ${kpi('เสร็จทันกำหนด', pct(s.onTimeRate), `ภายใน ${state.data.sla_hours / 24} วัน`, c, rateClass(s.onTimeRate))}
    </div>`;

    function trendSvg(areas) {
        const map = new Map();
        for (const a of areas) for (const t of a.trend) { const m = map.get(t.d) || { d: t.d, created: 0, done: 0 }; m.created += t.created; m.done += t.done; map.set(t.d, m); }
        const days = [...map.values()].sort((x, y) => x.d.localeCompare(y.d));
        if (!days.length) return '<p class="ex-empty">ไม่มีข้อมูลในช่วงนี้</p>';
        const W = 900, H = 190, L = 34, B = 24, T = 8, max = Math.max(1, ...days.map(d => Math.max(d.created, d.done)));
        const bw = (W - L) / days.length, y = v => T + (H - T - B) * (1 - v / max);
        const bars = days.map((d, i) => {
            const x = L + i * bw, w = Math.max(2, bw * 0.38);
            return `<rect x="${(x + bw * 0.08).toFixed(1)}" y="${y(d.created).toFixed(1)}" width="${w.toFixed(1)}" height="${(H - B - y(d.created)).toFixed(1)}" fill="#94a3b8"><title>${esc(dayLabel(d.d))} เปิดงาน ${d.created}</title></rect>
                    <rect x="${(x + bw * 0.08 + w + 1).toFixed(1)}" y="${y(d.done).toFixed(1)}" width="${w.toFixed(1)}" height="${(H - B - y(d.done)).toFixed(1)}" fill="#4f46e5"><title>${esc(dayLabel(d.d))} งานเสร็จ ${d.done}</title></rect>`;
        }).join('');
        const step = Math.ceil(days.length / 12);
        const labels = days.map((d, i) => i % step === 0 ? `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(dayLabel(d.d))}</text>` : '').join('');
        const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${W}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}" stroke="var(--line)"/><text x="${L - 4}" y="${(y(max * f) + 3).toFixed(1)}" text-anchor="end">${Math.round(max * f)}</text>`).join('');
        return `<svg class="ex-trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟจำนวนงานที่เปิดและงานที่เสร็จรายวัน">${grid}${bars}${labels}</svg>`;
    }

    function peopleBars(list, limit = 12) {
        const max = Math.max(1, ...list.map(p => p.total));
        return `<div class="ex-legend">${state.data.areas.map(a => `<span><i style="--c:${a.color}"></i>${esc(a.title)}</span>`).join('')}</div>
        <div class="ex-bars">${list.slice(0, limit).map(p => `<div class="ex-bar-row" data-person="${esc(p.username)}" title="กดดูรายละเอียดของ ${esc(p.name)}">
            <b>${esc(p.name)}<small>${esc(p.position)}</small></b>
            <div class="ex-stack" style="width:${Math.max(4, p.total / max * 100)}%">${state.data.areas.map(a => p.areas[a.key] ? `<i style="--c:${a.color};flex:${p.areas[a.key].total}" title="${esc(a.title)}: ${p.areas[a.key].total} งาน"></i>` : '').join('')}</div>
            <em>${num(p.total)}</em></div>`).join('')}</div>`;
    }

    // ---------------------------------------------------------------- แท็บ: ภาพรวม
    function renderOverview() {
        const d = state.data;
        $('tab-overview').innerHTML = `
        ${statsKpis(d.overall)}
        <div class="ex-areas">${d.areas.map(a => `<button type="button" class="ex-area" style="--c:${a.color}" data-area="${a.key}">
            <h3>${esc(a.title)}</h3><div class="ex-big">${num(a.total)} <small style="font-size:13px;font-weight:400;color:var(--muted)">งาน</small></div>
            ${meter(a.doneRate, a.color)}
            <dl><dt>เสร็จแล้ว</dt><dd>${num(a.done)} (${pct(a.doneRate)})</dd><dt>ยังค้าง</dt><dd>${num(a.open)}${a.overdue ? ` · <span class="ex-bad">ค้างนาน ${num(a.overdue)}</span>` : ''}</dd>
            <dt>ใช้เวลาเฉลี่ย</dt><dd>${hours(a.avgHours)}</dd><dt>ผู้รับผิดชอบ</dt><dd>${num(a.people.filter(p => p.username).length)} คน</dd></dl></button>`).join('')}</div>
        <div class="ex-card"><h2>งานที่เปิดและงานที่เสร็จรายวัน <small>เทา = เปิดงาน · น้ำเงิน = เสร็จ</small></h2>${trendSvg(d.areas)}</div>
        <div class="ex-card"><h2>ปริมาณงานของแต่ละคน <small>กดชื่อเพื่อดูว่าทำอะไรบ้าง</small></h2>${d.people.length ? peopleBars(d.people) : '<p class="ex-empty">ไม่มีข้อมูล</p>'}</div>`;
    }

    // ---------------------------------------------------------------- แท็บ: แยกตามงาน
    function renderAreas() {
        const d = state.data, a = areaOf(state.area);
        if (!a) { $('tab-areas').innerHTML = '<p class="ex-empty">ไม่มีข้อมูล</p>'; return; }
        const late = d.items.filter(i => i.a === a.key && i.o).sort((x, y) => (x.at || '').localeCompare(y.at || '')).slice(0, 15);
        $('tab-areas').innerHTML = `
        <div class="ex-seg">${d.areas.map(x => `<button type="button" data-area="${x.key}" class="${x.key === a.key ? 'is-on' : ''}" style="--c:${x.color}">${esc(x.title)} (${num(x.total)})</button>`).join('')}</div>
        ${statsKpis(a, a.color)}
        <div class="ex-card"><h2>แยกตามประเภทงาน <small>${esc(a.title)}</small></h2>${table(['ประเภทงาน', 'ทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เสร็จ %', 'เวลาเฉลี่ย'],
            a.categories.map(c => [esc(c.name), num(c.total), num(c.done), num(c.open), c.overdue ? `<span class="ex-bad">${num(c.overdue)}</span>` : '0', `<span class="${rateClass(c.doneRate)}">${pct(c.doneRate)}</span>`, hours(c.avgHours)]), [1, 2, 3, 4, 5, 6])}</div>
        <div class="ex-card"><h2>ใครทำงานนี้บ้าง <small>กดชื่อเพื่อดูรายการของคนนั้น</small></h2>${table(['ผู้รับผิดชอบ', 'ทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เสร็จ %', 'เวลาเฉลี่ย', 'ทันกำหนด'],
            a.people.map(p => [`${esc(p.name)}<br><small class="ex-help">${esc(p.position)}</small>`, num(p.total), num(p.done), num(p.open), p.overdue ? `<span class="ex-bad">${num(p.overdue)}</span>` : '0', `<span class="${rateClass(p.doneRate)}">${pct(p.doneRate)}</span>`, hours(p.avgHours), pct(p.onTimeRate)]), [1, 2, 3, 4, 5, 6, 7], a.people.map(p => p.username))}</div>
        <div class="ex-card"><h2>งานที่ค้างนาน <small>เกิน ${d.sla_hours / 24} วัน · เก่าสุดก่อน</small></h2>${late.length ? table(['รายการ', 'ประเภท', 'ผู้รับผิดชอบ', 'รับเรื่อง', 'สถานะ'],
            late.map(i => [esc(i.t) + (i.s ? `<br><small class="ex-help">${esc(i.s)}</small>` : ''), esc(i.c), esc(i.bn || '–'), when(i.at), esc(i.st)]), []) : '<p class="ex-empty">ไม่มีงานค้างนาน 🎉</p>'}</div>`;
    }

    function table(head, rows, numCols = [], clickKeys = null) {
        if (!rows.length) return '<p class="ex-empty">ไม่มีข้อมูล</p>';
        return `<div class="ex-table-wrap"><table class="ex-table"><thead><tr>${head.map((h, i) => `<th class="${numCols.includes(i) ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${
            rows.map((r, ri) => `<tr${clickKeys ? ` class="is-click" data-person="${esc(clickKeys[ri])}"` : ''}>${r.map((c, i) => `<td class="${numCols.includes(i) ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }

    // ---------------------------------------------------------------- แท็บ: แยกตามคน
    function renderPeople() {
        const d = state.data;
        $('tab-people').innerHTML = `<div class="ex-card"><h2>เจ้าหน้าที่ GA ทุกคน <small>กดแถวเพื่อดูว่าแต่ละคนรับผิดชอบ/ทำอะไรบ้าง</small></h2>
        <p class="ex-help">ผู้ทำ = ผู้ที่ดำเนินการในระบบ (ตรวจเอกสาร มอบหมายงาน กดเสร็จขั้นตอน บันทึกเคส ดำเนินการทรัพย์สิน/ซ่อมห้อง) · "ยังไม่ระบุผู้ทำ" = งานที่ยังไม่มีใครรับ</p>
        ${table(['เจ้าหน้าที่', 'งานทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เสร็จ %', 'เวลาเฉลี่ย', ...d.areas.map(a => a.title)],
            d.people.map(p => [`<b>${esc(p.name)}</b><br><small class="ex-help">${esc(p.position || p.username)}</small>`, num(p.total), num(p.done), num(p.open), p.overdue ? `<span class="ex-bad">${num(p.overdue)}</span>` : '0',
                `<span class="${rateClass(p.doneRate)}">${pct(p.doneRate)}</span>`, hours(p.avgHours), ...d.areas.map(a => p.areas[a.key] ? num(p.areas[a.key].total) : '–')]),
            [1, 2, 3, 4, 5, 6, ...d.areas.map((_, i) => 7 + i)], d.people.map(p => p.username))}</div>`;
    }

    function openPerson(username) {
        const d = state.data, p = d.people.find(x => x.username === username);
        if (!p) return;
        const mine = d.items.filter(i => i.by === username);
        const cats = p.categories.slice(0, 40);
        $('exDetail').innerHTML = `
        <div class="ex-dhead"><div><h2>${esc(p.name)}</h2><small>${esc(p.position || p.username)}</small></div><button type="button" class="ex-btn" data-close>ปิด</button></div>
        ${statsKpis(p)}
        <div class="ex-card"><h2>แยกตามส่วนงาน</h2>${table(['ส่วนงาน', 'ทั้งหมด', 'เสร็จ', 'ค้าง', 'ค้างนาน', 'เวลาเฉลี่ย'], d.areas.filter(a => p.areas[a.key]).map(a => { const s = p.areas[a.key]; return [`<span class="ex-pill" style="--c:${a.color}">${esc(a.title)}</span>`, num(s.total), num(s.done), num(s.open), num(s.overdue), hours(s.avgHours)]; }), [1, 2, 3, 4, 5])}</div>
        <div class="ex-card"><h2>ทำงานอะไรบ้าง <small>แยกตามประเภท</small></h2>${table(['ประเภทงาน', 'ส่วนงาน', 'ทั้งหมด', 'เสร็จ'], cats.map(c => [esc(c.name), `<span class="ex-pill" style="--c:${color(c.area)}">${esc(areaTitle(c.area))}</span>`, num(c.total), num(c.done)]), [2, 3])}</div>
        <div class="ex-card"><h2>รายการล่าสุด <small>${num(Math.min(60, mine.length))} จาก ${num(mine.length)} รายการ</small></h2>${itemsTable(mine.slice(0, 60))}</div>`;
        $('exDialog').showModal();
    }

    function itemsTable(list) {
        return list.length ? table(['รับเรื่อง', 'ส่วนงาน', 'ประเภท', 'รายการ', 'สถานะ', 'ใช้เวลา'], list.map(i => [when(i.at), `<span class="ex-pill" style="--c:${color(i.a)}">${esc(areaTitle(i.a))}</span>`, esc(i.c),
            esc(i.t) + (i.s ? `<br><small class="ex-help">${esc(i.s)}</small>` : ''), `<span class="${i.d ? 'ex-good' : (i.o ? 'ex-bad' : 'ex-warn')}">${esc(i.st)}</span>`, hours(i.h)])) : '<p class="ex-empty">ไม่มีรายการ</p>';
    }

    // ---------------------------------------------------------------- แท็บ: รายงาน
    function filtered() {
        const f = state.report, q = f.q.trim().toLowerCase();
        let list = state.data.items.filter(i => (!f.area || i.a === f.area) && (!f.person || i.by === f.person) &&
            (!f.status || (f.status === 'done' ? i.d : f.status === 'open' ? !i.d : i.o)) &&
            (!q || `${i.t} ${i.c} ${i.s} ${i.bn} ${i.r} ${i.st}`.toLowerCase().includes(q)));
        const key = f.sort;
        return list.sort((x, y) => ((x[key] ?? '') > (y[key] ?? '') ? 1 : -1) * f.dir);
    }
    function renderReport() {
        const d = state.data, f = state.report, list = filtered();
        const stats = { total: list.length, done: list.filter(i => i.d).length };
        $('tab-report').innerHTML = `<div class="ex-card"><span class="ex-print-title">รายงานสรุปงาน GA · ${esc($('exStatus').textContent)}</span>
        <div class="ex-filters">
            <select id="rfArea"><option value="">ทุกส่วนงาน</option>${d.areas.map(a => `<option value="${a.key}"${f.area === a.key ? ' selected' : ''}>${esc(a.title)}</option>`).join('')}</select>
            <select id="rfPerson"><option value="">ทุกคน</option>${d.people.map(p => `<option value="${esc(p.username)}"${f.person === p.username ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
            <select id="rfStatus"><option value="">ทุกสถานะ</option><option value="done"${f.status === 'done' ? ' selected' : ''}>เสร็จแล้ว</option><option value="open"${f.status === 'open' ? ' selected' : ''}>ยังค้าง</option><option value="late"${f.status === 'late' ? ' selected' : ''}>ค้างนาน</option></select>
            <input id="rfQ" type="search" placeholder="ค้นหา ชื่อ/รายการ/เลขเคส" value="${esc(f.q)}">
            <span style="margin-left:auto;display:flex;gap:8px"><button type="button" class="ex-btn" id="rfCsv">ดาวน์โหลด CSV</button><button type="button" class="ex-btn ex-btn-primary" id="rfPrint">พิมพ์ / บันทึก PDF</button></span>
        </div>
        <p class="ex-help">${num(stats.total)} รายการ · เสร็จ ${num(stats.done)} · ค้าง ${num(stats.total - stats.done)}${d.truncated ? ' · แสดงเฉพาะ 3,000 รายการล่าสุด' : ''}</p>
        ${list.length ? `<div class="ex-table-wrap"><table class="ex-table"><thead><tr>${[['at', 'รับเรื่อง'], ['a', 'ส่วนงาน'], ['c', 'ประเภท'], ['t', 'รายการ'], ['bn', 'ผู้ทำ'], ['st', 'สถานะ'], ['dn', 'เสร็จเมื่อ'], ['h', 'ใช้เวลา']].map(([k, l]) =>
            `<th data-sort="${k}">${l}${f.sort === k ? (f.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('')}</tr></thead><tbody>${list.slice(0, 500).map(i => `<tr><td>${when(i.at)}</td><td><span class="ex-pill" style="--c:${color(i.a)}">${esc(areaTitle(i.a))}</span></td><td>${esc(i.c)}</td>
            <td>${esc(i.t)}${i.s ? `<br><small class="ex-help">${esc(i.s)}</small>` : ''}</td><td>${esc(i.bn || '–')}</td><td><span class="${i.d ? 'ex-good' : (i.o ? 'ex-bad' : 'ex-warn')}">${esc(i.st)}</span></td><td>${i.dn ? when(i.dn) : '–'}</td><td class="num">${hours(i.h)}</td></tr>`).join('')}</tbody></table></div>
        ${list.length > 500 ? `<p class="ex-help">แสดง 500 รายการแรก — ดาวน์โหลด CSV เพื่อดูทั้งหมด</p>` : ''}` : '<p class="ex-empty">ไม่พบรายการตามตัวกรอง</p>'}</div>`;
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
    function render() {
        renderOverview(); renderAreas(); renderPeople(); renderReport();
        $('exFoot').innerHTML = `<b>แหล่งข้อมูล</b>${state.data.sources.map(s => `<span>${s.error ? '⚠️' : '✓'} ${esc(s.name)}${s.error ? ` — โหลดไม่ได้ (${esc(s.error)})` : ` · ${num(s.count)} รายการ`}</span>`).join('')}
        <span>เกณฑ์: "ค้างนาน" = ยังไม่เสร็จเกิน ${state.data.sla_hours / 24} วัน · "เสร็จทันกำหนด" = เสร็จภายใน ${state.data.sla_hours / 24} วันนับจากรับเรื่อง · งานเอกสารนับผู้ดำเนินการล่าสุดของรายการ</span>`;
    }
    // ---------------------------------------------------------------- ห้องพัก (ภาพรวมห้องพักทั้งหมด — ไม่มีข้อมูลพนักงาน)
    const roomState = { data: null, filter: 'all', q: '', loading: false };
    const km = v => { const t = String(v ?? '').trim(); return t && t !== '-' ? esc(t) + ' กม.' : '–'; };
    const baht = n => num(n) + ' บาท';
    async function loadRooms(refresh) {
        roomState.loading = true; $('tab-rooms').innerHTML = '<p class="ex-empty">กำลังโหลดข้อมูลห้องพัก…</p>';
        try {
            const response = await window.authFetch(API + '/rooms' + (refresh ? '?refresh=1' : ''), { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ดูแดชบอร์ดผู้บริหาร');
            if (!response.ok || !data.success) throw new Error(data.message || 'โหลดไม่สำเร็จ (' + response.status + ')');
            roomState.data = data; renderRooms();
        } catch (error) { $('tab-rooms').innerHTML = '<p class="ex-status is-error">' + esc(error.message) + '</p>'; }
        roomState.loading = false;
    }
    function renderRooms() {
        const d = roomState.data; if (!d) return;
        const q = roomState.q.trim().toLowerCase();
        const list = d.rooms.filter(r => (roomState.filter === 'all' || (roomState.filter === 'contracted') === r.contracted) && (!q || (r.project + ' ' + r.unit + ' ' + r.status + ' ' + r.type).toLowerCase().includes(q)));
        const rent = list.reduce((n, r) => n + r.rent, 0);
        const seg = (k, l, n) => '<button type="button" data-room-filter="' + k + '" class="' + (roomState.filter === k ? 'is-on' : '') + '">' + l + ' ' + n + '</button>';
        const steps = Object.entries(d.counts.processByStatus || {}).map(([s, n]) => esc(s) + ' ' + n).join(' · ') || 'รอทำสัญญา/วางจอง';
        const rows = list.map(r => '<tr><td>' + esc(r.no) + '</td><td><b>' + esc(r.project) + '</b><br><small class="ex-help">' + esc(r.unit) + '</small></td>' +
            '<td><span class="ex-pill" style="--c:' + (r.contracted ? '#0d9488' : '#d97706') + '">' + esc(r.status || '–') + '</span></td><td>' + esc(r.type || '–') + '</td>' +
            '<td class="num">' + (r.rent ? num(r.rent) : '–') + '</td><td class="num">' + km(r.mt) + '</td><td class="num">' + km(r.or) + '</td>' +
            '<td>' + (r.start || r.end ? esc(r.start || '?') + ' – ' + esc(r.end || '?') : '–') + (r.remaining ? '<br><small class="ex-help">' + esc(r.remaining) + '</small>' : '') + '</td></tr>').join('');
        $('tab-rooms').innerHTML =
            '<div class="ex-kpis">' +
            '<div class="ex-kpi" style="--c:#0d9488"><span>ห้องที่ทำสัญญาแล้ว</span><b>' + num(d.counts.contracted) + '</b><small>ค่าเช่า ' + baht(d.rent.contracted) + '/เดือน</small></div>' +
            '<div class="ex-kpi" style="--c:#d97706"><span>ห้องที่กำลังอยู่ในกระบวนการ</span><b>' + num(d.counts.process) + '</b><small>' + steps + '</small></div>' +
            '<div class="ex-kpi" style="--c:#2563eb"><span>รวมห้องทั้งหมด</span><b>' + num(d.counts.total) + '</b><small>ห้อง</small></div>' +
            '<div class="ex-kpi" style="--c:#4f46e5"><span>ค่าเช่ารวมทั้งหมดต่อเดือน</span><b>' + num(d.rent.all) + '</b><small>บาท · เฉพาะที่ทำสัญญาแล้ว ' + baht(d.rent.contracted) + '</small></div></div>' +
            '<div class="ex-card"><h2>ภาพรวมห้องพักทั้งหมด <small>จากทะเบียนห้องพัก · อัปเดต ' + when(d.at) + '</small></h2>' +
            '<div class="ex-filters"><div class="ex-seg">' + seg('all', 'ทั้งหมด', d.counts.total) + seg('contracted', 'ทำสัญญาแล้ว', d.counts.contracted) + seg('process', 'กำลังดำเนินการ', d.counts.process) + '</div>' +
            '<input id="rmQ" type="search" placeholder="ค้นหาที่พัก ยูนิต สถานะ…" value="' + esc(roomState.q) + '"><button type="button" class="ex-btn" id="rmRefresh" style="margin-left:auto">รีเฟรช</button></div>' +
            '<p class="ex-help">ระยะทางเป็นกิโลเมตร ตามทะเบียนห้องพัก (MT = Mireka Tower · OR = Orion City)</p>' +
            (list.length ? '<div class="ex-table-wrap"><table class="ex-table"><thead><tr><th>#</th><th>ที่พัก / ยูนิต</th><th>สถานะ</th><th>ประเภทห้อง</th><th class="num">ค่าเช่า/เดือน</th><th class="num">ห่าง Mireka Tower</th><th class="num">ห่าง Orion City</th><th>สัญญา</th></tr></thead><tbody>' + rows +
                '</tbody><tfoot><tr><td colspan="4"><b>รวม ' + num(list.length) + ' ห้อง</b></td><td class="num"><b>' + num(rent) + '</b></td><td colspan="3"><small class="ex-help">ค่าเช่ารวมต่อเดือน (' + esc(baht(rent)) + ')</small></td></tr></tfoot></table></div>' : '<p class="ex-empty">ไม่พบห้อง</p>') + '</div>';
    }

    function showTab(name) {
        state.tab = name;
        $('exRoomsBtn').classList.toggle('is-on', name === 'rooms');
        if (name === 'rooms' && !roomState.data && !roomState.loading) loadRooms();
        document.querySelectorAll('#exTabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === name));
        document.querySelectorAll('.ex-pane').forEach(p => { p.hidden = p.id !== `tab-${name}`; });
    }

    document.addEventListener('click', event => {
        const t = event.target;
        const tab = t.closest('#exTabs button'); if (tab) return showTab(tab.dataset.tab);
        if (t.closest('#exRoomsBtn')) return showTab('rooms');
        const rf = t.closest('[data-room-filter]'); if (rf) { roomState.filter = rf.dataset.roomFilter; return renderRooms(); }
        if (t.id === 'rmRefresh') return loadRooms(true);
        if (t.closest('[data-close]')) return $('exDialog').close();
        const person = t.closest('[data-person]'); if (person && state.data) return openPerson(person.dataset.person);
        const area = t.closest('[data-area]'); if (area && state.data) { state.area = area.dataset.area; renderAreas(); return showTab('areas'); }
        const th = t.closest('th[data-sort]'); if (th) { const f = state.report; f.dir = f.sort === th.dataset.sort ? -f.dir : -1; f.sort = th.dataset.sort; return renderReport(); }
        if (t.id === 'rfCsv') return csv();
        if (t.id === 'rfPrint') { showTab('report'); return window.print(); }
    });
    document.addEventListener('change', event => {
        const f = state.report, id = event.target.id;
        if (id === 'rfArea') f.area = event.target.value; else if (id === 'rfPerson') f.person = event.target.value; else if (id === 'rfStatus') f.status = event.target.value; else return;
        renderReport();
    });
    document.addEventListener('input', event => {
        if (event.target.id === 'rmQ') { roomState.q = event.target.value; const p = event.target.selectionStart; renderRooms(); const b = $('rmQ'); b.focus(); b.setSelectionRange(p, p); return; }
        if (event.target.id !== 'rfQ') return;
        state.report.q = event.target.value; const pos = event.target.selectionStart; renderReport();
        const box = $('rfQ'); box.focus(); box.setSelectionRange(pos, pos);
    });
    $('exPreset').addEventListener('change', () => { $('exCustom').hidden = $('exPreset').value !== 'custom'; if ($('exPreset').value !== 'custom') load(); });
    $('exFrom').addEventListener('change', () => load()); $('exTo').addEventListener('change', () => load());
    $('exRefresh').addEventListener('click', () => load(true));
    $('exDialog').addEventListener('click', event => { if (event.target === $('exDialog')) $('exDialog').close(); });
    load();
})();
