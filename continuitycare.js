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
            const panel = document.getElementById('continuityCasePanel');
            const list = document.getElementById('continuityCaseList');
            const title = document.getElementById('continuityCasePanelTitle');
            const description = document.getElementById('continuityCasePanelDescription');
            if (!panel || !list || !title || !description) return;
            if (!query) {
                caseSearchInput?.focus();
                return;
            }
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
            title.textContent = `ผลการค้นหา ${caseSearchInput.value.trim()}`;
            description.textContent = `พบ ${matches.length.toLocaleString('th-TH')} เคส`;
            renderContinuityCases(matches, list);
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
