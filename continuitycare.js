'use strict';

const continuityCategoryLabels = {
    pending: 'เคสที่รอดำเนินการ',
    active: 'เคสที่กำลังรักษา',
    followUp: 'เคสที่ต้องติดตามอาการ',
    billing: 'เคสที่รอเอกสารหรือการเงิน',
    closed: 'เคสที่ปิดแล้ว'
};

let continuitySelectedArea = '';
let continuitySummaryController = null;
let continuityCasesController = null;
let continuitySummaryRequestSequence = 0;
let continuityCasesRequestSequence = 0;
let continuityAllCases = [];
let continuitySearchLastQuery = '';

function continuityStatusCategory(statusText) {
    const value = String(statusText || '');
    if (/ปิดเคส|เอกสารและบัญชีครบถ้วน/i.test(value)) return 'closed';
    if (/รักษาเสร็จ|บิล|เอกสาร|เคลม|เงินคืน|เคลียร์บัญชี|สำรองจ่าย/i.test(value)) return 'billing';
    if (/ติดตาม|นัด|กลับบ้าน|รักษาต่อ|หัตถการ/i.test(value)) return 'followUp';
    if (/ระหว่าง|กำลัง|นอน|เฝ้าดู|รอผลตรวจ|แผนการรักษา/i.test(value)) return 'active';
    return 'pending';
}

function continuityArea(item) {
    return String(item.workLocation || item.colK || '-').trim() || '-';
}

