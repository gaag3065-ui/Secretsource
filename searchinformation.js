'use strict';

let activeInsuranceSearchController = null;
let activeInsuranceSearchSequence = 0;

function setTreatmentFormLocked(locked) {
    const claimForm = document.getElementById('claimForm');
    if (!claimForm) return false;

    claimForm
        .querySelectorAll('input, select, textarea, button')
        .forEach((element) => {
            if (locked) {
                element.disabled = true;
                return;
            }

            element.disabled = element.id === 'caseId';
        });

    claimForm.classList.toggle('employee-not-selected', locked);
    return true;
}

function setInsuranceSearchMessage(message, status = 'neutral') {
    const messageElement = document.getElementById('message');
    if (!messageElement) return;

    const colors = {
        neutral: '#526672',
        loading: '#526672',
        success: '#08745e',
        warning: '#a16207',
        error: '#b42318'
    };

    messageElement.textContent = message;
    messageElement.dataset.status = status;
    messageElement.style.color = colors[status] || colors.neutral;
}

function setCaseSearchStatus(message, status = 'neutral') {
    const statusElement = document.getElementById('caseSearchStatus');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.dataset.status = status;
}

function escapeSearchHtml(value) {
    return String(value ?? '-')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getEmploymentStatus(value) {
    const rawStatus = String(value ?? '').trim();
    const normalizedStatus = rawStatus.toLowerCase();

    if (normalizedStatus === 'on work' || normalizedStatus === 'onwork') {
        return { label: 'on work', className: 'on-work' };
    }

    if (normalizedStatus === 'resigned' || normalizedStatus === 'ลาออก') {
        return { label: 'resigned', className: 'resigned' };
    }

    return {
        label: rawStatus || 'ไม่ระบุสถานะ',
        className: 'unknown'
    };
}

function createEmployeeInformationRow(label, value) {
    const displayValue = String(value ?? '').trim() || '-';

    return `
        <div class="employee-detail-row">
            <span class="employee-detail-label">${escapeSearchHtml(label)}</span>
            <span class="employee-detail-value">${escapeSearchHtml(displayValue)}</span>
            <button
                type="button"
                class="employee-copy-button"
                data-copy-value="${escapeSearchHtml(displayValue)}"
                ${displayValue === '-' ? 'disabled' : ''}
            >Copy</button>
        </div>
    `;
}

async function copyEmployeeValue(value, button) {
    const text = String(value ?? '').trim();
    if (!text || text === '-') return;

    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        const temporaryInput = document.createElement('textarea');
        temporaryInput.value = text;
        temporaryInput.style.position = 'fixed';
        temporaryInput.style.opacity = '0';
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        document.execCommand('copy');
        temporaryInput.remove();
    }

    const originalText = button.textContent;
    button.textContent = 'คัดลอกแล้ว';
    button.classList.add('copied');

    window.setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, 1200);
}

function clearInsuranceSelection() {
    const hiddenInputIds = [
        'hiddenEmpName',
        'employeeName',
        'hiddenCompany',
        'hiddenSize',
        'hiddenWorkLocation',
        'hiddenInsuranceId',
        'insuranceId'
    ];

    hiddenInputIds.forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    const resultsList = document.getElementById('resultsList');
    if (resultsList) resultsList.replaceChildren();
    const searchMeta = document.getElementById('employeeSearchMeta');
    if (searchMeta) searchMeta.replaceChildren();

    setTreatmentFormLocked(true);

    if (typeof window.renderHistoryTable === 'function') {
        window.renderHistoryTable([]);
    }
}

function setSearchButtonBusy(button, busy, busyText) {
    if (!button) return;

    if (busy) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }
        button.disabled = true;
        button.textContent = busyText;
        return;
    }

    button.disabled = false;
    button.textContent = button.dataset.originalText || 'ค้นหา';
}

function beginInsuranceSearch() {
    activeInsuranceSearchController?.abort();
    activeInsuranceSearchController = new AbortController();
    activeInsuranceSearchSequence += 1;
    clearInsuranceSelection();

    return {
        controller: activeInsuranceSearchController,
        sequence: activeInsuranceSearchSequence
    };
}

let selectedLimitEmployee;
let limitRefreshSequence = 0;

