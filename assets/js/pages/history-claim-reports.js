// คลังประวัติรายงานเคลมทั้งหมด (สะสม X ฉบับ) — ดูรายการฉบับ, รายชื่อพนักงานในแต่ละฉบับ, เปลี่ยนสถานะฉบับ, ย้อนกลับ (Rollback)
// ปุ่มอยู่ข้างปุ่ม "สร้างรายงาน" · API: /api/history/claim-reports (modules/history-report/report-batches.js)
(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = v => Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
    const API = () => `${window.APP_CONFIG.API_BASE_URL}/api/history/claim-reports`;
    const STATUSES = ['กำลังทำรายงาน', 'ส่งรายงานแล้ว', 'รับเงินคืนครบแล้ว'];
    const CANCELLED = 'ยกเลิก / ย้อนกลับแล้ว';
    const when = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); };
    const creatorName = () => { try { return localStorage.getItem('claimReportCreator') || ''; } catch { return ''; } };   // ผู้ทำรายการ (จำชื่อจากหน้าต่างตัวอย่าง) — เก็บไม่ได้ก็ใช้ต่อได้
    let dialog, button, state = { reports: [], total: 0, open: '', detail: null, busy: false, message: '', changed: null };

    async function call(path = '', method = 'GET', body) {
        const response = await window.authFetch(`${API()}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw Object.assign(new Error(data.message || (response.status === 404 ? 'เครื่องหลังบ้านยังไม่ได้อัปเดต (git pull แล้วรีสตาร์ท)' : 'ทำรายการไม่สำเร็จ')), { changed: data.changed });
        return data;
    }
    const pill = status => `<span class="hcl-pill ${status === CANCELLED ? 'is-cancel' : status === 'รับเงินคืนครบแล้ว' ? 'is-done' : status === 'ส่งรายงานแล้ว' ? 'is-sent' : 'is-work'}">${esc(status)}</span>`;

    async function refresh() {
        try { const data = await call(); state.reports = Array.isArray(data.reports) ? data.reports : []; state.total = Number(data.total) || 0; state.active = Number(data.active) || 0; } catch (error) { state.message = error.message; }
        if (button) button.textContent = `📚 ประวัติรายงานทั้งหมด (สะสม ${state.total.toLocaleString('th-TH')} ฉบับ)`;
        if (dialog?.open) render();
    }
    function detailHtml(r) {
        const cancelled = r.status === CANCELLED, received = r.status === 'รับเงินคืนครบแล้ว';
        return `<div class="hcl-detail"><div class="hcl-detail-top"><div class="hcl-controls">
                <label>สถานะฉบับ <select data-status="${esc(r.reportNo)}" ${cancelled ? 'disabled' : ''}>${(cancelled ? [CANCELLED] : STATUSES).map(s => `<option ${s === r.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
                <button type="button" class="hcl-rollback" data-rollback="${esc(r.reportNo)}" ${cancelled || received ? 'disabled' : ''} title="${cancelled ? 'ฉบับนี้ย้อนกลับไปแล้ว' : received ? 'รับเงินคืนครบแล้ว — เปลี่ยนสถานะฉบับกลับก่อนจึงย้อนได้' : 'คืนเคสทั้งหมดกลับเป็น “รอนำส่งเอกสารเคลม”'}">↩ ย้อนกลับสถานะ (Rollback)</button></div>
                <small>สร้างโดย ${esc(r.creator)} · ${when(r.createdAt)} · ${esc(r.company)} ${esc(r.area)}</small></div>
            ${state.changed ? `<div class="hcl-warn"><b>เคสเหล่านี้ถูกเปลี่ยนสถานะหลังออกรายงานแล้ว:</b> ${state.changed.map(c => `#${esc(c.caseKey)} (${esc(c.status)})`).join(', ')}
                <button type="button" data-force="${esc(r.reportNo)}">ย้อนกลับเฉพาะเคสที่ยังไม่เปลี่ยน</button></div>` : ''}
            <div class="hcl-table"><table><thead><tr><th>เคส</th><th>พนักงาน</th><th>วันที่</th><th>อาการ</th><th class="n">ยอด</th></tr></thead><tbody>
                ${(r.cases || []).map(c => `<tr><td>#${esc(c.caseKey)}</td><td>${esc(c.name)}<small>${esc(c.insuranceId)} · ${esc(c.team)}</small></td><td>${esc(c.date)}</td><td>${esc(c.symptom)}</td><td class="n">${money((c.opd || 0) + (c.ipd || 0) + (c.dental || 0))}</td></tr>`).join('')}
            </tbody></table></div>
            ${r.log ? `<details class="hcl-log"><summary>ประวัติการเปลี่ยนแปลง (Audit Log)</summary><pre>${esc(r.log)}</pre></details>` : ''}</div>`;
    }
    function render() {
        dialog.querySelector('.hcl-body').innerHTML = `${state.message ? `<p class="hcl-msg" role="status">${esc(state.message)}</p>` : ''}
            ${state.reports.length ? `<ul class="hcl-list">${state.reports.map(r => `<li class="${r.reportNo === state.open ? 'is-open' : ''}">
                <button type="button" class="hcl-row" data-open="${esc(r.reportNo)}" aria-expanded="${r.reportNo === state.open}">
                    <b class="hcl-no">${esc(r.reportNo)}</b><span>${when(r.createdAt)}</span><span>${esc(r.creator)}</span><span>${r.caseCount} เคส</span><span class="n">${money(r.total)} บาท</span>${pill(r.status)}</button>
                ${r.reportNo === state.open && state.detail ? detailHtml(state.detail) : r.reportNo === state.open ? '<p class="hcl-msg">กำลังโหลดรายชื่อพนักงาน…</p>' : ''}</li>`).join('')}</ul>`
            : '<p class="hcl-empty">ยังไม่มีรายงานที่เคยสร้าง — เมื่อกด “ยืนยันสร้างรายงาน” ฉบับจะมาอยู่ที่นี่</p>'}`;
        dialog.querySelector('.hcl-count').textContent = `สะสม ${state.total.toLocaleString('th-TH')} ฉบับ · ใช้งานอยู่ ${(state.active ?? 0).toLocaleString('th-TH')} ฉบับ`;
    }
    async function openReport(no) {
        state.open = state.open === no ? '' : no; state.detail = null; state.changed = null; state.message = ''; render();
        if (!state.open) return;
        try { state.detail = (await call(`/${encodeURIComponent(no)}`)).report; } catch (error) { state.message = error.message; }
        render();
    }
    async function act(task, done) {
        if (state.busy) return; state.busy = true; state.message = ''; render();
        try { await task(); state.message = done; state.changed = null; } catch (error) { state.message = error.message; state.changed = error.changed || null; }
        state.busy = false; await refresh();
        if (state.open) { try { state.detail = (await call(`/${encodeURIComponent(state.open)}`)).report; } catch { /* คงรายการเดิม */ } render(); }
        if (typeof loadFilteredAllHistory === 'function') loadFilteredAllHistory().catch(() => {});   // สถานะ/ป้ายฉบับในตารางตามล่าสุด
    }
    function build() {
        dialog = Object.assign(document.createElement('dialog'), { className: 'hcl' });
        dialog.innerHTML = `<div class="hcl-shell"><header class="hcl-head"><div><h3>📚 ประวัติรายงานเคลมทั้งหมด</h3><p class="hcl-count"></p></div><button type="button" class="hcl-x" data-close aria-label="ปิด">×</button></header><div class="hcl-body"></div></div>`;
        document.body.appendChild(dialog);
        dialog.addEventListener('click', event => {
            if (event.target === dialog || event.target.closest('[data-close]')) return dialog.close();
            const open = event.target.closest('[data-open]'); if (open) return openReport(open.dataset.open);
            const rb = event.target.closest('[data-rollback]');
            if (rb && !rb.disabled) {
                const no = rb.dataset.rollback;
                if (!confirm(`ย้อนกลับสถานะฉบับ ${no}?\n\n• เคสทั้งหมดในฉบับนี้จะกลับเป็น “ผู้ป่วยสำรองจ่าย รอนำส่งเอกสารเคลม”\n• ล้างเลขที่ฉบับออกจากเคส เพื่อนำไปทำรายงานใหม่ได้\n• ฉบับนี้จะถูกเก็บเป็น “ยกเลิก / ย้อนกลับแล้ว”`)) return;
                return act(async () => { const r = await call(`/${encodeURIComponent(no)}/rollback`, 'POST', { by: creatorName() }); state.message = ''; return r; }, `ย้อนกลับ ${no} แล้ว — เคสกลับไปรอนำส่งเอกสารเคลม`);
            }
            const force = event.target.closest('[data-force]');
            if (force) return act(() => call(`/${encodeURIComponent(force.dataset.force)}/rollback`, 'POST', { force: true }), `ย้อนกลับ ${force.dataset.force} เฉพาะเคสที่ยังไม่เปลี่ยนสถานะแล้ว`);
        });
        dialog.addEventListener('change', event => {
            const select = event.target.closest('[data-status]');
            if (select) act(() => call(`/${encodeURIComponent(select.dataset.status)}/status`, 'PATCH', { status: select.value, by: creatorName() }), `เปลี่ยนสถานะ ${select.dataset.status} เป็น “${select.value}” แล้ว`);
        });
    }
    function openDialog() { if (!dialog) build(); state.message = ''; render(); dialog.showModal(); refresh(); }
    function mount() {
        const main = document.getElementById('createHistoryReportButton');
        if (!main || document.getElementById('openClaimReportsButton')) return;
        button = Object.assign(document.createElement('button'), { id: 'openClaimReportsButton', type: 'button', className: main.className, textContent: '📚 ประวัติรายงานทั้งหมด' });
        button.hidden = typeof window.hasPermission === 'function' && !window.hasPermission('ExportHistoryReport');   // สิทธิ์เดียวกับปุ่มสร้างรายงาน
        main.after(button);
        button.addEventListener('click', openDialog);
        refresh();
    }
    window.refreshClaimReports = refresh;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
