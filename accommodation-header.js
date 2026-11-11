// หัวหน้า "จัดการห้องพักพนักงาน": ภาพรวมจาก Google Sheet (แท็บ "ข้อมูลที่พัก" + นับพนักงานจาก "ข้อมูลเบื้องต้น")
// ย้ายมาจากหน้า "ภาพรวมที่พัก (Google Sheet)" เดิม — ตัวเลขดึงใหม่เองทุก 30 วินาที
// กล่องพื้นที่ (GE/ML/PP/SL/TH) · กล่องสถานะ · ช่องค้นหา → แสดงรายชื่อที่พักด้านล่างทันที (กดที่พักเพื่อดูรายชื่อพนักงาน)
(() => {
    const REFRESH_MS = 30 * 1000;
    const AREAS = ['GE', 'ML', 'PP', 'SL', 'TH'];
    const state = { data: null, area: null, status: 'all', query: '', open: new Set(), loading: false };
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = value => Number(value || 0).toLocaleString('th-TH');
    const norm = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-sheet${path}`;

    async function request(path, options = {}) {
        const response = await window.authFetch(api(path), { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.message || `โหลดข้อมูลไม่สำเร็จ (${response.status})`);
        return data;
    }

    async function load(force = false) {
        if (state.loading) return;
        state.loading = true;
        $('asRefresh').disabled = true;
        try {
            state.data = await request(force ? '?refresh=1' : '');
            render();
        } catch (error) {
            $('asUpdated').textContent = `โหลดไม่สำเร็จ: ${error.message}`;
        } finally {
            state.loading = false;
            $('asRefresh').disabled = false;
        }
    }

    function render() {
        const data = state.data;
        const totals = data.totals;
        $('asUpdated').textContent = `อัปเดต ${new Date(data.fetchedAt).toLocaleTimeString('th-TH')} · รีเฟรชเองทุก 30 วินาที`;
        $('asStats').innerHTML = [
            ['พนักงาน on work', totals.onWork],
            ['มีที่พักในรายการ', totals.housed],
            ['ยังไม่ระบุที่พัก', totals.noAccommodation, totals.noAccommodation ? 'is-warn' : ''],
            ['ที่พักทั้งหมด', totals.accommodations],
            ['ที่พักที่ยังไม่มีพนักงาน', totals.empty, totals.empty ? 'is-warn' : '']
        ].map(([label, value, cls]) => `<div class="as-stat ${cls || ''}"><strong>${num(value)}</strong><span>${esc(label)}</span></div>`).join('');
        renderCards();
        renderResults();
    }

    // ---------------------------------------------------------------- กล่องพื้นที่ / สถานะ
    const inArea = (item, area) => area === 'all' || (item.area || '').toUpperCase() === area;
    function renderCards() {
        const list = state.data?.accommodations || [];
        const box = (attr, key, label, count, sub, on) => `<button type="button" class="as-fcard ${on ? 'is-on' : ''}" ${attr}="${key}" aria-pressed="${on}"><strong>${num(count)}</strong><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
        $('asAreaCards').innerHTML = ['all', ...AREAS].map(area => {
            const items = list.filter(item => inArea(item, area));
            return box('data-area', area, area === 'all' ? 'ทุกพื้นที่' : area, items.length, `พนักงาน ${num(items.reduce((sum, item) => sum + item.employeeCount, 0))} คน`, state.area === area);
        }).join('');
        const scope = list.filter(item => state.area ? inArea(item, state.area) : true);
        $('asStatusCards').innerHTML = [['all', 'ทั้งหมด', scope.length], ['has', 'มีพนักงาน', scope.filter(item => item.employeeCount).length], ['empty', 'ยังไม่มีพนักงาน', scope.filter(item => !item.employeeCount).length]]
            .map(([key, label, count]) => box('data-status', key, label, count, '', state.status === key)).join('');
    }

    // ---------------------------------------------------------------- รายชื่อที่พักด้านล่าง (ตามพื้นที่ที่กด หรือผลการค้นหา)
    function renderResults() {
        const holder = $('asResults');
        const data = state.data;
        const q = norm(state.query);
        if (!data || (!state.area && !q)) { holder.hidden = true; holder.innerHTML = ''; return; }
        const area = state.area || 'all';
        const person = p => `${p.name} ${p.employeeId} ${p.company}`;
        let rows = data.accommodations.filter(item => inArea(item, area)
            && (state.status === 'all' || (state.status === 'has' ? item.employeeCount : !item.employeeCount)));
        const matchedPeople = new Map();
        if (q) {
            rows = rows.filter(item => {
                const people = item.employees.filter(p => norm(person(p)).includes(q));
                if (people.length) matchedPeople.set(item.sheetRow, people);
                return people.length || norm(`${item.name} ${(item.aliases || []).join(' ')} ${item.area} ${item.note}`).includes(q);
            });
        }
        const noRoom = q ? (data.noAccommodation?.employees || []).filter(p => norm(person(p)).includes(q)) : [];
        const title = state.area ? (state.area === 'all' ? 'ที่พักทุกพื้นที่' : `ที่พักพื้นที่ ${state.area}`) : 'ผลการค้นหา';
        holder.hidden = false;
        holder.innerHTML = `<div class="as-res-head"><b>${esc(title)}${q ? ` · ค้นหา "${esc(state.query)}"` : ''}</b><span>${num(rows.length)} ที่พัก · พนักงาน ${num(rows.reduce((sum, item) => sum + item.employeeCount, 0))} คน</span><button type="button" data-as-close>ปิดรายการ ✕</button></div>
            ${rows.length ? `<div class="as-res-list">${rows.map(item => {
        const open = state.open.has(item.sheetRow) || matchedPeople.has(item.sheetRow);
        const people = open ? item.employees : [];
        return `<div class="as-res-item ${open ? 'is-open' : ''}">
                <button type="button" class="as-res-row" data-as-open="${item.sheetRow}" aria-expanded="${open}">
                    <b>${esc(item.name)}</b>
                    <span class="as-res-tags">${item.area ? `<i>${esc(item.area)}</i>` : ''}${item.floors ? `<i>${esc(item.floors)} ชั้น</i>` : ''}${item.rooms ? `<i>${esc(item.rooms)} ห้อง</i>` : ''}</span>
                    <span class="as-res-count ${item.employeeCount ? '' : 'is-empty'}">${item.employeeCount ? `${num(item.employeeCount)} คน` : 'ยังไม่มีพนักงาน'}</span>
                    <span class="as-res-caret">${open ? '▾' : '▸'}</span>
                </button>
                ${open ? `<ul class="as-res-people">${people.length ? people.map(p => `<li class="${matchedPeople.get(item.sheetRow)?.includes(p) ? 'is-hit' : ''}"><b>${esc(p.name)}</b> <small>${esc(p.employeeId)} · ${esc(p.company)}${p.floor || p.room ? ` · ชั้น ${esc(p.floor || '-')} ห้อง ${esc(p.room || '-')}` : ''}</small></li>`).join('') : '<li class="as-res-none">ยังไม่มีพนักงาน</li>'}</ul>` : ''}
            </div>`;
    }).join('')}</div>` : '<p class="as-res-empty">ไม่พบที่พักตามเงื่อนไข</p>'}
            ${noRoom.length ? `<div class="as-res-noroom"><b>พนักงานที่ยังไม่ระบุที่พัก (${num(noRoom.length)} คน)</b><ul class="as-res-people">${noRoom.slice(0, 50).map(p => `<li class="is-hit"><b>${esc(p.name)}</b> <small>${esc(p.employeeId)} · ${esc(p.company)}</small></li>`).join('')}</ul></div>` : ''}`;
    }

    $('asAreaCards').addEventListener('click', event => {
        const button = event.target.closest('[data-area]'); if (!button) return;
        state.area = state.area === button.dataset.area ? null : button.dataset.area;
        state.open.clear();
        renderCards(); renderResults();
    });
    $('asStatusCards').addEventListener('click', event => {
        const button = event.target.closest('[data-status]'); if (!button) return;
        state.status = button.dataset.status;
        if (!state.area && !state.query) state.area = 'all';
        renderCards(); renderResults();
    });
    $('asResults').addEventListener('click', event => {
        if (event.target.closest('[data-as-close]')) { state.area = null; state.query = ''; $('asSearch').value = ''; renderCards(); renderResults(); return; }
        const row = event.target.closest('[data-as-open]'); if (!row) return;
        const id = Number(row.dataset.asOpen);
        if (state.open.has(id)) state.open.delete(id); else state.open.add(id);
        renderResults();
    });
    let searchTimer = null;
    $('asSearch').addEventListener('input', event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { state.query = event.target.value.trim(); renderResults(); }, 150);
    });
    $('asRefresh').addEventListener('click', () => load(true));

    // ---------------------------------------------------------------- เช่าที่พักใหม่ → เปิดหน้า "ตรวจรับห้องพัก" ในพอร์ทัล
    $('asCreate').addEventListener('click', () => {
        if (window.parent !== window) window.parent.postMessage({ type: 'open-task', serviceId: 'accommodation', route: 'room-inspection' }, window.location.origin);
        else window.location.href = 'room-inspection.html';
    });

    // ---------------------------------------------------------------- เรียลไทม์
    load();
    setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.data && Date.now() - state.data.fetchedAt > REFRESH_MS) load(); });
})();