function applySelectedEmployee(employee, selectedItem, options = {}) {
    const resultsList = document.getElementById('resultsList');
    if (!resultsList) return;
    selectedLimitEmployee = { employee, item: selectedItem };

    resultsList
        .querySelectorAll('.employee-result-option')
        .forEach((item) => {
            const selected = item === selectedItem;
            item.classList.toggle('selected', selected);
            item.setAttribute('aria-selected', String(selected));

            const details = item.querySelector('.employee-expanded-details');
            if (details) details.hidden = !selected;
        });

    const hiddenEmployeeValues = {
        hiddenEmpName: employee.colG || '-',
        employeeName: employee.colG || '-',
        hiddenCompany: employee.colB || '-',
        hiddenSize: employee.colD || '-',
        hiddenWorkLocation: employee.colK || '-',
        hiddenInsuranceId: employee.colC || '-',
        insuranceId: employee.colC || '-'
    };

    Object.entries(hiddenEmployeeValues).forEach(([elementId, value]) => {
        const element = document.getElementById(elementId);
        if (element) element.value = value;
    });

    const canOpenNewCase = employee.canOpenNewCase !== false;
    setTreatmentFormLocked(!canOpenNewCase);

    if (
        typeof window.setSlkColumnsVisibility === 'function' &&
        typeof window.isSlkWorkLocation === 'function'
    ) {
        window.setSlkColumnsVisibility(
            window.isSlkWorkLocation(employee.colK)
        );
    }

    if (typeof window.renderHistoryTable === 'function') {
        window.renderHistoryTable(
            Array.isArray(employee.history) ? employee.history : []
        );
    }

    if (!canOpenNewCase) {
        setInsuranceSearchMessage(
            'พบเคสแล้ว แต่ไม่พบข้อมูลพนักงานที่ยืนยันได้ จึงยังไม่เปิดฟอร์มสร้างเคสใหม่',
            'warning'
        );
        return;
    }

    const prefix = options.caseId
        ? `พบ Case ID ${options.caseId} และเลือกพนักงานให้แล้ว`
        : 'เลือกพนักงานแล้ว';

    setInsuranceSearchMessage(
        `${prefix}: ${employee.colG || '-'} | ${employee.colE || '-'} | ${employee.colC || '-'}`,
        'success'
    );
}

