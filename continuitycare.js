'use strict';

const continuityCategoryLabels = {
    pending: 'Pending / Awaiting Action',
    active: 'Active / Open Case',
    followUp: 'In Progress / Follow-up',
    billing: 'Discharged / Billing Pending',
    closed: 'Closed Case'
};

let continuitySelectedArea = '';

async function refreshContinuitySummary() {
    const status = document.getElementById('continuityCareStatus');

    if (!status) return;

    status.textContent = 'กำลังโหลดข้อมูลสรุป…';
    status.dataset.status = 'loading';

    try {
        const areaQuery = continuitySelectedArea
            ? `?area=${encodeURIComponent(continuitySelectedArea)}`
            : '';
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/continuity-of-care/summary${areaQuery}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'โหลดข้อมูลสรุปไม่สำเร็จ');
        }

        const summary = data.summary || {};

        setContinuityCount('continuityTotalCount', summary.total);
        setContinuityCount('continuityPendingCount', summary.pending);
        setContinuityCount('continuityActiveCount', summary.active);
        setContinuityCount('continuityFollowUpCount', summary.followUp);
        setContinuityCount('continuityBillingCount', summary.billing);
        setContinuityCount('continuityClosedCount', summary.closed);
        renderContinuityAreaButtons(data.areas, summary.total);

        initContinuityInteractions();

        status.textContent =
            Number(summary.needsReview || 0) > 0
                ? `มี ${Number(summary.needsReview).toLocaleString('th-TH')} เคสที่สถานะไม่ตรงคำเต็มและต้องตรวจสอบ`
                : `อัปเดตล่าสุด ${new Date().toLocaleString('th-TH')}`;
        status.dataset.status = 'success';
    } catch (error) {
        console.error('Continuity of Care summary error:', error);
        status.textContent =
            'ไม่สามารถโหลดข้อมูลติดตามเคสได้ กรุณาลองใหม่ภายหลัง';
        status.dataset.status = 'error';
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
            await refreshContinuitySummary();
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
}

async function loadContinuityCases(category) {
    const panel = document.getElementById('continuityCasePanel');
    const list = document.getElementById('continuityCaseList');
    const title = document.getElementById('continuityCasePanelTitle');
    const description = document.getElementById('continuityCasePanelDescription');
    if (!panel || !list || !continuityCategoryLabels[category]) return;

    document.querySelectorAll('.continuity-metric[data-category]')
        .forEach((card) => {
            const selected = card.dataset.category === category;
            card.classList.toggle('selected', selected);
            card.setAttribute('aria-expanded', String(selected));
        });

    panel.hidden = false;
    title.textContent = continuityCategoryLabels[category];
    description.textContent = 'กำลังโหลดรายชื่อเคส…';
    list.innerHTML = '<div class="continuity-empty">กำลังโหลดข้อมูล…</div>';

    try {
        const params = new URLSearchParams({ category });
        if (continuitySelectedArea) params.set('area', continuitySelectedArea);
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/continuity-of-care/cases?${params.toString()}`,
            { method: 'GET', cache: 'no-store' }
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'โหลดรายละเอียดเคสไม่สำเร็จ');
        }

        const cases = Array.isArray(data.cases) ? data.cases : [];
        const areaLabel = continuitySelectedArea
            ? ` ในพื้นที่ ${continuitySelectedArea}`
            : '';
        description.textContent = `พบ ${cases.length.toLocaleString('th-TH')} เคส${areaLabel} — เรียงเคสที่ค้างนานก่อน`;
        renderContinuityCases(cases, list);
    } catch (error) {
        console.error('Continuity of Care cases error:', error);
        description.textContent = 'ไม่สามารถโหลดรายละเอียดเคสได้';
        list.innerHTML = '<div class="continuity-empty continuity-error">กรุณาลองใหม่อีกครั้ง</div>';
    }
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
        addContinuityDetail(details, 'เคส ID', item.caseId);
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

function addContinuityDetail(container, label, value) {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = String(value || '-');
    container.append(term, detail);
}

function openContinuityInlineUpdate(item, target, button) {
    if (typeof window.populateOutcomeToModal !== 'function') return;

    const modal = document.getElementById('outcomeUpdateModal');
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
        modal.style.setProperty('display', 'none', 'important');
        return;
    }

    target.hidden = false;
    window.populateOutcomeToModal(item, { inlineTarget: target });
    button.textContent = 'ซ่อนแบบฟอร์มอัปเดต';
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeContinuityCasePanel() {
    restoreContinuityUpdateForm();
    const panel = document.getElementById('continuityCasePanel');
    if (panel) panel.hidden = true;
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
    modal.classList.remove('continuity-inline-update');
    if (typeof window.setOutcomeModalLayout === 'function') {
        window.setOutcomeModalLayout(modal, false);
    }
    home.after(modal);
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
