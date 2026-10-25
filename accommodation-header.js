// หัวหน้า "จัดการห้องพักพนักงาน": ภาพรวมจาก Google Sheet (แท็บ "ข้อมูลที่พัก" + นับพนักงานจาก "ข้อมูลเบื้องต้น")
// ย้ายมาจากหน้า "ภาพรวมที่พัก (Google Sheet)" เดิม — ตัวเลขดึงใหม่เองทุก 30 วินาที
// ชิปพื้นที่/สถานะ และช่องค้นหา ใช้กรองการ์ดตึกด้านล่าง (accommodation.js → applyAccommodationHeaderFilter)
(() => {
    const REFRESH_MS = 30 * 1000;
    const AREAS = ['GE', 'ML', 'PP', 'SL', 'TH'];
    const state = { data: null, area: 'all', loading: false };
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const api = path => `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-sheet${path}`;
    const applyFilter = filter => window.applyAccommodationHeaderFilter?.(filter);

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
        } finally {
            state.loading = false;
            $('asRefresh').disabled = false;
        }
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
    }

    function renderAreaChips() {
        $('asAreaChips').innerHTML = ['all', ...AREAS].map(area => `<button type="button" data-area="${area}" class="${state.area === area ? 'is-on' : ''}">${area === 'all' ? 'ทุกพื้นที่' : area}</button>`).join('');
    }

    // ---------------------------------------------------------------- ตัวกรองการ์ดตึก
    $('asAreaChips').addEventListener('click', event => {
        const button = event.target.closest('[data-area]'); if (!button) return;
        state.area = button.dataset.area;
        renderAreaChips();
        applyFilter({ area: state.area });
    });
    $('asStatusChips').addEventListener('click', event => {
        const button = event.target.closest('[data-status]'); if (!button) return;
        $('asStatusChips').querySelectorAll('button').forEach(node => node.classList.toggle('is-on', node === button));
        applyFilter({ status: button.dataset.status });
    });
    let searchTimer = null;
    $('asSearch').addEventListener('input', event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => applyFilter({ search: event.target.value.trim() }), 150);
    });
    $('asRefresh').addEventListener('click', () => load(true));

    // ---------------------------------------------------------------- สร้างที่พักใหม่ (บันทึกลงแท็บ "ข้อมูลที่พัก")
    function openDialog() {
        const form = $('asForm');
        form.reset();
        $('asFormError').hidden = true;
        $('asDialog').showModal();
        form.elements.area.focus();
    }
    $('asCreate').addEventListener('click', openDialog);
    $('asCancel').addEventListener('click', () => $('asDialog').close());
    $('asForm').addEventListener('submit', async event => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.target).entries());
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
    renderAreaChips();
    load();
    setInterval(() => { if (!document.hidden && !$('asDialog').open) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.data && Date.now() - state.data.fetchedAt > REFRESH_MS) load(); });
})();