window.refreshSelectedTreatmentLimits = async function (insuranceId) {
    const selection = selectedLimitEmployee;
    const code = String(insuranceId || '').trim();
    if (!selection?.item?.isConnected || !code || code !== String(selection.employee.colC || '').trim()) return;
    const sequence = ++limitRefreshSequence;
    try {
        const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/search`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
            body: JSON.stringify({ keyword: code })
        });
        const data = await readSearchResponse(response);
        const fresh = (data.employees || [data.employee]).find(employee => String(employee?.colC || '').trim() === code);
        if (!response.ok || !data.success || !fresh || selectedLimitEmployee !== selection || sequence !== limitRefreshSequence || !selection.item.isConnected) return;
        Object.assign(selection.employee, fresh);
        const summary = selection.item.querySelector('.limit-summary');
        if (summary) summary.outerHTML = buildLimitSummary(selection.employee);
        const header = selection.item.querySelector('.employee-summary-line');
        header?.querySelectorAll('.limit-badge').forEach(badge => badge.remove());
        header?.querySelector('.employee-summary-arrow')?.insertAdjacentHTML('beforebegin', limitBadges(selection.employee));
    } catch (error) {
        console.error('Refresh treatment limits:', error);
    }
};

// ---------------------------------------------------------------- สรุปวงเงิน: ยอดหักแต่ละครั้ง (ทุกเคส) เทียบกับยอดคงเหลือในชีต
// กติกา: วงเงิน OPD ไม่พอ → ใช้วงเงิน IPD ร่วมได้ 1 ครั้ง (ครั้งที่วงเงิน OPD หมด) และต้องมีใบยินยอมที่เซ็นแล้วอัปโหลดในอัปเดตเคสนั้น
const LOW_LIMIT = 1000;
const limitNumber = value => {
    const number = Number(String(value ?? '').replace(/[,\s฿บาท]/g, ''));
    return Number.isFinite(number) ? number : 0;
};
const limitMoney = value => limitNumber(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const hasLimitValue = value => String(value ?? '').trim() !== '' && String(value).trim() !== '-';

function analyzeLimits(employee) {
    const opdLimit = limitNumber(employee.colAV), ipdLimit = limitNumber(employee.colAW);
    const visits = collectTreatmentRounds(employee.history).map(({ caseId, date, expense: item, consent, status }) => {
        const dental = limitNumber(item.DentalOPD);
        // The sheet balance uses PP OPD/IPD and dental. SL expenses have their own columns.
        const opd = limitNumber(item.PPUsageOPD);
        const ipd = limitNumber(item.PPUsageIPD);
        const other = limitNumber(item.OtherUsage);   // วงเงินอื่นๆ — แยก ไม่รวม OPD/IPD/ทำฟัน
        return { caseId, date, status, item, opd, ipd, dental, other, total: opd + ipd + dental + other, consent };
    });

    // ไล่ยอดตามลำดับวันที่: หาเคสที่ใช้วงเงินร่วม / บันทึก OPD เกินยอดคงเหลือ
    let opdLeft = opdLimit, sharedCase = null;
    const problems = [];
    for (const v of visits) {
        const outpatient = v.opd + v.dental;
        v.opdBefore = opdLeft;
        if (outpatient > 0 && outpatient > opdLeft + 0.5) {
            v.over = outpatient - Math.max(opdLeft, 0);
            problems.push(`เคส #${v.caseId} บันทึก OPD ${limitMoney(outpatient)} บาท เกินวงเงิน OPD คงเหลือ ${limitMoney(Math.max(opdLeft, 0))} บาท — ส่วนเกิน ${limitMoney(v.over)} บาท ต้องย้ายไปหักวงเงิน IPD`);
        }
        v.shared = outpatient > 0 && v.ipd > 0 && outpatient >= opdLeft - 0.5;
        if (v.shared || v.over) {
            if (sharedCase) problems.push(`เคส #${v.caseId} ใช้วงเงิน IPD ร่วม OPD ซ้ำ — ใช้ร่วมได้ครั้งเดียว (ใช้ไปแล้วในเคส #${sharedCase.caseId})`);
            else sharedCase = v;
        } else if (sharedCase && outpatient > 0) {
            problems.push(`เคส #${v.caseId} ยังหักวงเงิน OPD หลังจากใช้วงเงินร่วมไปแล้ว (เคส #${sharedCase.caseId})`);
        }
        opdLeft -= outpatient;
    }

    const opdUsed = visits.reduce((sum, v) => sum + v.opd + v.dental, 0);
    const ipdUsed = visits.reduce((sum, v) => sum + v.ipd, 0);
    const otherLimit = limitNumber(employee.colBK), otherUsed = visits.reduce((sum, v) => sum + v.other, 0);
    const hasOther = hasLimitValue(employee.colBK) || otherUsed > 0;
    const mismatches = [['OPD', opdLimit - opdUsed, employee.colBA], ['IPD', ipdLimit - ipdUsed, employee.colBB], ...(hasOther ? [['วงเงินอื่นๆ', otherLimit - otherUsed, employee.colBM]] : [])]
        .filter(([, calculated, sheet]) => hasLimitValue(sheet) && Math.abs(calculated - limitNumber(sheet)) > 0.5);
    const low = [['OPD', employee.colBA], ['IPD', employee.colBB], ...(hasOther ? [['วงเงินอื่นๆ', employee.colBM]] : [])]
        .filter(([, sheet]) => hasLimitValue(sheet) && limitNumber(sheet) < LOW_LIMIT);
    const needConsent = sharedCase && !sharedCase.consent ? sharedCase : null;
    return { visits, opdLimit, ipdLimit, opdUsed, ipdUsed, otherLimit, otherUsed, hasOther, mismatches, low, sharedCase, needConsent, problems,
        checked: hasLimitValue(employee.colBA) || hasLimitValue(employee.colBB) };
}

