// ตรวจสอบกับส่วนกลาง: เทียบรายชื่อบ้าน/ยูนิตในทะเบียนห้องพักกับไฟล์ SL_GROUP_EAST และไฟล์อินเตอร์เน็ต — ระบบอ่านอย่างเดียว ไม่แก้ไฟล์ต้นทาง
// ตรง → แจ้งว่าตรง · ไม่ตรง → แจ้งว่าไม่ตรงอย่างไร (ผลมาจากหลังบ้าน /api/accommodation-rooms/overview → checks)
(() => {
    const root = document.getElementById('roomChecks');
    if (!root) return;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const state = { data: null, filter: { center: 'problem', internet: 'problem' }, showMatched: {} };
    const LEVEL = { bad: ['ไม่ตรง', 'is-bad'], warn: ['ควรตรวจ', 'is-warn'], info: ['ข้อมูล', 'is-info'] };

    function card(key, c) {
        const issues = c.issues || [];
        const bad = issues.filter(i => i.severity === 'bad').length, warn = issues.filter(i => i.severity === 'warn').length, info = issues.filter(i => i.severity === 'info').length;
        const f = state.filter[key];
        const shown = issues.filter(i => f === 'all' || (f === 'problem' ? i.severity !== 'info' : i.severity === f));
        const allOk = !c.diag && !bad && !warn;
        const head = c.diag
            ? `<p class="ck-state is-bad">⚠ ${esc(c.diag)}</p>`
            : allOk ? `<p class="ck-state is-ok">✅ ตรงกับทะเบียนทั้งหมด — ${num(c.matched.length)} / ${num(c.total)} รายการในไฟล์${info ? ` (มีข้อมูลประกอบ ${num(info)} รายการ)` : ''}</p>`
                : `<p class="ck-state is-warn">⚠ ตรงกับทะเบียน ${num(c.matched.length)} / ${num(c.total)} รายการในไฟล์ · <b>ไม่ตรง ${num(bad)}</b> · ควรตรวจ ${num(warn)}${info ? ` · ข้อมูลประกอบ ${num(info)}` : ''}</p>`;
        const chip = (val, label, n) => `<button type="button" data-ck-filter="${key}:${val}" class="${f === val ? 'is-on' : ''}">${label} <b>${num(n)}</b></button>`;
        return `<article class="ck-card">
            <div class="ck-head"><div><h3>${esc(c.name)}</h3><small>ไฟล์ของส่วนกลาง — ระบบอ่านอย่างเดียว ไม่แก้ไข</small></div><a class="ck-link" href="${esc(c.url)}" target="_blank" rel="noopener">เปิดไฟล์ ↗</a></div>
            ${head}
            ${issues.length ? `<div class="ck-chips">${chip('problem', 'ไม่ตรง + ควรตรวจ', bad + warn)}${chip('bad', 'ไม่ตรง', bad)}${chip('warn', 'ควรตรวจ', warn)}${chip('info', 'ข้อมูลประกอบ', info)}${chip('all', 'ทั้งหมด', issues.length)}</div>
            <div class="ck-wrap"><table class="ck-table"><thead><tr><th>ระดับ</th><th>ประเภท</th><th>ที่พัก / ยูนิต</th><th>ไม่ตรงอย่างไร</th></tr></thead>
            <tbody>${shown.map(i => `<tr><td><span class="ck-pill ${LEVEL[i.severity][1]}">${LEVEL[i.severity][0]}</span></td><td>${esc(i.type)}</td><td><b>${esc(i.project)}</b><small>${esc(i.unit)}${i.no ? ` · ลำดับ ${esc(i.no)}` : ''}</small></td><td>${esc(i.detail)}</td></tr>`).join('') || '<tr><td colspan="4" class="ck-empty">ไม่มีรายการในหมวดนี้</td></tr>'}</tbody></table></div>` : ''}
            ${c.matched.length ? `<button type="button" class="ck-toggle" data-ck-matched="${key}">${state.showMatched[key] ? '▾ ซ่อน' : '▸ ดู'}รายการที่ตรงกัน (${num(c.matched.length)})</button>
            ${state.showMatched[key] ? `<ul class="ck-matched">${c.matched.map(m => `<li>✔ <b>${esc(m.project)}</b> ${esc(m.unit)}</li>`).join('')}</ul>` : ''}` : ''}
        </article>`;
    }
    function render() {
        const d = state.data;
        if (!d || !d.checks) { root.innerHTML = '<p class="ck-empty">กำลังโหลดผลตรวจ…</p>'; return; }
        root.innerHTML = `<div class="ck-intro"><h2>ตรวจสอบกับส่วนกลาง</h2><p>เทียบรายชื่อบ้านและยูนิตในทะเบียนห้องพักกับไฟล์ที่ใช้ประสานงานกับส่วนกลาง ตรงก็แจ้งว่าตรง ไม่ตรงก็บอกว่าไม่ตรงอย่างไร — แก้ที่ไฟล์ต้นทางหรือทะเบียนให้ตรงกัน แล้วกดรีเฟรช</p></div>
            <div class="ck-grid">${card('center', d.checks.center)}${card('internet', d.checks.internet)}</div>`;
    }
    root.addEventListener('click', e => {
        const f = e.target.closest('[data-ck-filter]'); if (f) { const [k, v] = f.dataset.ckFilter.split(':'); state.filter[k] = v; render(); return; }
        const m = e.target.closest('[data-ck-matched]'); if (m) { state.showMatched[m.dataset.ckMatched] = !state.showMatched[m.dataset.ckMatched]; render(); }
    });
    window.addEventListener('ro-data', e => { state.data = e.detail; render(); });
    state.data = window.__roData || null;
    render();
})();