function continuityWaitingDays(value) {
    const match = String(value || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return 0;
    const year = Number(match[3]);
    const date = new Date(year > 2400 ? year - 543 : year, Number(match[2]) - 1, Number(match[1]));
    const days = Math.floor((Date.now() - date.getTime()) / 86400000);
    return Number.isFinite(days) && days > 0 ? days : 0;
}

function normalizeContinuityCases(history) {
    const grouped = new Map();
    (Array.isArray(history) ? history : []).forEach((event) => {
        const caseId = String(event.CaseIdNew || event.caseId || '').trim();
        if (!caseId) return;
        if (!grouped.has(caseId)) grouped.set(caseId, []);
        grouped.get(caseId).push(event);
    });

    return [...grouped.entries()].map(([caseId, events]) => {
        const latest = events[events.length - 1] || {};
        const statusText = latest.statusText || latest.Status || 'รอดำเนินการ';
        const category = continuityStatusCategory(statusText);
        return {
            ...latest,
            caseId,
            CaseIdNew: caseId,
            employeeName: latest.employeeName || latest.EmployeeName || latest.colG || '-',
            employeeId: latest.employeeId || latest.EmployeeId || latest.colE || '-',
            insuranceId: latest.insuranceId || latest.InsuranceId || latest.colC || '-',
            workLocation: continuityArea(latest),
            hospital: latest.hospital || latest.Hospital || '-',
            symptoms: latest.symptoms || latest.Symptoms || latest.symptom || '-',
            statusText,
            category,
            waitingDays: continuityWaitingDays(latest.treatmentDateTime),
            waitingLabel: continuityWaitingDays(latest.treatmentDateTime)
                ? `ค้าง ${continuityWaitingDays(latest.treatmentDateTime)} วัน`
                : 'อัปเดตล่าสุด',
            lastUpdated: latest.autoDateTime || latest.updatedAt || '-',
            nextAction: category === 'closed' ? 'ไม่มีงานค้าง' : 'ตรวจสอบและบันทึกผลล่าสุด',
            timeline: events
        };
    });
}

async function refreshContinuitySummary(options = {}) {
    const status = document.getElementById('continuityCareStatus');
    const refreshButton = document.getElementById('continuityRefreshButton');

    if (!status) return;

    const forceFresh = options.forceFresh !== false;
    continuitySummaryController?.abort();
    continuitySummaryController = new AbortController();
    continuitySummaryRequestSequence += 1;
    const requestSequence = continuitySummaryRequestSequence;

    status.textContent = 'กำลังโหลดข้อมูลสรุป…';
    status.dataset.status = 'loading';
    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.setAttribute('aria-busy', 'true');
    }

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/history/all`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
                cache: 'no-store'
            }
        );
        const data = await response.json();

        if (requestSequence !== continuitySummaryRequestSequence) return;

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'โหลดข้อมูลเคสไม่สำเร็จ');
        }

        continuityAllCases = normalizeContinuityCases(data.history);
        // มีผลค้นหาแสดงอยู่ตอนนี้ (เช่น เพิ่งกดอัปเดตผลการรักษาหรือปิดเคสสำเร็จ) — รื้อสร้างแค่
        // เคสที่กำลังแสดงอยู่ใหม่จากข้อมูลสดที่เพิ่งได้มา คงสถานะกาง/พับเดิมไว้ทุกเคส
        refreshContinuitySearchInPlace();
        const visibleCases = continuitySelectedArea
            ? continuityAllCases.filter((item) => continuityArea(item) === continuitySelectedArea)
            : continuityAllCases;
        const summary = visibleCases.reduce((counts, item) => {
            counts[item.category] += 1;
            return counts;
        }, { pending: 0, active: 0, followUp: 0, billing: 0, closed: 0 });

        setContinuityCount('continuityTotalCount', visibleCases.length);
        setContinuityCount('continuityPendingCount', summary.pending);
        setContinuityCount('continuityActiveCount', summary.active);
        setContinuityCount('continuityFollowUpCount', summary.followUp);
        setContinuityCount('continuityBillingCount', summary.billing);
        setContinuityCount('continuityClosedCount', summary.closed);
        const areaCounts = [...new Set(continuityAllCases.map(continuityArea))]
            .filter((area) => area !== '-')
            .map((area) => ({ value: area, count: continuityAllCases.filter((item) => continuityArea(item) === area).length }));
        renderContinuityAreaButtons(areaCounts, continuityAllCases.length);

        initContinuityInteractions();

        status.textContent = `ข้อมูลล่าสุดจากต้นทาง · ${visibleCases.length.toLocaleString('th-TH')} เคสพร้อมดำเนินการ`;
        status.dataset.status = 'success';
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Continuity of Care summary error:', error);
        status.textContent =
            'ไม่สามารถโหลดข้อมูลติดตามเคสได้ กรุณาลองใหม่ภายหลัง';
        status.dataset.status = 'error';
    } finally {
        if (
            refreshButton &&
            requestSequence === continuitySummaryRequestSequence
        ) {
            refreshButton.disabled = false;
            refreshButton.removeAttribute('aria-busy');
        }
    }
}

function renderContinuityAreaButtons(areas, summaryTotal) {
    const container = document.getElementById('continuityAreaButtons');
    if (!container) return;

    const options = [
        {
            value: '',
            count: Array.isArray(areas) && areas.length
                ? areas.reduce((sum, item) => sum + Number(item.count || 0), 0)
                : Number(summaryTotal || 0)
        },
        ...(Array.isArray(areas) ? areas : [])
    ];
    container.replaceChildren();

    options.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'continuity-area-button';
        button.classList.toggle('selected', item.value === continuitySelectedArea);
        button.setAttribute('aria-pressed', String(item.value === continuitySelectedArea));
        button.textContent = `${item.value || 'ทั้งหมด'} (${Number(item.count || 0).toLocaleString('th-TH')})`;
        button.addEventListener('click', async () => {
            if (continuitySelectedArea === item.value) return;
            continuitySelectedArea = item.value;
            closeContinuityCasePanel();
            await refreshContinuitySummary({ forceFresh: false });
        });
        container.appendChild(button);
    });
}

function initContinuityInteractions() {
    document.querySelectorAll('.continuity-metric[data-category]')
        .forEach((card) => {
            if (card.dataset.initialized === 'true') return;
            card.dataset.initialized = 'true';
            card.addEventListener('click', () => {
                loadContinuityCases(card.dataset.category);
            });
        });

    const closeButton = document.getElementById('continuityCasePanelClose');
    if (closeButton && closeButton.dataset.initialized !== 'true') {
        closeButton.dataset.initialized = 'true';
        closeButton.addEventListener('click', closeContinuityCasePanel);
    }

    const refreshButton = document.getElementById('continuityRefreshButton');
    if (refreshButton && refreshButton.dataset.initialized !== 'true') {
        refreshButton.dataset.initialized = 'true';
        refreshButton.addEventListener('click', async () => {
            closeContinuityCasePanel();
            await refreshContinuitySummary({ forceFresh: true });
        });
    }

    const caseSearchButton = document.getElementById('continuityCaseSearchButton');
    const caseSearchInput = document.getElementById('continuityCaseSearchInput');
    if (caseSearchButton && caseSearchButton.dataset.initialized !== 'true') {
        caseSearchButton.dataset.initialized = 'true';
        const search = () => {
            const query = String(caseSearchInput?.value || '')
                .normalize('NFKC')
                .trim()
                .toLocaleLowerCase('th-TH');
            if (!query) {
                caseSearchInput?.focus();
                return;
            }
            setContinuityPanelMode('search');
            continuitySearchLastQuery = query;
            continuityRunSearchQuery(query, caseSearchInput.value.trim());
        };
        caseSearchButton.addEventListener('click', search);
        caseSearchInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') search();
        });
    }
}

async function loadContinuityCases(category) {
    const panel = document.getElementById('continuityCasePanel');
    const list = document.getElementById('continuityCaseList');
    const title = document.getElementById('continuityCasePanelTitle');
    const description = document.getElementById('continuityCasePanelDescription');
    if (!panel || !list || !continuityCategoryLabels[category]) return;

    continuityCasesRequestSequence += 1;
    const requestSequence = continuityCasesRequestSequence;

    document.querySelectorAll('.continuity-metric[data-category]')
        .forEach((card) => {
            const selected = card.dataset.category === category;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-expanded', String(selected));
        });

    setContinuityPanelMode('category');
    panel.hidden = false;
    document.body.classList.add('continuity-details-open');
    title.textContent = continuityCategoryLabels[category];
    description.textContent = 'กำลังเตรียมรายการเคส…';
    list.innerHTML = '<div class="continuity-empty">กำลังเตรียมข้อมูล…</div>';

    window.requestAnimationFrame(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (requestSequence !== continuityCasesRequestSequence) return;
    const cases = continuityAllCases
        .filter((item) => item.category === category)
        .filter((item) => !continuitySelectedArea || continuityArea(item) === continuitySelectedArea)
        .sort((a, b) => Number(b.waitingDays || 0) - Number(a.waitingDays || 0));
    const areaLabel = continuitySelectedArea ? ` ในพื้นที่ ${continuitySelectedArea}` : '';
    description.textContent = `พบ ${cases.length.toLocaleString('th-TH')} เคส${areaLabel}`;
    renderContinuityCases(cases, list);
}

function renderContinuityCases(cases, container) {
    restoreContinuityUpdateForm();
    container.innerHTML = '';
    if (!cases.length) {
        container.innerHTML = '<div class="continuity-empty">ไม่มีเคสในหมวดนี้</div>';
        return;
    }

    cases.forEach((item) => {
        const row = document.createElement('article');
        row.className = 'continuity-case-item';

        const header = document.createElement('div');
        header.className = 'continuity-case-item-heading';
        const name = document.createElement('strong');
        name.textContent = item.employeeName || '-';
        const waiting = document.createElement('span');
        waiting.className = Number(item.waitingDays) >= 7 ? 'continuity-waiting overdue' : 'continuity-waiting';
        waiting.textContent = item.waitingLabel || 'ไม่ทราบระยะเวลา';
        header.append(name, waiting);

        const details = document.createElement('dl');
        details.className = 'continuity-case-details';
        addContinuityDetail(details, 'รหัสประกัน', item.insuranceId);
        addContinuityDetail(details, 'รหัสพนักงาน', item.employeeId);
        addContinuityDetail(details, 'เคส ID', item.caseId, 'continuity-detail-case-id');
        addContinuityDetail(details, 'อาการป่วย', item.symptoms, 'continuity-detail-symptoms');
        addContinuityDetail(details, 'ขั้นตอนล่าสุด', item.statusText);
        addContinuityDetail(details, 'อัปเดตล่าสุด', item.lastUpdated);
        addContinuityDetail(details, 'สิ่งที่ควรทำต่อ', item.nextAction);
        if (item.dataQualityMessage) {
            addContinuityDetail(
                details,
                'ตรวจสอบข้อมูล',
                item.dataQualityMessage
            );
        }

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'continuity-update-button';
        action.textContent = 'อัปเดตผลการรักษา';

        const inlineForm = document.createElement('div');
        inlineForm.className = 'continuity-inline-form-host';
        inlineForm.hidden = true;

        action.addEventListener('click', () => {
            openContinuityInlineUpdate(item, inlineForm, action);
        });

        row.append(header, details, action, inlineForm);
        container.appendChild(row);
    });
}

function addContinuityDetail(container, label, value, emphasisClass = '') {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    if (emphasisClass) {
        term.classList.add(emphasisClass);
        detail.classList.add(emphasisClass);
    }
    term.textContent = label;
    detail.textContent = String(value || '-');
    container.append(term, detail);
}

function openContinuityInlineUpdate(item, target, button) {
    if (typeof window.populateOutcomeToModal !== 'function') return;

    const modal = document.getElementById('outcomeUpdateModal');
    const panel = document.getElementById('continuityCasePanel');
    const row = target.closest('.continuity-case-item');
    const isCurrent = modal?.parentElement === target && !target.hidden;

    document.querySelectorAll('.continuity-inline-form-host')
        .forEach((host) => {
            host.hidden = true;
        });
    document.querySelectorAll('.continuity-update-button')
        .forEach((itemButton) => {
            itemButton.textContent = 'อัปเดตผลการรักษา';
        });

    if (isCurrent) {
        window.closeOutcomeUpdateModal?.();
        return;
    }

    document.querySelectorAll('.continuity-case-item.is-editing')
        .forEach((caseRow) => caseRow.classList.remove('is-editing'));
    row?.classList.add('is-editing');
    panel?.classList.add('is-updating');
    target.hidden = false;
    window.populateOutcomeToModal(item, { inlineTarget: target });
    button.textContent = 'ซ่อนแบบฟอร์มอัปเดต';
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetContinuityEditingState() {
    document.getElementById('continuityCasePanel')?.classList.remove('is-updating');
    document.querySelectorAll('.continuity-case-item.is-editing')
        .forEach((caseRow) => caseRow.classList.remove('is-editing'));
}

function closeContinuityCasePanel() {
    continuityCasesController?.abort();
    continuityCasesRequestSequence += 1;
    restoreContinuityUpdateForm();
    const panel = document.getElementById('continuityCasePanel');
    if (panel) panel.hidden = true;
    document.body.classList.remove('continuity-details-open');
    document.querySelectorAll('.continuity-metric[data-category]')
        .forEach((card) => {
            card.classList.remove('selected');
            card.setAttribute('aria-expanded', 'false');
        });
    continuitySearchLastQuery = '';
    const searchResultsBody = document.getElementById('continuitySearchResultsBody');
    if (searchResultsBody) searchResultsBody.replaceChildren();
    continuitySearchGroups.clear();
}

// สลับโหมดแสดงผลของแผงเคส: 'category' = การ์ดสรุปหมวดเดิม, 'search' = ผลค้นหาแบบ
// การ์ดพับ-กางเต็มรูปแบบ (เหมือนหน้าประวัติการรักษา) — ใช้คนละคอนเทนเนอร์กัน ไม่ปนกัน
function setContinuityPanelMode(mode) {
    const list = document.getElementById('continuityCaseList');
    const searchShell = document.getElementById('continuitySearchTableShell');
    if (list) list.hidden = mode === 'search';
    if (searchShell) searchShell.hidden = mode !== 'search';
    if (mode === 'category') {
        continuitySearchLastQuery = '';
        const searchResultsBody = document.getElementById('continuitySearchResultsBody');
        if (searchResultsBody) searchResultsBody.replaceChildren();
        continuitySearchGroups.clear();
    }
}

// รันคำค้นหาปัจจุบันซ้ำ (ใช้ทั้งตอนกดค้นหาครั้งแรก และตอนรีเฟรชผลลัพธ์หลังแก้ไข/ลบ)
function continuityRunSearchQuery(query, rawQueryText) {
    const panel = document.getElementById('continuityCasePanel');
    const tbody = document.getElementById('continuitySearchResultsBody');
    const title = document.getElementById('continuityCasePanelTitle');
    const description = document.getElementById('continuityCasePanelDescription');
    if (!panel || !tbody || !title || !description) return;

    const matches = continuityAllCases.filter((item) => [
        item.employeeName,
        item.employeeId,
        item.insuranceId,
        item.caseId
    ].some((value) => String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase('th-TH')
        .includes(query)));

    document.querySelectorAll('.continuity-metric[data-category]')
        .forEach((card) => card.classList.remove('selected'));

    panel.hidden = false;
    title.textContent = `ผลการค้นหา ${rawQueryText ?? query}`;
    description.textContent = `พบ ${matches.length.toLocaleString('th-TH')} เคส`;
    renderContinuitySearchResults(matches, tbody);
}

// รีจิสทรีของกลุ่มแถว (การ์ด) ที่กำลังแสดงอยู่ในผลค้นหา ณ ขณะนี้ คีย์ด้วยเลขเคส
// ใช้สร้าง/รื้อกลุ่มแถวของ "เคสเดียว" ใหม่ในที่เดิมได้ (โดยไม่แตะเคสอื่น) หลังแก้ไข/ลบ/อัปเดต
let continuitySearchGroups = new Map();

// สร้างกลุ่มแถวทั้งหมดของ "1 เคส" (แถวหลัก + รายการที่เหลือ + ปุ่มอัปเดต) แบบ standalone
// ไม่ผูกกับ DOM เดิมใด ๆ — ใช้ตอนเรนเดอร์ผลค้นหาครั้งแรกเท่านั้น ส่วนแก้ไข/ลบ/อัปเดตทีหลัง
// จะ "ผ่าตัด" เฉพาะแถว/เหตุการณ์ที่เปลี่ยนจริงเท่านั้น (ดู continuitySearch* ด้านล่าง) ไม่รื้อทั้งกลุ่ม
// อีกต่อไป เพื่อไม่ให้เคสพับ-กางใหม่ให้เห็นทุกครั้งที่มีการเปลี่ยนแปลง
function buildContinuitySearchCaseGroup(caseItem) {
    // เรียงจากเก่าสุด (เหตุการณ์แรกที่เปิดเคส) ไปหาล่าสุดเสมอ
    const events = [...(caseItem.timeline || [])].sort(
        (a, b) => Number(a.targetRowNumber) - Number(b.targetRowNumber)
    );
    if (!events.length) return null;

    // แถวหลัก (ทั้งตอนพับและตอนกาง) ใช้ข้อมูล "แถวแรก" ของเคสเสมอ ไม่ใช่แถวล่าสุด
    const firstEvent = events[0];
    // เหตุการณ์ที่เหลือ (ลำดับ 2 เป็นต้นไป จนถึงล่าสุด) ต่อท้ายลงมาตามลำดับในกล่องเดียวกัน
    const remainingEvents = events.slice(1);

    const parentRow = document.createElement('tr');
    parentRow.className = 'flat-history-row grouped-parent-row';

    const caseCell = document.createElement('td');
    const caseButton = document.createElement('button');
    caseButton.type = 'button';
    caseButton.className = 'history-case-toggle';

    const arrow = document.createElement('span');
    arrow.textContent = '▶';

    const caseText = document.createElement('strong');
    caseText.textContent = caseItem.caseId;
    caseButton.append(arrow, caseText);

    const employee = document.createElement('div');
    employee.className = 'history-case-employee';
    employee.textContent = firstEvent.employeeName || caseItem.employeeName || '-';

    const area = document.createElement('span');
    area.className = 'history-area-badge';
    area.textContent = getDisplayWorkLocation(firstEvent) || 'ไม่ระบุพื้นที่';

    caseCell.append(caseButton, employee, area);
    parentRow.appendChild(caseCell);

    appendContinuityHistoryCells(parentRow, firstEvent);
    continuityApplySlkVisibility(parentRow, firstEvent);

    const childRows = [];
    const timelineRows = [];

    // เหตุการณ์ที่เหลือ เรียงตามลำดับจริง (เก่า → ใหม่ จบที่รายการล่าสุด) ต่อท้ายลงมา
    // ในกล่องเดียวกัน — กางออกมาพร้อมกับแถวหลักในคลิกเดียว ข้อมูลครบทุกรายการ
    remainingEvents.forEach((eventItem, index) => {
        const childRow = document.createElement('tr');
        childRow.className = 'grouped-child-row';
        childRow.hidden = true;

        const childLabelCell = document.createElement('td');
        // เริ่มนับที่ 2 เพราะแถวหลักด้านบนคือเหตุการณ์ที่ 1 (แถวแรกของเคส) อยู่แล้ว
        childLabelCell.textContent = `↳ เหตุการณ์ที่ ${index + 2}`;
        childLabelCell.className = 'history-child-label';
        childRow.appendChild(childLabelCell);

        appendContinuityHistoryCells(childRow, eventItem);
        continuityApplySlkVisibility(childRow, eventItem);

        childRows.push({ row: childRow, eventItem });
        timelineRows.push(childRow);
    });

    // ท้ายกล่องสุด: ปุ่ม "อัปเดตผลการรักษาหรือปิดเคส" เดียวกับที่ใช้ในการ์ดหมวดหมู่
    // เพื่อบันทึกเหตุการณ์ใหม่ต่อจากรายการล่าสุดของเคสนี้ได้จากกล่องค้นหานี้เลย
    const updateRow = document.createElement('tr');
    updateRow.className = 'grouped-child-row continuity-search-update-row';
    updateRow.hidden = true;

    const updateCell = document.createElement('td');
    updateCell.className = 'continuity-search-update-cell';

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'continuity-update-button';
    updateButton.textContent = 'อัปเดตผลการรักษาหรือปิดเคส';

    updateCell.appendChild(updateButton);
    updateRow.appendChild(updateCell);
    timelineRows.push(updateRow);

    const setOpen = (shouldOpen) => {
        parentRow.classList.toggle('flat-row-open', shouldOpen);
        timelineRows.forEach((timelineRow) => { timelineRow.hidden = !shouldOpen; });
        arrow.textContent = shouldOpen ? '▼' : '▶';
    };

    parentRow.style.cursor = 'pointer';
    parentRow.addEventListener('click', (event) => {
        if (event.target.closest('.btn-edit-minimal, .flat-history-delete')) return;
        setOpen(!parentRow.classList.contains('flat-row-open'));
    });

    const group = {
        caseId: caseItem.caseId,
        parentRow,
        parentEventItem: firstEvent,
        childRows, // [{ row, eventItem }] เรียงเก่า→ใหม่ ไม่รวมแถวปุ่มอัปเดต
        updateRow,
        rows: [parentRow, ...timelineRows],
        setOpen,
        isOpen: () => parentRow.classList.contains('flat-row-open')
    };

    updateButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openContinuitySearchNewEventForm(group);
    });

    return group;
}

// เรนเดอร์ผลการค้นหาทั้งชุดใหม่ทั้งหมด (ใช้ตอนพิมพ์ค้นหาใหม่เท่านั้น) — ใช้ appendContinuityHistoryCells /
// createEvidenceDocumentsCell ฯลฯ จาก insuranceclaimhistory.js ตรง ๆ เพื่อให้รายละเอียด/ฟังก์ชัน/
// พฤติกรรมเหมือนกัน 100% (โหลดก่อนไฟล์นี้เสมอ ดู search.html)
function renderContinuitySearchResults(items, tbody) {
    if (!tbody) return;
    // ย้ายป๊อปอัปอัปเดตผลการรักษากลับที่เดิมก่อนรื้อ DOM ทุกครั้ง ไม่งั้นถ้ามันฝังอยู่ในการ์ดที่
    // กำลังจะถูกลบทิ้ง จะหลุดออกจากเอกสารไปเลย (หาไม่เจอผ่าน getElementById อีกต่อไป)
    restoreContinuityUpdateForm();
    tbody.replaceChildren();
    continuitySearchGroups.clear();

    if (!items.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.textContent = 'ไม่พบเคสตามเงื่อนไขที่ค้นหา';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    const sortedItems = [...items].sort((a, b) =>
        compareCaseIdDescending(a.caseId, b.caseId));

    const fragment = document.createDocumentFragment();

    sortedItems.forEach((caseItem) => {
        const group = buildContinuitySearchCaseGroup(caseItem);
        if (!group) return;
        continuitySearchGroups.set(group.caseId, group);
        group.rows.forEach((row) => fragment.appendChild(row));
    });

    tbody.appendChild(fragment);
}

// ต่อเหตุการณ์ใหม่ 1 รายการเข้าไปเป็นแถวสุดท้าย (ก่อนปุ่มอัปเดต) ของเคสที่ระบุ แบบผ่าตัดจริง —
// ไม่แตะแถวเดิมที่มีอยู่แล้วแม้แต่แถวเดียว จึงไม่มีการพับ-กางใหม่ให้เห็น (คงสถานะกาง/พับเดิมของ
// แถวที่เพิ่มใหม่ให้ตรงกับเคสนั้นด้วย)
function continuitySearchAppendEvent(group, eventItem) {
    const index = group.childRows.length;
    const childRow = document.createElement('tr');
    childRow.className = 'grouped-child-row';
    childRow.hidden = !group.isOpen();

    const label = document.createElement('td');
    label.textContent = `↳ เหตุการณ์ที่ ${index + 2}`;
    label.className = 'history-child-label';
    childRow.appendChild(label);

    appendContinuityHistoryCells(childRow, eventItem);
    continuityApplySlkVisibility(childRow, eventItem);

    group.updateRow.before(childRow);
    group.childRows.push({ row: childRow, eventItem });
    group.rows.splice(group.rows.length - 1, 0, childRow);
}

// รื้อสร้างเนื้อหาข้างในของ "1 แถว" ใหม่จากข้อมูลที่ให้มา โดยไม่แตะแถวอื่นเลย — ใช้ทั้งตอนกด
// "ยกเลิก" แก้ไข (คืนค่าจาก eventItem เดิม) และตอน "บันทึก" สำเร็จ (แสดงค่าที่เพิ่งแก้ทันที)
// เซลล์แรก (หัวข้อเคส หรือป้าย "↳ เหตุการณ์ที่ N") ไม่ถูกแตะต้อง เพราะระหว่างแก้ไขไม่เคยเปลี่ยนเลย
function restoreContinuitySearchRowView(row, eventItem) {
    row.classList.remove('is-editing-inline');
    const headerCell = row.firstElementChild;
    row.replaceChildren();
    if (headerCell) row.appendChild(headerCell);
    appendContinuityHistoryCells(row, eventItem);
    continuityApplySlkVisibility(row, eventItem);
}

// เรียงเลขป้าย "↳ เหตุการณ์ที่ N" ของแถวย่อยที่เหลือใหม่ให้ต่อเนื่องกัน หลังมีการลบแถวใดแถวหนึ่งออก
function continuitySearchRenumberChildRows(group) {
    group.childRows.forEach((entry, index) => {
        const labelCell = entry.row.firstElementChild;
        if (labelCell) labelCell.textContent = `↳ เหตุการณ์ที่ ${index + 2}`;
    });
}

// ลบเหตุการณ์ 1 รายการออกแบบผ่าตอนจริง ไม่รื้อทั้งเคส:
// - ลบแถวย่อย (ไม่ใช่แถวแรกของเคส) → เอาแถวนั้นออกเฉย ๆ แล้วเรียงเลขป้ายที่เหลือใหม่
// - ลบแถวแรกของเคส (แถวหลัก) → เลื่อนเหตุการณ์ถัดไปขึ้นมาแสดงในแถวหลักแทน แล้วเอาแถวย่อยเดิม
//   ของมันออก (ข้อมูลเดียวกัน ย้ายที่แสดงแล้ว ไม่ซ้ำ)
// - ถ้าเหลือเหตุการณ์เดียวแล้วถูกลบไป → เอาทั้งเคสออกจากกล่องค้นหา
function continuitySearchDeleteEvent(item, row) {
    continuityRemoveEventLocally(item);

    const caseId = String(item.CaseIdNew || '').trim();
    const group = continuitySearchGroups.get(caseId);
    if (!group) {
        row.remove();
        return;
    }

    restoreContinuityUpdateForm();

    if (row === group.parentRow) {
        if (!group.childRows.length) {
            group.rows.forEach((r) => r.remove());
            continuitySearchGroups.delete(caseId);
            return;
        }
        const promoted = group.childRows.shift();
        group.parentEventItem = promoted.eventItem;
        restoreContinuitySearchRowView(group.parentRow, promoted.eventItem);
        promoted.row.remove();
        const rowsIndex = group.rows.indexOf(promoted.row);
        if (rowsIndex !== -1) group.rows.splice(rowsIndex, 1);
        continuitySearchRenumberChildRows(group);
        return;
    }

    const entryIndex = group.childRows.findIndex((entry) => entry.row === row);
    if (entryIndex !== -1) group.childRows.splice(entryIndex, 1);
    const rowsIndex = group.rows.indexOf(row);
    if (rowsIndex !== -1) group.rows.splice(rowsIndex, 1);
    row.remove();
    continuitySearchRenumberChildRows(group);
}

// หลังโหลดข้อมูลสรุปใหม่จากเซิร์ฟเวอร์ (เช่น หลังกดอัปเดตผลการรักษาหรือปิดเคสสำเร็จ) — เทียบ
// เหตุการณ์ของแต่ละเคสที่กำลังแสดงอยู่กับของสดจาก continuityAllCases แล้ว "ต่อ" เฉพาะเหตุการณ์
// ใหม่ที่ยังไม่เคยแสดงเข้าไปเป็นแถวเพิ่ม โดยไม่แตะแถวเดิมที่มีอยู่แล้วแม้แต่แถวเดียว — จึงไม่มีการ
// พับ-กางใหม่ให้เห็น และไม่กระทบเคสอื่นที่ไม่ได้เปลี่ยนแปลงเลย
function refreshContinuitySearchInPlace() {
    if (!continuitySearchGroups.size) return;

    let touchedModal = false;
    continuitySearchGroups.forEach((group, caseId) => {
        const freshCaseItem = continuityAllCases.find((item) => item.caseId === caseId);
        if (!freshCaseItem || !(freshCaseItem.timeline || []).length) return;

        const freshEvents = [...(freshCaseItem.timeline || [])].sort(
            (a, b) => Number(a.targetRowNumber) - Number(b.targetRowNumber)
        );
        const knownRowNumbers = new Set([
            Number(group.parentEventItem.targetRowNumber),
            ...group.childRows.map((entry) => Number(entry.eventItem.targetRowNumber))
        ]);
        const newEvents = freshEvents.filter(
            (event) => !knownRowNumbers.has(Number(event.targetRowNumber))
        );
        if (!newEvents.length) return;

        if (!touchedModal) {
            restoreContinuityUpdateForm();
            touchedModal = true;
        }
        newEvents.forEach((eventItem) => continuitySearchAppendEvent(group, eventItem));
    });
}

// แก้ไขข้อมูลเหตุการณ์หนึ่งรายการใน continuityAllCases ทันทีในเครื่อง (ไม่ยิง fetch ซ้ำ)
// เพื่อให้ประวัติที่เพิ่งบันทึกขึ้นแสดงผลได้ทันทีหลัง saveContinuitySearchRowEdit สำเร็จ
function continuityPatchEventLocally(payload) {
    const caseId = String(payload.CaseIdNew || '').trim();
    const caseItem = continuityAllCases.find((item) => item.caseId === caseId);
    if (!caseItem) return;

    const idx = (caseItem.timeline || []).findIndex(
        (event) => Number(event.targetRowNumber) === Number(payload.sheetRowIndex)
    );
    if (idx === -1) return;

    caseItem.timeline[idx] = {
        ...caseItem.timeline[idx],
        ...payload,
        targetRowNumber: Number(payload.sheetRowIndex)
    };

    const latest = caseItem.timeline[caseItem.timeline.length - 1];
    if (latest) {
        caseItem.statusText = latest.statusText || caseItem.statusText;
        caseItem.category = continuityStatusCategory(caseItem.statusText);
    }
}

// ลบเหตุการณ์หนึ่งรายการออกจาก continuityAllCases ทันทีในเครื่อง (ไม่ยิง fetch ซ้ำ) — ถ้าเป็น
// รายการสุดท้ายของเคสนั้น ให้เอาทั้งเคสออกจากแคชไปเลย
function continuityRemoveEventLocally(item) {
    const caseId = String(item.CaseIdNew || '').trim();
    const caseIndex = continuityAllCases.findIndex((entry) => entry.caseId === caseId);
    if (caseIndex === -1) return;

    const caseItem = continuityAllCases[caseIndex];
    caseItem.timeline = (caseItem.timeline || []).filter(
        (event) => Number(event.targetRowNumber) !== Number(item.targetRowNumber)
    );

    if (!caseItem.timeline.length) {
        continuityAllCases.splice(caseIndex, 1);
        return;
    }

    const latest = caseItem.timeline[caseItem.timeline.length - 1];
    caseItem.statusText = latest.statusText || caseItem.statusText;
    caseItem.category = continuityStatusCategory(caseItem.statusText);
    caseItem.lastUpdated = latest.autoDateTime || caseItem.lastUpdated;
}

// เติมช่องข้อมูลของ 1 เหตุการณ์ประวัติ — ใช้รายการฟิลด์/ลำดับเดียวกับ
// appendHistoryDataCells ในหน้าประวัติการรักษาทุกประการ ต่างกันแค่ช่องปุ่มท้ายแถว
// (createContinuitySearchActionCell แทน createHistoryActionCell เพื่อความปลอดภัยของข้อมูล — ดูหมายเหตุด้านล่าง)
function appendContinuityHistoryCells(row, item) {
    const values = [
        { value: item.treatmentDateTime, label: 'เวลาและวันที่เข้ารักษา' },
        { value: item.statusText, label: 'ขั้นตอนการรักษา' },
        { value: item.symptoms, label: 'อาการป่วย' },
        { value: getDisplayWorkLocation(item), label: 'สถานที่ทำงาน' },
        { value: item.hospital, label: 'สถานที่รักษา' },
        { value: item.DentalOPD, className: 'continuity-money-value', label: 'ทำฟัน หักวงเงิน OPD' },
        { value: item.PPUsageOPD, className: 'continuity-money-value', label: 'PP OPD' },
        { value: item.PPUsageIPD, className: 'continuity-money-value', label: 'PP IPD' },
        { value: item.SLKUsageOpdThB, className: 'slk-column continuity-money-value', label: 'SL OPD (THB)' },
        { value: item.SLKUsageIpdThB, className: 'slk-column continuity-money-value', label: 'SL IPD (THB)' },
        { value: item.SLKUsageOpdLkr, className: 'slk-column continuity-money-value', label: 'SL OPD (LKR)' },
        { value: item.SLKUsageIpdLkr, className: 'slk-column continuity-money-value', label: 'SL IPD (LKR)' },
        { value: item.OverLimitCreditInsThB, className: 'slk-column continuity-money-value', label: 'ส่วนเกินวงเงินค่ารักษา (THB)' },
        { value: item.OverLimitCreditInsLkr, className: 'slk-column continuity-money-value', label: 'ส่วนเกินวงเงินค่ารักษา (LKR)' },
        { value: item.ExchangeRatesIns, className: 'slk-column', label: 'เรทค่าเงินที่ประกันคิดให้ (THB/LKR)' },
        { value: item.ExchangeRatesInt, className: 'slk-column', label: 'เรทค่าเงินปัจจุบัน (THB/LKR)' },
        { value: item.ClinicianReportedOutcomes, label: 'ผลการรักษา' },
        // หมายเหตุ/เวลาบันทึก/แอดมิน/ปุ่มแก้ไข-ลบ ไว้ต่อจาก "ผลการรักษา" เลย (ไม่ใช่หลังรูป)
        // ให้เรียงเติมเต็มแถวเดียวกันแนวนอนไปก่อน แล้วค่อยตามด้วยรูปเอกสารแนบเป็นแถวเต็มความกว้างท้ายสุด
        { value: item.notes, label: 'หมายเหตุ' },
        { value: item.autoDateTime, label: 'เวลาและวันที่บันทึกข้อมูล' },
        { value: item.adminName, label: 'แอดมินที่บันทึกข้อมูล' },
        { type: 'actions' },
        { value: item.DocumentsAttached, type: 'evidence' }
    ];

    for (const cellDef of values) {
        if (cellDef.type === 'evidence') {
            row.appendChild(createEvidenceDocumentsCell(cellDef.value, item.statusText));
            continue;
        }
        if (cellDef.type === 'actions') {
            row.appendChild(createContinuitySearchActionCell(item));
            continue;
        }
        row.appendChild(createHistoryTableCell(cellDef.value, cellDef.className || '', cellDef.label || ''));
    }
}

// ซ่อน/แสดงคอลัมน์ประกันกลุ่ม SLK เฉพาะแถวที่เพิ่งสร้าง (ไม่ใช้ window.setSlkColumnsVisibility
// เพราะฟังก์ชันนั้นกวาดทั้งหน้าเว็บ อาจไปกระทบคอลัมน์ของหน้าประวัติการรักษาที่เปิดอยู่ด้วย)
function continuityApplySlkVisibility(row, item) {
    const show = window.isSlkWorkLocation?.(getDisplayWorkLocation(item)) === true;
    row.querySelectorAll('.slk-column').forEach((el) => {
        el.style.display = show ? '' : 'none';
    });
}

// ปุ่มแก้ไข/ลบท้ายแถว: ปุ่มลบใช้ executeDeleteRow เดิมได้ตรง ๆ (ปลอดภัย ไม่พึ่งพาช่องซ่อนใด ๆ)
// ส่วนปุ่มแก้ไข "ไม่" เรียก populateDataToForm ของหน้าประวัติโดยตรง เพราะฟังก์ชันนั้นบันทึกชื่อ/
// รหัสประกัน/ขนาดของพนักงานจากช่องซ่อนของกล่องค้นหาพนักงานฝั่งซ้าย (hiddenEmpName ฯลฯ) ซึ่งอาจเป็น
// "คนละคนกัน" กับเจ้าของเคสที่ค้นเจอในกล่องนี้ — ใช้ตรง ๆ เสี่ยงบันทึกข้อมูลผิดคน จึงทำฟังก์ชันบันทึก
// ของตัวเองที่ดึงชื่อ/รหัสประกัน/ขนาดจากตัวเคสเองเสมอ (รูปแบบ/พฤติกรรมบนจอยังเหมือนเดิมทุกประการ)
function createContinuitySearchActionCell(item) {
    const actionCell = document.createElement('td');
    actionCell.className = 'flat-history-actions';

    if (window.hasPermission?.('EditTreatment') === true) {
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = '✏️ แก้ไข';
        editButton.className = 'btn-edit-minimal';
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            openContinuitySearchRowEdit(item, event.currentTarget);
        });
        actionCell.appendChild(editButton);
    }

    if (window.hasPermission?.('DeleteTreatment') === true) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = '🗑️ ลบ';
        deleteButton.className = 'flat-history-delete';
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            const deleted = await executeDeleteRow(item.targetRowNumber, item.CaseIdNew);
            if (!deleted) return;
            // ลบสำเร็จ (หลังบ้านลบรูปบน Google Drive ที่ผูกกับแถวนี้ให้ด้วยแล้ว) — เอาแค่แถวนี้
            // แถวเดียวออกจากจอ ไม่รื้อทั้งเคส ไม่พับ-กางใหม่ ไม่กระทบเคสอื่นที่กางอยู่เลย
            const row = event.currentTarget.closest('tr');
            continuitySearchDeleteEvent(item, row);
        });
        actionCell.appendChild(deleteButton);
    }

    if (!actionCell.children.length) actionCell.textContent = '-';
    return actionCell;
}

function openContinuitySearchRowEdit(eventItem, triggerButton) {
    const row = triggerButton?.closest('tr');
    if (!row || row.classList.contains('is-editing-inline')) return;

    row.classList.add('is-editing-inline');

    row.querySelectorAll('td[data-label]').forEach((td) => {
        const config = INLINE_EDIT_FIELD_CONFIG[td.dataset.label];
        if (!config) return;
        const fallbackText = td.textContent.trim();
        td.replaceChildren(buildInlineEditInput(config, eventItem, fallbackText));
    });

    const evidenceTd = row.querySelector('td.history-evidence-cell');
    if (evidenceTd) {
        const editorDiv = document.createElement('div');
        editorDiv.className = 'edit-evidence-editor inline-evidence-editor';
        evidenceTd.replaceChildren(editorDiv);
        renderEditEvidenceEditor(eventItem, editorDiv);
    }

    // ช่องปุ่ม "แก้ไข/ลบ" หาด้วยคลาสเสมอ (ไม่ใช่ td:last-child) เพราะตอนนี้ "เอกสารที่ต้องแนบ"
    // ถูกจัดให้เป็นช่องสุดท้ายของแถวแทน — ถ้าใช้ lastElementChild แบบเดิมจะไปทับช่องรูปโดยไม่ตั้งใจ
    const actionsTd = row.querySelector('td.flat-history-actions');

    // ช่องหมายเหตุเป็นกล่องข้อความหลายบรรทัด อยู่ปนกับช่องสั้น ๆ แล้วเหลือที่ว่างเยอะ
    // ย้ายลงไปไว้ท้ายสุด (เต็มความกว้าง) ก่อนปุ่มบันทึก/ยกเลิก ระหว่างที่แก้ไขอยู่เท่านั้น
    const notesTd = row.querySelector('td[data-label="หมายเหตุ"]');
    if (notesTd) notesTd.style.flexBasis = '100%';
    if (evidenceTd && notesTd && actionsTd) {
        evidenceTd.after(notesTd, actionsTd);
    }

    if (actionsTd) {
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'inline-edit-save';
        saveButton.textContent = '💾 บันทึก';
        saveButton.addEventListener('click', (event) => {
            event.stopPropagation();
            saveContinuitySearchRowEdit(row, eventItem);
        });

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'inline-edit-cancel';
        cancelButton.textContent = 'ยกเลิก';
        cancelButton.addEventListener('click', (event) => {
            event.stopPropagation();
            // ยกเลิก: คืนค่าแถวนี้แถวเดียวกลับเป็นข้อมูลเดิม (eventItem ยังไม่ถูกแก้เลย)
            // ไม่แตะแถวอื่น ไม่พับเคสกลับ ไม่กระทบเคสอื่นที่กางอยู่ด้วย
            restoreContinuitySearchRowView(row, eventItem);
        });

        actionsTd.replaceChildren(saveButton, cancelButton);
    }
}

// บันทึกการแก้ไข: ยิง payload ชุดเดียวกับ /api/update-treatment ของหน้าประวัติการรักษาทุกประการ
// ต่างกันแค่แหล่งที่มาของ employeeName/insuranceId/size/company ซึ่งดึงจากตัวเคส (eventItem)
// โดยตรงเสมอ ไม่พึ่งพาช่องซ่อนของกล่องค้นหาพนักงานฝั่งซ้ายเหมือนฟังก์ชันเดิมของหน้าประวัติ
async function saveContinuitySearchRowEdit(row, eventItem) {
    const getField = (key) => row.querySelector(`.inline-edit-field[data-field-key="${key}"]`);

    const symptomsField = getField('symptoms');
    const symptoms = (symptomsField ? symptomsField.value : eventItem.symptoms || '').trim();

    if (!symptoms) {
        alert('⚠️ กรุณากรอกรายละเอียดอาการป่วยด้วยครับ');
        symptomsField?.focus();
        return;
    }

    const saveButton = row.querySelector('.inline-edit-save');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '⏳ กำลังบันทึก...';
    }

    try {
        let editedDocuments = eventItem.DocumentsAttached || '-';
        const evidenceEditor = row.querySelector('.inline-evidence-editor');
        if (evidenceEditor) {
            editedDocuments = await collectEditedEvidenceDocuments(evidenceEditor);
        }

        let loggedInAdminName = '';
        try {
            loggedInAdminName = sessionStorage.getItem('loggedInAdminName') || '';
        } catch (storageError) {
            loggedInAdminName = '';
        }

        const payload = {
            sheetRowIndex: eventItem.targetRowNumber,
            CaseIdNew: eventItem.CaseIdNew || eventItem.caseId || '-',
            autoDateTime: new Date().toLocaleString('th-TH'),
            adminName: loggedInAdminName || 'System Admin',
            treatmentDateTime: (getField('treatmentDateTime')?.value || eventItem.treatmentDateTime || '-').trim(),
            company: eventItem.company || 'CALL 365',
            workLocation: eventItem.workLocation || getDisplayWorkLocation(eventItem),
            hospital: getField('hospital')?.value || eventItem.hospital || '-',
            symptoms,
            insuranceId: eventItem.insuranceId || '-',
            size: eventItem.size || 'M',
            employeeName: eventItem.employeeName || '-',
            statusText: eventItem.statusText || '-',
            DentalOPD: getField('DentalOPD')?.value || '0',
            PPUsageOPD: getField('PPUsageOPD')?.value || '0',
            PPUsageIPD: getField('PPUsageIPD')?.value || '0',
            SLKUsageOpdThB: getField('SLKUsageOpdThB')?.value || '0',
            SLKUsageIpdThB: getField('SLKUsageIpdThB')?.value || '0',
            SLKUsageOpdLkr: getField('SLKUsageOpdLkr')?.value || '0',
            SLKUsageIpdLkr: getField('SLKUsageIpdLkr')?.value || '0',
            OverLimitCreditInsThB: getField('OverLimitCreditInsThB')?.value || '0',
            OverLimitCreditInsLkr: getField('OverLimitCreditInsLkr')?.value || '0',
            ExchangeRatesIns: getField('ExchangeRatesIns')?.value || '1',
            ExchangeRatesInt: getField('ExchangeRatesInt')?.value || '1',
            ClinicianReportedOutcomes: getField('ClinicianReportedOutcomes')?.value || '-',
            DocumentsAttached: editedDocuments,
            previousDocumentsAttached: eventItem.DocumentsAttached || '-',
            notes: getField('notes')?.value || '-'
        };

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/update-treatment`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'ไม่สามารถบันทึกข้อมูลได้');
        }

        if (result.driveCleanupWarning) {
            alert(`บันทึกสำเร็จ แต่มีคำเตือนเรื่องรูปบน Drive: ${result.driveCleanupWarning}`);
        }

        // แก้ไขข้อมูลในแคชท้องถิ่นทันที แล้วแสดงผลค่าที่เพิ่งแก้ในแถวนี้แถวเดียวทันที ไม่ต้องรอ
        // ยิง fetch ซ้ำ ไม่แตะแถวอื่นเลยแม้แต่แถวเดียว จึงไม่มีการพับ-กางใหม่ให้เห็น
        const updatedEventItem = {
            ...eventItem,
            ...payload,
            targetRowNumber: Number(payload.sheetRowIndex)
        };
        continuityPatchEventLocally(payload);
        restoreContinuitySearchRowView(row, updatedEventItem);

        // sync ข้อมูลที่เก็บไว้ใน group ให้ตรงกับของที่เพิ่งแก้ด้วย เผื่อมีการลบ/โปรโมทแถวอื่น
        // หรือกดปุ่ม "อัปเดตผลการรักษา" ต่อในอนาคต (อ่านค่าล่าสุดจาก group ตอนกดเสมอ)
        const caseId = String(payload.CaseIdNew || '').trim();
        const group = continuitySearchGroups.get(caseId);
        if (group) {
            if (row === group.parentRow) {
                group.parentEventItem = updatedEventItem;
            } else {
                const entry = group.childRows.find((item) => item.row === row);
                if (entry) entry.eventItem = updatedEventItem;
            }
        }
    } catch (error) {
        alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = '💾 บันทึก';
        }
    }
}