// ป้ายสีแดงบนแถวสรุปพนักงาน (มองเห็นได้โดยไม่ต้องกดขยาย)
function limitBadges(employee) {
    const a = analyzeLimits(employee);
    return [
        ...a.low.map(([type, sheet]) => `<span class="limit-badge">⚠️ ${type} เหลือ ${limitMoney(sheet)}</span>`),
        a.needConsent ? '<span class="limit-badge">✍️ รอใบยินยอม IPD ร่วม</span>' : '',
        a.mismatches.length ? '<span class="limit-badge">ยอดคงเหลือไม่ตรง</span>' : ''
    ].join('');
}

// ใบยินยอม (พิมพ์ข้อมูลพนักงาน/เคสให้แล้ว) — เปิดหน้าต่างใหม่เพื่อพิมพ์หรือบันทึกเป็น PDF
function openIpdShareConsentForm(employee, visit) {
    const win = window.open('', '_blank');
    if (!win) { alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป๊อปอัปแล้วลองอีกครั้ง'); return; }
    const opdPart = visit ? Math.min(visit.opd + visit.dental, Math.max(visit.opdBefore, 0)) : 0;
    const ipdPart = visit ? visit.opd + visit.dental + visit.ipd - opdPart : 0;
    const field = value => escapeSearchHtml(value || '..............................');
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบยินยอมให้ใช้วงเงิน IPD ร่วม OPD</title>
        <style>body{font-family:'Sarabun','TH Sarabun New',Tahoma,sans-serif;max-width:720px;margin:40px auto;font-size:17px;line-height:1.9;color:#111}
        h1{text-align:center;font-size:22px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin:14px 0}td{border:1px solid #999;padding:6px 10px}
        .sign{display:flex;justify-content:space-between;margin-top:70px;text-align:center}.sign div{width:45%}@media print{button{display:none}}</style></head><body>
        <button onclick="print()" style="float:right">🖨️ พิมพ์ / บันทึก PDF</button>
        <h1>ใบยินยอมให้ใช้วงเงินผู้ป่วยใน (IPD) ร่วมกับวงเงินผู้ป่วยนอก (OPD)</h1>
        <p>ข้าพเจ้า ${field(employee.colG)} รหัสพนักงาน ${field(employee.colE)} Insurance ID ${field(employee.colC)} บริษัท ${field(employee.colB)} Size ${field(employee.colD)}</p>
        <p>ขอยินยอมให้ใช้วงเงินผู้ป่วยใน (IPD) ร่วมชำระค่ารักษาพยาบาลผู้ป่วยนอก (OPD) เนื่องจากวงเงิน OPD คงเหลือไม่เพียงพอ ตามรายละเอียดดังนี้</p>
        <table>
            <tr><td>เลขเคส</td><td>${field(visit?.caseId)}</td></tr>
            <tr><td>วันที่เข้ารักษา</td><td>${field(visit?.date.text)}</td></tr>
            <tr><td>ค่ารักษาที่ใช้วงเงิน OPD/IPD</td><td>${visit ? `${limitMoney(visit.opd + visit.dental + visit.ipd)} บาท` : field('')}</td></tr>
            <tr><td>หักวงเงิน OPD (ยอดคงเหลือทั้งหมด)</td><td>${visit ? `${limitMoney(opdPart)} บาท` : field('')}</td></tr>
            <tr><td>หักวงเงิน IPD</td><td>${visit ? `${limitMoney(ipdPart)} บาท` : field('')}</td></tr>
        </table>
        <p>ข้าพเจ้ารับทราบว่าการใช้วงเงิน IPD ร่วมกับ OPD ใช้ได้เพียงครั้งเดียว เมื่อวงเงิน OPD หมด และไม่สามารถใช้วงเงินร่วมได้อีก</p>
        <div class="sign"><div>ลงชื่อ ...................................... พนักงาน<br>(${field(employee.colG)})<br>วันที่ ........./........./.........</div>
        <div>ลงชื่อ ...................................... ผู้รับเรื่อง<br>(......................................)<br>วันที่ ........./........./.........</div></div>
        </body></html>`);
    win.document.close();
}

function buildLimitSummary(employee) {
    const a = analyzeLimits(employee);
    const lines = [
        `📌วงเงินค่ารักษาพยาบาล Size ${employee.colD || '-'}  รวม ${limitMoney(a.opdLimit + a.ipdLimit)} บาท`,
        `- ผู้ป่วยใน IPD วงเงิน ${limitMoney(a.ipdLimit)}  คงเหลือ ${limitMoney(employee.colBB)} บาท`,
        `- ผู้ป่วยนอก OPD วงเงิน ${limitMoney(a.opdLimit)}  คงเหลือ ${limitMoney(employee.colBA)} บาท`,
        ...(a.hasOther ? [`- วงเงินอื่นๆ (แยกต่างหาก) วงเงิน ${limitMoney(a.otherLimit)}  คงเหลือ ${limitMoney(employee.colBM)} บาท`] : []),
        // เรียงจากวันที่เก่าสุด → ปัจจุบัน (ไม่ระบุวันที่ไว้ท้ายสุด)
        ...[...a.visits].sort((x, y) => {
            const fx = Number.isFinite(x.date.time) && x.date.time > 0, fy = Number.isFinite(y.date.time) && y.date.time > 0;
            return fx && fy ? x.date.time - y.date.time : fx ? -1 : fy ? 1 : 0;
        }).map(v => {
            const parts = treatmentAmountFields.filter(([field]) => !field.startsWith('Exchange') && limitNumber(v.item[field]))
                .map(([field, label]) => `${label} ${limitMoney(v.item[field])}`);
            return `${v.date.text || 'ไม่ระบุวันที่'} — ${parts.join(' · ')}${v === a.sharedCase ? ' — ใช้วงเงิน IPD ร่วม' : ''}`;
        })
    ];
    const text = lines.join('\n');

    const alerts = [
        ...a.low.map(([type, sheet]) => `⚠️ วงเงิน ${type} เหลือน้อย: ${limitMoney(sheet)} บาท (ต่ำกว่า ${limitMoney(LOW_LIMIT)})`
            + (type === 'OPD' ? (a.sharedCase ? ` — ใช้วงเงิน IPD ร่วมไปแล้วในเคส #${a.sharedCase.caseId} ใช้ร่วมซ้ำไม่ได้` : ' — ถ้าไม่พอ ใช้วงเงิน IPD ร่วมได้ 1 ครั้ง (ต้องเซ็นใบยินยอม)') : '')),
        ...a.problems.map(p => `⚠️ ${p}`),
        ...a.mismatches.map(([type, calculated, sheet]) =>
            `⚠️ ยอดคงเหลือไม่ตรง — ${type}: คำนวณจากประวัติได้ ${limitMoney(calculated)} แต่ชีตแสดง ${limitMoney(sheet)} (ต่าง ${limitMoney(Math.abs(calculated - limitNumber(sheet)))})`)
    ];
    const consent = a.needConsent ? `
        <div class="limit-consent">
            <b>✍️ เคส #${escapeSearchHtml(a.needConsent.caseId)} ใช้วงเงิน IPD ร่วม OPD — ยังไม่มีใบยินยอม</b>
            <p>ดาวน์โหลดใบยินยอม ให้พนักงานเซ็น แล้วอัปโหลดในช่อง "ใบยินยอมให้ใช้วงเงิน IPD ร่วม OPD" ของ <b>อัปเดตเคส #${escapeSearchHtml(a.needConsent.caseId)}</b> — แจ้งเตือนนี้จะหายไปเมื่ออัปโหลดแล้ว</p>
            <button type="button" class="limit-consent-button" data-consent-form>📄 ดาวน์โหลดใบยินยอมให้ใช้วงเงิน IPD ร่วม OPD</button>
        </div>` : (a.sharedCase ? `<div class="limit-summary-ok">✓ เคส #${escapeSearchHtml(a.sharedCase.caseId)} ใช้วงเงิน IPD ร่วม OPD — มีใบยินยอมแล้ว</div>` : '');
    const status = alerts.length
        ? alerts.map(t => `<div class="limit-summary-alert">${escapeSearchHtml(t)}</div>`).join('')
        : (a.checked ? '<div class="limit-summary-ok">✓ ยอดคงเหลือตรงกับประวัติการรักษา</div>' : '');

    const money = `
        <div class="limit-money-table">
            <span></span><b>วงเงิน</b><b>ใช้ไป (จากประวัติ)</b><b>คงเหลือ</b>
            <b class="limit-row">OPD (รวมทำฟัน)</b><span>${limitMoney(a.opdLimit)}</span><span>${limitMoney(a.opdUsed)}</span><span class="limit-balance${a.low.some(([t]) => t === 'OPD') ? ' is-low' : ''}">${escapeSearchHtml(employee.colBA || '-')}</span>
            <b class="limit-row">IPD</b><span>${limitMoney(a.ipdLimit)}</span><span>${limitMoney(a.ipdUsed)}</span><span class="limit-balance${a.low.some(([t]) => t === 'IPD') ? ' is-low' : ''}">${escapeSearchHtml(employee.colBB || '-')}</span>
            ${a.hasOther ? `<b class="limit-row limit-other" title="แยกต่างหาก ไม่รวมกับ OPD / IPD / ทำฟัน">วงเงินอื่นๆ</b><span>${limitMoney(a.otherLimit)}</span><span>${limitMoney(a.otherUsed)}</span><span class="limit-balance${a.low.some(([t]) => t === 'วงเงินอื่นๆ') ? ' is-low' : ''}">${escapeSearchHtml(employee.colBM || '-')}</span>` : ''}
        </div>`;

    return `
        <div class="limit-summary">
            ${status}
            ${consent}
            ${money}
            <div class="limit-summary-head"><b>สรุปการหักวงเงินแต่ละครั้ง (${a.visits.length} ครั้ง)</b>
                <button type="button" class="employee-copy-button" data-copy-value="${escapeSearchHtml(text)}">Copy ทั้งหมด</button></div>
            <pre class="limit-summary-text">${escapeSearchHtml(text)}</pre>
        </div>`;
}

function createEmployeeResultItem(employee, options = {}) {
    const employmentStatus = getEmploymentStatus(employee.colI);
    const item = document.createElement('div');
    item.className = 'employee-result-option';
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');

    item.innerHTML = `
        <div class="employee-summary-line">
            <span class="employee-summary-name">${escapeSearchHtml(employee.colG)}</span>
            <span class="employee-summary-divider">|</span>
            <span>${escapeSearchHtml(employee.colE)}</span>
            <span class="employee-summary-divider">|</span>
            <span>${escapeSearchHtml(employee.colC)}</span>
            <span class="employee-status-badge ${employmentStatus.className}">
                ${escapeSearchHtml(employmentStatus.label)}
            </span>
            ${limitBadges(employee)}
            <span class="employee-summary-arrow">▾</span>
        </div>
        <div class="employee-expanded-details" hidden>
            <p class="employee-found-row">
                ${options.caseId
                    ? `ผลลัพธ์จาก Case ID ${escapeSearchHtml(options.caseId)}`
                    : `ผลลัพธ์: เจอ (แถวที่ ${escapeSearchHtml(employee.foundRow)})`}
            </p>
            ${createEmployeeInformationRow('สถานะปัจจุบัน', employmentStatus.label)}
            ${createEmployeeInformationRow('ชื่อ', employee.colG)}
            ${createEmployeeInformationRow('บริษัท', employee.colB)}
            ${createEmployeeInformationRow('รหัสพนักงาน', employee.colE)}
            ${createEmployeeInformationRow('SIZE', employee.colD)}
            ${createEmployeeInformationRow('Insurance ID', employee.colC)}
            ${createEmployeeInformationRow('สถานที่ทำงาน', employee.colK)}
            ${buildLimitSummary(employee)}
        </div>
    `;

    const selectCurrentEmployee = () => {
        applySelectedEmployee(employee, item, options);
    };

    item.addEventListener('click', (event) => {
        if (event.target.closest('[data-consent-form]')) {
            event.stopPropagation();
            openIpdShareConsentForm(employee, analyzeLimits(employee).needConsent);
            return;
        }

        const copyButton = event.target.closest('.employee-copy-button');

        if (copyButton) {
            event.stopPropagation();
            copyEmployeeValue(copyButton.dataset.copyValue, copyButton);
            return;
        }

        selectCurrentEmployee();
    });

    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCurrentEmployee();
        }
    });

    return item;
}

