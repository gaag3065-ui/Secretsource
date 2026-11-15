// ติดตามขั้นตอนการดำเนินงานที่พักใหม่ — กรองยูนิตที่ยังไม่ขึ้น "ทำสัญญาแล้ว" มาทำเป็น Flow chart ตามวันที่ในทะเบียนห้องพัก
// (คอลัมน์วันที่ H–Q: ตรวจสอบ → ตั้งเบิกมัดจำ → จ่ายมัดจำ → ได้รับสัญญา → ส่งตรวจ → ตรวจเสร็จ → ตั้งเบิกค่าเช่า → ได้รับเงิน → ตรวจก่อนเซ็น → เซ็นสัญญา)
// แสดงวันที่ชัดเจนทุกขั้น และระยะเวลาระหว่างขั้น / รวมทั้งหมด / ค้างอยู่ขั้นล่าสุดมากี่วัน — อ่านจาก window.__roData (accommodation-rooms.js)
(() => {
    const host = document.getElementById('accommodationFlow');
    if (!host) return;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const KEYS = ['dH', 'dI', 'dJ', 'dK', 'dL', 'dM', 'dN', 'dO', 'dP', 'dQ'];
    const FALLBACK = ['วันตรวจสอบ', 'วันที่ตั้งเบิกค่ามัดจำ', 'วันที่จ่ายค่ามัดจำ', 'วันที่ได้รับสัญญา', 'วันที่ส่งสัญญาไปตรวจสอบ', 'วันที่ตรวจสอบเสร็จ', 'วันที่ตั้งเบิกค่าเช่าล่วงหน้า', 'วันที่ได้รับเงินตั้งเบิก', 'วันที่ตรวจสอบก่อนเซ็นสัญญา', 'วันที่เซ็นสัญญา'];
    const DONE = 'ทำสัญญาแล้ว', DAY = 86400000;
    const state = { data: null, filter: 'all', query: '' };

    const parseDmy = text => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim()); if (!m) return null; const y = +m[3] > 2400 ? +m[3] - 543 : +m[3]; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); };
    const todayUtc = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
    const days = (a, b) => Math.round((b - a) / DAY);
    const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thDate = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear() + 543).slice(2)}`;
    const span = n => n < 0 ? 'ลำดับวันที่ไม่ตรง' : n === 0 ? 'วันเดียวกัน' : n >= 60 ? `${n} วัน (≈ ${(n / 30).toFixed(1)} เดือน)` : `${n} วัน`;

    function rowsOf() {
        const heads = state.data.dateHeaders || {};
        const labels = KEYS.map((k, i) => String(heads[k] || FALLBACK[i]).replace(/\s*\(.*?\)\s*$/, ''));
        const now = todayUtc();
        const rooms = (state.data.rooms || []).filter(r => r.status !== DONE).map(r => {
            const steps = KEYS.map((k, i) => ({ label: labels[i], text: r[k] || '', date: parseDmy(r[k]) }));
            const dated = steps.filter(s => s.date);
            let prev = null;
            steps.forEach(s => { if (s.date) { s.gap = prev ? days(prev.date, s.date) : null; s.from = prev ? prev.label : ''; prev = s; } });
            const first = dated[0] || null, last = dated[dated.length - 1] || null;
            return { r, steps, first, last, total: first && last ? days(first.date, last.date) : null, waiting: last ? days(last.date, now) : null, sinceStart: first ? days(first.date, now) : null };
        });
        return { rooms, labels };
    }

    function render() {
        if (!state.data) { host.innerHTML = '<p class="fl-empty">กำลังโหลดข้อมูลทะเบียนห้องพัก…</p>'; return; }
        const { rooms } = rowsOf();
        const statuses = [...new Set(rooms.map(x => x.r.status))];
        const q = state.query.trim().toLowerCase();
        const shown = rooms.filter(x => (state.filter === 'all' || x.r.status === state.filter) && (!q || `${x.r.project} ${x.r.unit} ${x.r.status}`.toLowerCase().includes(q)))
            .sort((a, b) => (b.waiting ?? -1) - (a.waiting ?? -1));
        const withDates = rooms.filter(x => x.last);
        const avgWait = withDates.length ? Math.round(withDates.reduce((n, x) => n + x.waiting, 0) / withDates.length) : 0;
        const longest = withDates.slice().sort((a, b) => b.waiting - a.waiting)[0];
        const chip = (key, label, n) => `<button type="button" data-fl-filter="${esc(key)}" class="${state.filter === key ? 'is-on' : ''}">${esc(label)} <b>${n}</b></button>`;
        host.innerHTML = `<div class="fl-top">
            <div><h2>🧭 ติดตามขั้นตอนการดำเนินงานที่พักใหม่</h2><p>ยูนิตที่ยังไม่ขึ้น “ทำสัญญาแล้ว” ${num(rooms.length)} ยูนิต · แสดงวันที่ของแต่ละขั้น และระยะเวลาจากขั้นหนึ่งไปอีกขั้น · เรียงตามที่ค้างนานสุดก่อน</p></div>
            <div class="fl-kpis"><span><small>ยูนิตที่กำลังดำเนินการ</small><b>${num(rooms.length)}</b></span><span><small>ค้างขั้นล่าสุดเฉลี่ย</small><b>${num(avgWait)} วัน</b></span>${longest ? `<span class="is-hot"><small>ค้างนานสุด</small><b>${num(longest.waiting)} วัน</b><em>${esc(longest.r.project)} ${esc(longest.r.unit)}</em></span>` : ''}</div>
        </div>
        <div class="fl-filters">${chip('all', 'ทั้งหมด', rooms.length)}${statuses.map(s => chip(s, s, rooms.filter(x => x.r.status === s).length)).join('')}<input type="search" data-fl-q placeholder="ค้นหาที่พัก / ยูนิต…" value="${esc(state.query)}"></div>
        ${shown.length ? shown.map(card).join('') : '<p class="fl-empty">ไม่พบยูนิตที่ตรงเงื่อนไข</p>'}`;
        const input = host.querySelector('[data-fl-q]');
        if (input && state.query) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }

    function card(x) {
        const { r, steps } = x;
        const lastIdx = steps.map(s => !!s.date).lastIndexOf(true);
        const hot = x.waiting != null && x.waiting >= 30;
        const nodes = steps.map((s, i) => {
            const cls = s.date ? (i === lastIdx ? 'is-now' : 'is-done') : 'is-todo';
            const gap = s.date && s.gap != null ? `<span class="fl-gap${s.gap < 0 ? ' is-bad' : s.gap >= 14 ? ' is-slow' : ''}" title="จาก “${esc(s.from)}”">⏱ +${s.gap < 0 ? '?' : s.gap} วัน</span>` : '';
            return `<li class="fl-node ${cls}"><span class="fl-dot">${i + 1}</span><b class="fl-label">${esc(s.label)}</b>${s.date ? `<span class="fl-date">${esc(thDate(s.date))}</span><small>${esc(s.text)}</small>` : '<span class="fl-date is-empty">ยังไม่มีวันที่</span>'}${gap}</li>`;
        }).join('');
        const summary = x.first
            ? `<span>เริ่ม <b>${esc(thDate(x.first.date))}</b></span><span>ขั้นล่าสุด <b>${esc(x.last.label)}</b> · ${esc(thDate(x.last.date))}</span><span>ใช้เวลาตั้งแต่เริ่มถึงขั้นล่าสุด <b>${esc(span(x.total))}</b></span><span class="${hot ? 'is-hot' : ''}">ค้างอยู่ที่ขั้นนี้มา <b>${esc(span(x.waiting))}</b> (ถึงวันนี้)</span>`
            : '<span class="is-hot">ยังไม่มีวันที่ในทะเบียนเลย — ระบุวันที่ในขั้นแรกที่ทำแล้ว</span>';
        return `<article class="fl-card${hot ? ' is-hot' : ''}">
            <header><div><h3>${esc(r.project)} <small>${esc(r.unit)}</small></h3><span class="fl-status">${esc(r.status)}</span></div><div class="fl-meta">${r.rent ? `ค่าเช่า ${num(r.rent)}/เดือน` : ''}${r.type ? ` · ${esc(r.type)}` : ''}</div></header>
            <div class="fl-summary">${summary}</div>
            <ol class="fl-flow">${nodes}</ol>
        </article>`;
    }

    host.addEventListener('click', e => { const b = e.target.closest('[data-fl-filter]'); if (b) { state.filter = b.dataset.flFilter; render(); } });
    host.addEventListener('input', e => { if (e.target.matches('[data-fl-q]')) { state.query = e.target.value; render(); } });
    window.addEventListener('ro-data', e => { state.data = e.detail; render(); });
    state.data = window.__roData || null;
    render();
})();