// ============================================================================
// ปุ่ม "อัปเดตผลการรักษาหรือปิดเคส" — ใช้รูปแบบ/ช่องข้อมูล/พฤติกรรมชุดเดียวกับแถวประวัติ
// เป๊ะ ๆ (ป้ายชื่อบน ค่า/อินพุตล่าง เอกสารแนบเป็นการ์ดเล็ก 3 ช่อง หมายเหตุ+ปุ่มท้ายกล่อง)
// ตามที่สั่งให้ตรงกับตัวอย่างการ์ด "✏️ แก้ไข" ของหน้าประวัติการรักษา 100% — ต่างจากการแก้ไข
// แถวเดิมแค่ 2 จุดเท่าที่จำเป็นต่อเจตนารมย์เดิมของปุ่มนี้ (เพิ่มเหตุการณ์ใหม่ ไม่ใช่แก้ของเก่า):
//   1) "ขั้นตอนการรักษา" ต้องเลือกได้ (ปกติแถวประวัติจะล็อกเป็นข้อความอ่านอย่างเดียว)
//   2) ไม่มีช่อง "เวลาบันทึกข้อมูล/แอดมิน" เพราะยังไม่เคยถูกบันทึกจริง (เซิร์ฟเวอร์เพิ่งจะสร้างตอนกดยืนยัน)
// ============================================================================