function renderEmployeeResults(employees, options = {}) {
    const resultsList = document.getElementById('resultsList');
    if (!resultsList) return;

    const pageSize = 4;
    const totalPages = Math.max(1, Math.ceil(employees.length / pageSize));
    let currentPage = 0;

    const renderPage = () => {
        resultsList.replaceChildren();

        const searchMeta = document.getElementById('employeeSearchMeta');
        if (searchMeta) searchMeta.replaceChildren();

        const instruction = document.createElement('div');
        instruction.className = 'employee-selection-instruction';
        instruction.textContent = options.caseId
            ? `พบ Case ID ${options.caseId}`
            : employees.length > pageSize
                ? `พบ ${employees.length} รายการ — แสดงครั้งละ ${pageSize} รายการ`
                : 'กรุณาคลิกเลือกพนักงาน';
        (searchMeta || resultsList).appendChild(instruction);

        const startIndex = currentPage * pageSize;
        const pageEmployees = employees.slice(
            startIndex,
            startIndex + pageSize
        );
        const items = pageEmployees.map((employee) => {
            const item = createEmployeeResultItem(employee, options);
            resultsList.appendChild(item);
            return item;
        });

        if (totalPages > 1) {
            const pager = document.createElement('div');
            pager.className = 'employee-result-pager';
            pager.innerHTML = `
                <button type="button" data-page-action="previous" ${currentPage === 0 ? 'disabled' : ''}>ก่อนหน้า</button>
                <span>หน้า ${currentPage + 1} / ${totalPages}</span>
                <button type="button" data-page-action="next" ${currentPage === totalPages - 1 ? 'disabled' : ''}>ถัดไป</button>
            `;
            pager.addEventListener('click', (event) => {
                const action = event.target.closest('[data-page-action]')
                    ?.dataset.pageAction;
                if (!action) return;

                currentPage += action === 'next' ? 1 : -1;
                currentPage = Math.max(
                    0,
                    Math.min(currentPage, totalPages - 1)
                );
                renderPage();
            });
            resultsList.appendChild(pager);
        }

        if (options.autoSelect && employees.length === 1) {
            applySelectedEmployee(employees[0], items[0], options);
        }
    };

    renderPage();

    if (options.autoSelect && employees.length === 1) return;

    setTreatmentFormLocked(true);
    setInsuranceSearchMessage(
        options.caseId
            ? `พบพนักงานที่เกี่ยวข้อง ${employees.length} รายการ กรุณาเลือกข้อมูลที่ถูกต้อง`
            : `พบ ${employees.length} รายการ กรุณาคลิกเลือกพนักงาน`,
        'success'
    );
}

