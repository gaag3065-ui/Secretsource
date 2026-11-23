// ประวัติการรักษา — มุมมองกระชับ: ตาราง 1 แถว = 1 เคส + หน้าต่างสรุปเคส (Modal) แบ่ง 3 โซน (ข้อมูลรักษา / ยอดเงินเฉพาะที่มีค่า / เอกสารแนบ) + ไทม์ไลน์
// ทำงานเป็น "ชั้นแสดงผล" ซ้อนบนตารางเดิมใน insuranceclaimhistory.js: อ่านข้อมูลจาก window.currentIndividualHistory / currentFilteredHistory
// (ตารางเดิมยังถูกวาดตามปกติแต่ซ่อนไว้ — การแก้ไข/ลบ/อัปเดตผล/ย้ายรูปเดิมทำงานต่อได้ โดยปุ่มในหน้าต่างจะ "กดแทน" ปุ่มจริงของตารางเดิม)
(() => {
    'use strict';
    const PAGE = 20;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const num = value => Number(String(value ?? '').replace(/[,\s฿บาท]/g, '')) || 0;
    const money = value => value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const blank = value => { const text = String(value ?? '').trim(); return !text || text === '-' ? '' : text; };
    const can = key => { try { return window.hasPermission?.(key) === true; } catch { return false; } };

    // หมวดยอดเงิน: แสดงเฉพาะที่ > 0 (ซ่อน 0 / - อัตโนมัติ)
    const AMOUNTS = [
        ['DentalOPD', 'ทำฟัน (หักวงเงิน OPD)', '฿', ''], ['PPUsageOPD', 'PP OPD', '฿', ''], ['PPUsageIPD', 'PP IPD', '฿', ''],
        ['SLKUsageOpdThB', 'SL OPD', '฿', ''], ['SLKUsageIpdThB', 'SL IPD', '฿', ''], ['SLKUsageOpdLkr', 'SL OPD', 'LKR', ''], ['SLKUsageIpdLkr', 'SL IPD', 'LKR', ''],
        ['OtherUsage', 'วงเงินอื่นๆ', '฿', ''], ['OverLimitCreditInsThB', 'ส่วนเกินวงเงิน', '฿', 'is-over'], ['OverLimitCreditInsLkr', 'ส่วนเกินวงเงิน', 'LKR', 'is-over']
    ];
    const amountsOf = event => AMOUNTS.map(([key, label, unit, cls]) => ({ key, label, unit, cls, value: num(event?.[key]) })).filter(a => a.value > 0);

    const stageOf = text => {
        const t = String(text || '');
        if (/ปิดเคส|เอกสารและบัญชีครบถ้วน/.test(t)) return 'closed';
        if (/รักษาเสร็จ|บิล|เอกสาร|เคลม|เงินคืน|เคลียร์บัญชี|สำรองจ่าย/.test(t)) return 'docs';
        if (/ติดตาม|นัด|กลับบ้าน|รักษาต่อ|หัตถการ/.test(t)) return 'follow';
        if (/ระหว่าง|กำลัง|นอน|เฝ้าดู|รอผลตรวจ|แผนการรักษา/.test(t)) return 'active';
        return 'pending';
    };
    const pill = text => `<span class="hc-pill is-${stageOf(text)}">${esc(blank(text) || 'รอดำเนินการ')}</span>`;

    const state = { cases: [], shown: PAGE, sig: '', mode: 'individual', root: null, timer: 0 };

    function groupCases(history, mode) {
        const groups = new Map();
        (Array.isArray(history) ? history : []).forEach(item => {
            const id = String(item?.CaseIdNew ?? '-').trim() || '-';
            if (!groups.has(id)) groups.set(id, []);
            groups.get(id).push(item);
        });
        const compare = typeof compareCaseIdDescending === 'function' ? compareCaseIdDescending : (a, b) => Number(b) - Number(a);
        return [...groups.keys()].sort(compare).map(id => {
            const events = groups.get(id);
            if (mode === 'filtered') events.sort((a, b) => Number(a.targetRowNumber) - Number(b.targetRowNumber));   // ตารางเดิมโหมดกรองเรียงแบบนี้ · โหมดรายบุคคลใช้ลำดับดิบเหมือนตารางเดิม (จับคู่ปุ่มกดแทนให้ตรงรายการ)
            const latest = (typeof latestCaseEvent === 'function' ? latestCaseEvent(events) : null) || events[events.length - 1];
            let rounds = 1;
            try { rounds = Math.max(1, typeof collectTreatmentRounds === 'function' ? collectTreatmentRounds(events).length : 1); } catch { rounds = 1; }
            // สถานะล่าสุดของเคสมาจากหลังบ้าน (caseLatest) ในโหมดกรอง — แถวที่ผ่านตัวกรองอาจเป็นแถวเก่า จึงห้ามใช้สถานะของแถวนั้นแทน
            const status = (mode === 'filtered' ? window.currentCaseLatest?.[id]?.statusText : '') || (typeof latestCaseEvent === 'function' ? latestCaseEvent(events)?.statusText : '') || latest.statusText;
            return { id, events, latest, status, rounds, amounts: amountsOf(latest) };
        });
    }
    const areaOf = item => { try { return typeof getDisplayWorkLocation === 'function' ? getDisplayWorkLocation(item) : (item.workLocation || item.area || '-'); } catch { return '-'; } };

    // ---------------------------------------------------------------- ตารางกระชับ
    function ensureRoot() {
        if (state.root?.isConnected) return state.root;
        const shell = document.querySelector('#table-box-placeholder .history-table-shell');
        if (!shell) return null;
        shell.classList.add('hc-legacy');
        window.__hcLazyEvidence = true;   // ตารางเดิมซ่อนอยู่ → รูปเอกสารในตารางเดิมไม่ต้องดึงจนกว่าจะมองเห็นจริง
        const root = document.createElement('section');
        root.id = 'hcRoot';
        root.className = 'hc-root';
        shell.before(root);
        root.addEventListener('click', onRootClick);
        root.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.matches('tr.hc-row')) openDetail(event.target.dataset.case); });
        state.root = root;
        return root;
    }
    function rowHtml(c) {
        const e = c.latest;
        const date = blank(e.treatmentDateTime);
        const company = blank(e.company);
        const note = blank(e.notes);
        return `<tr class="hc-row" data-case="${esc(c.id)}" tabindex="0">
            <td class="hc-col-case"><b class="hc-case-id">#${esc(c.id)}</b><small>รอบ ${c.rounds}${c.events.length > 1 ? ` · ${c.events.length} รายการ` : ''}</small></td>
            <td class="hc-col-date">${esc(date || '-')}</td>
            <td class="hc-col-emp"><b>${esc(blank(e.employeeName) || '-')}</b><small>${esc([areaOf(e) !== '-' ? areaOf(e) : '', company].filter(Boolean).join(' · ') || '-')}</small></td>
            <td class="hc-col-sym"><span class="hc-sym">${esc(blank(e.symptoms) || '-')}</span><small>${esc(blank(e.hospital) || '-')}</small></td>
            <td class="hc-col-amt">${c.amounts.length ? c.amounts.map(a => `<span class="hc-chip ${a.cls}">${esc(a.label)}: <b>${money(a.value)}</b> ${esc(a.unit)}</span>`).join('') : '<span class="hc-none">—</span>'}</td>
            <td class="hc-col-status">${pill(c.status)}${note ? `<small title="${esc(note)}">📝 ${esc(note.length > 40 ? note.slice(0, 40) + '…' : note)}</small>` : ''}</td>
            <td class="hc-col-act"><button type="button" class="hc-btn" data-hc-view>ดูรายละเอียด</button>${can('EditTreatment') ? '<button type="button" class="hc-btn is-update" data-hc-update>อัปเดตเคส</button><button type="button" class="hc-btn is-edit" data-hc-edit>แก้ไข</button>' : ''}</td>
        </tr><tr class="hc-flags-row" hidden><td colspan="7"></td></tr>`;
    }
    function render() {
        const root = ensureRoot();
        if (!root) return;
        const mode = window.historyDisplayMode === 'filtered' ? 'filtered' : 'individual';
        const history = mode === 'filtered' ? window.currentFilteredHistory : window.currentIndividualHistory;
        const sig = mode + '|' + JSON.stringify(history || []);
        if (sig === state.sig && root.childElementCount) return;
        if (mode !== state.mode) state.shown = PAGE;
        state.sig = sig; state.mode = mode;
        state.cases = groupCases(history, mode);
        paint();
    }
    function paint() {
        const root = state.root;
        if (!root) return;
        if (!state.cases.length) {
            const hasData = Array.isArray(state.mode === 'filtered' ? window.currentFilteredHistory : window.currentIndividualHistory);
            root.innerHTML = `<p class="hc-empty">${hasData ? 'ไม่พบประวัติตามเงื่อนไขที่เลือก' : 'เลือกพนักงาน หรือกรองประวัติ เพื่อดูรายการ'}</p>`;
            document.dispatchEvent(new CustomEvent('hc:rendered'));
            return;
        }
        const list = state.cases.slice(0, state.shown);
        root.innerHTML = `<div class="hc-scroll"><table class="hc-table">
            <thead><tr><th>เคส / รอบ</th><th>วันที่เข้ารักษา</th><th>พนักงาน · พื้นที่</th><th>อาการ · สถานพยาบาล</th><th>ยอดเบิก</th><th>สถานะ</th><th></th></tr></thead>
            <tbody id="hcBody">${list.map(rowHtml).join('')}</tbody></table></div>
            <div class="hc-foot"><span>แสดง ${list.length.toLocaleString('th-TH')} จาก ${state.cases.length.toLocaleString('th-TH')} เคส</span>${list.length < state.cases.length ? `<button type="button" class="hc-btn" data-hc-more>แสดงเพิ่มอีก ${Math.min(PAGE, state.cases.length - list.length)} เคส</button>` : ''}</div>`;
        document.dispatchEvent(new CustomEvent('hc:rendered'));
    }
    function onRootClick(event) {
        if (event.target.closest('[data-hc-more]')) { state.shown += PAGE; paint(); return; }
        const row = event.target.closest('tr.hc-row');
        if (!row || event.target.closest('a')) return;
        if (event.target.closest('[data-hc-update]')) return runUpdate(row.dataset.case);
        openDetail(row.dataset.case, { focus: event.target.closest('[data-hc-edit]') ? 'timeline' : '' });
    }

    // ---------------------------------------------------------------- ปุ่มของตารางเดิม (ใช้ "กดแทน" เพื่อคงระบบแก้ไข/ลบ/อัปเดตผลเดิมไว้ทั้งหมด)
    function legacyActions(c) {
        const body = document.getElementById('tableBodyResult');
        if (!body) return { events: [], update: null };
        const rows = [...body.children];
        let bundles = [];
        if (state.mode === 'filtered') {
            const findParent = () => [...body.children].find(tr => tr.classList.contains('grouped-parent-row') && (tr.querySelector('.history-case-toggle strong')?.textContent || '').trim() === c.id);
            let parent = findParent();
            for (let guard = 0; !parent && guard < 200; guard++) {   // ตารางเดิมแบ่งหน้า 40 เคส: กดปุ่มแสดงเพิ่มของมันจนกว่าเคสนี้จะถูกวาด
                const more = body.querySelector('.history-pager-row button');
                if (!more) break;
                more.click();
                parent = findParent();
            }
            if (parent) {
                // ลำดับในตารางเดิม: แถวแม่ = รายการล่าสุด · แถวลูก grouped-child-row = รายการก่อนหน้าตามลำดับ → ตรงกับ c.events (เรียงเก่า→ใหม่)
                for (let tr = parent.nextElementSibling; tr && tr.classList.contains('grouped-child-row'); tr = tr.nextElementSibling) bundles.push(tr.querySelector('.flat-history-actions'));
                bundles.push(parent.querySelector('.flat-history-actions'));
            }
        } else {
            bundles = rows.filter(tr => tr.classList.contains(`child-row-of-${c.id}`)).map(tr => tr.lastElementChild);
        }
        const pick = cell => cell ? { edit: cell.querySelector('.btn-edit-minimal'), full: cell.querySelector('.btn-edit-full'), del: cell.querySelector('.flat-history-delete, button[data-permission="DeleteTreatment"]') } : {};
        const consistent = (buttons, event) => {   // ปุ่มลบแบบ onclick ระบุเลขแถวไว้ → ต้องตรงกับรายการนี้ ไม่งั้นไม่ใช้ปุ่มของรายการนี้เลย
            const m = /executeDeleteRow\((\d+)/.exec(buttons.del?.getAttribute?.('onclick') || '');
            return !m || !event.targetRowNumber || Number(m[1]) === Number(event.targetRowNumber);
        };
        const ordered = state.mode === 'filtered' ? c.events : (typeof buildCaseTimelineGroups === 'function' ? buildCaseTimelineGroups(c.events).filter(item => !item.roundBoxes) : c.events);
        const update = state.mode === 'filtered' ? null : rows.find(tr => tr.classList.contains(`child-row-of-${c.id}-spacer`))?.querySelector('button');
        return { events: ordered.map((event, i) => { const buttons = ordered.length === bundles.length ? pick(bundles[i]) : {}; return { event, ...(consistent(buttons, event) ? buttons : {}) }; }), update };
    }

    // ---------------------------------------------------------------- หน้าต่างสรุปเคส
    function closeDetail() { document.getElementById('hcModal')?.remove(); document.removeEventListener('keydown', onKey); }
    const onKey = event => { if (event.key === 'Escape') closeDetail(); };
    function kv(label, value, wide) { const text = blank(value); return `<div class="hc-kv${wide ? ' is-wide' : ''}"><dt>${esc(label)}</dt><dd>${text ? esc(text) : '<span class="hc-none">—</span>'}</dd></div>`; }
    function openDetail(caseId, { focus = '' } = {}) {
        const c = state.cases.find(x => x.id === String(caseId));
        if (!c) return;
        closeDetail();
        const e = c.latest;
        const amounts = c.amounts;
        const slk = amounts.some(a => /^SL/.test(a.label) || a.unit === 'LKR');
        const totalThb = amounts.filter(a => a.unit === '฿' && !a.cls).reduce((sum, a) => sum + a.value, 0);
        const modal = document.createElement('div');
        modal.id = 'hcModal';
        modal.className = 'hc-modal';
        modal.innerHTML = `<div class="hc-panel" role="dialog" aria-modal="true" aria-label="รายละเอียดเคส #${esc(c.id)}">
            <header class="hc-head"><div><h3>เคส #${esc(c.id)} <small>รอบ ${c.rounds}</small></h3><div>${pill(c.status)}</div></div><button type="button" class="hc-x" data-hc-close aria-label="ปิด">×</button></header>
            <div class="hc-body">
                <section class="hc-zone"><h4>ข้อมูลการรักษา</h4><dl class="hc-grid2">
                    ${kv('ชื่อพนักงาน', e.employeeName)}${kv('รหัสประกัน', e.insuranceId)}
                    ${kv('บริษัท / พื้นที่', [blank(e.company), areaOf(e) !== '-' ? areaOf(e) : ''].filter(Boolean).join(' · '))}${kv('วันที่เข้ารักษา', e.treatmentDateTime)}
                    ${kv('โรงพยาบาล / สถานพยาบาล', e.hospital)}${kv('ผลการรักษา', e.ClinicianReportedOutcomes)}
                    ${kv('อาการป่วย', e.symptoms, true)}${kv('หมายเหตุ', e.notes, true)}
                    ${kv('บันทึกล่าสุด', [blank(e.autoDateTime), blank(e.adminName)].filter(Boolean).join(' · '))}${kv('สถานะล่าสุด', c.status)}
                </dl></section>
                <section class="hc-zone"><h4>สรุปยอดเงิน <small>(เฉพาะหมวดที่มีการเบิกจ่าย)</small></h4>${amounts.length ? `<table class="hc-money"><tbody>
                    ${amounts.map(a => `<tr class="${a.cls}"><th>${esc(a.label)}</th><td>${money(a.value)} ${esc(a.unit)}</td></tr>`).join('')}
                    ${totalThb && amounts.filter(a => a.unit === '฿' && !a.cls).length > 1 ? `<tr class="is-total"><th>รวม (บาท)</th><td>${money(totalThb)} ฿</td></tr>` : ''}
                    ${slk && (blank(e.ExchangeRatesIns) || blank(e.ExchangeRatesInt)) ? `<tr class="is-rate"><th>เรทค่าเงิน (ประกัน / ปัจจุบัน)</th><td>${esc(blank(e.ExchangeRatesIns) || '-')} / ${esc(blank(e.ExchangeRatesInt) || '-')}</td></tr>` : ''}
                </tbody></table>` : '<p class="hc-none">ยังไม่มียอดเบิกในเคสนี้</p>'}</section>
                <section class="hc-zone hc-docs"><h4>เอกสารแนบ &amp; รูปภาพ <small>(กดรูปเพื่อขยาย)</small></h4><table class="hc-evid"><tbody><tr data-hc-evidence></tr></tbody></table></section>
                <section class="hc-zone hc-timeline" id="hcTimeline"><h4>ไทม์ไลน์ของเคส <small>${c.events.length} รายการ</small>${can('EditTreatment') ? '<button type="button" class="hc-btn is-primary hc-update-btn" data-hc-update-modal>🏥 อัปเดตเคส</button>' : ''}</h4><div data-hc-timeline></div></section>
            </div></div>`;
        document.body.append(modal);
        document.addEventListener('keydown', onKey);
        modal.addEventListener('click', event => {
            if (event.target === modal || event.target.closest('[data-hc-close]')) return closeDetail();
            if (event.target.closest('[data-hc-update-modal]')) return runUpdate(c.id);
        });
        // รูปในหน้าต่าง: ซ่อนไว้จนกว่าจะโหลดสำเร็จ (กันกรอบรูปแตก/alt ค้าง) — ที่โหลดไม่ได้ ตัวโหลดเดิมจะเปลี่ยนเป็นข้อความสั้นแทนอยู่แล้ว
        modal.addEventListener('load', event => { if (event.target?.tagName === 'IMG') event.target.classList.add('hc-loaded'); }, true);
        fillEvidence(modal.querySelector('[data-hc-evidence]'), c);
        fillTimeline(modal.querySelector('[data-hc-timeline]'), c);
        modal.querySelector('.hc-x').focus();
        if (focus === 'timeline') modal.querySelector('#hcTimeline')?.scrollIntoView({ block: 'start' });
    }
    function fillEvidence(host, c) {
        if (typeof createEvidenceDocumentsCell !== 'function') { host.innerHTML = '<td class="hc-none">ดูเอกสารไม่ได้ในหน้านี้</td>'; return; }
        const e = c.latest;
        try {
            const individual = state.mode !== 'filtered';
            const timelines = individual ? c.events : [...(window.currentCaseDocuments?.[c.id] || []), ...c.events];
            const raw = (typeof combineCaseEvidenceDocuments === 'function' ? combineCaseEvidenceDocuments(timelines) : e.DocumentsAttached) || '-';
            const ctx = individual && e.targetRowNumber ? { caseId: e.CaseIdNew || c.id, rowNumber: e.targetRowNumber, employeeName: e.employeeName, event: e, combine: () => combineCaseEvidenceDocuments(c.events) } : null;
            const cell = createEvidenceDocumentsCell(raw, e.statusText, true, ctx, individual ? undefined : c.id);
            host.append(cell);
            cell._normalizeCaseEvidence?.();
        } catch (error) { console.warn('hc evidence', error); host.innerHTML = '<td class="hc-none">โหลดเอกสารไม่สำเร็จ</td>'; }
    }
    function fillTimeline(host, c) {
        const actions = legacyActions(c);
        const items = [...actions.events].reverse();   // ใหม่สุดอยู่บน
        host.innerHTML = `<ol class="hc-tl">${items.map((item, i) => {
            const ev = item.event;
            const amounts = amountsOf(ev);
            return `<li data-i="${i}"><div class="hc-tl-top"><time>${esc(blank(ev.autoDateTime) || blank(ev.treatmentDateTime) || '-')}</time>${pill(ev.statusText)}<span class="hc-tl-by">${esc(blank(ev.adminName))}</span></div>
                <div class="hc-tl-body">${blank(ev.hospital) ? `<span>${esc(ev.hospital)}</span>` : ''}${blank(ev.symptoms) ? `<span>${esc(ev.symptoms)}</span>` : ''}${blank(ev.notes) ? `<em>${esc(ev.notes)}</em>` : ''}</div>
                ${amounts.length ? `<div class="hc-tl-amt">${amounts.map(a => `<span class="hc-chip ${a.cls}">${esc(a.label)}: <b>${money(a.value)}</b> ${esc(a.unit)}</span>`).join('')}</div>` : ''}
                ${(item.edit || item.full || item.del) ? `<div class="hc-tl-act">${item.edit ? '<button type="button" class="hc-btn is-edit" data-act="edit">✏️ แก้ไข</button>' : ''}${item.full ? '<button type="button" class="hc-btn" data-act="full">📝 แก้ไขทุกรายละเอียด</button>' : ''}${item.del ? '<button type="button" class="hc-btn is-del" data-act="del">🗑️ ลบ</button>' : ''}</div>` : ''}</li>`;
        }).join('') || '<li class="hc-none">ยังไม่มีรายการ</li>'}</ol>`;
        host.addEventListener('click', event => {
            const button = event.target.closest('[data-act]');
            if (!button) return;
            const li = button.closest('li');
            const target = items[Number(li?.dataset.i)]?.[{ edit: 'edit', full: 'full', del: 'del' }[button.dataset.act]];
            if (!target || !target.isConnected) return alert('ปุ่มนี้ใช้ไม่ได้ในขณะนี้ กรุณาโหลดประวัติใหม่');
            if (button.dataset.act === 'edit') return startInlineEdit(target);   // ตารางเดิมซ่อนอยู่ → ย้ายแถวจริงมาแก้ในหน้าต่างที่มองเห็น
            closeDetail();
            target.click();   // แก้ไขทุกรายละเอียด/ลบ: ใช้ปุ่มจริงของตารางเดิม (เปิดป๊อปอัปเดิม/ยืนยันลบเดิม)
        });
    }

    // ---------------------------------------------------------------- อัปเดตเคส (ฟอร์มอัปเดตผลการรักษาเดิม populateOutcomeToModal)
    function runUpdate(caseId) {
        const c = state.cases.find(x => x.id === String(caseId));
        if (!c) return;
        if (typeof window.populateOutcomeToModal !== 'function') return alert('ฟอร์มอัปเดตเคสยังไม่พร้อม กรุณารีเฟรชหน้า');
        closeDetail();
        const latest = (typeof latestCaseEvent === 'function' ? latestCaseEvent(c.events) : null) || c.latest;
        window.populateOutcomeToModal({ ...latest, ...(state.mode === 'filtered' && c.status ? { statusText: c.status } : {}) });
    }

    // ---------------------------------------------------------------- แก้ไขแบบ inline ในหน้าต่างที่มองเห็น
    // ระบบเดิมแปลงช่องของ "แถวในตาราง" ให้เป็นช่องกรอกในที่เดิม (populateDataToForm) แต่ตารางเดิมซ่อนอยู่ จึงย้ายแถวจริงมาไว้ในหน้าต่างชั่วคราว
    // บันทึก/ยกเลิกเรียก cancelInlineRowEdit() เดิม (ตารางเดิมวาดใหม่ทั้งชุด) → ปิดหน้าต่างนี้พร้อมกัน
    let inline = null;
    function closeInline(restore) {
        const current = inline;
        if (!current) return;
        inline = null;
        current.overlay.remove();
        document.removeEventListener('keydown', onInlineKey);
        if (restore && typeof originalCancel === 'function') originalCancel();   // ปิดเอง: ให้ตารางเดิมกลับสภาพ (ไม่ค้างโหมดแก้ไข)
    }
    const onInlineKey = event => { if (event.key === 'Escape') closeInline(true); };
    let originalCancel = null;
    function hookCancel() {
        if (typeof window.cancelInlineRowEdit !== 'function' || window.cancelInlineRowEdit.__hc) return;
        originalCancel = window.cancelInlineRowEdit;
        const patched = function (...args) { closeInline(false); return originalCancel.apply(this, args); };
        patched.__hc = true;
        window.cancelInlineRowEdit = patched;
    }
    function startInlineEdit(editButton) {
        const row = editButton.closest('tr');
        if (!row) return alert('เปิดแถวนี้เพื่อแก้ไขไม่ได้ กรุณาโหลดประวัติใหม่');
        hookCancel();
        closeDetail();
        closeInline(true);
        const host = document.getElementById('table-box-placeholder') || document.body;   // อยู่ใน placeholder เพื่อใช้สไตล์ช่องกรอกเดิม
        const overlay = document.createElement('div');
        overlay.id = 'hcInline';
        overlay.className = 'hc-modal hc-inline-modal';
        overlay.innerHTML = `<div class="hc-panel hc-inline-panel" role="dialog" aria-modal="true" aria-label="แก้ไขรายการ">
            <header class="hc-head"><div><h3>✏️ แก้ไขรายการ <small>แก้ไขแล้วกด "💾 บันทึก" หรือ "ยกเลิก"</small></h3></div><button type="button" class="hc-x" data-hc-inline-close aria-label="ปิด">×</button></header>
            <div class="hc-body"><table class="hc-inline-table"><tbody></tbody></table></div></div>`;
        host.append(overlay);
        row.hidden = false;
        row.style.display = '';
        overlay.querySelector('tbody').append(row);   // ย้ายแถวจริง (ปุ่ม/ข้อมูลเดิมครบ) มาไว้ในหน้าต่าง
        overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('[data-hc-inline-close]')) closeInline(true); });
        document.addEventListener('keydown', onInlineKey);
        inline = { overlay, row };
        editButton.click();   // สลับช่องของแถวเป็นช่องกรอก (populateDataToForm เดิม)
        overlay.querySelector('.inline-edit-field')?.focus();
    }

    // ---------------------------------------------------------------- เริ่มทำงาน + ติดตามการวาดตารางเดิมใหม่
    function schedule() { clearTimeout(state.timer); state.timer = setTimeout(render, 120); }
    function start() {
        const body = document.getElementById('tableBodyResult');
        if (!body || !document.querySelector('#table-box-placeholder .history-table-shell')) return setTimeout(start, 400);
        ensureRoot();
        new MutationObserver(schedule).observe(body, { childList: true });
        document.addEventListener('hc:refresh', schedule);
        render();
    }
    window.HistoryCompact = { refresh: () => { state.sig = ''; render(); }, open: openDetail };
    start();
})();
