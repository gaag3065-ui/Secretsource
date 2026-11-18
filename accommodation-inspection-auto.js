// รวมรูปตรวจห้องเป็น PDF อัตโนมัติ: สแกนโฟลเดอร์ "งานตรวจบ้าน" → จับคู่บ้านกับห้องในทะเบียน → ใช้ PDF ที่มีอยู่ หรือสร้างจากรูป → เก็บในระบบ (ขั้น "ตรวจสอบ") + เปิดลิงก์ให้ HR
(() => {
    const actions = document.querySelector('.as-actions');
    if (!actions) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms/inspection-auto`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const state = { data: null, msg: '', bad: false, timer: null, busy: false };
    document.head.insertAdjacentHTML('beforeend', `<style>
        .ia-dialog { width: min(1180px, 98vw); max-height: 96dvh; border: 0; border-radius: 16px; padding: 0; box-shadow: 0 24px 70px rgba(16,24,40,.3); }
        .ia-dialog::backdrop { background: rgba(16,24,40,.55); }
        .ia-wrap { display: grid; gap: 10px; padding: 16px 18px; max-height: 96dvh; overflow: auto; font-size: 13.5px; }
        .ia-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; } .ia-top h2 { margin: 0; font-size: 19px; }
        .ia-note { color: #475467; font-size: 12.5px; } .ia-msg { min-height: 18px; color: #087f74; } .ia-msg.bad { color: #b42318; font-weight: 700; }
        .ia-table { width: 100%; border-collapse: collapse; font-size: 12.5px; } .ia-table th { background: #f1f5f6; position: sticky; top: 0; padding: 7px; border: 1px solid #e1e7ea; text-align: left; }
        .ia-table td { border: 1px solid #e1e7ea; padding: 6px 7px; vertical-align: top; } .ia-table select { max-width: 240px; font: inherit; font-size: 12px; }
        .ia-pill { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
        .ia-ready { background: #fef0c7; color: #93370d; } .ia-done { background: #d1fadf; color: #067647; } .ia-changed { background: #dbeafe; color: #1d4ed8; } .ia-unmatched { background: #fee4e2; color: #b42318; } .ia-empty { background: #f2f4f7; color: #667085; }
        .ia-btn { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; } .ia-btn.primary { background: #087f74; color: #fff; border-color: #087f74; } .ia-btn:disabled { opacity: .45; cursor: not-allowed; }
        .ia-bar { height: 8px; background: #e4e7ec; border-radius: 999px; overflow: hidden; } .ia-bar i { display: block; height: 100%; background: #087f74; }
        .ia-warn { background: #fff4e5; border: 1px solid #f5c26b; border-radius: 10px; padding: 8px 10px; font-size: 12.5px; }
    </style>`);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'as-btn as-btn-ghost'; button.textContent = 'รวมรูปตรวจห้องเป็น PDF (อัตโนมัติ)';
    actions.prepend(button);
    const dialog = document.createElement('dialog'); dialog.className = 'ia-dialog'; document.body.append(dialog);

    async function request(path, options) {
        const response = await window.authFetch(API + path, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ (ต้องมีสิทธิ์ "ติดตามขั้นตอนที่พักใหม่ (Flow chart)")');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    const rooms = () => (window.__roData?.rooms || []).map(r => ({ no: r.no, label: `${r.no}. ${r.project} ${r.unit}` }));
    const LABEL = { ready: 'พร้อมทำ', done: 'เสร็จแล้ว', changed: 'มีไฟล์ใหม่', unmatched: 'ยังไม่จับคู่ห้อง', empty: 'ไม่มีรูป/PDF' };
    function render() {
        const d = state.data, job = d.job || {}, houses = d.last?.houses || [];
        const todo = houses.filter(h => h.no && (h.status === 'ready' || h.status === 'changed')).length;
        const pct = job.total ? Math.round(job.index / job.total * 100) : 0;
        const opts = rooms().map(r => `<option value="${r.no}">${esc(r.label)}</option>`).join('');
        dialog.innerHTML = `<div class="ia-wrap"><div class="ia-top"><h2>รวมรูปตรวจห้องเป็น PDF อัตโนมัติ</h2><button type="button" class="ia-btn" data-ia-close>ปิด</button></div>
            <div class="ia-note">อ่านโฟลเดอร์ "งานตรวจบ้าน" ใน Drive · บ้านที่มี PDF รายงานรูปภาพอยู่แล้ว → คัดลอกไปเก็บ · บ้านที่มีแต่รูป → ย่อรูป เรียงตามเวลาถ่าย ใส่คำอธิบาย แล้วสร้าง PDF รูปแบบเดียวกัน · เก็บที่ขั้น "ตรวจสอบ" ของห้อง และ${d.public ? 'เปิดสิทธิ์ดูแบบ "ผู้มีลิงก์" ให้ HR' : 'ไม่เปิดสาธารณะ (HR ดูผ่านหน้าล็อกอิน)'}</div>
            <div class="ia-warn">คำอธิบายใต้รูป: ${d.ai ? 'ใช้ AI (Claude) ดูรูปย่อของบ้านนั้นเขียนให้ — รูปห้องถูกส่งไปบริการภายนอก' : 'ยังไม่ได้ตั้ง ANTHROPIC_API_KEY → ใช้ "รูปที่ 1, 2, 3…" แทน (ไม่ส่งรูปออกนอกระบบ)'}</div>
            ${job.running ? `<div><b>กำลังทำ ${esc(job.index)}/${esc(job.total)}: ${esc(job.current)}</b><div class="ia-bar"><i style="width:${pct}%"></i></div></div>` : ''}
            ${(job.results || []).length && !job.running ? `<div class="ia-note">ผลรอบล่าสุด: สำเร็จ ${job.results.filter(r => r.ok).length} · ไม่สำเร็จ ${job.results.filter(r => !r.ok).length}${job.results.filter(r => !r.ok).map(r => `<br>⚠ ${esc(r.name)}: ${esc(r.error)}`).join('')}</div>` : ''}
            <div><button type="button" class="ia-btn" data-ia-scan ${state.busy || job.running ? 'disabled' : ''}>สแกนโฟลเดอร์</button>
                <button type="button" class="ia-btn primary" data-ia-run ${todo && !state.busy && !job.running ? '' : 'disabled'}>ทำทุกบ้านที่พร้อม (${todo})</button>
                <span class="ia-note">${d.last ? 'สแกนล่าสุด ' + new Date(d.last.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : 'ยังไม่เคยสแกน'}</span></div>
            <p class="ia-msg ${state.bad ? 'bad' : ''}" role="status">${esc(state.msg)}</p>
            <div style="overflow:auto;max-height:56dvh"><table class="ia-table"><thead><tr><th>บ้าน (โฟลเดอร์)</th><th>ห้องในทะเบียน</th><th>PDF</th><th>รูป</th><th>วิดีโอ</th><th>สถานะ</th><th></th></tr></thead><tbody>${houses.map(h => `<tr data-fid="${esc(h.folderId)}">
                <td><b>${esc(h.name)}</b></td>
                <td><select data-ia-map><option value="">— เลือกห้อง —</option>${opts.replace(`value="${h.no}"`, `value="${h.no}" selected`)}</select></td>
                <td>${esc(h.pdfs)}</td><td>${esc(h.images)}</td><td>${esc(h.videos)}</td>
                <td><span class="ia-pill ia-${esc(h.status)}">${esc(LABEL[h.status] || h.status)}</span>${h.done?.url ? ` <a href="${esc(h.done.url)}" target="_blank" rel="noopener">เปิด PDF</a>` : ''}${h.done ? `<br><small>${esc(h.done.source === 'adopted' ? 'ใช้ PDF เดิม' : h.done.source === 'built-ai' ? 'สร้างจากรูป + AI' : 'สร้างจากรูป')}</small>` : ''}</td>
                <td>${h.no && !job.running ? `<button type="button" class="ia-btn" data-ia-one>${h.status === 'done' ? 'ทำใหม่' : 'ทำบ้านนี้'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">ยังไม่มีข้อมูล — กด "สแกนโฟลเดอร์"</td></tr>'}</tbody></table></div></div>`;
    }
    async function refresh() { state.data = await request(''); render(); if (state.data.job?.running && dialog.open) state.timer = setTimeout(() => refresh().catch(() => {}), 3000); }
    dialog.addEventListener('click', async event => {
        const t = event.target;
        if (t === dialog || t.closest('[data-ia-close]')) { clearTimeout(state.timer); return dialog.close(); }
        const run = async (fn, doing) => { state.busy = true; state.msg = doing; state.bad = false; render(); try { await fn(); state.msg = ''; } catch (error) { state.msg = error.message; state.bad = true; } state.busy = false; try { await refresh(); } catch { render(); } };
        if (t.closest('[data-ia-scan]')) return run(async () => { state.data = await request('/scan', { method: 'POST', body: '{}' }); }, 'กำลังสแกนโฟลเดอร์ใน Drive…');
        if (t.closest('[data-ia-run]')) return run(async () => { await request('/run', { method: 'POST', body: '{}' }); }, 'เริ่มทำงานเบื้องหลัง…');
        const one = t.closest('[data-ia-one]');
        if (one) { const fid = one.closest('tr').dataset.fid; return run(async () => { await request('/run', { method: 'POST', body: JSON.stringify({ folderIds: [fid], redo: true }) }); }, 'เริ่มทำงานเบื้องหลัง…'); }
    });
    dialog.addEventListener('change', async event => {
        const sel = event.target.closest('[data-ia-map]'); if (!sel) return;
        const fid = sel.closest('tr').dataset.fid;
        try { await request('/map', { method: 'PUT', body: JSON.stringify({ folderId: fid, no: sel.value ? Number(sel.value) : 0 }) }); state.msg = 'บันทึกการจับคู่แล้ว — กด "สแกนโฟลเดอร์" เพื่ออัปเดตสถานะ'; state.bad = false; }
        catch (error) { state.msg = error.message; state.bad = true; }
        const m = dialog.querySelector('.ia-msg'); if (m) { m.textContent = state.msg; m.className = 'ia-msg' + (state.bad ? ' bad' : ''); }
    });
    button.addEventListener('click', async () => {
        dialog.innerHTML = '<div class="ia-wrap"><p class="ia-msg">กำลังโหลด…</p></div>'; dialog.showModal();
        try { if (!(window.getCsrfToken && window.getCsrfToken())) { const r = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' }); const d = await r.json().catch(() => ({})); if (d.csrfToken) sessionStorage.setItem('csrfToken', d.csrfToken); } await refresh(); }
        catch (error) { dialog.innerHTML = `<div class="ia-wrap"><div class="ia-top"><h2>รวมรูปตรวจห้อง</h2><button type="button" class="ia-btn" data-ia-close>ปิด</button></div><p class="ia-msg bad">${esc(error.message)}</p></div>`; }
    });
})();