// โคลนดรอปดาวน์สถานะจากฟอร์มป๊อปอัปเดิม (มีตัวเลือกครบทุกกลุ่มอยู่แล้ว) มาใช้ซ้ำ ไม่พิมพ์รายการเอง
// ใหม่ให้เสี่ยงตกหล่น/ไม่ตรงกัน — ตัด onchange เดิมออกเพราะมันไปอ้างอิงช่อง "อื่นๆ" ของป๊อปอัปเดิม
// ซึ่งไม่ได้อยู่ในฟอร์มนี้ (ผลคือถ้าเลือก "อื่นๆ" จะบันทึกเป็นคำว่า "อื่นๆ" ตรง ๆ โดยไม่มีช่องพิมพ์ระบุเพิ่ม)
function buildContinuityStatusSelect(currentValue) {
    const template = document.getElementById('ocStatusSelect');
    const select = template
        ? template.cloneNode(true)
        : document.createElement('select');
    select.removeAttribute('id');
    select.removeAttribute('onchange');
    select.className = 'inline-edit-field';
    select.required = true;
    if (currentValue) select.value = currentValue;
    return select;
}

// คืนแถวปุ่มอัปเดตกลับเป็นปุ่มเปล่าตามเดิม (ใช้ทั้งตอนกดยกเลิก และหลังบันทึกสำเร็จ)
function restoreContinuityUpdateRowButton(group) {
    const row = group.updateRow;
    row.className = 'grouped-child-row continuity-search-update-row';
    row.replaceChildren();

    const updateCell = document.createElement('td');
    updateCell.className = 'continuity-search-update-cell';

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'continuity-update-button';
    updateButton.textContent = 'อัปเดตผลการรักษาหรือปิดเคส';
    updateButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openContinuitySearchNewEventForm(group);
    });

    updateCell.appendChild(updateButton);
    row.appendChild(updateCell);
}

