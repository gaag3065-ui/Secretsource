// ผังงานสำหรับผู้บริหาร: แสดงข้อมูลจาก GET /api/exec/workflows เท่านั้น
(() => {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const finished = s => ['done', 'skip'].includes(s.status);
    const status = s => finished(s) ? (s.status === 'skip' ? 'ข้ามขั้นตอน' : '✓ สำเร็จแล้ว') : s.status === 'doing' ? '● กำลังทำ' : s.ready ? 'พร้อมเริ่ม' : 'รอขั้นตอนก่อนหน้า';
    const kind = s => finished(s) ? 'done' : s.status === 'doing' ? 'doing' : s.ready ? 'ready' : 'wait';
    let projects = [];
    function graph(p) {
        if (!p.steps.length) return '<p>ยังไม่มีขั้นตอนงาน</p>';
        const levels = new Map(), byId = new Map(p.steps.map(s => [s.id, s]));
        const level = s => {
            if (levels.has(s.id)) return levels.get(s.id);
            levels.set(s.id, 0);
            const value = s.after.length ? 1 + Math.max(...s.after.filter(a => byId.has(a)).map(a => level(byId.get(a))), -1) : 0;
            levels.set(s.id, value); return value;
        };
        const cols = [];
        p.steps.forEach(s => (cols[level(s)] ||= []).push(s));
        const positions = new Map(), w = 230, h = 116, gap = 54;
        cols.forEach((col, x) => col.forEach((s, y) => positions.set(s.id, { x: 16 + x * (w + gap), y: 16 + y * (h + 20) })));
        const width = 32 + cols.length * (w + gap) - gap, height = 32 + Math.max(...cols.map(c => c.length)) * (h + 20) - 20;
        const paths = p.steps.flatMap(s => s.after.map(a => {
            const from = positions.get(a), to = positions.get(s.id); if (!from || !to) return '';
            const x = from.x + w, y = from.y + h / 2, endX = to.x - 5, endY = to.y + h / 2, mid = (x + endX) / 2;
            return `<path d="M${x},${y} C${mid},${y} ${mid},${endY} ${endX},${endY}" stroke="${finished(byId.get(a)) ? '#16a34a' : '#94a3b8'}" marker-end="url(#exArrow${p.id})"/>`;
        })).join('');
        return `<div class="ex-wf-scroll" tabindex="0" aria-label="ผังขั้นตอน ${esc(p.title)}"><div class="ex-wf-canvas" style="width:${width}px;height:${height}px">
            <svg width="${width}" height="${height}" aria-hidden="true"><defs><marker id="exArrow${p.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#94a3b8" stroke="none"/></marker></defs>${paths}</svg>
            ${p.steps.map((s, i) => { const at = positions.get(s.id); return `<button type="button" class="ex-wf-node is-${kind(s)}" data-ex-project="${p.id}" data-ex-step="${i}" style="left:${at.x}px;top:${at.y}px;width:${w}px;height:${h}px"><small>${i + 1}. ${status(s)}</small><b>${esc(s.title)}</b><span>${esc(s.assignee || 'ยังไม่ระบุผู้รับผิดชอบ')}</span></button>`; }).join('')}
            </div></div>`;
    }
    function render(data, error = '') {
        projects = data?.projects || [];
        const active = projects.filter(p => !p.complete).length;
        document.getElementById('exWorkflows').innerHTML = `<h2>🧭 WORKFLOW งาน GA <small>กำลังดำเนินการ ${active} งาน · สำเร็จแล้ว ${projects.length - active} งาน</small></h2><p class="ex-help">กดขั้นตอนเพื่อดูรายละเอียด · แสดงทุกงานโดยไม่จำกัดช่วงวันที่ด้านบน</p>`
            + (error ? `<p class="ex-status is-error">${esc(error)}</p>` : !data ? '<p>กำลังโหลดผังงาน…</p>' : !projects.length ? '<p>ยังไม่มีงาน Workflow</p>' : projects.map(p => `<details class="ex-wf-project${p.complete ? ' is-complete' : ''}" ${p.complete ? '' : 'open'}><summary><b>${esc(p.title)}</b><span>${p.complete ? '✓ สำเร็จแล้ว' : 'กำลังดำเนินการ'} · ${p.done}/${p.total} ขั้นตอน</span><small>${esc(p.section)}${p.due_date ? ' · กำหนด ' + esc(p.due_date) : ''}</small></summary><div class="ex-wf-body">${p.detail ? `<p class="ex-wf-text">${esc(p.detail)}</p>` : ''}${graph(p)}</div></details>`).join(''));
    }
    document.addEventListener('click', event => {
        const button = event.target.closest('[data-ex-project]'); if (!button) return;
        const p = projects.find(x => x.id === Number(button.dataset.exProject)), s = p?.steps[Number(button.dataset.exStep)];
        if (!s) return;
        document.getElementById('exDetail').innerHTML = `<div class="ex-dhead"><div><h2>${esc(s.title)}</h2><small>${esc(p.title)}</small></div><button type="button" class="ex-btn" data-close>ปิด</button></div>
            <div class="ex-wf-detail"><p><b>สถานะ:</b> ${status(s)}</p><p><b>ผู้รับผิดชอบ:</b> ${esc(s.assignee || 'ยังไม่ระบุ')}</p>
            <h3>รายละเอียดขั้นตอน</h3><p class="ex-wf-text">${esc(s.detail || 'ยังไม่มีรายละเอียด')}</p>
            ${s.after.length ? `<p><b>ต้องทำหลังจาก:</b> ${esc(s.after.map(id => p.steps.find(x => x.id === id)?.title || id).join(', '))}</p>` : ''}
            ${s.items?.length ? `<h3>ข้อมูลและเอกสารที่ขอ</h3><ul>${s.items.map(i => `<li>${esc(i.label)} (${esc({ text: 'ข้อความ', image: 'รูปภาพ', pdf: 'PDF' }[i.kind] || i.kind)})</li>`).join('')}</ul>` : ''}
            ${s.progress ? `<p><b>เก็บข้อมูลจากพนักงาน:</b> ${s.progress.total} คน · รับทราบ ${s.progress.acknowledged} · ส่งแล้ว ${s.progress.submitted}</p>` : ''}
            <h3>บันทึก / ผลลัพธ์</h3><p class="ex-wf-text">${esc(s.note || 'ยังไม่มีบันทึก')}</p>
            ${s.done_at ? `<p>บันทึกโดย ${esc(s.done_by)} · ${esc(s.done_at)}</p>` : ''}</div>`;
        document.getElementById('exDialog').showModal();
    });
    window.ExecWorkflow = { render };
})();
