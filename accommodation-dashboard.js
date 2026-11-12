// หน้าสรุปภาพรวมห้องพัก (บนสุด) + จัดตาราง/รายงานเดิมเข้าแท็บ — ดูภาพรวมในจอเดียว กดแท็บหรือกล่องเพื่อดูรายละเอียด
// ระดับ 1: แถบตัวเลข + แถบแจ้งเตือน · ระดับ 2: กล่องย่อย 4 กล่อง · ระดับ 3: แท็บรายละเอียด (ย้ายส่วนเดิมมาไว้ ไม่เปลี่ยนการทำงานของส่วนนั้น)
(() => {
    const layout = document.querySelector('.accommodation-layout');
    const head = document.querySelector('.as-head');
    if (!layout || !head) return;
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const compact = v => v >= 1e6 ? (v / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ล้าน' : num(v);
    const PER_BED = 2;   // 1 ห้องนอน = 2 คน
    const STATUS_LIST = ['ทำสัญญาแล้ว', 'รอทำสัญญา', 'วางจองแล้ว', 'ตั้งเบิกแล้ว รอรับเงินวางจอง', 'ไม่มีการวางจอง', 'ได้รับเงินแล้ว รอวางจอง', 'จัดทำรายการ รอตั้งเบิกค่ามัดจำ', 'รอเข้าตรวจสอบก่อนวางมัดจำ', 'รอเข้าตรวจสอบก่อนเซ็นสัญญา'];
    const bedsOf = r => Number((/(\d+)\s*ห้องนอน/.exec(r.type || '') || [])[1] || 0);
    const bathsOf = r => Number((/(\d+)\s*ห้องน้ำ/.exec(r.type || '') || [])[1] || 0);
    const parseDmy = text => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim()); if (!m) return null; const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); };
    const state = { ro: window.__roData || null, rx: window.__rxStats || null, tab: 'units' };

    // ---------------------------------------------------------------- โครงหน้า: หัวเรื่อง → สรุป → แท็บ
    const slim = head; slim.classList.add('dx-slim');
    const dash = document.createElement('section');
    dash.id = 'dash'; dash.className = 'dx'; dash.setAttribute('aria-label', 'สรุปภาพรวมห้องพัก');
    slim.after(dash);
    const wrap = document.createElement('section');
    wrap.className = 'dx-tabs-wrap';
    wrap.innerHTML = '<div class="dx-tabs" role="tablist"></div><div class="dx-panes"></div>';
    dash.after(wrap);
    const TABS = [
        { key: 'units', label: '🏠 ยูนิตและสถานะ', nodes: () => [$('roomOverview')] },
        { key: 'exp', label: '💳 ค่าใช้จ่ายและรอบกำหนด', nodes: () => [$('roomExpenses')] },
        { key: 'checks', label: '🔍 ตรวจสอบกับส่วนกลาง', nodes: () => [$('roomChecks')] },
        { key: 'people', label: '👥 พนักงานและที่พัก', nodes: () => [$('asStats'), head.querySelector('.as-filters'), head.querySelector('.as-toolbar'), $('asResults')] },
        { key: 'ledger', label: '📊 ค่าน้ำไฟ · สัญญา · ผังห้อง', nodes: () => [$('accommodationLedger')] }
    ];
    const tabBar = wrap.querySelector('.dx-tabs'), panes = wrap.querySelector('.dx-panes');
    for (const t of TABS) {
        const pane = document.createElement('div');
        pane.className = 'dx-pane'; pane.dataset.pane = t.key; pane.hidden = true; pane.setAttribute('role', 'tabpanel');
        t.nodes().filter(Boolean).forEach(n => pane.appendChild(n));
        panes.appendChild(pane);
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'dx-tab'; btn.dataset.tab = t.key; btn.setAttribute('role', 'tab');
        btn.innerHTML = `<span>${esc(t.label)}</span><i class="dx-badge" hidden></i>`;
        tabBar.appendChild(btn);
    }
    function show(key, scroll) {
        if (!TABS.some(t => t.key === key)) key = 'units';
        state.tab = key;
        tabBar.querySelectorAll('.dx-tab').forEach(b => { const on = b.dataset.tab === key; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
        panes.querySelectorAll('.dx-pane').forEach(p => { p.hidden = p.dataset.pane !== key; });
        try { localStorage.setItem('dxTab', key); } catch { /* ignore */ }
        if (scroll) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    tabBar.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab, false); });
    let saved = 'units'; try { saved = localStorage.getItem('dxTab') || 'units'; } catch { /* ignore */ }
    show(saved, false);

    // ---------------------------------------------------------------- สรุปบนสุด
    function badge(key, n) { const el = tabBar.querySelector(`[data-tab="${key}"] .dx-badge`); if (!el) return; el.hidden = !n; el.textContent = n || ''; }
    function render() {
        const d = state.ro;
        if (!d) { dash.innerHTML = '<p class="dx-empty">กำลังโหลดภาพรวม…</p>'; return; }
        const rooms = d.rooms || [];
        const contracted = rooms.filter(r => r.status === STATUS_LIST[0]);
        const beds = rooms.reduce((n, r) => n + bedsOf(r), 0), baths = rooms.reduce((n, r) => n + bathsOf(r), 0);
        const capacity = contracted.reduce((n, r) => n + bedsOf(r) * PER_BED, 0), occupants = contracted.reduce((n, r) => n + (r.employees || 0), 0);
        const buildings = new Set(rooms.map(r => String(r.project || '').toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean));
        const rent = rooms.reduce((n, r) => n + (r.rent || 0), 0), rentC = contracted.reduce((n, r) => n + (r.rent || 0), 0);
        const pct = capacity ? Math.round(occupants / capacity * 100) : 0;
        const c = d.counts || {};
        const reviews = rooms.filter(r => (r.review || []).length).length;
        const kpi = (label, value, sub, tone = '') => `<div class="dx-kpi ${tone}"><small>${esc(label)}</small><strong>${value}</strong><span>${sub}</span></div>`;
        const kpis = [
            kpi('ยูนิตทั้งหมด', num(rooms.length), `ทำสัญญาแล้ว <b>${num(contracted.length)}</b> · ระหว่างดำเนินการ <b>${num(rooms.length - contracted.length)}</b>`),
            kpi('ห้องนอน / ห้องน้ำ', num(beds), `ห้องน้ำรวม <b>${num(baths)}</b> · รองรับ ${num(beds * PER_BED)} คน`),
            kpi('ตึก', num(buildings.size), `ค่าเช่าเฉลี่ย <b>${rooms.length ? num(Math.round(rent / rooms.length)) : 0}</b>/ยูนิต`),
            kpi('ค่าเช่า / เดือน', compact(rent), `ทำสัญญาแล้ว <b>${compact(rentC)}</b>`),
            kpi('ผู้พัก / ความจุ (ยูนิตทำสัญญาแล้ว)', `${num(occupants)}<em> / ${num(capacity)}</em>`, `อัตราเข้าพัก <b>${pct}%</b> · ที่ว่าง <b>${num(Math.max(0, capacity - occupants))}</b>`, pct >= 90 ? 'is-hot' : ''),
            kpi('พนักงาน on work', num(c.employeesOnWork), `ยังไม่ระบุที่พัก <b>${num(c.employeesWithoutRoom)}</b> · จับคู่ห้องได้ <b>${num(c.employeesMatched)}</b>`, c.employeesWithoutRoom ? 'is-warn' : '')
        ].join('');

        // แถบแจ้งเตือน (รวมจากทุกส่วน — กดเพื่อไปยังรายการ)
        const s = state.rx;
        const items = [];
        if (s) {
            if (s.unpaid) items.push(['bad', `ค่าใช้จ่ายเดือนนี้ค้างจ่าย ${num(s.unpaid)} รายการ`, 'exp']);
            if (s.gasPending) items.push(['warn', `รอรับค่าแก๊ส ${num(s.gasPending)} ยูนิต`, 'exp']);
            if (s.rentOver || s.airOver) items.push(['bad', `เลยกำหนดค่าเช่าล่วงหน้า ${num(s.rentOver)} · ล้างแอร์ ${num(s.airOver)} ยูนิต`, 'exp']);
            if (s.rentSoon || s.airSoon) items.push(['warn', `ใกล้ถึงกำหนด 30 วัน: ค่าเช่าล่วงหน้า ${num(s.rentSoon)} · ล้างแอร์ ${num(s.airSoon)} ยูนิต`, 'exp']);
            if (s.noticeDue) items.push(['bad', `ถึงกำหนดแจ้งยกเลิกเช่า ${num(s.noticeDue)} ยูนิต`, 'exp']);
            if (s.noticeSoon) items.push(['warn', `ใกล้กำหนดแจ้งยกเลิกเช่า ${num(s.noticeSoon)} ยูนิต`, 'exp']);
        }
        const netDown = contracted.filter(r => (r.internet || []).some(x => x.kind === 'down') && !(r.internet || []).some(x => x.kind === 'ok')).length;
        const netNone = contracted.filter(r => (r.internet || []).length && (r.internet || []).every(x => x.kind === 'none')).length;
        if (netDown) items.push(['bad', `อินเตอร์เน็ตใช้งานไม่ได้ ${num(netDown)} ยูนิต`, 'units']);
        if (netNone) items.push(['warn', `ยังไม่ติดตั้งอินเตอร์เน็ต ${num(netNone)} ยูนิต`, 'units']);
        const ck = d.checks || {};
        const ckBad = ['center', 'internet'].reduce((n, k) => n + ((ck[k]?.issues || []).filter(i => i.severity === 'bad').length), 0);
        const ckWarn = ['center', 'internet'].reduce((n, k) => n + ((ck[k]?.issues || []).filter(i => i.severity === 'warn').length), 0);
        const ckDiag = ['center', 'internet'].some(k => ck[k]?.diag);
        if (ckBad || ckWarn) items.push([ckBad ? 'bad' : 'warn', `ไม่ตรงกับไฟล์ส่วนกลาง ${num(ckBad)} · ควรตรวจ ${num(ckWarn)} รายการ`, 'checks']);
        if (ckDiag) items.push(['warn', 'อ่านไฟล์ส่วนกลางไม่ได้ (ต้องแชร์ไฟล์ให้บัญชีระบบ)', 'checks']);
        badge('checks', ckBad + ckWarn);
        if (reviews) items.push(['warn', `ต้องยืนยันที่พักพนักงาน ${num(reviews)} ยูนิต`, 'units']);
        if (c.issues) items.push(['warn', `ทะเบียนมีจุดต้องตรวจ ${num(c.issues)} จุด`, 'units']);
        badge('exp', s ? (s.unpaid + s.rentOver + s.airOver + s.noticeDue) : 0);
        badge('units', reviews);
        const alertHtml = items.length
            ? `<b class="dx-alert-title">🔔 ต้องดำเนินการ</b>${items.map(([tone, text, tab]) => `<button type="button" class="dx-alert is-${tone}" data-go="${tab}">${esc(text)}</button>`).join('')}`
            : `<b class="dx-alert-title">${s ? '✅ ไม่มีรายการค้าง' : 'กำลังโหลดแจ้งเตือน…'}</b>`;

        // กล่องย่อย 1: สถานะยูนิต 9 ขั้น
        const byStatus = STATUS_LIST.map(st => [st, rooms.filter(r => r.status === st).length]);
        const maxSt = Math.max(1, ...byStatus.map(x => x[1]));
        const p1 = `<h3>สถานะยูนิต <small>กดเพื่อกรอง</small></h3><div class="dx-bars">${byStatus.map(([st, n]) => `<button type="button" class="dx-bar" data-status="${esc(st)}"><span>${esc(st)}</span><i style="--w:${Math.round(n / maxSt * 100)}%"></i><b>${num(n)}</b></button>`).join('')}</div>`;
        // กล่องย่อย 2: อัตราเข้าพักรายตึก
        const byB = new Map();
        for (const r of contracted) { const k = r.project; const o = byB.get(k) || { name: k, cap: 0, occ: 0, units: 0 }; o.cap += bedsOf(r) * PER_BED; o.occ += r.employees || 0; o.units++; byB.set(k, o); }
        const top = [...byB.values()].sort((a, b) => b.occ - a.occ).slice(0, 6);
        const p2 = `<h3>อัตราเข้าพักรายตึก <small>6 อันดับแรก</small></h3><div class="dx-bars">${top.map(b => { const f = b.cap ? Math.min(100, Math.round(b.occ / b.cap * 100)) : 0; return `<div class="dx-bar is-static"><span>${esc(b.name)} <em>${b.units} ยูนิต</em></span><i class="${f >= 100 ? 'is-full' : ''}" style="--w:${f}%"></i><b>${b.occ}/${b.cap}</b></div>`; }).join('') || '<p class="dx-empty">ยังไม่มีข้อมูล</p>'}</div>`;
        // กล่องย่อย 3: สัญญาใกล้หมด
        const now = new Date(); const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const expiring = contracted.map(r => ({ r, end: parseDmy(r.end) })).filter(x => x.end && x.end >= today).sort((a, b) => a.end - b.end).slice(0, 5);
        const p3 = `<h3>สัญญาใกล้หมด <small>5 รายการถัดไป</small></h3><ul class="dx-list">${expiring.map(({ r, end }) => { const days = Math.round((end - today) / 86400000); return `<li><span><b>${esc(r.project)}</b> <em>${esc(r.unit)}</em></span><span class="dx-days ${days <= 90 ? 'is-bad' : days <= 150 ? 'is-warn' : ''}">${num(days)} วัน</span></li>`; }).join('') || '<li class="dx-empty">ไม่มีสัญญาที่ใกล้หมด</li>'}</ul>`;
        // กล่องย่อย 4: ค่าใช้จ่ายเดือนนี้
        const paidPct = s && s.total ? Math.round(s.paid / s.total * 100) : 0;
        const p4 = `<h3>ค่าใช้จ่ายเดือนนี้ <small>${s ? esc(s.monthLabel) : ''}</small></h3>${s ? `<div class="dx-meter"><i style="--w:${paidPct}%"></i></div><p class="dx-meter-t"><b>${num(s.paid)}</b> / ${num(s.total)} รายการ จ่ายแล้ว (${paidPct}%)</p>
            <div class="dx-mini">${s.cats.map(([label, paid, total]) => `<span class="${paid === total ? 'is-ok' : 'is-bad'}">${esc(label)} <b>${paid}/${total}</b></span>`).join('')}</div>` : '<p class="dx-empty">กำลังโหลด…</p>'}`;
        dash.innerHTML = `<div class="dx-kpis">${kpis}</div><div class="dx-alerts ${items.length ? 'has-alert' : ''}">${alertHtml}</div>
            <div class="dx-panels"><article class="dx-panel">${p1}</article><article class="dx-panel">${p2}</article><article class="dx-panel" data-go="ledger" title="ดูตารางสัญญาทั้งหมด">${p3}</article><article class="dx-panel" data-go="exp" title="ดูรายละเอียดค่าใช้จ่าย">${p4}</article></div>`;
    }
    dash.addEventListener('click', e => {
        const st = e.target.closest('[data-status]');
        if (st) { show('units', true); setTimeout(() => document.querySelector(`#roomOverview [data-ro-filter="st:${CSS.escape(st.dataset.status)}"]`)?.click(), 50); return; }
        const go = e.target.closest('[data-go]');
        if (go) show(go.dataset.go, true);
    });
    window.addEventListener('ro-data', e => { state.ro = e.detail; render(); });
    window.addEventListener('ro-expense-alerts', e => { state.rx = e.detail.stats || null; render(); });
    render();
})();
