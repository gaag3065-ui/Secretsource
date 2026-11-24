// จัดการพนักงาน: เงื่อนไขประจำกล่องงาน (เทมเพลต) → กำหนดให้พนักงานรายคน (ป้ายสี + เลือกจากรายการเท่านั้น) → ตัวกรองชั้นที่ 2
// ใช้ร่วมกับ staff-management.js ผ่าน window.StaffAlloc (init ส่ง state/request/toast/render มาให้) · ตารางจัดสรรสิ่งของอยู่ใน staff-allocation-grid.js
// ข้อมูลอยู่หลังบ้าน /api/staff/boxes/:key/... (ชีต "ฐานข้อมูลจัดการพนักงาน" แท็บใหม่) — ไม่แตะงานและข้อมูลที่พนักงานกรอกเดิม
(() => {
    const $ = id => document.getElementById(id);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const S = { ctx: null, data: new Map(), loading: new Map(), failed: new Map(), dialog: null };
    const enc = encodeURIComponent;
    const view = box => S.data.get(box);

    async function load(box, force = false) {
        if (!force && S.data.has(box)) return S.data.get(box);
        if (!S.loading.has(box)) {
            S.loading.set(box, S.ctx.request(`/boxes/${enc(box)}/allocation`)
                .then(r => { S.failed.delete(box); S.data.set(box, r.allocation); return r.allocation; })
                .catch(error => { S.failed.set(box, error.message); throw error; })
                .finally(() => S.loading.delete(box)));
        }
        return S.loading.get(box);
    }
    // เรียก API แก้ไขของกล่องนี้ → หลังบ้านตอบข้อมูลล่าสุดของกล่องกลับมา
    async function call(box, path, method, body) {
        const r = await S.ctx.request(`/boxes/${enc(box)}${path}`, { method, body: JSON.stringify(body || {}) });
        S.data.set(box, r.allocation);
        return r;
    }
    const peopleOf = box => [...new Set((S.ctx.state.data?.tasks || []).filter(t => t.box === box && t.status !== 'cancelled').map(t => t.employee_key))];
    const condOf = (box, key) => { const d = view(box); return d ? d.conds.find(c => c.id === d.assign[key]) || null : null; };
    const badge = c => c ? `<i class="sa-badge" style="--c:${esc(c.color)}">${esc(c.name)}</i>` : '';
    const options = (d, current) => `<option value="">— ไม่มีเงื่อนไข —</option>${d.conds.map(c => `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`;
    const boxTitle = box => (S.ctx.state.data?.boxes || []).find(b => b.key === box)?.title || box;

    // ---------------------------------------------------------------- แถบเงื่อนไขใต้กล่องงาน + ตัวกรอง (เรียกทุกครั้งที่วาดตาราง)
    function sync() {
        const { state } = S.ctx, box = state.box, bar = $('smCondBar'), sel = $('smCond');
        if (!bar || !sel) return;
        if (!box || state.partial) { bar.hidden = true; sel.hidden = true; sel.value = ''; return; }
        bar.hidden = false;
        const d = view(box);
        if (!d) {
            sel.hidden = true;
            if (S.failed.has(box)) { bar.innerHTML = `<span class="sa-note is-bad">โหลดเงื่อนไขไม่สำเร็จ: ${esc(S.failed.get(box))}</span> <button type="button" class="fa-btn fa-btn-ghost" data-sa="retry">ลองอีกครั้ง</button>`; return; }
            bar.innerHTML = '<span class="sa-note">กำลังโหลดเงื่อนไข…</span>';
            load(box).then(() => S.ctx.rerender()).catch(() => S.ctx.rerender());
            return;
        }
        const people = peopleOf(box), count = id => people.filter(k => d.assign[k] === id).length;
        const keep = sel.value;
        sel.hidden = !d.conds.length;
        sel.innerHTML = `<option value="">เงื่อนไข : ทั้งหมด</option><option value="_none">ยังไม่กำหนดเงื่อนไข (${people.filter(k => !d.assign[k]).length})</option>${d.conds.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${count(c.id)})</option>`).join('')}`;
        sel.value = [...sel.options].some(o => o.value === keep) ? keep : '';
        sel.classList.toggle('is-set', Boolean(sel.value));
        bar.innerHTML = `<b>🏷 เงื่อนไขในงานนี้</b>
            <span class="sa-chips">${d.conds.map(c => `<button type="button" class="sa-chip${sel.value === c.id ? ' is-on' : ''}" style="--c:${esc(c.color)}" data-sa-filter="${esc(c.id)}" title="กรองเฉพาะเงื่อนไขนี้">${esc(c.name)} <i>${count(c.id)}</i></button>`).join('') || '<span class="sa-note">ยังไม่มีเงื่อนไข — กด "เพิ่มเงื่อนไข" เพื่อสร้างเทมเพลต</span>'}</span>
            <button type="button" class="fa-btn" data-sa="manage">＋ เพิ่ม / จัดการเงื่อนไข</button>
            ${d.conds.length ? `<select data-sa-bulk aria-label="ตั้งเงื่อนไขให้ทุกคนที่แสดงอยู่"><option value="">ตั้งเงื่อนไขให้คนที่แสดงอยู่ทั้งหมด…</option><option value="_clear">— เอาเงื่อนไขออก —</option>${d.conds.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>` : ''}
            <button type="button" class="fa-btn fa-btn-primary" data-sa="grid">📦 จัดสรรสิ่งของ</button>`;
    }
    const matches = key => {
        const box = S.ctx.state.box, want = $('smCond')?.value, d = box && view(box);
        if (!want || !d) return true;
        return want === '_none' ? !d.assign[key] : d.assign[key] === want;
    };
    // ช่องเลือกเงื่อนไขในแถวรายชื่อ (เฉพาะเมื่อเลือกกล่องงานและกล่องนั้นมีเงื่อนไข)
    function cell(key) {
        const box = S.ctx.state.box, d = box && view(box);
        if (!d || !d.conds.length || !peopleOf(box).includes(key)) return '';
        return `<div class="sa-cell">${badge(condOf(box, key))}<select class="sa-pick" data-sa-pick="${esc(key)}" data-sa-box="${esc(box)}" aria-label="เลือกเงื่อนไข">${options(d, d.assign[key])}</select></div>`;
    }
    // ใน Modal "ตรวจเอกสาร" ของพนักงาน: เลือกเงื่อนไขของทุกกล่องงานที่พนักงานคนนี้อยู่ (ที่กล่องนั้นมีเงื่อนไขแล้ว)
    async function fillModal(key) {
        const slot = document.querySelector('[data-sa-slot]');
        if (!slot) return;
        const boxes = [...new Set((S.ctx.state.data?.tasks || []).filter(t => t.employee_key === key && t.status !== 'cancelled').map(t => t.box))];
        const rows = [];
        for (const box of boxes) {
            try { const d = await load(box); if (d.conds.length) rows.push(`<label class="sa-modal-row"><span>${esc(boxTitle(box))}</span>${badge(condOf(box, key))}<select class="sa-pick" data-sa-pick="${esc(key)}" data-sa-box="${esc(box)}">${options(d, d.assign[key])}</select></label>`); } catch { /* หลังบ้านเก่า — ไม่แสดงช่องนี้ */ }
        }
        if (slot.isConnected) slot.innerHTML = rows.length ? `<div class="sa-modal"><b>🏷 เงื่อนไข</b>${rows.join('')}</div>` : '';
    }

    // ---------------------------------------------------------------- จัดการเทมเพลตเงื่อนไข (เพิ่ม / เปลี่ยนชื่อ / ลบ)
    function manage() {
        const box = S.ctx.state.box, d = view(box);
        if (!d) return;
        S.dialog ||= Object.assign(document.createElement('dialog'), { className: 'fa-dialog sa-dialog' });
        if (!S.dialog.isConnected) document.body.append(S.dialog);
        const people = peopleOf(box);
        S.dialog.innerHTML = `<div class="sa-box"><header class="sa-head"><div><h2>🏷 เงื่อนไขของงาน “${esc(boxTitle(box))}”</h2><p>สร้างเป็นเทมเพลตไว้ แล้วเลือกให้พนักงานแต่ละคนจากรายการนี้ (ไม่ต้องพิมพ์เอง)</p></div><button type="button" class="sa-x" data-sa-close aria-label="ปิด">×</button></header>
            <div class="sa-list">${d.conds.map(c => `<div class="sa-row" data-cond="${esc(c.id)}"><i class="sa-dot" style="--c:${esc(c.color)}"></i><input value="${esc(c.name)}" maxlength="60" aria-label="ชื่อเงื่อนไข"><small>${people.filter(k => d.assign[k] === c.id).length} คน</small><button type="button" class="fa-btn" data-sa-rename>บันทึกชื่อ</button><button type="button" class="fa-btn fa-btn-ghost" data-sa-del>ลบ</button></div>`).join('') || '<p class="sa-note">ยังไม่มีเงื่อนไข</p>'}</div>
            <form class="sa-add" data-sa-add><input name="name" maxlength="60" placeholder="ชื่อเงื่อนไขใหม่ เช่น กลุ่ม A - รับของที่ออฟฟิศ" required><button class="fa-btn fa-btn-primary">＋ เพิ่มเงื่อนไข</button></form>
            <p class="sa-msg" data-sa-msg role="status"></p></div>`;
        if (!S.dialog.open) S.dialog.showModal();
    }
    const msg = (text, bad) => { const n = S.dialog?.querySelector('[data-sa-msg]'); if (n) { n.textContent = text; n.className = `sa-msg${bad ? ' is-bad' : ''}`; } };
    async function manageAction(fn, ok) {
        try { await fn(); manage(); msg(ok); S.ctx.rerender(); } catch (error) { msg(error.message, true); }
    }

    // ---------------------------------------------------------------- เหตุการณ์
    async function setAssign(box, assignments, okText) {
        try { await call(box, '/assign', 'PUT', { assignments }); S.ctx.toast(okText); } catch (error) { S.ctx.toast(error.message, true); }
        S.ctx.rerender();
        document.querySelector('[data-sa-slot]') && fillModal(assignments[0]?.employee_key);
    }
    document.addEventListener('change', event => {
        const pickSel = event.target.closest?.('[data-sa-pick]');
        if (pickSel) return setAssign(pickSel.dataset.saBox || S.ctx.state.box, [{ employee_key: pickSel.dataset.saPick, cond_id: pickSel.value }], 'บันทึกเงื่อนไขแล้ว');
        const bulk = event.target.closest?.('[data-sa-bulk]');
        if (!bulk || !bulk.value) return;
        const box = S.ctx.state.box, d = view(box), keys = S.ctx.visible().filter(k => peopleOf(box).includes(k));
        const cond = bulk.value === '_clear' ? '' : bulk.value, name = cond ? d.conds.find(c => c.id === cond)?.name : 'ไม่มีเงื่อนไข';
        bulk.value = '';
        if (keys.length && confirm(`ตั้งเงื่อนไข “${name}” ให้ ${keys.length} คนที่แสดงอยู่ตอนนี้?`)) setAssign(box, keys.map(k => ({ employee_key: k, cond_id: cond })), `ตั้งเงื่อนไขให้ ${keys.length} คนแล้ว`);
    });
    document.addEventListener('click', event => {
        const t = event.target, box = S.ctx?.state.box;
        const chip = t.closest?.('[data-sa-filter]');
        if (chip) { const sel = $('smCond'); sel.value = sel.value === chip.dataset.saFilter ? '' : chip.dataset.saFilter; return S.ctx.rerender(); }
        const act = t.closest?.('[data-sa]')?.dataset.sa;
        if (act === 'manage') return manage();
        if (act === 'grid') return window.StaffAllocGrid?.open(box);
        if (act === 'retry') { S.failed.delete(box); return S.ctx.rerender(); }
    });
    document.addEventListener('submit', event => {
        const form = event.target.closest?.('[data-sa-add]');
        if (!form) return;
        event.preventDefault();
        manageAction(() => call(S.ctx.state.box, '/conditions', 'POST', { name: form.elements.name.value }), 'เพิ่มเงื่อนไขแล้ว');
    });
    document.addEventListener('click', event => {
        if (!S.dialog?.contains(event.target)) return;
        if (event.target === S.dialog || event.target.closest('[data-sa-close]')) return S.dialog.close();
        const row = event.target.closest('[data-cond]'), box = S.ctx.state.box;
        if (!row) return;
        if (event.target.closest('[data-sa-rename]')) manageAction(() => call(box, `/conditions/${enc(row.dataset.cond)}`, 'PUT', { name: row.querySelector('input').value }), 'เปลี่ยนชื่อแล้ว');
        if (event.target.closest('[data-sa-del]') && confirm('ลบเงื่อนไขนี้? (พนักงานที่เลือกไว้จะกลายเป็น "ไม่มีเงื่อนไข" — ข้อมูลในชีตยังอยู่)')) manageAction(() => call(box, `/conditions/${enc(row.dataset.cond)}/delete`, 'POST'), 'ลบเงื่อนไขแล้ว');
    });

    window.StaffAlloc = {
        init: ctx => { S.ctx = ctx; },
        sync, matches, cell, fillModal, view, load, call, peopleOf, condOf, badge, boxTitle,
        ctx: () => S.ctx, refresh: box => load(box, true)
    };
})();
