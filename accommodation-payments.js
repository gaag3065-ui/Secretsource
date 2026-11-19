// จัดการรายงานทุกขั้นตอน (บิลที่พัก): ① ตั้งเบิก (PDF แยกตามบริษัท + ยืนยันตั้งเบิกพร้อมหลักฐาน) → ② รับเงิน (หลักฐาน + จัดก้อนตามจุดจ่าย) → ③ จ่าย + นำส่งหลักฐาน (ใบเสร็จ + ส่งแชท)
// ทำทีละหลายบิลจากหน้านี้ได้เลย (ไม่ต้องเข้าทีละบ้าน) · เงื่อนไขของแต่ละขั้น (วันที่ + รูปหลักฐาน + ติ๊กยืนยัน) ยังบังคับที่หลังบ้านเหมือนเดิม
// ทุกบิลย้อนกลับไปตั้งเบิกใหม่ได้ตลอด (ไม่ต้องโหลด PDF ซ้ำ) · สี: เขียว = ขั้นที่กำลังทำ · เหลือง = ขั้นที่ทำเสร็จแล้ว
(() => {
    const actions = document.querySelector('.as-actions');
    if (!actions) return;
    const API = `${window.APP_CONFIG.API_BASE_URL}/api`;
    const PAY = '/accommodation-rooms/payments';
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const METHODS = { super: 'ซุปเปอร์มาเก็ต', condo: 'นิติบุคคล / นิติอาคาร', bank: 'ธนาคาร' };
    const STATUS = { requested: 'ตั้งเบิกแล้ว — รอรับเงิน', received: 'รับเงินแล้ว — รอจ่าย/นำส่ง', done: 'เสร็จสมบูรณ์' };
    const STEP = ['ตามบิล', 'ได้รับบิล+ลงเว็บ', 'ตั้งเบิกแล้ว', 'ได้รับเงินแล้ว', 'จ่าย+ส่งหลักฐานครบ'];
    const CIRC = ['①', '②', '③', '④', '⑤'];
    const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const now = new Date(Date.now() + 7 * 3600 * 1000);
    const todayDmy = () => { const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10).split('-'); return `${d[2]}/${d[1]}/${d[0]}`; };
    const state = { tab: 'request', cands: [], batches: [], itemRecords: {}, sel: new Set(), rows: new Map(), picks: new Set(), period: `${THAI_MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`, round: 'T.1', notes: '', payDate: '', batchId: '', dates: {}, recvIn: {}, bundle: {}, seenRq: new Set(), filter: 'all', q: '', busy: false, msg: '', bad: false };
    const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ไม่มี storage */ } };

    document.head.insertAdjacentHTML('beforeend', `<style>
        .pm-dialog { width: min(1320px, 98vw); max-height: 96dvh; border: 0; border-radius: 16px; padding: 0; box-shadow: 0 24px 70px rgba(16,24,40,.3); }
        .pm-dialog::backdrop { background: rgba(16,24,40,.55); }
        .pm-wrap { display: grid; gap: 12px; padding: 16px 18px 18px; max-height: 96dvh; overflow: auto; font-size: 14px; }
        .pm-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; } .pm-top h2 { margin: 0; font-size: 20px; }
        .pm-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .pm-tabs button { flex: 1 1 220px; border: 2px solid #d0d5dd; background: #fff; border-radius: 12px; padding: 10px 14px; font: inherit; font-weight: 700; cursor: pointer; text-align: left; }
        .pm-tabs button small { display: block; font-weight: 400; color: #667085; }
        .pm-tabs button.is-done { border-color: #facc15; background: #fef9c3; color: #713f12; }
        .pm-tabs button.is-on { border-color: #16a34a; background: #dcfce7; color: #14532d; box-shadow: 0 0 0 3px rgba(22,163,74,.2); }
        .pm-tabs button.is-on small { color: #166534; }
        .pm-card { border: 1px solid #e1e7ea; border-radius: 12px; padding: 12px 14px; background: #fff; }
        .pm-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .pm-wrap label { display: grid; gap: 3px; font-size: 12.5px; color: #475467; font-weight: 600; }
        .pm-wrap input, .pm-wrap select, .pm-wrap textarea { font: inherit; font-size: 13.5px; padding: 6px 8px; border: 1px solid #d0d5dd; border-radius: 8px; min-width: 0; box-sizing: border-box; width: 100%; }
        .pm-wrap input[type=checkbox] { width: 18px; height: 18px; padding: 0; }
        .pm-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .pm-table th { background: #f4b26b; padding: 6px 6px; border: 1px solid #c9954f; font-size: 12.5px; text-align: center; position: sticky; top: 0; }
        .pm-table td { border: 1px solid #e1e7ea; padding: 4px 5px; vertical-align: top; } .pm-table td.n { text-align: right; white-space: nowrap; }
        .pm-table tr.co td { background: #fde6c8; font-weight: 700; } .pm-table tr.sub td { background: #fff3e0; font-weight: 700; text-align: right; } .pm-table tr.grand td { background: #f4b26b; font-weight: 800; text-align: right; }
        .pm-table input, .pm-table select { padding: 4px 6px; font-size: 12.5px; } .pm-bankbox { display: grid; gap: 4px; }
        .pm-btn { border: 1px solid #d0d5dd; background: #fff; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 700; cursor: pointer; }
        .pm-btn.primary { background: #16a34a; color: #fff; border-color: #16a34a; } .pm-btn.warn { background: #fff7ed; border-color: #fdba74; color: #9a3412; } .pm-btn.sm { padding: 3px 9px; font-size: 12px; border-radius: 8px; } .pm-btn:disabled { opacity: .45; cursor: not-allowed; }
        .pm-msg { font-size: 13px; color: #087f74; min-height: 18px; } .pm-msg.bad { color: #b42318; font-weight: 700; }
        .pm-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; } .pm-chip { border: 1px solid #d0d5dd; background: #fff; border-radius: 999px; padding: 5px 12px; cursor: pointer; font: inherit; font-size: 13px; } .pm-chip.is-on { background: #16a34a; color: #fff; border-color: #16a34a; }
        .pm-kpis { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); } .pm-kpi { border: 1px solid #e1e7ea; border-top: 4px solid #16a34a; border-radius: 12px; padding: 8px 12px; background: #fff; } .pm-kpi span { font-size: 12px; color: #667085; display: block; } .pm-kpi b { font-size: 20px; }
        .pm-groups { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); }
        .pm-group { border: 2px solid #e1e7ea; border-radius: 12px; padding: 10px 12px; background: #fff; display: grid; gap: 6px; align-content: start; } .pm-group.is-paid { border-color: #facc15; background: #fefce8; }
        .pm-group h4 { margin: 0; font-size: 15px; } .pm-group .tot { font-size: 20px; font-weight: 800; }
        .pm-check { display: flex !important; align-items: center; gap: 8px; font-size: 13.5px !important; color: #18212f !important; } .pm-check small { color: #667085; font-weight: 400; }
        .pm-note { font-size: 12.5px; color: #667085; } .pm-warn { background: #fff4d6; border: 1px solid #f2cf93; color: #9a5b00; border-radius: 10px; padding: 8px 12px; font-size: 13px; }
        .pm-item { display: grid; grid-template-columns: auto 1fr auto; gap: 6px 8px; align-items: center; padding: 5px 0; border-top: 1px dashed #e4e7ec; font-size: 12.5px; }
        .pm-item:first-of-type { border-top: 0; } .pm-item .sub { grid-column: 2 / -1; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .pm-s { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 700; background: #fee4e2; color: #b42318; } .pm-s.s1, .pm-s.s2, .pm-s.s3 { background: #ffe6c7; color: #b54708; } .pm-s.s4 { background: #fef9c3; color: #713f12; }
        .pm-thumbs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; } .pm-th { width: 44px; height: 44px; border: 1px solid #d0d5dd; border-radius: 8px; overflow: hidden; background: #f2f4f7; cursor: zoom-in; padding: 0; display: grid; place-items: center; font-size: 11px; position: relative; }
        .pm-th img { width: 100%; height: 100%; object-fit: cover; } .pm-th .x { position: absolute; top: -1px; right: -1px; background: #b42318; color: #fff; border-radius: 0 8px 0 8px; width: 16px; height: 16px; font-size: 10px; line-height: 16px; text-align: center; }
        .pm-up { display: inline-block; border: 1px dashed #98a2b3; border-radius: 8px; padding: 3px 10px; cursor: pointer; font-size: 12px; font-weight: 700; color: #475467; background: #fff; }
        .pm-ev { border: 2px solid #86efac; background: #f0fdf4; border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; }
        .pm-viewer { width: min(1200px, 96vw); height: 92vh; border: 0; border-radius: 12px; padding: 0; background: #101828; } .pm-viewer::backdrop { background: rgba(0,0,0,.7); } .pm-viewer .bar { display: flex; justify-content: flex-end; padding: 6px 10px; } .pm-viewer .body { height: calc(92vh - 46px); display: grid; place-items: center; overflow: auto; } .pm-viewer img { max-width: 100%; max-height: 100%; } .pm-viewer iframe { width: 100%; height: 100%; border: 0; background: #fff; }
        @media (max-width: 760px) { .pm-table { min-width: 980px; } .pm-scroll { overflow-x: auto; } .pm-groups { grid-template-columns: 1fr; } }
    </style>`);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'as-btn as-btn-ghost'; button.textContent = 'จัดการรายงานทุกขั้นตอน';
    actions.prepend(button);
    const dialog = document.createElement('dialog'); dialog.className = 'pm-dialog'; document.body.append(dialog);
    const viewer = document.createElement('dialog'); viewer.className = 'pm-viewer'; document.body.append(viewer);

    // ---------------------------------------------------------------- เรียก API
    async function ensureCsrf() {
        if (window.getCsrfToken && window.getCsrfToken()) return;
        const response = await window.authFetch(`${API}/session`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (data.csrfToken) sessionStorage.setItem('csrfToken', data.csrfToken);
    }
    async function request(path, options) {
        if (options?.method && options.method !== 'GET') await ensureCsrf();
        const response = await window.authFetch(`${API}${path}`, { cache: 'no-store', ...(options || {}), headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
        if (options?.blob && response.ok) return response.blob();
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error('บัญชีนี้ไม่มีสิทธิ์ในส่วนนี้ (ต้องมีสิทธิ์ "จัดการรายงานตั้งเบิก / รับเงิน / นำส่งหลักฐาน")');
        if (response.status === 404) throw new Error('เครื่องหลังบ้านยังไม่ได้อัปเดต — รอ 1–2 นาทีแล้วลองใหม่');
        if (!response.ok || data.success === false) throw new Error(data.message || 'ทำรายการไม่สำเร็จ');
        return data;
    }
    function applyOverview(data) {
        if (data.candidates) state.cands = data.candidates;
        if (data.batches) state.batches = data.batches;
        if (data.itemRecords) state.itemRecords = data.itemRecords;
        for (const c of state.cands) if (!state.rows.has(c.key)) state.rows.set(c.key, { ...c, fee: c.fee || (c.method === 'super' ? 30 : 0) });
        // ชุดที่รอยืนยันตั้งเบิก: ติ๊กเลือกทุกบิลให้ก่อน (เอาออกได้) — ทำครั้งเดียวต่อบิล
        for (const b of state.batches) for (const i of b.items) if (idxOf(i.key) < 2 && !state.seenRq.has(i.key)) { state.seenRq.add(i.key); state.picks.add('rq|' + i.key); }
        if (!state.batchId || !state.batches.some(b => b.id === state.batchId)) state.batchId = (state.batches.find(b => b.status !== 'done') || state.batches[0] || {}).id || '';
    }
    async function load() { applyOverview(await request(`${PAY}`)); }
    // ทำงาน + แสดงข้อความ + วาดใหม่ (กันกดซ้ำ)
    async function act(label, fn) {
        if (state.busy) return;
        state.busy = true; state.msg = label + '…'; state.bad = false; render();
        try { const m = await fn(); state.msg = m || ''; } catch (error) { state.msg = error.message; state.bad = true; }
        state.busy = false; render();
    }

    // ---------------------------------------------------------------- ตัวช่วยข้อมูล
    const batchOf = () => state.batches.find(b => b.id === state.batchId);
    const rec = key => state.itemRecords[key] || null;
    const idxOf = key => (rec(key) ? rec(key).idx : -1);
    const itemTotal = i => (Number(i.amount) || 0) + (i.method === 'super' ? Number(i.fee) || 0 : 0);
    const sum = list => list.reduce((n, i) => n + itemTotal(i), 0);
    const groupKey = i => i.method === 'bank' ? `ธนาคาร|${i.bank}|${i.acctNo}|${i.acctName}` : i.method === 'condo' ? `นิติ|${i.place || i.building}` : 'ซุปเปอร์มาเก็ต';
    const groupTitle = i => i.method === 'bank' ? `🏦 ${i.bank || '(ไม่ระบุธนาคาร)'}` : i.method === 'condo' ? `🏢 นิติอาคาร ${i.place || ''}`.trim() : '🛒 ซุปเปอร์มาเก็ต';
    function groupsOf(batch) {
        const map = new Map();
        for (const i of batch.items) { const k = groupKey(i); const g = map.get(k) || { key: k, method: i.method, title: groupTitle(i), bank: i.bank, acctNo: i.acctNo, acctName: i.acctName, items: [] }; g.items.push(i); map.set(k, g); }
        const order = { super: 0, condo: 1, bank: 2 };
        return [...map.values()].sort((a, b) => order[a.method] - order[b.method] || a.title.localeCompare(b.title));
    }
    function stageState(b) {
        if (!b || !b.items.length) return { request: '', receive: '', deliver: '' };
        const min = Math.min(...b.items.map(i => idxOf(i.key)));
        return { request: min >= 2 ? 'done' : '', receive: min >= 3 ? 'done' : '', deliver: min >= 4 ? 'done' : '' };
    }
    const stepChip = key => { const i = idxOf(key); return `<span class="pm-s s${Math.max(i, 0)}">${CIRC[Math.max(i, 0)]} ${esc(STEP[Math.max(i, 0)])}</span>`; };
    const filesOf = (keys, step) => { const seen = new Map(); for (const k of keys) for (const f of rec(k)?.files || []) if (f.step === step && !seen.has(f.id)) seen.set(f.id, f); return [...seen.values()]; };

    // ---------------------------------------------------------------- ไฟล์/รูป: ย่อรูป · แสดงรูปย่อ · ขยาย
    const fileUrls = new Map();
    async function fileUrl(id) {
        if (fileUrls.has(id)) return fileUrls.get(id);
        const response = await window.authFetch(`${API}/accommodation-rooms/expenses/file/${encodeURIComponent(id)}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error('เปิดไฟล์ไม่ได้');
        const url = URL.createObjectURL(await response.blob()); fileUrls.set(id, url); return url;
    }
    const thumbs = (files, rmKind = '', rmStep = 0) => files.map(f => `<span style="position:relative"><button type="button" class="pm-th" data-pm-view="${esc(f.id)}" data-mime="${esc(f.mime)}" title="${esc(f.name || '')} ${esc(f.at || '')}">${f.mime === 'application/pdf' ? '📄 PDF' : `<img alt="" data-pm-src="${esc(f.id)}">`}</button>${rmKind ? `<button type="button" class="pm-th x" data-pm-rm="${rmKind}" data-rm-id="${esc(f.id)}" data-rm-step="${rmStep}" title="เอาไฟล์นี้ออก" style="width:16px;height:16px;padding:0;border:0">✕</button>` : ''}</span>`).join('') || '<span class="pm-note">ยังไม่มีไฟล์</span>';
    function hydrate() { dialog.querySelectorAll('img[data-pm-src]').forEach(img => { const id = img.dataset.pmSrc; fileUrl(id).then(u => { img.src = u; }).catch(() => { img.replaceWith('⚠'); }); img.removeAttribute('data-pm-src'); }); }
    async function openViewer(id, mime) {
        viewer.innerHTML = '<div class="bar"><button type="button" class="pm-btn sm" data-pm-vclose>✕ ปิด</button></div><div class="body" style="color:#fff">กำลังโหลด…</div>'; viewer.showModal();
        try { const u = await fileUrl(id); viewer.querySelector('.body').innerHTML = mime === 'application/pdf' ? `<iframe src="${u}#view=FitH"></iframe>` : `<img src="${u}" alt="หลักฐาน">`; }
        catch (error) { viewer.querySelector('.body').textContent = error.message; }
    }
    viewer.addEventListener('click', e => { if (e.target === viewer || e.target.closest('[data-pm-vclose]')) viewer.close(); });
    function toDataUrl(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
            r.onload = () => {
                if (file.type === 'application/pdf') return resolve(r.result);
                if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('รองรับเฉพาะรูป JPG / PNG / WEBP หรือ PDF'));
                const img = new Image();
                img.onerror = () => reject(new Error('เปิดรูปไม่ได้'));
                img.onload = () => { const s = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.85)); };
                img.src = r.result;
            };
            r.readAsDataURL(file);
        });
    }
    async function uploadEvidence(files, keys, step) {
        if (!keys.length) throw new Error('ยังไม่ได้เลือกบิล');
        let ok = 0;
        for (const file of files) {
            const dataUrl = await toDataUrl(file);
            const res = await request(`${PAY}/evidence`, { method: 'POST', body: JSON.stringify({ batchId: state.batchId, keys, step, name: file.name, dataUrl }) });
            applyOverview(res); ok++;
            if (res.failed?.length) throw new Error('แนบไม่ครบบางบิล: ' + res.failed.slice(0, 2).join(' · '));
        }
        return `แนบหลักฐานแล้ว ${ok} ไฟล์ (${keys.length} บิล)`;
    }
    async function removeEvidence(fileId, step) {
        const b = batchOf(); if (!b) return;
        const keys = b.items.map(i => i.key).filter(k => (rec(k)?.files || []).some(f => f.id === fileId && f.step === step));
        for (const k of keys) { const [no, cat, period] = k.split('|'); await request('/accommodation-rooms/expenses/files', { method: 'DELETE', body: JSON.stringify({ no: Number(no), cat, period, id: fileId }) }); }
        await load();
    }

    // ---------------------------------------------------------------- แท็บ ① ตั้งเบิก
    function requestHtml() {
        const rows = state.cands.map(c => state.rows.get(c.key)), co = new Map();
        for (const r of rows) { const k = (r.company || '').trim() || 'ไม่ระบุบริษัท'; (co.get(k) || co.set(k, []).get(k)).push(r); }
        const picked = rows.filter(r => state.sel.has(r.key));
        const body = [...co.entries()].map(([name, list]) => {
            const chosen = list.filter(r => state.sel.has(r.key));
            return `<tr class="co"><td colspan="7">${esc(name)} <small style="font-weight:400">· ${list.length} รายการ</small></td></tr>` + list.map(r => `<tr data-key="${esc(r.key)}">
                <td><input type="checkbox" data-pm-sel ${state.sel.has(r.key) ? 'checked' : ''}></td>
                <td><input data-f="desc" value="${esc(r.desc)}"><small class="pm-note">${esc(r.building)}${r.files ? ` · 📷 ${r.files}` : ''}</small></td>
                <td><input data-f="company" value="${esc(r.company)}" placeholder="บริษัท" style="width:90px"></td>
                <td><input data-f="amount" inputmode="decimal" value="${esc(r.amount)}" style="width:110px;text-align:right"></td>
                <td><select data-f="method">${Object.entries(METHODS).map(([k, v]) => `<option value="${k}" ${r.method === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
                <td>${r.method === 'bank' ? `<div class="pm-bankbox"><input data-f="bank" value="${esc(r.bank)}" placeholder="ธนาคารอะไร"><input data-f="acctNo" value="${esc(r.acctNo)}" placeholder="หมายเลขบัญชี"><input data-f="acctName" value="${esc(r.acctName)}" placeholder="ชื่อบัญชี"></div>`
                    : r.method === 'condo' ? `<input data-f="place" value="${esc(r.place)}" placeholder="ชื่อนิติอาคาร / สถานที่จ่าย">`
                    : `<label>ค่าธรรมเนียมเคาน์เตอร์ (LKR)<input data-f="fee" inputmode="decimal" value="${esc(r.fee)}" style="width:90px"></label>`}</td>
                <td class="n rowtot">${num(itemTotal(r))}</td></tr>`).join('') + `<tr class="sub" data-co="${esc(name)}"><td colspan="6">รวม ${esc(name)} (ที่เลือก ${chosen.length})</td><td class="n subtot">${num(sum(chosen))}</td></tr>`;
        }).join('');
        const pending = state.batches.filter(b => b.status !== 'done' && b.items.some(i => idxOf(i.key) < 2));
        return `<div class="pm-card"><h3 style="margin:0 0 8px">เลือกบิลที่ได้รับแล้วมาตั้งเบิก <small style="font-weight:400;color:#667085">— บิลที่ส่งกลับมาจากขั้นถัดไปจะอยู่ในรายการนี้ด้วย</small></h3>
        <div class="pm-grid">
            <label>ประจำเดือน<input data-pm-top="period" value="${esc(state.period)}"></label>
            <label>รอบ<input data-pm-top="round" value="${esc(state.round)}"></label>
            <label>Payment Date (ใส่ทุกแถวในใบ)<input data-pm-top="payDate" value="${esc(state.payDate)}" placeholder="วัน/เดือน/ปี (ไม่บังคับ)"></label></div>
        ${rows.length ? `<div class="pm-scroll"><table class="pm-table"><thead><tr><th style="width:34px"><input type="checkbox" data-pm-all ${picked.length === rows.length ? 'checked' : ''}></th><th>รายการ / ที่พัก</th><th>บริษัท</th><th>ยอดตามบิล (LKR)</th><th>จ่ายอย่างไร</th><th>รายละเอียดการจ่าย</th><th>ยอดรวม (LKR)</th></tr></thead><tbody>${body}
            <tr class="grand"><td colspan="6">Grand Total — เลือก ${picked.length} จาก ${rows.length} รายการ</td><td class="n" id="pmGrand">${num(sum(picked))}</td></tr></tbody></table></div>`
            : '<div class="pm-warn">ยังไม่มีบิลที่รอตั้งเบิก — ทำขั้น ② ได้รับบิลและลงเว็บ (วันที่ + รูปบิล + ยอดเงิน) ในแท็บค่าใช้จ่ายและรอบกำหนดก่อน หรือส่งบิลกลับมาจากชุดที่ตั้งเบิกแล้ว (ด้านล่าง)</div>'}
        <label style="margin-top:8px">หมายเหตุด้านล่างใบ (บรรทัดละ 1 ข้อ — แสดงตัวอักษรสีแดงใต้ตาราง)<textarea data-pm-top="notes" rows="2">${esc(state.notes)}</textarea></label>
        <div style="margin-top:8px"><button type="button" class="pm-btn primary" data-pm-create ${picked.length && !state.busy ? '' : 'disabled'}>📄 สร้างชุดตั้งเบิก + ดาวน์โหลด PDF</button></div></div>
        ${pending.map(b => confirmRequestHtml(b)).join('')}`;
    }
    // ยืนยันตั้งเบิก: หลักฐานแคปหน้าแชท + วันที่ → ทุกบิลที่เลือกเลื่อนเป็น "ตั้งเบิกแล้ว"
    function confirmRequestHtml(b) {
        const todo = b.items.filter(i => idxOf(i.key) < 2), picks = todo.filter(i => state.picks.has('rq|' + i.key));
        const ev = filesOf(picks.map(i => i.key), 2);
        return `<div class="pm-ev" data-batch="${esc(b.id)}"><h3 style="margin:0">📨 ยืนยันตั้งเบิก — ${esc(b.label || b.period)} <small style="font-weight:400;color:#166534">(${todo.length} บิลรอยืนยัน)</small></h3>
            <div class="pm-note">เลือกบิลที่ตั้งเบิกจริง → แนบรูปแคปหน้าแชทตั้งเบิก 1 ไฟล์ใช้กับทุกบิลที่เลือกได้ → ใส่วันที่ → ยืนยัน (บิลไหนยังไม่ได้ตั้งเบิก ติ๊กออกแล้วส่งกลับได้)</div>
            ${todo.map(i => `<div class="pm-item"><input type="checkbox" data-pm-pick="rq|${esc(i.key)}" ${state.picks.has('rq|' + i.key) ? 'checked' : ''}><span><b>${esc(i.building)}</b> — ${esc(i.desc)} · LKR ${num(itemTotal(i))}</span>${stepChip(i.key)}</div>`).join('')}
            <div class="pm-grid"><label>วันที่ตั้งเบิก<input data-pm-ev-date="rq-${esc(b.id)}" value="${esc(state.dates['rq-' + b.id] ?? todayDmy())}"></label>
                <div><div class="pm-thumbs">${thumbs(ev, 'ev', 2)}</div><label class="pm-up" style="margin-top:4px">＋ แนบรูปแคปหน้าแชทตั้งเบิก<input type="file" hidden accept="image/*,application/pdf" multiple data-pm-evup="2" data-batch="${esc(b.id)}" data-scope="rq"></label></div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="pm-btn primary" data-pm-advance="request" data-batch="${esc(b.id)}" ${picks.length && ev.length && !state.busy ? '' : 'disabled'}>✔ ยืนยันตั้งเบิก ${picks.length} บิล</button>
                <button type="button" class="pm-btn warn" data-pm-return="rq" data-batch="${esc(b.id)}" ${picks.length && !state.busy ? '' : 'disabled'}>↩ ส่ง ${picks.length} บิลที่เลือกกลับไปเลือกใหม่</button>
                <button type="button" class="pm-btn" data-pm-pdf data-batch="${esc(b.id)}">⬇ โหลด PDF ตั้งเบิกอีกครั้ง</button></div></div>`;
    }
    function readTop(root) { root.querySelectorAll('[data-pm-top]').forEach(el => { state[el.dataset.pmTop] = el.value; }); }
    function validatePicked(picked) {
        for (const r of picked) {
            if (!(Number(r.amount) > 0)) return `รายการ "${r.desc} ${r.building}" ยังไม่มียอด`;
            if (!String(r.company || '').trim()) return `รายการ "${r.desc} ${r.building}" ยังไม่ระบุบริษัท`;
            if (r.method === 'bank' && !(r.bank?.trim() && r.acctNo?.trim() && r.acctName?.trim())) return `รายการ "${r.desc} ${r.building}" จ่ายผ่านธนาคาร ต้องระบุธนาคาร / หมายเลขบัญชี / ชื่อบัญชี`;
        }
        return '';
    }
    async function downloadPdf(batch) {
        const items = batch.items.map(i => ({ ...i, payDate: i.payDate || state.payDate || '' }));
        const blob = await request('/room-inspection/pdf', { method: 'POST', body: JSON.stringify({ kind: 'payment-request', data: { period: batch.period, round: batch.round, items, notes: batch.notes } }), blob: true });
        const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `ตั้งเบิกค่าน้ำไฟ ${batch.period} ${batch.round}.pdf`.replace(/[\\/:*?"<>|]/g, '-') });
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    }
    async function createBatch() {
        const picked = state.cands.map(c => state.rows.get(c.key)).filter(r => state.sel.has(r.key));
        const bad = validatePicked(picked); if (bad) { state.msg = bad; state.bad = true; return render(); }
        await act('กำลังบันทึกชุดตั้งเบิกและสร้าง PDF', async () => {
            const saved = await request(`${PAY}/batches`, { method: 'PUT', body: JSON.stringify({ status: 'requested', period: state.period, round: state.round, label: `${state.period} ${state.round}`, requestedAt: todayDmy(),
                notes: state.notes.split('\n').map(x => x.trim()).filter(Boolean), items: picked.map(r => ({ ...r, payDate: state.payDate })) }) });
            state.sel.clear(); state.rows.clear(); applyOverview(saved); state.batchId = saved.batch.id;
            try { await downloadPdf(saved.batch); return `สร้างชุดตั้งเบิกแล้ว (${saved.batch.items.length} รายการ) และดาวน์โหลด PDF แล้ว — ส่งใบให้บัญชี แล้วกลับมาแนบหลักฐานและกด "ยืนยันตั้งเบิก" ด้านล่าง`; }
            catch (error) { state.bad = true; return `บันทึกชุดตั้งเบิกแล้ว แต่สร้าง PDF ไม่สำเร็จ: ${error.message} — กด "โหลด PDF ตั้งเบิกอีกครั้ง" ได้`; }
        });
    }

    // ---------------------------------------------------------------- ตัวเลือกชุด / ย้อนกลับ
    function batchPicker() {
        if (!state.batches.length) return '<div class="pm-warn">ยังไม่มีชุดตั้งเบิก — เริ่มที่แท็บ ① ตั้งเบิก</div>';
        const b = batchOf();
        return `<div class="pm-grid"><label>ชุดตั้งเบิก<select data-pm-batch>${state.batches.map(x => `<option value="${esc(x.id)}" ${x.id === state.batchId ? 'selected' : ''}>${esc(x.label || x.period)} · ${x.items.length} รายการ · ${esc(STATUS[x.status] || x.status)}</option>`).join('')}</select></label>
            <div class="pm-kpi"><span>ยอดตั้งเบิกรวม</span><b>LKR ${num(sum(b.items))}</b></div>
            <div style="align-self:end"><button type="button" class="pm-btn" data-pm-pdf data-batch="${esc(b.id)}">⬇ โหลด PDF ตั้งเบิกอีกครั้ง</button></div></div>`;
    }
    const pickBar = (scope, b) => { const n = b.items.filter(i => state.picks.has(scope + '|' + i.key)).length; return `<div class="pm-chips"><button type="button" class="pm-btn sm" data-pm-pickall="${scope}">เลือกทั้งหมด</button><button type="button" class="pm-btn sm" data-pm-pickclear="${scope}">ล้าง</button>
        <button type="button" class="pm-btn sm warn" data-pm-return="${scope}" data-batch="${esc(b.id)}" ${n && !state.busy ? '' : 'disabled'}>↩ ส่ง ${n} บิลที่เลือกกลับไปตั้งเบิกใหม่</button><span class="pm-note">ไม่ต้องโหลด PDF ซ้ำ — บิลกลับไปอยู่ในรายการเลือกตั้งเบิก</span></div>`; };
    const itemRow = (i, scope, extra = '') => `<div class="pm-item"><input type="checkbox" data-pm-pick="${scope}|${esc(i.key)}" ${state.picks.has(scope + '|' + i.key) ? 'checked' : ''}><span><b>${esc(i.building)}</b> — ${esc(i.desc)} · <b>${num(itemTotal(i))}</b></span>${stepChip(i.key)}${extra}</div>`;

    // ---------------------------------------------------------------- แท็บ ② รับเงิน
    function receiveHtml() {
        const b = batchOf(); if (!b) return batchPicker();
        const total = sum(b.items), groups = groupsOf(b), received = b.status !== 'requested';
        const notReq = b.items.filter(i => idxOf(i.key) < 2), toRecv = b.items.filter(i => idxOf(i.key) === 2);
        const ev = filesOf(toRecv.map(i => i.key), 3);
        const q = state.q.trim().toLowerCase();
        const banks = [...new Set(b.items.filter(i => i.method === 'bank').map(i => i.bank || '(ไม่ระบุ)'))];
        const shown = groups.filter(g => (state.filter === 'all' || state.filter === g.method || state.filter === 'b:' + (g.bank || '(ไม่ระบุ)')) && (!q || (g.title + ' ' + g.items.map(i => i.building + ' ' + i.desc + ' ' + i.company).join(' ') + ' ' + g.acctNo + ' ' + g.acctName).toLowerCase().includes(q)));
        const byM = m => sum(b.items.filter(i => i.method === m));
        const paidTotal = sum(groups.filter(g => b.paid?.[g.key]?.at).flatMap(g => g.items));
        const chip = (k, l) => `<button type="button" class="pm-chip ${state.filter === k ? 'is-on' : ''}" data-pm-filter="${esc(k)}">${esc(l)}</button>`;
        return `${batchPicker()}
        ${notReq.length ? `<div class="pm-warn">มี ${notReq.length} บิลในชุดนี้ยังไม่ได้ "ยืนยันตั้งเบิก" (แท็บ ① ด้านล่าง) — ต้องยืนยันตั้งเบิกก่อนจึงแนบหลักฐานและรับเงินได้ <button type="button" class="pm-btn sm" data-pm-tab="request">ไปแท็บ ① ยืนยันตั้งเบิก →</button></div>` : ''}
        <div class="pm-ev"><h3 style="margin:0">💵 บันทึกการรับเงิน — ${toRecv.length} บิลรอรับเงิน</h3>
            <div class="pm-grid"><label>วันที่ได้รับเงิน<input data-pm-recv="date" value="${esc(state.recvIn[b.id]?.date ?? (b.receivedAt || todayDmy()))}"></label>
            <label>ยอดเงินที่ได้รับจริง (LKR)<input data-pm-recv="amount" inputmode="decimal" value="${esc(state.recvIn[b.id]?.amount ?? (b.receivedAmount || total))}"></label>
            <div class="pm-kpi"><span>ส่วนต่างจากยอดตั้งเบิก</span><b id="pmDiff">${num((b.receivedAmount || total) - total)}</b></div></div>
            <div><div class="pm-thumbs">${thumbs(ev, 'ev', 3)}</div><label class="pm-up" style="margin-top:4px">＋ แนบรูปหลักฐานรับเงิน (แคปหน้าแชท)<input type="file" hidden accept="image/*,application/pdf" multiple data-pm-evup="3" data-batch="${esc(b.id)}" data-scope="rc"></label> <span class="pm-note">ไฟล์เดียวใช้กับทุกบิลที่รอรับเงินในชุดนี้</span></div>
            <div><button type="button" class="pm-btn primary" data-pm-receive ${toRecv.length && ev.length && !state.busy ? '' : 'disabled'}>✔ บันทึกว่าได้รับเงินแล้ว (${toRecv.length} บิล)</button></div></div>
        <div class="pm-kpis"><div class="pm-kpi"><span>🛒 ซุปเปอร์มาเก็ต</span><b>${num(byM('super'))}</b></div><div class="pm-kpi"><span>🏢 นิติบุคคล</span><b>${num(byM('condo'))}</b></div><div class="pm-kpi"><span>🏦 ธนาคาร</span><b>${num(byM('bank'))}</b></div><div class="pm-kpi"><span>จ่ายแล้ว / ทั้งหมด</span><b>${num(paidTotal)} / ${num(total)}</b></div></div>
        <div class="pm-chips">${chip('all', `ทั้งหมด ${groups.length} ก้อน`)}${chip('super', 'ซุปเปอร์มาเก็ต')}${chip('condo', 'นิติบุคคล')}${chip('bank', 'ธนาคารทั้งหมด')}${banks.map(x => chip('b:' + x, x)).join('')}
            <input data-pm-q placeholder="ค้นหาที่พัก / ธนาคาร / บริษัท…" value="${esc(state.q)}" style="max-width:260px"></div>
        ${pickBar('rc', b)}
        <div class="pm-groups">${shown.map(g => { const p = b.paid?.[g.key] || {}; return `<div class="pm-group ${p.at ? 'is-paid' : ''}"><h4>${esc(g.title)}</h4>
            ${g.method === 'bank' ? `<div class="pm-note">เลขบัญชี ${esc(g.acctNo)} · ${esc(g.acctName)}</div>` : ''}
            <div class="tot">LKR ${num(sum(g.items))}</div><div class="pm-note">${g.items.length} รายการ · ${[...new Set(g.items.map(i => i.company))].join(', ')}</div>
            ${g.items.map(i => itemRow(i, 'rc')).join('')}
            <label class="pm-check"><input type="checkbox" data-pm-paid="${esc(g.key)}" ${p.at ? 'checked' : ''} ${received ? '' : 'disabled'}><span>จ่ายก้อนนี้แล้ว ${p.at ? `<small>· ${esc(p.at)}</small>` : (received ? '' : '<small>(ต้องบันทึกรับเงินก่อน)</small>')}</span></label></div>`; }).join('') || '<div class="pm-note">ไม่พบก้อนที่ตรงกับตัวกรอง</div>'}</div>`;
    }

    // ---------------------------------------------------------------- แท็บ ③ จ่าย + นำส่งหลักฐาน
    const CHANNELS = [['telegram', 'Telegram — กลุ่ม SL ตั้งเบิก (ให้บัญชีดู)', 'sl'], ['whatsapp', 'WhatsApp — กลุ่มเจ้าของบ้าน', 'owner']];
    const chatUrls = () => lsGet('pmChatUrls', {});
    function messageFor(b, g, channel) {
        const lines = g.items.map(i => `• ${i.building} — ${i.desc} — LKR ${num(itemTotal(i))}`).join('\n');
        const where = g.method === 'bank' ? `โอน/ฝากเข้า ${g.bank} ${g.acctNo} (${g.acctName})` : g.method === 'condo' ? `ชำระที่นิติอาคาร ${g.items[0].place || ''}` : 'ชำระเงินสดที่ซุปเปอร์มาเก็ต';
        const paid = b.paid?.[g.key]?.at || todayDmy();
        return channel === 'whatsapp' ? `แจ้งหลักฐานการชำระค่าสาธารณูปโภค (${paid})\n${lines}\nรวม LKR ${num(sum(g.items))}\n${where}\nขอบคุณครับ/ค่ะ`
            : `หลักฐานการจ่ายบิล — ${b.label || b.period} (${paid})\n${lines}\nรวม LKR ${num(sum(g.items))} · ${where}`;
    }
    async function firstReceiptBlob(g) { const f = g.items.flatMap(i => rec(i.key)?.files || []).find(x => x.step === 4 && x.mime !== 'application/pdf'); if (!f) return null; const r = await window.authFetch(`${API}/accommodation-rooms/expenses/file/${encodeURIComponent(f.id)}`); return r.ok ? r.blob() : null; }
    async function toPng(blob) { if (blob.type === 'image/png') return blob; const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); return new Promise(res => c.toBlob(res, 'image/png')); }
    function deliverHtml() {
        const b = batchOf(); if (!b) return batchPicker();
        const groups = groupsOf(b), urls = chatUrls();
        const complete = g => g.items.every(i => idxOf(i.key) >= 4);
        const done = groups.filter(complete).length;
        return `${batchPicker()}
        <div class="pm-kpis"><div class="pm-kpi"><span>จ่าย+ส่งหลักฐานครบ</span><b>${done} / ${groups.length} ก้อน</b></div>
            <div class="pm-kpi"><span>ลิงก์ห้องแชท (เก็บในเครื่องนี้)</span><div class="pm-chips"><button type="button" class="pm-btn sm" data-pm-seturl="telegram">${urls.telegram ? '✓' : '＋'} Telegram</button><button type="button" class="pm-btn sm" data-pm-seturl="whatsapp">${urls.whatsapp ? '✓' : '＋'} WhatsApp</button></div></div></div>
        ${b.status === 'requested' ? '<div class="pm-warn">ยังไม่ได้บันทึกการรับเงิน (แท็บ ② รับเงิน) — ต้องรับเงินและจ่ายก่อนจึงนำส่งหลักฐานได้</div>' : ''}
        ${pickBar('dl', b)}
        <div class="pm-groups">${groups.map(g => { const paid = !!b.paid?.[g.key]?.at, d = b.deliver?.[g.key] || {}, keys = g.items.map(i => i.key);
            const missing = [!paid ? 'ติ๊ก "จ่ายก้อนนี้แล้ว" (แท็บ ②)' : '', ...g.items.filter(i => !(rec(i.key)?.files || []).some(f => f.step === 4)).map(i => `ใบเสร็จของ ${i.building}`), ...CHANNELS.filter(([k]) => !d[k]).map(([, l]) => `ส่ง ${l}`), ...g.items.filter(i => idxOf(i.key) < 3).map(i => `${i.building} ยังไม่ผ่านขั้นรับเงิน`)].filter(Boolean);
            return `<div class="pm-group ${complete(g) ? 'is-paid' : ''}" data-gk="${esc(g.key)}"><h4>${esc(g.title)} ${complete(g) ? '✓' : ''}</h4>
            <div class="tot">LKR ${num(sum(g.items))}</div>
            ${g.items.map(i => itemRow(i, 'dl', `<div class="sub"><div class="pm-thumbs">${thumbs((rec(i.key)?.files || []).filter(f => f.step === 4), 'rc', 4)}</div><label class="pm-up">＋ ใบเสร็จ<input type="file" hidden accept="image/*,application/pdf" multiple data-pm-evup="4" data-batch="${esc(b.id)}" data-scope="item" data-key="${esc(i.key)}"></label></div>`)).join('')}
            <label class="pm-up" style="justify-self:start">＋ แนบใบเสร็จใบเดียวให้ทุกบิลในก้อน<input type="file" hidden accept="image/*,application/pdf" multiple data-pm-evup="4" data-batch="${esc(b.id)}" data-scope="group" data-gk="${esc(g.key)}"></label>
            ${CHANNELS.map(([k, l]) => `<div class="pm-item" style="grid-template-columns:1fr auto"><span><b>${esc(l)}</b> ${d[k] ? `<small>· ส่งแล้ว ${esc(d[k])}</small>` : ''}</span>
                <span class="pm-chips"><button type="button" class="pm-btn sm" data-pm-copy="msg" data-gk="${esc(g.key)}" data-ch="${k}">📋 ข้อความ</button><button type="button" class="pm-btn sm" data-pm-copy="img" data-gk="${esc(g.key)}" data-ch="${k}">🖼 รูป</button>
                <button type="button" class="pm-btn sm" data-pm-open data-gk="${esc(g.key)}" data-ch="${k}">↗ เปิดแชท</button>${navigator.canShare ? `<button type="button" class="pm-btn sm" data-pm-share data-gk="${esc(g.key)}" data-ch="${k}">📤 แชร์</button>` : ''}
                <label class="pm-check" style="margin:0"><input type="checkbox" data-pm-deliver="${esc(g.key)}|${k}" ${d[k] ? 'checked' : ''} ${paid ? '' : 'disabled'}> ส่งแล้ว</label></span></div>`).join('')}
            <button type="button" class="pm-btn primary" data-pm-advance="paid" data-gk="${esc(g.key)}" data-batch="${esc(b.id)}" ${missing.length || complete(g) || state.busy ? 'disabled' : ''}>${complete(g) ? '✓ ก้อนนี้ครบแล้ว' : '✔ ยืนยันจ่าย + ส่งหลักฐานครบ (' + keys.length + ' บิล)'}</button>
            ${!complete(g) && missing.length ? `<div class="pm-note" style="color:#b42318">ยังขาด: ${missing.map(esc).join(' · ')}</div>` : ''}</div>`; }).join('')}</div>`;
    }

    function render() {
        const b = batchOf(), st = stageState(b);
        const tabs = [['request', '① ตั้งเบิก', 'เลือกบิล · วิธีจ่าย · PDF · ยืนยันตั้งเบิก', st.request], ['receive', '② รับเงิน', 'หลักฐานรับเงิน · จัดก้อนตามจุดจ่าย', st.receive], ['deliver', '③ จ่าย + นำส่งหลักฐาน', 'ใบเสร็จ · Telegram · WhatsApp', st.deliver]];
        const body = state.tab === 'request' ? requestHtml() : state.tab === 'receive' ? receiveHtml() : deliverHtml();
        const keep = dialog.querySelector('.pm-wrap')?.scrollTop || 0;
        dialog.innerHTML = `<div class="pm-wrap"><div class="pm-top"><h2>จัดการรายงานทุกขั้นตอน — บิลที่พักพนักงาน</h2><button type="button" class="pm-btn" data-pm-close>ปิด</button></div>
            <div class="pm-tabs">${tabs.map(([k, t, s, done]) => `<button type="button" data-pm-tab="${k}" class="${state.tab === k ? 'is-on' : done ? 'is-done' : ''}">${t}${done ? ' ✓' : ''}<small>${s}</small></button>`).join('')}</div>
            <div class="pm-note">🟢 เขียว = ขั้นที่กำลังทำ · 🟡 เหลือง = ทำเสร็จแล้ว (ชุดที่เลือกอยู่)</div>
            <p class="pm-msg ${state.bad ? 'bad' : ''}" role="status">${esc(state.msg)}</p>${body}</div>`;
        dialog.querySelector('.pm-wrap').scrollTop = keep;
        hydrate();
    }

    // ---------------------------------------------------------------- เหตุการณ์
    const keysIn = (scope, b) => b.items.filter(i => state.picks.has(scope + '|' + i.key) && (scope !== 'rq' || idxOf(i.key) < 2)).map(i => i.key);   // ติ๊ก 'rq' ที่ค้างของบิลที่ยืนยันตั้งเบิกไปแล้วไม่นับ
    dialog.addEventListener('click', async event => {
        const t = event.target, b = batchOf();
        if (t.closest('[data-pm-close]') || t === dialog) return dialog.close();
        const view = t.closest('[data-pm-view]'); if (view && !t.closest('[data-pm-rm]')) return openViewer(view.dataset.pmView, view.dataset.mime);
        const tab = t.closest('[data-pm-tab]'); if (tab) { readTop(dialog); state.tab = tab.dataset.pmTab; state.msg = ''; state.bad = false; return render(); }
        const f = t.closest('[data-pm-filter]'); if (f) { state.filter = f.dataset.pmFilter; return render(); }
        if (t.closest('[data-pm-create]')) { readTop(dialog); return createBatch(); }
        const pdf = t.closest('[data-pm-pdf]');
        if (pdf) { const bb = state.batches.find(x => x.id === (pdf.dataset.batch || state.batchId)); return act('กำลังสร้าง PDF', async () => { await downloadPdf(bb); return 'ดาวน์โหลด PDF แล้ว'; }); }
        const pa = t.closest('[data-pm-pickall]'); if (pa && b) { const sc = pa.dataset.pmPickall; (sc === 'rq' ? [] : b.items).forEach(i => state.picks.add(sc + '|' + i.key)); return render(); }
        const pc = t.closest('[data-pm-pickclear]'); if (pc && b) { const sc = pc.dataset.pmPickclear; b.items.forEach(i => state.picks.delete(sc + '|' + i.key)); return render(); }
        const ret = t.closest('[data-pm-return]');
        if (ret) {
            const bb = state.batches.find(x => x.id === (ret.dataset.batch || state.batchId)), sc = ret.dataset.pmReturn, keys = keysIn(sc, bb);
            if (!keys.length || !window.confirm(`ส่ง ${keys.length} บิลกลับไปรายการเลือกตั้งเบิกใหม่?\n(ไม่ต้องโหลด PDF ซ้ำ · หลักฐานที่แนบไว้ยังอยู่ · บิลจะกลับเป็นขั้น ② ได้รับบิลและลงเว็บแล้ว)`)) return;
            return act('กำลังส่งบิลกลับ', async () => { const res = await request(`${PAY}/return`, { method: 'POST', body: JSON.stringify({ batchId: bb.id, keys }) }); keys.forEach(k => ['rq', 'rc', 'dl'].forEach(s => state.picks.delete(s + '|' + k))); applyOverview(res); state.tab = 'request'; return `ส่ง ${res.returned} บิลกลับไปตั้งเบิกแล้ว${res.cancelled ? ' (ชุดนี้ว่างเปล่า ปิดชุดให้)' : ''}${res.failed?.length ? ' · บางบิลย้อนไม่สำเร็จ: ' + res.failed.join(' · ') : ''}`; });
        }
        const adv = t.closest('[data-pm-advance]');
        if (adv) {
            const bb = state.batches.find(x => x.id === (adv.dataset.batch || state.batchId)), stage = adv.dataset.pmAdvance;
            if (stage === 'request') {
                const keys = keysIn('rq', bb), date = dialog.querySelector(`[data-pm-ev-date="rq-${bb.id}"]`)?.value.trim();
                if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date || '')) { state.msg = 'กรอกวันที่ตั้งเบิกเป็น วัน/เดือน/ปี'; state.bad = true; return render(); }
                if (!keys.length) { state.msg = 'ยังไม่ได้เลือกบิลที่จะยืนยันตั้งเบิก'; state.bad = true; return render(); }
                return act('กำลังยืนยันตั้งเบิก', () => advanceFlow(bb, 'request', keys, date, [], 'ยืนยันตั้งเบิก'));
            }
            const g = groupsOf(bb).find(x => x.key === adv.dataset.gk); if (!g) return;
            return act('กำลังยืนยันจ่ายและส่งหลักฐาน', async () => { const msg = await advanceFlow(bb, 'paid', g.items.map(i => i.key), bb.paid?.[g.key]?.at || todayDmy(), ['sl', 'owner'], 'ยืนยันจ่าย+ส่งหลักฐาน'); await maybeFinish(bb.id); return msg; });
        }
        if (t.closest('[data-pm-receive]') && b) {
            const date = dialog.querySelector('[data-pm-recv=date]').value.trim(), amount = Number(String(dialog.querySelector('[data-pm-recv=amount]').value).replace(/,/g, ''));
            if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)) { state.msg = 'กรอกวันที่ได้รับเงินเป็น วัน/เดือน/ปี'; state.bad = true; return render(); }
            if (!(amount > 0)) { state.msg = 'กรอกยอดเงินที่ได้รับจริง'; state.bad = true; return render(); }
            return act('กำลังบันทึกการรับเงิน', async () => {
                const saved = await request(`${PAY}/batches`, { method: 'PUT', body: JSON.stringify({ ...b, receivedAt: date, receivedAmount: amount, status: b.status === 'requested' ? 'received' : b.status }) }); applyOverview(saved);
                return advanceFlow(batchOf(), 'received', b.items.filter(i => idxOf(i.key) === 2).map(i => i.key), date, [], 'บันทึกรับเงิน');
            });
        }
        const rm = t.closest('[data-pm-rm]');
        if (rm && b) {
            if (!window.confirm(rm.dataset.pmRm === 'rc' ? 'เอาใบเสร็จนี้ออก? (ไฟล์ยังเก็บใน Drive)' : 'เอาไฟล์นี้ออกจากทุกบิลที่ผูกไว้? (ไฟล์ยังเก็บใน Drive)')) return;
            return act('กำลังเอาไฟล์ออก', async () => { await removeEvidence(rm.dataset.rmId, Number(rm.dataset.rmStep)); return 'เอาไฟล์ออกแล้ว'; });
        }
        const su = t.closest('[data-pm-seturl]'); if (su) { const k = su.dataset.pmSeturl, cur = chatUrls(); const v = window.prompt(`วางลิงก์ห้องแชท ${k === 'telegram' ? 'Telegram (เช่น https://t.me/ชื่อกลุ่ม หรือ https://web.telegram.org/...)' : 'WhatsApp (เช่น https://web.whatsapp.com/ หรือ https://chat.whatsapp.com/...)'}`, cur[k] || ''); if (v !== null) { if (v.trim() && !/^https?:\/\//i.test(v.trim())) { state.msg = 'ลิงก์ต้องขึ้นต้นด้วย https://'; state.bad = true; return render(); } lsSet('pmChatUrls', { ...cur, [k]: v.trim() }); render(); } return; }
        const cp = t.closest('[data-pm-copy]');
        if (cp && b) {
            const g = groupsOf(b).find(x => x.key === cp.dataset.gk), ch = cp.dataset.ch;
            try {
                if (cp.dataset.pmCopy === 'msg') { await navigator.clipboard.writeText(messageFor(b, g, ch)); state.msg = 'คัดลอกข้อความแล้ว — ไปวางในแชท'; }
                else { const blob = await firstReceiptBlob(g); if (!blob) throw new Error('ยังไม่มีรูปใบเสร็จ (PDF คัดลอกเป็นรูปไม่ได้ — ใช้ปุ่ม แชร์ หรือดาวน์โหลดไปแนบเอง)'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toPng(blob) })]); state.msg = 'คัดลอกรูปใบเสร็จแล้ว — กด Ctrl+V ในช่องแชท'; }
                state.bad = false;
            } catch (error) { state.msg = 'คัดลอกไม่ได้: ' + error.message; state.bad = true; }
            return render();
        }
        const op = t.closest('[data-pm-open]');
        if (op && b) { const ch = op.dataset.ch, url = chatUrls()[ch]; if (!url) { state.msg = `ยังไม่ได้ตั้งลิงก์ห้องแชท ${ch} — กดปุ่ม "＋ ${ch === 'telegram' ? 'Telegram' : 'WhatsApp'}" ด้านบนก่อน`; state.bad = true; return render(); } if (!/^https?:\/\//i.test(url)) { state.msg = 'ลิงก์ห้องแชทต้องขึ้นต้นด้วย https:// เท่านั้น — กดปุ่มตั้งลิงก์ใหม่'; state.bad = true; return render(); } window.open(url, '_blank', 'noopener'); state.msg = 'เปิดห้องแชทแล้ว — วางข้อความ/รูป กดส่งเอง แล้วกลับมาติ๊ก "ส่งแล้ว"'; state.bad = false; return render(); }
        const sh = t.closest('[data-pm-share]');
        if (sh && b) {
            const g = groupsOf(b).find(x => x.key === sh.dataset.gk), ch = sh.dataset.ch;
            try {
                const files = []; for (const i of g.items) for (const f of (rec(i.key)?.files || []).filter(x => x.step === 4).slice(0, 3)) { const r = await window.authFetch(`${API}/accommodation-rooms/expenses/file/${encodeURIComponent(f.id)}`); if (r.ok) { const bl = await r.blob(); files.push(new File([bl], f.name || 'receipt', { type: bl.type })); } }
                const payload = { text: messageFor(b, g, ch), ...(files.length && navigator.canShare({ files }) ? { files } : {}) };
                await navigator.share(payload);
                // แชร์สำเร็จ (ผู้ใช้เลือกแอปและกดส่งในหน้าแชร์) → ติ๊ก "ส่งแล้ว" ให้ · แก้/ยกเลิกได้ที่ช่องติ๊ก
                return patchBatch(bb => { bb.deliver = bb.deliver || {}; bb.deliver[g.key] = bb.deliver[g.key] || {}; bb.deliver[g.key][ch] = todayDmy(); }, 'บันทึกว่าส่งแล้วจากการแชร์ (ถ้าไม่ได้ส่งจริง ให้เอาติ๊กออก)');
            } catch (error) { if (error?.name !== 'AbortError') { state.msg = 'แชร์ไม่ได้: ' + error.message; state.bad = true; render(); } }
        }
    });
    async function advanceFlow(b, stage, keys, date, checks, label) {
        const res = await request(`${PAY}/advance`, { method: 'POST', body: JSON.stringify({ batchId: b.id, stage, keys, date, checks }) });
        applyOverview(res);
        const ok = res.results.filter(r => r.ok).length, bad = res.results.filter(r => r.error);
        if (bad.length) { state.bad = true; return `${label}สำเร็จ ${ok} บิล · ไม่สำเร็จ ${bad.length}: ${bad.slice(0, 3).map(r => r.key.split('|')[0] + ' — ' + r.error).join(' | ')}`; }
        return `${label}แล้ว ${ok} บิล`;
    }
    async function maybeFinish(id) { const b = state.batches.find(x => x.id === id); if (b && b.status !== 'done' && b.items.every(i => idxOf(i.key) >= 4)) { const saved = await request(`${PAY}/batches`, { method: 'PUT', body: JSON.stringify({ ...b, status: 'done' }) }); applyOverview(saved); } }
    function patchBatch(fn, okMsg) {
        const b = structuredClone(batchOf()); fn(b);
        return act('กำลังบันทึก', async () => { const saved = await request(`${PAY}/batches`, { method: 'PUT', body: JSON.stringify(b) }); applyOverview(saved); return okMsg || ''; });
    }
    dialog.addEventListener('change', async event => {
        const t = event.target, b = batchOf();
        if (t.matches('[data-pm-batch]')) { state.batchId = t.value; return render(); }
        if (t.matches('[data-pm-all]')) { readTop(dialog); state.cands.forEach(c => t.checked ? state.sel.add(c.key) : state.sel.delete(c.key)); return render(); }
        if (t.matches('[data-pm-pick]')) { t.checked ? state.picks.add(t.dataset.pmPick) : state.picks.delete(t.dataset.pmPick); return render(); }
        if (t.matches('[data-pm-evup]')) {
            const files = [...t.files]; t.value = ''; if (!files.length || !b) return;
            const bb = state.batches.find(x => x.id === t.dataset.batch) || b, sc = t.dataset.scope, step = Number(t.dataset.pmEvup);
            const keys = sc === 'rq' ? bb.items.filter(i => state.picks.has('rq|' + i.key) && idxOf(i.key) < 2).map(i => i.key)
                : sc === 'rc' ? bb.items.filter(i => idxOf(i.key) === 2).map(i => i.key)
                    : sc === 'item' ? [t.dataset.key] : (groupsOf(bb).find(g => g.key === t.dataset.gk)?.items.map(i => i.key) || []);
            if (!keys.length && sc === 'rc') { state.msg = 'ยังแนบหลักฐานรับเงินไม่ได้ — ไม่มีบิลที่ "ยืนยันตั้งเบิก" แล้วในชุดนี้ (ตอนนี้ ' + bb.items.filter(i => idxOf(i.key) < 2).length + ' บิลยังอยู่ขั้นก่อนตั้งเบิก) · ไปที่แท็บ ① ตั้งเบิก → แนบหลักฐาน + กรอกวันที่ → กด "ยืนยันตั้งเบิก" ก่อน แล้วกลับมาแท็บนี้'; state.bad = true; return render(); }
            return act('กำลังอัปโหลด', () => uploadEvidence(files, keys, step));
        }
        const row = t.closest('tr[data-key]');
        if (row) {
            readTop(dialog);
            const r = state.rows.get(row.dataset.key);
            if (t.matches('[data-pm-sel]')) { t.checked ? state.sel.add(r.key) : state.sel.delete(r.key); return render(); }
            const f = t.dataset.f; if (!f) return;
            r[f] = t.value;
            if (f === 'method' && t.value === 'super' && !Number(r.fee)) r.fee = 30;
            if (f === 'method' || f === 'company') return render();
            dialog.querySelectorAll('tr[data-key]').forEach(tr => { const x = state.rows.get(tr.dataset.key); tr.querySelector('.rowtot').textContent = num(itemTotal(x)); });
            dialog.querySelectorAll('tr.sub').forEach(tr => { const list = state.cands.map(c => state.rows.get(c.key)).filter(x => ((x.company || '').trim() || 'ไม่ระบุบริษัท') === tr.dataset.co && state.sel.has(x.key)); tr.querySelector('.subtot').textContent = num(sum(list)); });
            const g = dialog.querySelector('#pmGrand'); if (g) g.textContent = num(sum(state.cands.map(c => state.rows.get(c.key)).filter(x => state.sel.has(x.key))));
            return;
        }
        if (t.matches('[data-pm-top]')) { readTop(dialog); return; }
        if (t.matches('[data-pm-paid]') && b) { const k = t.dataset.pmPaid, on = t.checked; return patchBatch(bb => { bb.paid = bb.paid || {}; if (on) bb.paid[k] = { at: todayDmy(), by: '' }; else delete bb.paid[k]; if (!on) { delete (bb.deliver || {})[k]; if (bb.status === 'done') bb.status = 'received'; } }); }
        if (t.matches('[data-pm-deliver]') && b) { const [k, ch] = t.dataset.pmDeliver.split('|'), on = t.checked; return patchBatch(bb => { bb.deliver = bb.deliver || {}; bb.deliver[k] = bb.deliver[k] || {}; bb.deliver[k][ch] = on ? todayDmy() : ''; if (!on && bb.status === 'done') bb.status = 'received'; }); }
    });
    dialog.addEventListener('input', event => {
        const t = event.target;
        if (t.matches('[data-pm-q]')) { state.q = t.value; const pos = t.selectionStart; render(); const q = dialog.querySelector('[data-pm-q]'); q.focus(); q.setSelectionRange(pos, pos); return; }
        if (t.matches('[data-pm-ev-date]')) { state.dates[t.dataset.pmEvDate] = t.value; return; }
        if (t.matches('[data-pm-recv]')) { const bq = batchOf(); if (bq) state.recvIn[bq.id] = { ...(state.recvIn[bq.id] || {}), [t.dataset.pmRecv]: t.value }; const b = bq, a = Number(String(dialog.querySelector('[data-pm-recv=amount]').value).replace(/,/g, '')) || 0; const d = dialog.querySelector('#pmDiff'); if (d && b) d.textContent = num(a - sum(b.items)); }
    });
    button.addEventListener('click', async () => {
        state.msg = 'กำลังโหลด…'; state.bad = false; render(); dialog.showModal();
        try { await load(); state.msg = ''; } catch (error) { state.msg = error.message; state.bad = true; }
        render();
    });
})();
