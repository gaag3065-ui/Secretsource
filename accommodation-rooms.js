// ภาพรวมห้องพักทั้งหมดจากทะเบียนห้องพัก (อัปเดตตลอด) + จำนวนพนักงานที่พักอยู่ — /api/accommodation-rooms
// แยก 3 กลุ่ม: ห้องที่มีอยู่แล้ว (มีพนักงาน / ไม่มีพนักงาน) · ห้องที่กำลังอยู่ในกระบวนการ · รวมทั้งหมด
(() => {
    const root = document.getElementById('roomOverview');
    if (!root) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = v => Number(v || 0).toLocaleString('th-TH');
    const state = { data: null, filter: 'all', query: '' };

    async function load(refresh = false) {
        root.querySelector('.ro-body').innerHTML = '<p class="ro-empty">กำลังโหลดทะเบียนห้องพัก…</p>';
        try {
            const response = await window.authFetch(`${API}/overview${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
            const data = await response.json().catch(() => ({}));
            if (response.status === 404 && !data.message) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)');
            if (!response.ok || !data.success) throw new Error(data.message || 'โหลดไม่สำเร็จ');
            state.data = data;
            render();
        } catch (error) {
            root.querySelector('.ro-body').innerHTML = `<p class="ro-empty ro-error">${esc(error.message)}</p>`;
        }
    }

    function render() {
        const { counts: c, rooms, issues, unmatched, at, masterUrl } = state.data;
        const statuses = Object.entries(c.processByStatus || {}).map(([s, n]) => `<span>${esc(s)} <b>${num(n)}</b></span>`).join('');
        const q = state.query.toLowerCase();
        const list = rooms.filter(r => (state.filter === 'all' || (state.filter === 'process' ? r.group === 'กำลังดำเนินการ' : r.group === state.filter))
            && (!q || `${r.project} ${r.unit} ${r.status} ${r.agent} ${r.companies.join(' ')}`.toLowerCase().includes(q)));
        const chip = (key, label, n) => `<button type="button" data-ro-filter="${key}" class="${state.filter === key ? 'is-on' : ''}">${label} <b>${num(n)}</b></button>`;
        root.querySelector('.ro-updated').textContent = `อัปเดต ${new Date(at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`;
        root.querySelector('.ro-master').hidden = !masterUrl;
        if (masterUrl) root.querySelector('.ro-master').href = masterUrl;
        root.querySelector('.ro-body').innerHTML = `
            <div class="ro-cards">
                <article class="ro-card ro-existing">
                    <small>ห้องที่มีอยู่แล้ว (ทำสัญญาแล้ว)</small><strong>${num(c.existing)}</strong>
                    <div class="ro-split"><span>มีพนักงาน <b>${num(c.existingOccupied)}</b></span><span>ไม่มีพนักงาน <b>${num(c.existingEmpty)}</b></span></div>
                </article>
                <article class="ro-card ro-process">
                    <small>ห้องที่กำลังอยู่ในกระบวนการ</small><strong>${num(c.process)}</strong>
                    <div class="ro-split">${statuses || '<span>-</span>'}</div>
                </article>
                <article class="ro-card ro-total">
                    <small>รวมห้องทั้งหมด</small><strong>${num(c.total)}</strong>
                    <div class="ro-split"><span>พนักงาน on work <b>${num(c.employeesOnWork)}</b></span><span>จับคู่ห้องได้ <b>${num(c.employeesMatched)}</b></span></div>
                </article>
            </div>
            <div class="ro-check ${c.issues || c.employeesUnmatched ? 'has-issue' : ''}">
                <b>${c.issues || c.employeesUnmatched ? '⚠️ ตรวจสอบความถูกต้องของข้อมูล' : '✅ ตรวจสอบความถูกต้องของข้อมูล: ไม่พบจุดผิดปกติ'}</b>
                <span>จุดที่ต้องตรวจในทะเบียน ${num(c.issues)} · พนักงานที่จับคู่ห้องไม่ได้ ${num(c.employeesUnmatched)} · ยังไม่มีที่พัก ${num(c.employeesWithoutRoom)}</span>
                ${issues.length || unmatched.length ? '<button type="button" data-ro-toggle-check>ดูรายละเอียด</button>' : ''}
                <div class="ro-check-list" hidden>
                    ${issues.length ? `<h4>ทะเบียนห้องพัก</h4><ul>${issues.map(i => `<li><b>${esc(i.type)}</b> — ลำดับ ${esc(i.no)} ${esc(i.project)} ${esc(i.unit)} ${esc(i.detail)}</li>`).join('')}</ul>` : ''}
                    ${unmatched.length ? `<h4>พนักงานที่จับคู่ห้องในทะเบียนไม่ได้ (แท็บข้อมูลเบื้องต้น)</h4><ul>${unmatched.map(e => `<li>แถว ${esc(e.row)} · ${esc(e.company)} · ${esc(e.building)} ${esc(e.floor)} ${esc(e.room)} — ${esc(e.reason)}</li>`).join('')}</ul>` : ''}
                </div>
            </div>
            <div class="ro-toolbar">
                <div class="ro-chips">${chip('all', 'ทั้งหมด', c.total)}${chip('มีพนักงาน', 'มีพนักงาน', c.existingOccupied)}${chip('ไม่มีพนักงาน', 'ไม่มีพนักงาน', c.existingEmpty)}${chip('process', 'กำลังดำเนินการ', c.process)}</div>
                <input type="search" data-ro-search placeholder="ค้นหาที่พัก ยูนิต สถานะ…" value="${esc(state.query)}">
            </div>
            <div class="ro-table-wrap"><table class="ro-table">
                <thead><tr><th>#</th><th>ที่พัก / ยูนิต</th><th>สถานะ</th><th>พนักงาน</th><th>ประเภทห้อง</th><th>ค่าเช่า/เดือน</th><th>สัญญา</th><th>ผู้จัดหา</th></tr></thead>
                <tbody>${list.map(r => `<tr>
                    <td>${esc(r.no)}</td>
                    <td><b>${esc(r.project)}</b><small>${esc(r.unit)}</small></td>
                    <td><span class="ro-pill ${r.group === 'มีพนักงาน' ? 'is-ok' : r.group === 'ไม่มีพนักงาน' ? 'is-empty' : 'is-process'}">${esc(r.group === 'กำลังดำเนินการ' ? r.status : r.group)}</span></td>
                    <td>${r.employees ? `${num(r.employees)} คน<small>${esc(r.companies.join(', '))}</small>` : '-'}</td>
                    <td>${esc(r.type || '-')}</td>
                    <td>${r.rent ? num(r.rent) : '-'}</td>
                    <td>${r.start || r.end ? `${esc(r.start)} – ${esc(r.end)}<small>${esc(r.remaining)}</small>` : '-'}</td>
                    <td>${esc(r.agent || '-')}</td></tr>`).join('') || '<tr><td colspan="8" class="ro-empty">ไม่พบห้องตามเงื่อนไข</td></tr>'}</tbody>
            </table></div>`;
    }

    root.addEventListener('click', async event => {
        const filter = event.target.closest('[data-ro-filter]');
        if (filter) { state.filter = filter.dataset.roFilter; render(); return; }
        if (event.target.closest('[data-ro-toggle-check]')) { const list = root.querySelector('.ro-check-list'); list.hidden = !list.hidden; return; }
        if (event.target.closest('[data-ro-refresh]')) { load(true); return; }
        const sync = event.target.closest('[data-ro-sync]');
        if (sync) {
            sync.disabled = true; sync.textContent = 'กำลังอัปเดต…';
            try {
                const response = await window.authFetch(`${API}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data.success) throw new Error(data.message || 'อัปเดตไม่สำเร็จ');
                await load(true);
            } catch (error) { alert(error.message); }
            finally { sync.disabled = false; sync.textContent = 'อัปเดตไฟล์หลักตอนนี้'; }
        }
    });
    root.addEventListener('input', event => {
        if (!event.target.matches('[data-ro-search]')) return;
        state.query = event.target.value;
        const pos = event.target.selectionStart;
        render();
        const input = root.querySelector('[data-ro-search]'); input.focus(); input.setSelectionRange(pos, pos);
    });
    load();
})();