async function readSearchResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('รูปแบบคำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง');
    }
    return response.json();
}

async function performEmployeeSearch() {
    const keywordInput = document.getElementById('keywordInput');
    const keyword = String(keywordInput?.value || '').trim();

    if (!keyword) {
        setInsuranceSearchMessage('กรุณากรอกชื่อหรือรหัสพนักงาน', 'error');
        keywordInput?.focus();
        return;
    }

    const searchButton = document.getElementById('searchBtn');
    setCaseSearchStatus('', 'neutral');
    const request = beginInsuranceSearch();
    setSearchButtonBusy(searchButton, true, 'กำลังค้นหา…');
    setInsuranceSearchMessage('กำลังดึงข้อมูลพนักงานและประวัติล่าสุด…', 'loading');

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/search`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword }),
                signal: request.controller.signal
            }
        );
        const data = await readSearchResponse(response);

        if (request.sequence !== activeInsuranceSearchSequence) return;

        const employees = Array.isArray(data.employees)
            ? data.employees
            : (data.employee ? [data.employee] : []);

        if (!response.ok || !data.success || employees.length === 0) {
            throw new Error(data.message || 'ไม่พบข้อมูลพนักงาน');
        }

        renderEmployeeResults(employees, { autoSelect: true });
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Employee search error:', error);
        setInsuranceSearchMessage(
            error.message || 'เกิดข้อผิดพลาดในการค้นหาข้อมูล',
            'error'
        );
        setTreatmentFormLocked(true);
    } finally {
        setSearchButtonBusy(searchButton, false);
    }
}

async function performCaseSearch() {
    const caseInput = document.getElementById('caseSearchInput');
    const caseId = String(caseInput?.value || '')
        .normalize('NFKC')
        .trim();

    if (!caseId) {
        setInsuranceSearchMessage('กรุณากรอกชื่อ รหัสพนักงาน รหัสประกัน หรือ Case ID', 'error');
        setCaseSearchStatus('กรุณากรอกชื่อ รหัสพนักงาน รหัสประกัน หรือ Case ID', 'error');
        caseInput?.focus();
        return;
    }

    // ไม่ใช่ตัวเลขล้วน (ชื่อ / รหัสพนักงาน / รหัสประกัน) → ค้นหาพนักงานแบบเดียวกับช่องค้นหาด้านบน
    // พบคนเดียว → เลือกให้อัตโนมัติ (ประวัติขึ้นเลย) · พบหลายคน → เลื่อนขึ้นไปให้เลือกจากรายการด้านบน
    if (!/^d{1,10}$/.test(caseId)) {
        const keywordInput = document.getElementById('keywordInput');
        if (!keywordInput) return;
        keywordInput.value = caseId;
        setCaseSearchStatus(`กำลังค้นหา "${caseId}"…`, 'loading');
        await performEmployeeSearch();
        const options = document.querySelectorAll('#resultsList .employee-result-option');
        if (options.length === 1) {
            options[0].click();
            setCaseSearchStatus(`พบ "${caseId}" และแสดงประวัติแล้ว`, 'success');
        } else if (options.length > 1) {
            setCaseSearchStatus(`พบ ${options.length} คน — เลือกพนักงานจากรายการด้านบน`, 'warning');
            document.getElementById('resultsList')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setCaseSearchStatus(`ไม่พบ "${caseId}"`, 'error');
        }
        return;
    }

    if (!/^[A-Za-z0-9_-]{1,50}$/.test(caseId)) {
        setInsuranceSearchMessage('รูปแบบ Case ID ไม่ถูกต้อง', 'error');
        setCaseSearchStatus('รูปแบบ Case ID ไม่ถูกต้อง', 'error');
        caseInput?.focus();
        return;
    }

    const searchButton = document.getElementById('caseSearchBtn');
    const request = beginInsuranceSearch();
    setSearchButtonBusy(searchButton, true, 'กำลังค้นหา…');
    setInsuranceSearchMessage(`กำลังค้นหา Case ID ${caseId} จากข้อมูลล่าสุด…`, 'loading');
    setCaseSearchStatus(`กำลังค้นหา Case ID ${caseId}…`, 'loading');

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/search-case`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caseId }),
                signal: request.controller.signal
            }
        );
        const data = await readSearchResponse(response);

        if (request.sequence !== activeInsuranceSearchSequence) return;

        const employees = Array.isArray(data.employees)
            ? data.employees
            : [];

        if (!response.ok || !data.success || employees.length === 0) {
            throw new Error(data.message || `ไม่พบ Case ID ${caseId}`);
        }

        renderEmployeeResults(employees, {
            autoSelect: true,
            caseId: data.caseId || caseId
        });
        setCaseSearchStatus(
            `พบ Case ID ${data.caseId || caseId} และแสดงประวัติแล้ว`,
            'success'
        );
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Case ID search error:', error);
        setInsuranceSearchMessage(
            error.message || 'เกิดข้อผิดพลาดในการค้นหา Case ID',
            'error'
        );
        setCaseSearchStatus(
            error.message || 'เกิดข้อผิดพลาดในการค้นหา Case ID',
            'error'
        );
        setTreatmentFormLocked(true);
    } finally {
        setSearchButtonBusy(searchButton, false);
    }
}

function initSearchBoxEvents() {
    const searchButton = document.getElementById('searchBtn');
    const caseSearchButton = document.getElementById('caseSearchBtn');
    const keywordInput = document.getElementById('keywordInput');
    const caseInput = document.getElementById('caseSearchInput');

    if (searchButton) searchButton.onclick = performEmployeeSearch;
    if (caseSearchButton) caseSearchButton.onclick = performCaseSearch;

    keywordInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            performEmployeeSearch();
        }
    });

    caseInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            performCaseSearch();
        }
    });

    setTreatmentFormLocked(true);
}

window.performSearch = performEmployeeSearch;
window.performCaseSearch = performCaseSearch;
window.initSearchBoxEvents = initSearchBoxEvents;