// เพิ่มเหตุการณ์ที่เพิ่งบันทึกสำเร็จเข้า continuityAllCases ทันทีในเครื่อง (ไม่ยิง fetch ซ้ำ)
// กันไม่ให้ refreshContinuitySearchInPlace() (ที่ทำงานเบื้องหลังหลัง refreshContinuitySummary)
// เห็นเป็น "เหตุการณ์ใหม่" อีกรอบแล้วต่อแถวซ้ำเข้าไปอีกอัน
function continuityAddEventLocally(payload) {
    const caseId = String(payload.CaseIdNew || '').trim();
    const caseItem = continuityAllCases.find((item) => item.caseId === caseId);
    if (!caseItem) return;

    caseItem.timeline = [...(caseItem.timeline || []), { ...payload }];
    caseItem.statusText = payload.statusText || caseItem.statusText;
    caseItem.category = continuityStatusCategory(caseItem.statusText);
    caseItem.lastUpdated = payload.autoDateTime || caseItem.lastUpdated;
}

// เปิดฟอร์ม "อัปเดตผลการรักษาหรือปิดเคส" ตรงแถวปุ่มเลย — สลับปุ่มให้กลายเป็นแถวข้อมูลกรอกได้
// รูปแบบเดียวกับแถวประวัติทุกกล่อง (เรียกใช้ appendContinuityHistoryCells + INLINE_EDIT_FIELD_CONFIG
// ชุดเดียวกับตอนกด "✏️ แก้ไข" เป๊ะ ๆ) แล้วค่อยดัดแปลงเฉพาะจุดที่เจตนารมย์ต่างกันตามที่อธิบายไว้ด้านบน
function openContinuitySearchNewEventForm(group) {
    const row = group.updateRow;
    if (row.classList.contains('is-editing-inline')) return;

    const latestEvent = group.childRows.length
        ? group.childRows[group.childRows.length - 1].eventItem
        : group.parentEventItem;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const draftEvent = {
        ...latestEvent,
        targetRowNumber: -1,
        // treatmentDateTime ใช้ปี ค.ศ. ตรง ๆ (ไม่บวก 543) ตามรูปแบบเดียวกับ flatpickr "d/m/Y"
        // ที่ใช้กรอกวันที่เข้ารักษาทั่วทั้งระบบ — คนละฟิลด์กับ autoDateTime ที่ใช้ปี พ.ศ.
        treatmentDateTime: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
        statusText: '',
        ClinicianReportedOutcomes: '',
        notes: '-',
        DocumentsAttached: '-'
    };

    row.className = 'grouped-child-row continuity-search-update-row is-editing-inline';
    row.replaceChildren();
    appendContinuityHistoryCells(row, draftEvent);
    continuityApplySlkVisibility(row, draftEvent);

    // แปลงช่องที่แก้ไขได้ตามปกติให้เป็นอินพุตชุดเดียวกับตอนกด "✏️ แก้ไข" เป๊ะ ๆ
    row.querySelectorAll('td[data-label]').forEach((td) => {
        const config = INLINE_EDIT_FIELD_CONFIG[td.dataset.label];
        if (!config) return;
        const fallbackText = td.textContent.trim();
        td.replaceChildren(buildInlineEditInput(config, draftEvent, fallbackText));
    });

    // ต่างจากแถวประวัติจุดเดียว: "ขั้นตอนการรักษา" ต้องเลือกได้ (ไม่ใช่ข้อความล็อกอ่านอย่างเดียว)
    // เพราะเจตนารมย์ของปุ่มนี้คือปรับสถานะเคสไปข้างหน้า
    const statusTd = row.querySelector('td[data-label="ขั้นตอนการรักษา"]');
    if (statusTd) statusTd.replaceChildren(buildContinuityStatusSelect(draftEvent.statusText));

    // เหตุการณ์ยังไม่เคยถูกบันทึกจริง จึงยังไม่มี "เวลาบันทึก/แอดมิน" ให้แสดง (เซิร์ฟเวอร์จะสร้างให้
    // ตอนกดยืนยัน) เอาช่องว่างเปล่า ๆ สองช่องนี้ออกไปก่อน ไม่ใช่ปล่อยให้โชว์ "-" ที่ไม่มีความหมาย
    row.querySelector('td[data-label="เวลาและวันที่บันทึกข้อมูล"]')?.remove();
    row.querySelector('td[data-label="แอดมินที่บันทึกข้อมูล"]')?.remove();

    const evidenceTd = row.querySelector('td.history-evidence-cell');
    if (evidenceTd) {
        const editorDiv = document.createElement('div');
        editorDiv.className = 'edit-evidence-editor inline-evidence-editor';
        evidenceTd.replaceChildren(editorDiv);
        renderEditEvidenceEditor(draftEvent, editorDiv);
    }

    const actionsTd = row.querySelector('td.flat-history-actions');
    const notesTd = row.querySelector('td[data-label="หมายเหตุ"]');
    if (notesTd) notesTd.style.flexBasis = '100%';
    if (evidenceTd && notesTd && actionsTd) {
        evidenceTd.after(notesTd, actionsTd);
    }

    if (actionsTd) {
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'inline-edit-save';
        saveButton.textContent = '💾 บันทึก';
        saveButton.addEventListener('click', (event) => {
            event.stopPropagation();
            saveContinuityNewEvent(group, row, draftEvent);
        });

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'inline-edit-cancel';
        cancelButton.textContent = 'ยกเลิก';
        cancelButton.addEventListener('click', (event) => {
            event.stopPropagation();
            restoreContinuityUpdateRowButton(group);
        });

        actionsTd.replaceChildren(saveButton, cancelButton);
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// บันทึกเหตุการณ์ใหม่: ยิง payload ชุดเดียวกับฟอร์มป๊อปอัปเดิมไปที่ /api/save-treatment พร้อม
// isTimelineUpdate:true (บอกหลังบ้านว่านี่คือการต่อประวัติเคสเดิม ห้ามเปลี่ยนเลขเคส) — เจตนารมย์
// เดิมของปุ่มนี้ไม่เปลี่ยนแม้หน้าตาจะเปลี่ยนไปแล้ว
async function saveContinuityNewEvent(group, row, draftEvent) {
    const getField = (key) => row.querySelector(`.inline-edit-field[data-field-key="${key}"]`);

    const statusSelect = row.querySelector('td[data-label="ขั้นตอนการรักษา"] select');
    const statusText = (statusSelect?.value || '').trim();
    if (!statusText) {
        alert('⚠️ กรุณาเลือกขั้นตอนการรักษาก่อนบันทึกครับ');
        statusSelect?.focus();
        return;
    }

    const symptomsField = getField('symptoms');
    const symptoms = (symptomsField ? symptomsField.value : draftEvent.symptoms || '').trim();
    if (!symptoms) {
        alert('⚠️ กรุณากรอกรายละเอียดอาการป่วยด้วยครับ');
        symptomsField?.focus();
        return;
    }

    const outcomeField = getField('ClinicianReportedOutcomes');
    const outcome = (outcomeField?.value || '').trim();
    if (!outcome) {
        alert('⚠️ กรุณากรอกผลการรักษาก่อนบันทึกครับ');
        outcomeField?.focus();
        return;
    }

    const saveButton = row.querySelector('.inline-edit-save');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '⏳ กำลังบันทึก...';
    }

    try {
        let editedDocuments = '-';
        const evidenceEditor = row.querySelector('.inline-evidence-editor');
        if (evidenceEditor) {
            editedDocuments = await collectEditedEvidenceDocuments(evidenceEditor);
        }

        let loggedInAdminName = '';
        try {
            loggedInAdminName = sessionStorage.getItem('loggedInAdminName') || '';
        } catch (storageError) {
            loggedInAdminName = '';
        }

        const payload = {
            sheetRowIndex: -1,
            CaseIdNew: draftEvent.CaseIdNew || draftEvent.caseId || '-',
            autoDateTime: new Date().toLocaleString('th-TH'),
            adminName: loggedInAdminName || 'System Admin',
            treatmentDateTime: (getField('treatmentDateTime')?.value || draftEvent.treatmentDateTime || '-').trim(),
            company: draftEvent.company || 'CALL 365',
            workLocation: draftEvent.workLocation || getDisplayWorkLocation(draftEvent),
            hospital: getField('hospital')?.value || draftEvent.hospital || '-',
            symptoms,
            insuranceId: draftEvent.insuranceId || '-',
            size: draftEvent.size || 'M',
            employeeName: draftEvent.employeeName || '-',
            isTimelineUpdate: true,
            statusText,
            DentalOPD: getField('DentalOPD')?.value || '0',
            PPUsageOPD: getField('PPUsageOPD')?.value || '0',
            PPUsageIPD: getField('PPUsageIPD')?.value || '0',
            SLKUsageOpdThB: getField('SLKUsageOpdThB')?.value || '0',
            SLKUsageIpdThB: getField('SLKUsageIpdThB')?.value || '0',
            SLKUsageOpdLkr: getField('SLKUsageOpdLkr')?.value || '0',
            SLKUsageIpdLkr: getField('SLKUsageIpdLkr')?.value || '0',
            OverLimitCreditInsThB: getField('OverLimitCreditInsThB')?.value || '0',
            OverLimitCreditInsLkr: getField('OverLimitCreditInsLkr')?.value || '0',
            ExchangeRatesIns: getField('ExchangeRatesIns')?.value || '1',
            ExchangeRatesInt: getField('ExchangeRatesInt')?.value || '1',
            ClinicianReportedOutcomes: outcome,
            DocumentsAttached: editedDocuments,
            notes: getField('notes')?.value || '-'
        };

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/save-treatment`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'ไม่สามารถบันทึกข้อมูลได้');
        }

        window.showInsuranceToast?.(
            `อัปเดตผลการรักษาเคส ${payload.CaseIdNew} สำเร็จ`,
            'success'
        );

        payload.targetRowNumber = result.updatedRowIndex ?? -1;

        // ต่อเป็นแถวใหม่ในไทม์ไลน์ทันที (ไม่รีเฟรชทั้งเคส ไม่พับ-กางใหม่) แล้วคืนปุ่มกลับที่เดิม
        continuityAddEventLocally(payload);
        continuitySearchAppendEvent(group, payload);
        restoreContinuityUpdateRowButton(group);
        group.setOpen(true);
    } catch (error) {
        alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = '💾 บันทึก';
        }
    }
}

function restoreContinuityUpdateForm() {
    const modal = document.getElementById('outcomeUpdateModal');
    const home = document.getElementById('outcomeUpdateModalHome');
    if (!modal || !home) return;

    modal.style.setProperty('display', 'none', 'important');
    resetContinuityEditingState();
    modal.classList.remove('continuity-inline-update');
    if (typeof window.setOutcomeModalLayout === 'function') {
        window.setOutcomeModalLayout(modal, false);
    }
    home.after(modal);
}

if (!window.continuityOutcomeCloseBound) {
    window.continuityOutcomeCloseBound = true;
    document.addEventListener('continuity:outcome-update-close', resetContinuityEditingState);
    // หมายเหตุ: ไม่รันคำค้นหาซ้ำตรงนี้ — ตอนปิดฟอร์ม (closeOutcomeUpdateModal) ข้อมูลจากเซิร์ฟเวอร์
    // ยังไม่ทันโหลดเสร็จ (รันก่อน await refreshContinuitySummary() ในฟอร์มอัปเดตเสมอ) และการรื้อ DOM
    // ตรงนี้จะไปดึงป๊อปอัปที่ยังฝังอยู่ในการ์ดเก่าหลุดออกจากเอกสารด้วย ดูจุดที่รีเฟรชจริงใน
    // refreshContinuitySummary() แทน (เรียก refreshContinuitySearchInPlace() หลังข้อมูลใหม่มาถึงแล้ว)
}

function setContinuityCount(elementId, value) {
    const element = document.getElementById(elementId);

    if (!element) return;

    const count = Number(value);
    element.textContent =
        Number.isFinite(count) && count >= 0
            ? count.toLocaleString('th-TH')
            : '0';
}

window.refreshContinuitySummary = refreshContinuitySummary;
