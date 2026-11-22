// จัดการสัญญาเช่าของห้องแบบครบวงจร (ในหน้ารายละเอียดห้อง): อัปโหลดใหม่ · เปิดดู · แก้ชื่อ/ประเภท/หมายเหตุ · แทนที่ไฟล์ · ตั้งเป็นสัญญาหลัก ·
// อ่านวันเริ่ม/สิ้นสุด/ค่าเช่าจาก PDF แล้วอัปเดตทะเบียน · ลบ (ถังขยะ) / กู้คืน · ประวัติทุกครั้ง (ใคร/เมื่อไร/ทำอะไร)
// หลักการเดียวกันนี้ใช้กับรายการอื่นด้วย: สร้าง · แก้ไข · แทนที่ · ลบแบบกู้คืนได้ · ประวัติ · สิทธิ์
(() => {
    const API = `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-rooms`;
    const CONTRACT_API = `${window.APP_CONFIG.API_BASE_URL}/api/room-inspection/contract-extract`;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const KIND = { lease: 'สัญญาเช่า', addon: 'เอกสารประกอบ', other: 'อื่นๆ' };
    const MAX = 12 * 1024 * 1024;
    let ctx = null;   // { box, room, reload, canUpload, editing, extract, msg, bad, busy, history }

    async function call(url, method, body) {
        if (!(window.getCsrfToken && window.getCsrfToken())) { const r = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/session`, { cache: 'no-store' }); const d = await r.json().catch(() => ({})); if (d.csrfToken) sessionStorage.setItem('csrfToken', d.csrfToken); }
        const response = await window.authFetch(url, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ (ต้องมีสิทธิ์ "ติดตามขั้นตอนที่พักใหม่ (Flow chart)" หรือ "แก้ไขข้อมูลห้องพัก")');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    const readDataUrl = file => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(file); });
    async function fileDataUrl(id) {
        const r = await window.authFetch(`${API}/expenses/file/${encodeURIComponent(id)}`);
        if (!r.ok) throw new Error('เปิดไฟล์ไม่ได้');
        return readDataUrl(await r.blob());
    }

    function rowHtml(f) {
        const lease = f.kind === 'lease';
        const hist = (f.log || []).map(h => `<li>${esc(h.at || '')} · ${esc(h.by || '-')} — ${esc(h.e || '')}</li>`).join('');
        if (ctx.editing === f.id) {
            return `<div class="al-row is-edit" data-fid="${esc(f.id)}"><div class="al-form">
                <label>ชื่อไฟล์<input data-al-name value="${esc(f.name)}" maxlength="80"></label>
                <label>ประเภท<select data-al-kind>${Object.entries(KIND).map(([k, l]) => `<option value="${k}" ${k === f.kind ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                <label>หมายเหตุ<input data-al-note value="${esc(f.note)}" maxlength="200" placeholder="เช่น ฉบับแก้ไข / ลงนามครบแล้ว"></label>
                <div class="al-actions"><button type="button" class="ro-btn ro-btn-primary" data-al-save>บันทึก</button><button type="button" class="ro-btn" data-al-cancel>ยกเลิก</button></div></div></div>`;
        }
        return `<div class="al-row" data-fid="${esc(f.id)}">
            <div class="al-main"><button type="button" class="ro-lease ro-lease-signed" data-al-open title="เปิดไฟล์">${f.main ? '⭐' : '✅'} ${esc(KIND[f.kind] || 'สัญญาเช่า')}${f.main ? ' (หลัก)' : ''}</button>
                <b>${esc(f.name)}</b>${f.note ? `<small>📝 ${esc(f.note)}</small>` : ''}<small>แนบ ${esc(f.at || '-')}${f.by ? ' · ' + esc(f.by) : ''}</small></div>
            <div class="al-actions">
                <button type="button" class="ro-btn ro-btn-sm" data-al-open>เปิด</button>
                <button type="button" class="ro-btn ro-btn-sm" data-al-edit>✎ แก้ไข</button>
                <label class="ro-btn ro-btn-sm al-label" title="อัปโหลดไฟล์ใหม่มาแทนไฟล์นี้ (ไฟล์เดิมไปถังขยะ กู้คืนได้)">⇄ แทนที่ไฟล์<input type="file" accept="application/pdf" hidden data-al-replace></label>
                ${lease && !f.main ? '<button type="button" class="ro-btn ro-btn-sm" data-al-main>⭐ ตั้งเป็นสัญญาหลัก</button>' : ''}
                ${lease ? '<button type="button" class="ro-btn ro-btn-sm" data-al-extract title="อ่านวันเริ่ม/สิ้นสุด/ค่าเช่าจากไฟล์ แล้วเสนอให้ยืนยันก่อนอัปเดตทะเบียน">📖 อ่านข้อมูลจาก PDF</button>' : ''}
                <button type="button" class="ro-btn ro-btn-sm is-danger" data-al-del>🗑 ลบ</button>
                ${hist ? '<button type="button" class="ro-btn ro-btn-sm" data-al-hist>🕘 ประวัติ</button>' : ''}</div>
            ${ctx.history === f.id ? `<ul class="al-hist">${hist}</ul>` : ''}
            ${ctx.extract && ctx.extract.fid === f.id ? extractHtml(ctx.extract.info) : ''}</div>`;
    }
    function opts(list, fmt) { return (list || []).map(x => `<option value="${esc(x.value)}" title="${esc(x.context)}">${esc(fmt ? fmt(x) : x.value)}</option>`).join(''); }
    function extractHtml(info) {
        if (info.error) return `<div class="al-ex"><p class="ro-hint">${esc(info.error)} — กรอกเองในช่องแก้ไขทะเบียนด้านล่างได้</p></div>`;
        const pick = (label, key, name, list, fmt) => `<label>${label}<select data-al-pick="${name}"><option value="">— เลือกจากสัญญา —</option>${opts(list, fmt)}</select><input data-al-val="${name}" placeholder="${key}" inputmode="${name === 'rent' ? 'decimal' : 'text'}"></label>`;
        return `<div class="al-ex"><p class="ro-hint">อ่านได้ ${esc(info.pages)} หน้า · เลือกค่าที่ถูกต้อง (เลื่อนเมาส์ที่ตัวเลือกเพื่อดูประโยคต้นฉบับ) หรือพิมพ์เอง · ช่องที่เว้นว่างจะไม่ถูกแก้</p>
            <div class="al-grid">${pick('วันเริ่มสัญญา', 'วว/ดด/ปปปป', 'start', info.start)}${pick('วันสิ้นสุดสัญญา', 'วว/ดด/ปปปป', 'end', info.end)}${pick('ค่าเช่า/เดือน', 'ตัวเลข', 'rent', info.rent, x => Number(x.value).toLocaleString('en-US') + (x.currency ? ' ' + x.currency : ''))}</div>
            <button type="button" class="ro-btn ro-btn-primary" data-al-apply>✔ อัปเดตทะเบียนห้อง</button> <button type="button" class="ro-btn" data-al-cancel-ex>ปิด</button></div>`;
    }
    function render() {
        const r = ctx.room, can = r.status === 'ทำสัญญาแล้ว';
        const act = r.signedLeases || [], bin = r.leaseTrash || [];
        const links = (r.contracts || []).map((c, i, a) => `<a class="ro-lease" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.name)}">📄 สัญญา${a.length > 1 ? ' ' + (i + 1) : ''}</a>`).join('');
        ctx.box.innerHTML = `<h4>สัญญาเช่า</h4>
            ${act.length ? act.map(rowHtml).join('') : `<p class="ro-hint">${can ? '⚠ ยังไม่มีไฟล์สัญญาในระบบ' : 'ยังไม่ถึงขั้นทำสัญญา'}</p>`}
            ${links ? `<p>ไฟล์สัญญาจากไฟล์ "สัญญาเช่า": ${links}</p>` : ''}
            ${can ? `<div class="al-up"><select data-al-ukind>${Object.entries(KIND).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
                <label class="ro-btn ro-btn-primary al-label">＋ อัปโหลดไฟล์ PDF (ไม่เกิน 12 MB)<input type="file" accept="application/pdf" hidden data-al-upload></label></div>` : ''}
            ${bin.length ? `<details class="al-bin"><summary>ถังขยะ (${bin.length}) — กู้คืนได้</summary>${bin.map(f => `<div class="al-row" data-fid="${esc(f.id)}"><div class="al-main"><b>${esc(f.name)}</b><small>${esc(KIND[f.kind] || '')} · ลบ ${esc(f.deletedAt || '')}${f.deletedBy ? ' · ' + esc(f.deletedBy) : ''}</small></div><div class="al-actions"><button type="button" class="ro-btn ro-btn-sm" data-al-open>เปิด</button><button type="button" class="ro-btn ro-btn-sm" data-al-restore>↩ กู้คืน</button></div></div>`).join('')}</details>` : ''}
            <p class="ro-msg ${ctx.bad ? 'is-bad' : ''}" role="status">${esc(ctx.msg || '')}</p>
            <p class="ro-hint">เก็บที่ขั้น "เซ็นสัญญา" ของห้องนี้ · ทุกการแก้ไข/ลบ/แทนที่ถูกบันทึกประวัติ (ใคร/เมื่อไร) · ไฟล์ที่ลบยังอยู่ใน Google Drive และกู้คืนได้</p>`;
    }
    async function refresh(msg, bad) {
        try { ctx.room = (await ctx.reload()) || ctx.room; } catch { /* ใช้ข้อมูลเดิม */ }
        ctx.msg = msg || ''; ctx.bad = !!bad; ctx.busy = false; render();
    }
    async function act(fn, doing) {
        if (ctx.busy) return;
        const c = ctx; c.busy = true; c.msg = doing; c.bad = false; render();
        try { const text = await fn(); if (ctx !== c) return; await refresh(text || 'ทำรายการแล้ว'); }
        catch (error) { if (ctx !== c) return; c.busy = false; c.msg = error.message; c.bad = true; render(); }
    }
    const fidOf = el => el.closest('[data-fid]')?.dataset.fid;
    const edit = body => call(`${API}/flow/files`, 'PUT', { no: ctx.room.no, ...body });

    async function onClick(event) {
        const t = event.target, fid = fidOf(t);
        if (t.closest('[data-al-open]') && fid) {
            const tab = window.open('', '_blank');   // เปิดแท็บทันทีที่กด (กัน popup blocker) แล้วค่อยใส่ไฟล์
            try { const r = await window.authFetch(`${API}/expenses/file/${encodeURIComponent(fid)}`); if (!r.ok) throw new Error('เปิดไม่ได้'); const url = URL.createObjectURL(await r.blob()); if (tab) tab.location.href = url; else window.open(url, '_blank'); }
            catch { if (tab) tab.close(); ctx.msg = 'เปิดไฟล์ไม่ได้ — ลองใหม่อีกครั้ง'; ctx.bad = true; render(); }
            return;
        }
        if (t.closest('[data-al-edit]')) { ctx.editing = fid; render(); return; }
        if (t.closest('[data-al-cancel]')) { ctx.editing = null; render(); return; }
        if (t.closest('[data-al-save]')) {
            const row = t.closest('.al-row');
            return act(async () => { await edit({ fileId: fid, name: row.querySelector('[data-al-name]').value, kind: row.querySelector('[data-al-kind]').value, note: row.querySelector('[data-al-note]').value }); ctx.editing = null; return 'บันทึกการแก้ไขแล้ว'; }, 'กำลังบันทึก…');
        }
        if (t.closest('[data-al-main]')) return act(async () => { await edit({ fileId: fid, main: true }); return 'ตั้งเป็นสัญญาหลักแล้ว'; }, 'กำลังบันทึก…');
        if (t.closest('[data-al-del]')) {
            const name = ctx.room.signedLeases.find(f => f.id === fid)?.name || 'ไฟล์นี้';
            if (!window.confirm(`ลบ "${name}" ออกจากรายการสัญญาของห้องนี้?\n(ไฟล์ยังอยู่ใน Google Drive และกู้คืนได้จาก "ถังขยะ")`)) return;
            return act(async () => { await edit({ fileId: fid, deleted: true }); return 'ย้ายไปถังขยะแล้ว'; }, 'กำลังลบ…');
        }
        if (t.closest('[data-al-restore]')) return act(async () => { await edit({ fileId: fid, deleted: false }); return 'กู้คืนแล้ว'; }, 'กำลังกู้คืน…');
        if (t.closest('[data-al-hist]')) { ctx.history = ctx.history === fid ? null : fid; render(); return; }
        if (t.closest('[data-al-cancel-ex]')) { ctx.extract = null; render(); return; }
        if (t.closest('[data-al-extract]')) {
            return act(async () => {
                const dataUrl = await fileDataUrl(fid);
                if (dataUrl.length > MAX * 1.4) throw new Error('ไฟล์ใหญ่เกิน 12 MB อ่านอัตโนมัติไม่ได้');
                const info = await call(CONTRACT_API, 'POST', { dataUrl });
                ctx.extract = { fid, info };
                return info.error ? '' : 'อ่านข้อมูลจากสัญญาแล้ว — เลือก/ตรวจค่า แล้วกดอัปเดตทะเบียน';
            }, 'กำลังอ่านสัญญา (อ่านในเครื่องหลังบ้าน ไม่ส่งออกภายนอก)…');
        }
        if (t.closest('[data-al-apply]')) {
            const body = {}, box = t.closest('.al-ex');
            for (const k of ['start', 'end', 'rent']) { const v = box.querySelector(`[data-al-val="${k}"]`).value.trim(); if (v) body[k] = k === 'rent' ? v.replace(/,/g, '') : v; }
            if (!Object.keys(body).length) { ctx.msg = 'ยังไม่ได้เลือกหรือกรอกค่าใดเลย'; ctx.bad = true; render(); return; }
            const r = ctx.room;
            if (!window.confirm(`อัปเดตทะเบียนห้อง ${r.project} ${r.unit}\n${body.start ? 'วันเริ่ม: ' + body.start + '\n' : ''}${body.end ? 'วันสิ้นสุด: ' + body.end + '\n' : ''}${body.rent ? 'ค่าเช่า: ' + Number(body.rent).toLocaleString('en-US') + '\n' : ''}(ทับค่าเดิมในช่องที่เลือก)`)) return;
            return act(async () => { const res = await call(`${API}/rooms/${encodeURIComponent(r.no)}`, 'PUT', body); ctx.extract = null; return res.changed ? 'อัปเดตทะเบียนแล้ว (' + res.changed + ' ช่อง)' : 'ค่าเหมือนเดิม ไม่ได้แก้อะไร'; }, 'กำลังอัปเดตทะเบียน…');
        }
    }
    async function onChange(event) {
        const t = event.target;
        const pick = t.closest('[data-al-pick]');
        if (pick) { const field = pick.parentElement.querySelector('[data-al-val]'); if (field && pick.value) field.value = pick.value; return; }
        const up = t.closest('[data-al-upload]'), rep = t.closest('[data-al-replace]');
        if (!up && !rep) return;
        const input = up || rep, file = input.files[0]; input.value = '';
        if (!file) return;
        if (file.type !== 'application/pdf') { ctx.msg = 'ต้องเป็นไฟล์ PDF'; ctx.bad = true; render(); return; }
        if (file.size > MAX) { ctx.msg = 'ไฟล์ใหญ่เกิน 12 MB'; ctx.bad = true; render(); return; }
        const kind = up ? ctx.box.querySelector('[data-al-ukind]').value : undefined, replaceId = rep ? fidOf(rep) : undefined;
        act(async () => {
            const dataUrl = await readDataUrl(file);
            await call(`${API}/flow/files`, 'POST', { no: ctx.room.no, id: 'dQ', name: file.name, dataUrl, lease: true, ...(kind ? { kind } : {}), ...(replaceId ? { replaceId } : {}) });
            return replaceId ? 'แทนที่ไฟล์แล้ว (ไฟล์เดิมอยู่ในถังขยะ)' : 'อัปโหลดแล้ว';
        }, 'กำลังอัปโหลด…');
    }

    // box = <section data-ro-lbox>, room = แถวห้องจาก overview, reload = โหลดภาพรวมใหม่แล้วคืนแถวห้องนั้น
    window.AccommodationLease = {
        mount(box, room, reload) {
            if (!box) return;
            ctx = { box, room, reload, editing: null, extract: null, history: null, msg: '', bad: false, busy: false };
            box.onclick = onClick; box.onchange = onChange;
            render();
        }
    };
})();
