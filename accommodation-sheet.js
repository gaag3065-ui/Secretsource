// ภาพรวมที่พักจาก Google Sheet (แท็บ "ข้อมูลที่พัก" + นับพนักงานจาก "ข้อมูลเบื้องต้น")
// ดึงใหม่เองทุก 30 วินาทีขณะเปิดหน้านี้อยู่ — ไม่ต้องกดซิงก์
(() => {
    const REFRESH_MS = 30 * 1000;
    const AREAS = ['GE', 'ML', 'PP', 'SL', 'TH'];
    const state = { data: null, area: 'all', status: 'all', search: '', openRows: new Set(), loading: false };
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const lower = value => String(value ?? '').normalize('NFKC').toLowerCase();
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-sheet${path}`;

    async function request(path, options = {}) {
        const response = await window.authFetch(api(path), { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.message || `โหลดข้อมูลไม่สำเร็จ (${response.status})`);
        return data;
    }

    let toastTimer = null;
    function toast(text, isError = false) {
        const node = $('asToast');
        node.textContent = text;
        node.className = `as-toast is-visible${isError ? ' is-error' : ''}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { node.className = 'as-toast'; }, 4500);
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
            if (!state.data) $('asList').innerHTML = `<p class="as-empty">${esc(error.message)}</p>`;
        } finally {
            state.loading = false;
            $('asRefresh').disabled = false;
        }
    }

    function matchesFilters(item) {
        if (state.area !== 'all' && item.area !== state.area && !item.byArea[state.area]) return false;
        if (state.status === 'has' && !item.employeeCount) return false;
        if (state.status === 'empty' && item.employeeCount) return false;
        if (!state.search) return true;
        const query = lower(state.search);
        return [item.name, item.id, ...item.aliases].some(text => lower(text).includes(query))
            || item.employees.some(person => lower(person.name).includes(query) || lower(person.employeeId).includes(query));
    }

    function render() {
        const data = state.data;
        const totals = data.totals;
        $('asUpdated').textContent = `อัปเดต ${new Date(data.fetchedAt).toLocaleTimeString('th-TH')} · รีเฟรชเองทุก 30 วินาที`;
        if (data.sheetUrl) { $('asSheetLink').href = data.sheetUrl; $('asSheetLink').hidden = false; }

        $('asStats').innerHTML = [
            ['พนักงาน on work', totals.onWork],
            ['มีที่พักในรายการ', totals.housed],
            ['ยังไม่ระบุที่พัก', totals.noAccommodation, totals.noAccommodation ? 'is-warn' : ''],
            ['ที่พักทั้งหมด', totals.accommodations],
            ['ที่พักที่ยังไม่มีพนักงาน', totals.empty, totals.empty ? 'is-warn' : '']
        ].map(([label, value, cls]) => `<div class="as-stat ${cls || ''}"><strong>${Number(value).toLocaleString('th-TH')}</strong><span>${esc(label)}</span></div>`).join('');

        $('asAreaChips').innerHTML = ['all', ...AREAS].map(area => `<button type="button" data-area="${area}" class="${state.area === area ? 'is-on' : ''}">${area === 'all' ? 'ทุกพื้นที่' : area}</button>`).join('');

        const list = data.accommodations.filter(matchesFilters).sort((a, b) => (b.employeeCount - a.employeeCount) || a.area.localeCompare(b.area) || a.name.localeCompare(b.name, 'th'));
        $('asListCount').textContent = `${list.length} จาก ${data.accommodations.length} ที่พัก`;
        $('asList').innerHTML = list.length ? list.map(itemHtml).join('') : '<p class="as-empty">ไม่พบที่พักตามเงื่อนไข</p>';

        const unmatched = data.unmatched;
        $('asUnmatchedCard').hidden = !unmatched.length;
        $('asUnmatchedCount').textContent = `${unmatched.length} ชื่อ · ${totals.unmatched} คน`;
        const options = data.accommodations.slice().sort((a, b) => a.name.localeCompare(b.name, 'th')).map(item => `<option value="${item.sheetRow}">${esc(item.name)} (${esc(item.area)})</option>`).join('');
        $('asUnmatched').innerHTML = unmatched.map((group, index) => `<div class="as-unmatched-row">
                <div><strong>${esc(group.rawName)}</strong><div class="as-meta">${areaTags(group.byArea)}</div></div>
                <span class="as-count">${group.count}<small>คน</small></span>
                <div class="as-merge">
                    <select data-merge-select="${index}"><option value="">รวมกับที่พัก...</option>${options}</select>
                    <button type="button" class="as-btn as-btn-ghost as-btn-sm" data-merge="${index}">รวม</button>
                    <button type="button" class="as-btn as-btn-ghost as-btn-sm" data-create-from="${index}">สร้างเป็นที่พักใหม่</button>
                </div>
            </div>`).join('');

        const noAcc = data.noAccommodation;
        $('asNoAccCount').textContent = `${noAcc.count.toLocaleString('th-TH')} คน`;
        $('asNoAcc').innerHTML = `<div class="as-noacc-areas">${areaTags(noAcc.byArea)}</div>${peopleTable(noAcc.employees, true)}`;
    }

    const areaTags = byArea => Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([area, count]) => `<span class="as-tag is-area">${esc(area === '-' ? 'ไม่ระบุพื้นที่' : area)} ${count}</span>`).join('');

    function peopleTable(people, withArea = false) {
        if (!people.length) return '<p class="as-hint">ไม่มีพนักงาน</p>';
        const rows = people.slice().sort((a, b) => String(a.floor).localeCompare(String(b.floor), 'th', { numeric: true }) || String(a.room).localeCompare(String(b.room), 'th', { numeric: true }) || a.name.localeCompare(b.name, 'th'));
        return `<table><thead><tr><th>ชื่อ</th><th>รหัส</th><th>บริษัท</th>${withArea ? '<th>พื้นที่</th>' : '<th>ชั้น/ห้อง</th>'}</tr></thead><tbody>${rows.map(person => `<tr><td>${esc(person.name)}</td><td>${esc(person.employeeId)}</td><td>${esc(person.company)}</td>${withArea ? `<td>${esc(person.area || '-')}</td>` : `<td>${esc([person.floor, person.room].filter(value => value && value !== '-').join(' / ') || '-')}</td>`}</tr>`).join('')}</tbody></table>`;
    }

    function itemHtml(item) {
        const size = [item.floors && `${item.floors} ชั้น`, item.rooms && `${item.rooms} ห้อง`].filter(Boolean).join(' · ');
        const empty = !item.employeeCount;
        return `<article class="as-item${empty ? ' is-empty' : ''}">
            <div class="as-item-head">
                <div class="as-item-title"><strong>${esc(item.name)}</strong><small>${esc(item.id)}${item.aliases.length ? ` · ชื่อเรียกอื่น: ${esc(item.aliases.join(', '))}` : ''}</small></div>
                <span class="as-count">${item.employeeCount}<small>คน</small></span>
            </div>
            <div class="as-meta"><span class="as-tag">${esc(item.area || '-')}</span>${size ? `<span>${esc(size)}</span>` : ''}${empty ? '<span class="as-tag is-empty">ยังไม่มีพนักงาน</span>' : areaTags(item.byArea)}${item.note ? `<span>${esc(item.note)}</span>` : ''}</div>
            ${empty ? '' : `<details class="as-people" data-row="${item.sheetRow}" ${state.openRows.has(item.sheetRow) ? 'open' : ''}><summary>ดูรายชื่อพนักงาน</summary>${peopleTable(item.employees)}</details>`}
        </article>`;
    }

    // ---------------------------------------------------------------- events
    $('asAreaChips').addEventListener('click', event => { const button = event.target.closest('[data-area]'); if (!button) return; state.area = button.dataset.area; render(); });
    $('asStatusChips').addEventListener('click', event => {
        const button = event.target.closest('[data-status]'); if (!button) return;
        state.status = button.dataset.status;
        $('asStatusChips').querySelectorAll('button').forEach(node => node.classList.toggle('is-on', node === button));
        if (state.data) render();
    });
    let searchTimer = null;
    $('asSearch').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.search = event.target.value.trim(); if (state.data) render(); }, 150); });
    $('asList').addEventListener('toggle', event => { const node = event.target.closest('[data-row]'); if (!node) return; const row = Number(node.dataset.row); node.open ? state.openRows.add(row) : state.openRows.delete(row); }, true);
    $('asRefresh').addEventListener('click', () => load(true));

    $('asUnmatched').addEventListener('click', async event => {
        const merge = event.target.closest('[data-merge]');
        const createFrom = event.target.closest('[data-create-from]');
        if (merge) {
            const group = state.data.unmatched[Number(merge.dataset.merge)];
            const select = document.querySelector(`[data-merge-select="${merge.dataset.merge}"]`);
            if (!select.value) return toast('เลือกที่พักที่จะรวมก่อน', true);
            const target = state.data.accommodations.find(item => String(item.sheetRow) === select.value);
            if (!confirm(`รวม "${group.rawName}" (${group.count} คน) เข้ากับที่พัก "${target.name}"?\nระบบจะเพิ่มเป็นชื่อเรียกอื่นในแท็บข้อมูลที่พัก (ไม่แก้ข้อมูลพนักงาน)`)) return;
            merge.disabled = true;
            try {
                await request(`/${select.value}/aliases`, { method: 'POST', body: JSON.stringify({ alias: group.rawName }) });
                toast(`รวม "${group.rawName}" เข้ากับ "${target.name}" แล้ว`);
                await load(true);
            } catch (error) { toast(error.message, true); merge.disabled = false; }
        } else if (createFrom) {
            const group = state.data.unmatched[Number(createFrom.dataset.createFrom)];
            const area = Object.entries(group.byArea).sort((a, b) => b[1] - a[1])[0]?.[0];
            openDialog({ name: group.rawName, area: AREAS.includes(area) ? area : '' });
        }
    });

    function openDialog(values = {}) {
        const form = $('asForm');
        form.reset();
        $('asFormError').hidden = true;
        for (const [key, value] of Object.entries(values)) if (form.elements[key]) form.elements[key].value = value;
        $('asDialog').showModal();
        form.elements[values.name ? 'floors' : 'area'].focus();
    }
    $('asCreate').addEventListener('click', () => openDialog());
    $('asCancel').addEventListener('click', () => $('asDialog').close());
    $('asForm').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.target;
        const body = Object.fromEntries(new FormData(form).entries());
        $('asSave').disabled = true;
        $('asFormError').hidden = true;
        try {
            const result = await request('', { method: 'POST', body: JSON.stringify(body) });
            $('asDialog').close();
            toast(`สร้างที่พัก ${result.accommodation.id} "${result.accommodation.name}" ใน Google Sheet แล้ว`);
            await load(true);
        } catch (error) {
            $('asFormError').textContent = error.message;
            $('asFormError').hidden = false;
        } finally { $('asSave').disabled = false; }
    });

    // ---------------------------------------------------------------- เรียลไทม์
    load();
    setInterval(() => { if (!document.hidden && !$('asDialog').open) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.data && Date.now() - state.data.fetchedAt > REFRESH_MS) load(); });
})();
