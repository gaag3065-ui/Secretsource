// 🎯 วางกลุ่มนี้ไว้บนสุดของไฟล์ insuranceclaimhistory.js
let currentEditingRowIndex = -1; 
let currentDomRowIndex = -1;
let currentActiveCaseId = "";
let currentActiveEventItem = null;

// 🎯 ฟังก์ชันจัดการอัปเดตชื่อไฟล์รูปภาพประจำหน้าจอโมดอลสีเขียว (ฝั่งล่าง)
// function updateOcFileName() {
//#region
function updateOcFileName() {
    const fileInput = document.getElementById('ocImageUpload');
    const fileNameDisplay = document.getElementById('ocFileNameDisplay');
    
    if (fileInput && fileInput.files.length > 0) {
        // แสดงชื่อไฟล์ภาพปัจจุบันพร้อมปรับอักษรเป็นสีเขียว
        fileNameDisplay.innerText = fileInput.files[0].name;
        fileNameDisplay.style.color = "#198754"; 
    } else {
        fileNameDisplay.innerText = "ยังไม่ได้เลือกไฟล์";
        fileNameDisplay.style.color = "#6c757d";
    }
}
//#endregion

//const INACTIVITY_LIMIT = 5 * 60 * 1000; 
//#region
const INACTIVITY_LIMIT = 60 * 60 * 1000; 
let timeoutId;



// 🚪 ฟังก์ชันสั่งออกจากระบบถาวร
async function logoutUser() {
    alert(
        'ไม่มีการใช้งานระบบเกินเวลาที่กำหนด ระบบจะออกจากระบบเพื่อความปลอดภัย'
    );

    await window.performSecureLogout();
}

// 🔁 รีเซ็ตเวลานับถอยหลังใหม่เมื่อขยับเมาส์
function resetTimer() {

    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(logoutUser, INACTIVITY_LIMIT);
}


// 👁️ ดักจับพฤติกรรมการเคลื่อนไหวทั่วหน้าจอ
function setupInactivityTimer() {
    // รันตรวจเช็คสิทธิ์หน้าจอชั้นแรกสุดก่อนเปิดระบบดักจับ


    window.onload = resetTimer;
    window.onmousemove = resetTimer;
    window.onmousedown = resetTimer;
    window.ontouchstart = resetTimer;
    window.onclick = resetTimer;
    window.onkeypress = resetTimer;
    window.addEventListener('scroll', resetTimer, true);
    
    resetTimer(); // เริ่มสแตนด์บายนับถอยหลังก้อนแรก
}

// 🚀 เปิดเครื่องระบบตรวจจับความปลอดภัย
setupInactivityTimer();


// 🚪 ฟังก์ชันเสริมสำหรับปุ่มกดออกจากระบบสีแดงด้านล่าง (Manual Logout)
async function manualLogout() {
    const confirmed = confirm(
        'คุณต้องการออกจากระบบใช่หรือไม่?'
    );

    if (!confirmed) return;

    await window.performSecureLogout();
}
//#endregion

//function renderHistoryTable(historyData) {
//#region
// ================================================================================================================================================================== //
// =============  ส่วนบน  ==================== โค้ดฟังชั่นปรับตรรกะในที่เวลาคลิกแล้วจะกรองเอาแถวของเคสนั้นๆมาแสดง หากมีแถวเดียวก็ไม่ต้องลง =========================================== //
// =================================================================================================================================================================== //
function renderHistoryTable(historyData) {

        window.historyDisplayMode = 'individual';
        window.currentIndividualHistory =
        Array.isArray(historyData)
            ? [...historyData]
            : [];

    const tableBody = document.getElementById('tableBodyResult');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!historyData || historyData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="23" class="text-center" style="font-weight:bold; padding:25px; background:#f8f9fa;">ℹ️ พนักงานคนนี้ยังไม่มีประวัติการรักษา</td></tr>`;
        return;
    }

    const groupedCases = {};
    historyData.forEach(item => {
        const id = item.CaseIdNew;
        if (!groupedCases[id]) groupedCases[id] = [];
        groupedCases[id].push(item);
    });

    Object.keys(groupedCases).forEach(caseId => {
        const timelines = groupedCases[caseId];
        
        // แถวหน้าด่านยึดข้อมูลอัปเดตสถานะล่าสุด (ตัวสุดท้ายของอาร์เรย์) เสมอ
        const latestEvent = timelines[timelines.length - 1]; 
        
        // 🎯 ปรับปรุงใหม่: ล็อกความสามารถให้ทุกเคส ID สามารถคลิกเปลี่ยนสไลด์เปิด-ปิดได้เหมือนกันทั้งหมด 100%
        const hasMultipleEvents = timelines.length > 1;

        let badgeStyle = latestEvent.statusText && latestEvent.statusText.includes("รักษาเสร็จ") 
            ? "background-color: #d1e7dd; color: #0f5132; padding: 4px 8px; border-radius: 4px;" 
            : "background-color: #fff3cd; color: #664d03; padding: 4px 8px; border-radius: 4px;";

        const parentTr = document.createElement('tr');
        parentTr.className = 'parent-row';
        // 🎯 บังคับให้เมาส์เปลี่ยนเป็นรูปมือชี้ (Pointer) สำหรับทุกล็อกแถวเพื่อบอกแอดมินว่า "ทุกเคสกดคลิกขยายได้นะ"
        parentTr.style.cursor = 'pointer';
        
        // 🎯 พ่นลูกศร ▼ ให้ปรากฏอยู่ข้างเลขเคส ID ในทุกช่องแถวหลักไม่มีข้อยกเว้น
        parentTr.innerHTML = `
            <td class="text-center font-bold">
                <div class="case-cell"><span class="txt-case-id">${caseId}</span><span class="toggle-arrow" style="margin-left:5px;">▼</span></div>
            </td>
            <td class="text-center">${latestEvent.treatmentDateTime || '-'}</td>
            <td class="text-center"><span style="${badgeStyle}">${latestEvent.statusText || 'รอดำเนินการ'}</span></td>
            <td class="text-left" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${latestEvent.symptoms || '-'}</td>
            <td class="text-left">${getDisplayWorkLocation(latestEvent)}</td>
            <td class="text-left">${latestEvent.hospital || '-'}</td>
            <td class="text-right" style="background:#f9fff9;">${latestEvent.DentalOPD || '0'}</td>
            <td class="text-right" style="background:#f9fff9;">${latestEvent.PPUsageOPD || '0'}</td>
            <td class="text-right" style="background:#f9fff9;">${latestEvent.PPUsageIPD || '0'}</td>
            <td class="text-right slk-column" style="background:#fffdf0;">${latestEvent.SLKUsageOpdThB || '0'}</td>
            <td class="text-right slk-column" style="background:#fffdf0;">${latestEvent.SLKUsageIpdThB || '0'}</td>
            <td class="text-right slk-column" style="background:#fffdf0;">${latestEvent.SLKUsageOpdLkr || '0'}</td>
            <td class="text-right slk-column" style="background:#fffdf0;">${latestEvent.SLKUsageIpdLkr || '0'}</td>
            <td class="text-right slk-column" style="color:red; background:#fffdf0;">${latestEvent.OverLimitCreditInsThB || '0'}</td>
            <td class="text-right slk-column" style="color:red; background:#fffdf0;">${latestEvent.OverLimitCreditInsLkr || '0'}</td>
            <td class="text-center slk-column" style="background:#fffdf0;">${latestEvent.ExchangeRatesIns || '1'}</td>
            <td class="text-center slk-column" style="background:#fffdf0;">${latestEvent.ExchangeRatesInt || '1'}</td>
            <td class="text-left">${latestEvent.ClinicianReportedOutcomes || '-'}</td>
            <td class="text-left">${latestEvent.DocumentsAttached || '-'}</td>
            <td class="text-left">${latestEvent.notes || '-'}</td>
            <td class="text-center">${latestEvent.autoDateTime || '-'}</td>
            <td class="text-center">${latestEvent.adminName || '-'}</td>
            <td class="text-center" style="background:#f8f9fa; font-size:11px; color:#6c757d;">- คลิกเพื่อดูไทม์ไลน์ -</td>
        `;
        const combinedCaseEvidence =
            combineCaseEvidenceDocuments(timelines);

        const parentEvidenceCell =
            createEvidenceDocumentsCell(
                combinedCaseEvidence,
                latestEvent.statusText,
                true
            );

        parentTr.children[18].replaceWith(
            parentEvidenceCell
        );

        tableBody.appendChild(parentTr);

        const childRowsArray = [];
        
        // 🎯 กางประวัติไทม์ไลน์ย่อยออกมาตามปกติ (หากเป็นเคสเดี่ยว ก็จะวนลูปรันสร้างออกมาแค่ 1 แถวอย่างถูกต้อง)
        timelines.forEach((event) => {
            const childTr = document.createElement('tr');
            childTr.className = `child-row-of-${caseId}`;
            childTr.style.display = 'none'; 
            childTr.style.backgroundColor = '#f4f7f6'; 

            childTr.innerHTML = `
                <td class="text-center font-bold" style="color:#0b5ed7; background:#eef1f6;">${caseId}</td>
                <td class="text-center" style="font-size:12px; color:#555;">${event.treatmentDateTime || '-'}</td>
                <td class="text-center" style="font-size:12px; color:#555;">${event.statusText || '-'}</td>
                <td class="text-left" style="white-space:normal !important; max-width:200px;">${event.symptoms || '-'}</td>
                <td class="text-center">${getDisplayWorkLocation(event)}</td>
                <td class="text-left">${event.hospital || '-'}</td>
                <td class="text-right" style="background:#edf7ed;">${event.DentalOPD || '0'}</td>
                <td class="text-right" style="background:#edf7ed;">${event.PPUsageOPD || '0'}</td>
                <td class="text-right" style="background:#edf7ed;">${event.PPUsageIPD || '0'}</td>
                <td class="text-right slk-column" style="background:#fffbe6;">${event.SLKUsageOpdThB || '0'}</td>
                <td class="text-right slk-column" style="background:#fffbe6;">${event.SLKUsageIpdThB || '0'}</td>
                <td class="text-right slk-column" style="background:#fffbe6;">${event.SLKUsageOpdLkr || '0'}</td>
                <td class="text-right slk-column" style="background:#fffbe6;">${event.SLKUsageIpdLkr || '0'}</td>
                <td class="text-right slk-column" style="color:red; background:#fffbe6;">${event.OverLimitCreditInsThB || '0'}</td>
                <td class="text-right slk-column" style="color:red; background:#fffbe6;">${event.OverLimitCreditInsLkr || '0'}</td>
                <td class="text-center slk-column" style="background:#fffbe6;">${event.ExchangeRatesIns || '1'}</td>
                <td class="text-center slk-column" style="background:#fffbe6;">${event.ExchangeRatesInt || '1'}</td>
                <td class="text-left">${event.ClinicianReportedOutcomes || '-'}</td>
                <td class="text-left">${event.DocumentsAttached || '-'}</td>
                <td class="text-left">${event.notes || '-'}</td>
                <td class="text-center" style="font-size:12px;">${event.autoDateTime || '-'}</td>
                <td class="text-center" style="font-size:12px;">${event.adminName || '-'}</td>
                <td class="text-center" style="background:#fff;">
                    ${window.hasPermission?.('EditTreatment') === true ? `<button type="button" class="btn-edit-minimal" data-permission="EditTreatment" onclick="event.stopPropagation(); const decodedData = JSON.parse(decodeURIComponent(escape(window.atob('${window.btoa(unescape(encodeURIComponent(JSON.stringify(event))))}')))); populateDataToForm(decodedData);">✏️ แก้ไข</button>` : ''}
                    ${window.hasPermission?.('DeleteTreatment') === true ? `<button type="button" data-permission="DeleteTreatment" style="padding: 2px 8px; background: transparent; border: 1px solid #dc3545; color: #dc3545; border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="event.stopPropagation(); executeDeleteRow(${event.targetRowNumber}, '${caseId}')">🗑️ ลบ</button>` : ''}
                </td>
            `;
            const childEvidenceCell =
                createEvidenceDocumentsCell(
                    event.DocumentsAttached,
                    event.statusText
                );

            childTr.children[18].replaceWith(
                childEvidenceCell
            );
            tableBody.appendChild(childTr);
            childRowsArray.push(childTr);
        });

        // 🎯 สั่งฝังแถวเว้นช่องไฟสีขาวและแนบกล่องปุ่มยาวสีเขียวเข้าประกบท้ายขบวนให้ทุกเคสอย่างเสมอภาค
        const spacerTr = document.createElement('tr');
        spacerTr.className = `child-row-of-${caseId}-spacer`;
        spacerTr.style.display = 'none'; 
        
        spacerTr.innerHTML = `
            <td colspan="23" style="height: 45px !important; background-color: #ffffff !important; border: none !important; padding: 8px 15px !important; text-align: left;">
                <button type="button" style="padding: 6px 20px; background-color: #198754; color: white; border: none; border-radius: 5px; font-size: 12.5px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1);" onclick="event.stopPropagation(); const decodedData = JSON.parse(decodeURIComponent(escape(window.atob('${window.btoa(unescape(encodeURIComponent(JSON.stringify(latestEvent))))}')))); populateOutcomeToModal(decodedData);">
                    🏥 อัปเดตผลการรักษา
                </button>
            </td>
        `;
        tableBody.appendChild(spacerTr);
        childRowsArray.push(spacerTr);

        // ระบบคลิกสลับหน้าจอ (Toggle) ทำงานสแตนด์บายได้ทุกแถวอย่างเสรี
        parentTr.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-edit-minimal') || e.target.tagName === 'BUTTON') return;
            const isCurrentlyOpen = parentTr.classList.contains('is-open');

            if (!isCurrentlyOpen) {
                parentTr.classList.add('is-open');
                childRowsArray.forEach(row => row.style.display = '');
                const txtCaseId = parentTr.querySelector('.txt-case-id');
                if (txtCaseId) txtCaseId.style.display = 'none';

                Array.from(parentTr.children).forEach((td, idx) => {
                    if (idx > 0 && idx < 21) td.style.opacity = '0'; 
                });
                const arrow = parentTr.querySelector('.toggle-arrow');
                if (arrow) arrow.innerText = '▲';
            } else {
                parentTr.classList.remove('is-open');
                childRowsArray.forEach(row => row.style.display = 'none');
                const txtCaseId = parentTr.querySelector('.txt-case-id');
                if (txtCaseId) txtCaseId.style.display = '';
                Array.from(parentTr.children).forEach((td) => { td.style.opacity = '1'; });
                const arrow = parentTr.querySelector('.toggle-arrow');
                if (arrow) arrow.innerText = '▼';
            }
        });
    });


                const workLocation =
                    document.getElementById('hiddenWorkLocation')?.value || '';

                window.setSlkColumnsVisibility(
                    window.isSlkWorkLocation(workLocation)
                );

}

// ================================================================================================================================================================== //
// ============= ส่วนล่าง  ==================== โค้ดฟังชั่นปรับตรรกะในที่เวลาคลิกแล้วจะกรองเอาแถวของเคสนั้นๆมาแสดง หากมีแถวเดียวก็ไม่ต้องลง =========================================== //
// =================================================================================================================================================================== //
//#endregion





   
//ล้างรูปเก่าทุกครั้งที่เปิดเคสใหม่ เพื่อป้องกันรูปจากเคสก่อนหน้าติดมาด้วย
//function resetUpdateEvidenceFiles() {
//#region
function resetUpdateEvidenceFiles() {
    const inputIds = [
        'updateReceiptFile',
        'medicalCertificateFile',
        'closeCaseEvidenceFile'
    ];

    const previewIds = [
        'updateReceiptPreview',
        'medicalCertificatePreview',
        'closeCaseEvidencePreview'
    ];

    inputIds.forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });

    previewIds.forEach((id) => {
        const preview = document.getElementById(id);
        if (preview) preview.replaceChildren();
    });
}
//#endregion

//เพิ่มฟังก์ชันสร้างชื่อไฟล์
//function getSafeUpdateEmployeeName() {
//function getImageExtension(file) {
//function buildUpdateEvidenceName(prefix, file) {
//#region
function getSafeUpdateEmployeeName() {
    const rawName =
        currentActiveEventItem?.employeeName ||
        currentActiveEventItem?.EmployeeName ||
        currentActiveEventItem?.empName ||
        document.getElementById('hiddenEmpName')?.value ||
        'ไม่ทราบชื่อ';

    return String(rawName)
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[\\/:*?"<>|]/g, '');
}


function getImageExtension(file) {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
        return extension === 'jpeg' ? 'jpg' : extension;
    }

    const mimeExtensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
    };

    return mimeExtensions[file.type] || 'jpg';
}

function buildUpdateEvidenceName(prefix, file) {
    const caseId = String(currentActiveCaseId || '').trim();
    const employeeName = getSafeUpdateEmployeeName();
    const extension = getImageExtension(file);

    if (!caseId) {
        throw new Error('ไม่พบเลขเคส ID');
    }

    return `${prefix}_${caseId}_${employeeName}.${extension}`;
}
//#endregion

//เพิ่มฟังก์ชันอัปโหลดรูปไป Google Drive
//async function uploadUpdateEvidence(file, prefix) {
//#region
async function uploadUpdateEvidence(file, prefix) {
    if (!file) return '';

    const fileName = buildUpdateEvidenceName(prefix, file);
    const fileData = await fileToDataUrl(file);

    const response = await window.authFetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/upload-drive`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                caseId: currentActiveCaseId,
                fileName,
                employeeName: getSafeUpdateEmployeeName(),
                fileData
            })
        }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || `อัปโหลด ${fileName} ไม่สำเร็จ`);
    }

    return result.fileUrl || '';
}
//#endregion

//เพิ่มฟังก์ชันอัปโหลดทั้ง 3 รูปพร้อมกัน
//window.uploadAllUpdateEvidence = async function () {
//#region
window.uploadAllUpdateEvidence = async function () {
    const receiptFile =
        document.getElementById('updateReceiptFile')?.files?.[0] || null;

    const medicalFile =
        document.getElementById('medicalCertificateFile')?.files?.[0] || null;

    const closeFile =
        document.getElementById('closeCaseEvidenceFile')?.files?.[0] || null;

    const [receiptUrl, medicalCertificateUrl, closeCaseUrl] =
        await Promise.all([
            uploadUpdateEvidence(receiptFile, 'UpdateReceiptcase'),
            uploadUpdateEvidence(medicalFile, 'MedicalCertificatecase'),
            uploadUpdateEvidence(closeFile, 'Closecase')
        ]);

    return {
        receiptUrl,
        medicalCertificateUrl,
        closeCaseUrl
    };
};
//#endregion

//window.toggleOcOtherInput = function (selectedValue) {
//#region
// 🎯 ฟังก์ชันช่วย เปิด/ซ่อน ช่องกรอกข้อความเสริมเมื่อเลือกขั้นตอนการรักษาเป็น "อื่นๆ"
window.toggleOcOtherInput = function (selectedValue) {
    const wrapper = document.getElementById('ocStatusOtherWrapper');
    const otherInput = document.getElementById('ocStatusOtherInput');
    if (wrapper && otherInput) {
        if (selectedValue === 'อื่นๆ') {
            wrapper.style.display = 'block';
            otherInput.required = true; // บังคับให้ต้องพิมพ์ห้ามปล่อยว่าง
            otherInput.focus();
        } else {
            wrapper.style.display = 'none';
            otherInput.required = false;
            otherInput.value = ''; // ล้างข้อความเก่าทิ้ง
        }
    }
};
//#endregion

//ฟังก์ชันดึงประวัติมาดีดแทรกแถวใหม่ในตารางทันที โดยไม่มีการกะพริบปิด-เปิดหน้าต่าง 
//ฟังก์ชันฉีดแถวสดเรียลไทม์ (แก้ไขจัดเรียงลำดับพิกัดให้ไหลลงสู่ด้านล่างตารางอย่างเสมอภาคและคงที่)
//window.injectNewRowToTableRealtime = function (payloadData) {
//#region
window.injectNewRowToTableRealtime = function (payloadData) {
    const tableBody = document.getElementById('tableBodyResult');
    if (!tableBody || !payloadData) return;

    if (tableBody.innerHTML.includes("ยังไม่มีประวัติ") || tableBody.innerHTML.includes("กรุณาค้นหา")) {
        tableBody.innerHTML = '';
    }

    const caseId = payloadData.CaseIdNew;
    const targetRowNo = payloadData.updatedRowIndex || payloadData.sheetRowIndex || -1;
    const displayAutoTime = payloadData.autoDateTime || new Date().toLocaleString('th-TH');

    const formatMoney = (val) => {
        if (val === undefined || val === null || val === '') return '0.00';
        let num = parseFloat(String(val).replace(/,/g, '').trim());
        if (isNaN(num)) return '0.00';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const mockEventItem = {
        targetRowNumber: targetRowNo, 
        CaseIdNew: caseId,
        treatmentDateTime: payloadData.treatmentDateTime || '-',
        statusText: payloadData.statusText || 'แจ้งประกัน กำลังเข้ารับการรักษา',
        symptoms: payloadData.symptoms || '-',
        workLocation: payloadData.workLocation || '-',
        hospital: payloadData.hospital || '-',
        DentalOPD: payloadData.DentalOPD || '0',
        PPUsageOPD: payloadData.PPUsageOPD || '0',
        PPUsageIPD: payloadData.PPUsageIPD || '0',
        SLKUsageOpdThB: payloadData.SLKUsageOpdThB || '0',
        SLKUsageIpdThB: payloadData.SLKUsageIpdThB || '0',
        SLKUsageOpdLkr: payloadData.SLKUsageOpdLkr || '0',
        SLKUsageIpdLkr: payloadData.SLKUsageIpdLkr || '0',
        OverLimitCreditInsThB: payloadData.OverLimitCreditInsThB || '0',
        OverLimitCreditInsLkr: payloadData.OverLimitCreditInsLkr || '0',
        ExchangeRatesIns: payloadData.ExchangeRatesIns || '1',
        ExchangeRatesInt: payloadData.ExchangeRatesInt || '1',
        ClinicianReportedOutcomes: payloadData.ClinicianReportedOutcomes || '-',
        DocumentsAttached: payloadData.documentsAttached || payloadData.DocumentsAttached || '-',
        notes: payloadData.notes || '-',
        autoDateTime: displayAutoTime,
        adminName: payloadData.adminName || 'System Admin'
    };

    window.currentIndividualHistory =
        Array.isArray(window.currentIndividualHistory)
            ? window.currentIndividualHistory
            : [];

    const realtimeHistoryIndex =
        window.currentIndividualHistory.findIndex(
            (item) =>
                Number(item.targetRowNumber) ===
                Number(mockEventItem.targetRowNumber)
        );

    if (realtimeHistoryIndex >= 0) {
        window.currentIndividualHistory[realtimeHistoryIndex] =
            mockEventItem;
    } else {
        window.currentIndividualHistory.push(mockEventItem);
    }

    const safeJsonString = JSON.stringify(mockEventItem);
    const safeEncodedBase64 = window.btoa(unescape(encodeURIComponent(safeJsonString)));

    const parentTr = document.createElement('tr');
    parentTr.className = 'parent-row';
    parentTr.style.cursor = 'pointer';
    parentTr.style.backgroundColor = '#edf7ed'; 

    parentTr.innerHTML = `
        <td class="text-center font-bold" style="color:#198754;">
            <div class="case-cell"><span class="txt-case-id">${caseId}</span><span class="toggle-arrow" style="margin-left:5px;">▼</span></div>
        </td>
        <td class="text-center">${mockEventItem.treatmentDateTime}</td>
        <td class="text-center"><span style="background-color: #fff3cd; color: #664d03; padding: 4px 8px; border-radius: 4px;">${mockEventItem.statusText}</span></td>
        <td class="text-left" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${mockEventItem.symptoms || '-'}</td>
        <td>${getDisplayWorkLocation(mockEventItem)}</td>
        <td class="text-left">${mockEventItem.hospital || '-'}</td>
        <td class="text-right" style="font-weight:bold;">${formatMoney(mockEventItem.DentalOPD)}</td>
        <td class="text-right" style="font-weight:bold;">${formatMoney(mockEventItem.PPUsageOPD)}</td>
        <td class="text-right" style="font-weight:bold;">${formatMoney(mockEventItem.PPUsageIPD)}</td>
        <td class="text-right slk-column" style="font-weight:bold;">${formatMoney(mockEventItem.SLKUsageOpdThB)}</td>
        <td class="text-right slk-column" style="font-weight:bold;">${formatMoney(mockEventItem.SLKUsageIpdThB)}</td>
        <td class="text-right slk-column" style="font-weight:bold;">${formatMoney(mockEventItem.SLKUsageOpdLkr)}</td>
        <td class="text-right slk-column" style="font-weight:bold;">${formatMoney(mockEventItem.SLKUsageIpdLkr)}</td>
        <td class="text-right slk-column" style="color:red; font-weight:bold;">${formatMoney(mockEventItem.OverLimitCreditInsThB)}</td>
        <td class="text-right slk-column" style="color:red; font-weight:bold;">${formatMoney(mockEventItem.OverLimitCreditInsLkr)}</td>
        <td class="text-center slk-column">${mockEventItem.ExchangeRatesIns}</td>
        <td class="text-center slk-column">${mockEventItem.ExchangeRatesInt}</td>
        <td class="text-left">${mockEventItem.ClinicianReportedOutcomes}</td>
        <td class="text-left">${mockEventItem.DocumentsAttached}</td>
        <td class="text-left">${mockEventItem.notes}</td>
        <td class="text-center">${mockEventItem.autoDateTime}</td>
        <td class="text-center">${mockEventItem.adminName}</td>
        <td class="text-center" style="background:#f8f9fa; font-size:11px; color:#6c757d;">- ไทม์ไลน์เรียลไทม์ -</td>
    `;

    parentTr.children[18].replaceWith(
        createEvidenceDocumentsCell(
            mockEventItem.DocumentsAttached,
            mockEventItem.statusText,
            true
        )
    );

    const childTr = document.createElement('tr');
    childTr.className = `child-row-of-${caseId}`;
    childTr.style.display = 'none'; 
    childTr.style.backgroundColor = '#f4f7f6'; 

    childTr.innerHTML = `
        <td class="text-center font-bold" style="color:#0b5ed7; background:#eef1f6;">${caseId}</td>
        <td class="text-center" style="font-size:12px; color:#555;">${mockEventItem.treatmentDateTime}</td>
        <td class="text-center" style="font-size:12px; color:#555;">${mockEventItem.statusText}</td>
        <td class="text-left" style="white-space:normal !important; max-width:200px;">${mockEventItem.symptoms || '-'}</td>
        <td>${getDisplayWorkLocation(mockEventItem)}</td>
        <td class="text-left">${mockEventItem.hospital || '-'}</td>
        <td class="text-right">${formatMoney(mockEventItem.DentalOPD)}</td>
        <td class="text-right">${formatMoney(mockEventItem.PPUsageOPD)}</td>
        <td class="text-right">${formatMoney(mockEventItem.PPUsageIPD)}</td>
        <td class="text-right slk-column">${formatMoney(mockEventItem.SLKUsageOpdThB)}</td>
        <td class="text-right slk-column">${formatMoney(mockEventItem.SLKUsageIpdThB)}</td>
        <td class="text-right slk-column">${formatMoney(mockEventItem.SLKUsageOpdLkr)}</td>
        <td class="text-right slk-column">${formatMoney(mockEventItem.SLKUsageIpdLkr)}</td>
        <td class="text-right slk-column" style="color:red;">${formatMoney(mockEventItem.OverLimitCreditInsThB)}</td>
        <td class="text-right slk-column" style="color:red;">${formatMoney(mockEventItem.OverLimitCreditInsLkr)}</td>
        <td class="text-center slk-column">${mockEventItem.ExchangeRatesIns}</td>
        <td class="text-center slk-column">${mockEventItem.ExchangeRatesInt}</td>
        <td class="text-left">${mockEventItem.ClinicianReportedOutcomes}</td>
        <td class="text-left">${mockEventItem.DocumentsAttached}</td>
        <td class="text-left">${mockEventItem.notes}</td>
        <td class="text-center" style="font-size:12px;">${mockEventItem.autoDateTime}</td>
        <td class="text-center" style="font-size:12px;">${mockEventItem.adminName}</td>
        <td class="text-center" style="background:#fff; white-space: nowrap;">
            ${window.hasPermission?.('EditTreatment') === true ? `<button type="button" class="btn-edit-minimal" data-permission="EditTreatment" onclick="event.stopPropagation(); const decodedData = JSON.parse(decodeURIComponent(escape(window.atob('${safeEncodedBase64}')))); populateDataToForm(decodedData);">✏️ แก้ไข</button>` : ''}
            ${window.hasPermission?.('DeleteTreatment') === true ? `<button type="button" data-permission="DeleteTreatment" style="padding: 2px 8px; background: transparent; border: 1px solid #dc3545; color: #dc3545; border-radius: 4px; font-size: 11px; cursor: pointer;" onclick="event.stopPropagation(); executeDeleteRow(${targetRowNo}, '${caseId}')">🗑️ ลบ</button>` : ''}
        </td>
    `;

    childTr.children[18].replaceWith(
        createEvidenceDocumentsCell(
            mockEventItem.DocumentsAttached,
            mockEventItem.statusText
        )
    );

            if (payloadData.isTimelineUpdate === true) {
            const existingParent = Array.from(
                tableBody.querySelectorAll('.parent-row')
            ).find((row) => {
                const caseText = row.querySelector('.txt-case-id')
                    ?.textContent?.trim();

                return caseText === String(caseId).trim();
            });

            if (existingParent) {
                const existingEvidenceCell =
                    existingParent.children[18];

                const combinedEvidence =
                    combineCaseEvidenceDocuments([
                        {
                            DocumentsAttached:
                                existingEvidenceCell?.dataset
                                    ?.evidenceRaw || '-',
                            statusText: 'สรุปหลักฐานทั้งเคส'
                        },
                        mockEventItem
                    ]);

                existingEvidenceCell?.replaceWith(
                    createEvidenceDocumentsCell(
                        combinedEvidence,
                        'สรุปหลักฐานทั้งเคส',
                        true
                    )
                );

                const existingSpacer = Array.from(tableBody.children)
                    .find((row) =>
                        row.classList.contains(
                            `child-row-of-${caseId}-spacer`
                        )
                    );

                const isOpen = existingParent.classList.contains('is-open');
                childTr.style.display = isOpen ? '' : 'none';

                childTr.querySelectorAll('.slk-column').forEach((element) => {
                    const location = String(
                        payloadData.workLocation || ''
                    ).toUpperCase();

                    element.style.display =
                        location.includes('SL') ? '' : 'none';
                });

                if (existingSpacer) {
                    tableBody.insertBefore(childTr, existingSpacer);
                } else {
                    existingParent.insertAdjacentElement(
                        'afterend',
                        childTr
                    );
                }

                existingParent.addEventListener('click', (event) => {
                    if (
                        event.target.closest('button') ||
                        event.target.closest('a')
                    ) {
                        return;
                    }

                    setTimeout(() => {
                        childTr.style.display =
                            existingParent.classList.contains('is-open')
                                ? ''
                                : 'none';
                    }, 0);
                });

                return;
            }
        }


    const spacerTr = document.createElement('tr');
    spacerTr.className = `child-row-of-${caseId}-spacer`;
    spacerTr.style.display = 'none'; 
    
    spacerTr.innerHTML = `
        <td colspan="23" style="height: 45px !important; background-color: #ffffff !important; border: none !important; padding: 8px 15px !important; text-align: left;">
            <button type="button" style="padding: 6px 20px; background-color: #198754; color: white; border: none; border-radius: 5px; font-size: 12.5px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1);" onclick="event.stopPropagation(); const decodedData = JSON.parse(decodeURIComponent(escape(window.atob('${safeEncodedBase64}')))); populateOutcomeToModal(decodedData);">
                🏥 อัปเดตผลการรักษา
            </button>
        </td>
    `;

    // 🎯 [แก้ไขจุดบั๊กที่ 2]: เปลี่ยนจากคำสั่ง insertBefore (แทรกบนสุด) มาใช้คำสั่ง appendChild (ต่อท้ายล่างสุด)
    // เพื่อบังคับให้แถวเกิดใหม่ไหลลงล่างตารางอย่างเป็นระบบ สอดคล้องกับพิกัดข้อมูลก่อนและหลังรีเฟรชหน้าจอเด็ดขาด 100%
    tableBody.appendChild(parentTr);
    tableBody.appendChild(childTr);
    tableBody.appendChild(spacerTr);

    const childRowsArray = [childTr, spacerTr];

    parentTr.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-edit-minimal') || e.target.tagName === 'BUTTON') return;
        const isCurrentlyOpen = parentTr.classList.contains('is-open');

        if (!isCurrentlyOpen) {
            parentTr.classList.add('is-open');
            childRowsArray.forEach(row => row.style.display = '');
            const txtCaseId = parentTr.querySelector('.txt-case-id');
            if (txtCaseId) txtCaseId.style.display = 'none';

            Array.from(parentTr.children).forEach((td, idx) => {
                if (idx > 0 && idx < 22) td.style.opacity = '0'; 
            });
            const arrow = parentTr.querySelector('.toggle-arrow');
            if (arrow) arrow.innerText = '▲';
        } else {
            parentTr.classList.remove('is-open');
            childRowsArray.forEach(row => row.style.display = 'none');
            const txtCaseId = parentTr.querySelector('.txt-case-id');
  if (txtCaseId) txtCaseId.style.display = '';
            Array.from(parentTr.children).forEach((td) => { td.style.opacity = '1'; });
            const arrow = parentTr.querySelector('.toggle-arrow');
            if (arrow) arrow.innerText = '▼';
        }
    });

    // 🔐 ระบบควบคุมการสแกนซ่อน-แสดงคอลัมน์ประกันกลุ่ม SLK อัตโนมัติตามสถานที่ทำงานของแถวเปิดสดใบใหม่
    const workLocation = document.getElementById('hiddenWorkLocation')?.value || '';
    const slkElements = parentTr.querySelectorAll('.slk-column');
    slkElements.forEach(el => el.style.display = workLocation.toUpperCase().includes('SL') ? '' : 'none');
    
    // ทำซ้ำสำหรับช่อง slk-column ภายในแถวย่อยเพื่อควบคุมสิทธิ์หน้าจอให้เท่าเทียมกัน
    const subSlkElements = childTr.querySelectorAll('.slk-column');
    subSlkElements.forEach(el => el.style.display = workLocation.toUpperCase().includes('SL') ? '' : 'none');

    console.log(`🎉 [Live Scientific Injection Success] แก้ไขตำแหน่งไหลลงด้านล่างสุดเรียบร้อยแล้ว!`);
};
//#endregion

//ฟังก์ชันหยอดค่าข้อมูลประวัติพนักงานเดิม เข้าสู่หน้าต่างป๊อปอัปผลการรักษา (Populate Data)
//window.populateOutcomeToModal = function(eventItem) {
//#region
        window.populateOutcomeToModal = function(eventItem) {
            resetUpdateEvidenceFiles();
            currentActiveEventItem = eventItem;
            currentActiveCaseId = String(
                eventItem.CaseIdNew ||
                eventItem.caseId ||
                ''
            ).trim();
   
        const hiddenWorkLocationEl = document.getElementById('hiddenWorkLocation');
        const workLocation = hiddenWorkLocationEl ? hiddenWorkLocationEl.value : '';
        const slkWrapper = document.getElementById('ocSlkFieldsWrapper');

        if (slkWrapper) {
            if (workLocation.toUpperCase().includes('SL')) {
                slkWrapper.style.display = 'block';
            } else {
                slkWrapper.style.display = 'none';
            }
        }


                if (document.getElementById('ocStatusSelect')) {
        document.getElementById('ocStatusSelect').value = ''; 
        toggleOcOtherInput(''); 
                  }

            currentEditingRowIndex = eventItem.targetRowNumber || -1;
            const modal = document.getElementById('outcomeUpdateModal');
            if (modal) { modal.style.display = 'flex'; }

            function setOcInput(id, value) {
                const el = document.getElementById(id);
                if (el) {
                    let cleanValue = (value !== undefined && value !== null) ? String(value) : '';
                    if (el.type === 'number') {
                        cleanValue = cleanValue.replace(/,/g, '').replace(/\s+/g, '').trim();
                    }
                    el.value = cleanValue;
                }
            }

            // ดีดค่าล็อก Readonly สีเทาขึ้นโมดอลป๊อปอัปสีเขียว
            setOcInput('ocCaseId', eventItem.CaseIdNew);
            setOcInput('ocHospital', eventItem.hospital);
            setOcInput('ocSymptoms', eventItem.symptoms);

            // ดีดค่าเงินเดิมขึ้นสแตนด์บายรอตรวจเช็คในฟอร์ม
            setOcInput('ocInpDentalOPD', eventItem.DentalOPD);
            setOcInput('ocInpPPUsageOPD', eventItem.PPUsageOPD);
            setOcInput('ocInpPPUsageIPD', eventItem.PPUsageIPD);

      
            setOcInput('ocInpSlkOpdThb', eventItem.SLKUsageOpdThB);
            setOcInput('ocInpSlkIpdThb', eventItem.SLKUsageIpdThB);
            setOcInput('ocInpSlkOpdLkr', eventItem.SLKUsageOpdLkr);
            setOcInput('ocInpSlkIpdLkr', eventItem.SLKUsageIpdLkr);
            setOcInput('ocInpOverThb', eventItem.OverLimitCreditInsThB);
            setOcInput('ocInpOverLkr', eventItem.OverLimitCreditInsLkr);
            setOcInput('ocInpRateIns', eventItem.ExchangeRatesIns || '1');
            setOcInput('ocInpRateInt', eventItem.ExchangeRatesInt || '1');
                    

            // แยกแกะส่วนวันที่และเวลาเพื่อจัดเตรียมเข้าช่อง Flatpickr ใต้กล่องอาการป่วย
            const rawDateTime = String(eventItem.treatmentDateTime || '').trim();
            const dateTimeParts = rawDateTime.split(' ');
            
            let cleanDate = dateTimeParts[0] || '';
            let cleanTime = dateTimeParts[1] || '';
            
            cleanDate = cleanDate.replace(/,/g, '').trim();
            cleanTime = cleanTime.replace(/,/g, '').trim();

            setOcInput('ocManualDate', cleanDate);
            setOcInput('ocManualTime', cleanTime);

            // ปลุกสั่งปฏิทินและนาฬิกาของหน้าป๊อปอัปให้พร้อมเปิดสิทธิ์ผูกมัดรับค่า
            if (!document.getElementById('ocManualDate')._flatpickr) { 
                flatpickr("#ocManualDate", { dateFormat: "d/m/Y", allowInput: true }); 
            }
            if (!document.getElementById('ocManualTime')._flatpickr) { 
                flatpickr("#ocManualTime", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, allowInput: true }); 
            }
        };
//#endregion

const EDIT_EVIDENCE_TYPES = {
    'รูปหลักฐานการเปิดเคส': {
        type: 'OPEN_CASE',
        prefix: 'Opencase'
    },
    'รูปใบเสร็จ': {
        type: 'RECEIPT',
        prefix: 'UpdateReceiptcase'
    },
    'ใบรับรองแพทย์': {
        type: 'MEDICAL_CERTIFICATE',
        prefix: 'MedicalCertificatecase'
    },
    'รูปหลักฐานการปิดเคส': {
        type: 'CLOSE_CASE',
        prefix: 'Closecase'
    }
};

function renderEditEvidenceEditor(eventItem) {
    const editor =
        document.getElementById('mdEvidenceEditor');

    if (!editor) return;

    currentActiveCaseId = String(
        eventItem.CaseIdNew || ''
    );
    currentActiveEventItem = eventItem;

    editor.dataset.originalStatus =
        eventItem.statusText || '-';

    const rawValue =
        eventItem.documentsAttached ||
        eventItem.DocumentsAttached ||
        '-';

    const hiddenInput =
        document.getElementById('mdInpDocs');

    if (hiddenInput) hiddenInput.value = rawValue;

    const documents = parseEvidenceDocuments(
        rawValue,
        eventItem.statusText
    );

    editor.replaceChildren();

    for (const documentItem of documents) {
        const config =
            EDIT_EVIDENCE_TYPES[documentItem.label];

        const card = document.createElement('div');
        card.className = 'edit-evidence-card';
        card.dataset.evidenceType = config.type;
        card.dataset.evidencePrefix = config.prefix;
        card.dataset.currentUrl = documentItem.url || '';

        const title = document.createElement('div');
        title.className = 'edit-evidence-card-title';
        title.textContent = documentItem.label;

        const current = document.createElement(
            documentItem.url ? 'button' : 'div'
        );
        current.className = 'edit-evidence-current';

        if (documentItem.url) {
            current.type = 'button';
            const image = document.createElement('img');
            image.src = getEvidencePreviewUrl(
                documentItem.url,
                'w320'
            );
            image.alt = documentItem.label;
            current.appendChild(image);
            current.addEventListener('click', () =>
                openImageViewer(
                    getEvidencePreviewUrl(
                        documentItem.url,
                        'w1600'
                    ),
                    documentItem.label
                )
            );
        } else {
            current.textContent = 'ยังไม่มีรูป';
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/jpeg,image/png,image/webp';
        fileInput.className = 'edit-evidence-file';
        fileInput.title = `เลือกรูปใหม่สำหรับ${documentItem.label}`;

        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) return;

            const previewUrl = URL.createObjectURL(file);
            current.replaceChildren();
            const image = document.createElement('img');
            image.src = previewUrl;
            image.alt = file.name;
            current.appendChild(image);
        });

        const removeLabel = document.createElement('label');
        removeLabel.className = 'edit-evidence-remove';
        const removeInput = document.createElement('input');
        removeInput.type = 'checkbox';
        removeInput.className = 'edit-evidence-remove-input';
        removeInput.disabled = !documentItem.url;
        removeLabel.append(removeInput, 'ลบรูปเดิม');

        card.append(
            title,
            current,
            fileInput,
            removeLabel
        );
        editor.appendChild(card);
    }
}

async function collectEditedEvidenceDocuments() {
    const cards = document.querySelectorAll(
        '#mdEvidenceEditor .edit-evidence-card'
    );
    const lines = [];

    for (const card of cards) {
        const file = card.querySelector(
            '.edit-evidence-file'
        )?.files?.[0];
        const removeExisting = card.querySelector(
            '.edit-evidence-remove-input'
        )?.checked === true;
        let url = removeExisting
            ? ''
            : card.dataset.currentUrl || '';

        if (file) {
            url = await uploadUpdateEvidence(
                file,
                card.dataset.evidencePrefix
            );
        }

        if (url) {
            lines.push(
                `${card.dataset.evidenceType}|${url}`
            );
        }
    }

    return lines.join('\n') || '-';
}

//ฟังก์ชันระบบแก้ไขข้อมูลย้อนหลังไปฝั่งล่าง
//window.populateDataToForm = function (eventItem) {
//window.closeEditModal = function () {
//#region
// 🎯 แก้ไขปรับปรุงใหม่: สั่งเปิดหน้าต่างแบบฟอร์มป๊อปอัป Modal ให้ดีดเด้งกึ่งกลางจอเป๊ะๆ 100%
window.populateDataToForm = function (eventItem) {

    renderEditEvidenceEditor(eventItem);

    //  สั่งให้ระบบค้นหาและจำพิกัดบรรทัดบนหน้าจอของปุ่มที่แอดมินเพิ่งคลิกเข้ามา
    const allRows = document.querySelectorAll('#tableBodyResult tr');
    allRows.forEach((row, idx) => {
        // ดักหาแถวที่มีข้อมูลอาการป่วยและวันที่ตรวจตรงกันกับที่กดเข้ามา
        if (row.innerHTML.includes(eventItem.symptoms) && row.innerHTML.includes(eventItem.treatmentDateTime)) {
            currentDomRowIndex = row.rowIndex; // บันทึกพิกัดลำดับแถวหน้าจอจริงเก็บไว้ในตัวแปรกลาง
        }
    });

    // 1. ล็อกเลขบรรทัดจริงเก็บเข้าตัวแปรกลางหลักหลังบ้าน (ยึดตามคำสั่งควบคุมขั้นตอนที่ 1)
    currentEditingRowIndex = eventItem.targetRowNumber || -1;

    // 2. สั่งปลุกหน้าต่างป๊อปอัปกล่องข้อความโครงสร้าง HTML ของเราให้เด้งแสดงผลกึ่งกลางหน้าจอทันที
    const modal = document.getElementById('editCaseModal');
    if (modal) {
        modal.style.setProperty('display', 'flex', 'important'); 
    }

    // ฟังก์ชันย่อยสำหรับป้อนค่าเข้าช่องอินพุตภายในโมดอลป๊อปอัปอย่างปลอดภัย
           function setMdInput(id, value) {
            const el = document.getElementById(id);
            if (el) {
                let cleanValue = (value !== undefined && value !== null) ? String(value) : '';
                
                // 🎯 ปรับปรุงใหม่: ลบทั้งคอมม่า และลบช่องว่าง/เว้นวรรคทุกจุดทิ้งทันทีหากอินพุตเป็น type="number"
                if (el.type === 'number') {
                    cleanValue = cleanValue.replace(/,/g, '').replace(/\s+/g, '').trim();
                }
                
                el.value = cleanValue;
            }
        }


    // 3. หยอดป้อนค่าข้อมูลทั่วไปประจำเคสลงช่องกรอกในกล่องป๊อปอัป
    setMdInput('mdCaseId', eventItem.CaseIdNew);
    setMdInput('mdHospitalSelect', eventItem.hospital);
    setMdInput('mdSymptomsInput', eventItem.symptoms);
    setMdInput('mdNotesInput', eventItem.notes);

    // 4. วิเคราะห์สับสยายแยกวันที่และเวลาออกจากกันให้สะอาด เพื่อล็อกช่อง Flatpickr เดี่ยวๆ
    const rawDateTime = String(eventItem.treatmentDateTime || '').trim();
    const dateTimeParts = rawDateTime.split(' ');
    let cleanDate = dateTimeParts[0] || '';
    let cleanTime = dateTimeParts[1] || '';
    
    // ล้างเครื่องหมายจุลภาคขยะ (,) ที่อาจจะหลงเหลือติดมาจากฐานข้อมูลชีต
    cleanDate = cleanDate.replace(/,/g, '').trim();
    cleanTime = cleanTime.replace(/,/g, '').trim();

    setMdInput('mdManualDate', cleanDate);
    setMdInput('mdManualTime', cleanTime);

       // ✅ โค้ดชุดใหม่ที่ปลอดภัยกว่าเดิม (วางแทนที่จุดที่ลบออกได้เลยครับ)
    const mdDateEl = document.getElementById('mdManualDate');
    const mdTimeEl = document.getElementById('mdManualTime');

    if (mdDateEl && !mdDateEl._flatpickr) {
        flatpickr("#mdManualDate", { dateFormat: "d/m/Y", allowInput: true });
    }
    if (mdTimeEl && !mdTimeEl._flatpickr) {
        flatpickr("#mdManualTime", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, allowInput: true });
    }

    if (mdDateEl && mdDateEl._flatpickr) mdDateEl._flatpickr.setDate(cleanDate, true);
    if (mdTimeEl && mdTimeEl._flatpickr) mdTimeEl._flatpickr.setDate(cleanTime, true);


    // 5. ดีดข้อมูลสิทธิ์ตัวเลขวงเงินต่างๆ กรอกลงตามล็อกช่องในป๊อปอัปครบทุกไอดี
    setMdInput('mdInpDentalOPD', eventItem.DentalOPD);
    setMdInput('mdInpPPUsageOPD', eventItem.PPUsageOPD);
    setMdInput('mdInpPPUsageIPD', eventItem.PPUsageIPD);
    setMdInput('mdInpSLKUsageOpdThB', eventItem.SLKUsageOpdThB);
    setMdInput('mdInpSLKUsageIpdThB', eventItem.SLKUsageIpdThB);
    setMdInput('mdInpSLKUsageOpdLkr', eventItem.SLKUsageOpdLkr);
    setMdInput('mdInpSLKUsageIpdLkr', eventItem.SLKUsageIpdLkr);
    setMdInput('mdInpOverLimitThB', eventItem.OverLimitCreditInsThB);
    setMdInput('mdInpOverLimitLkr', eventItem.OverLimitCreditInsLkr);
    setMdInput('mdInpExchangeRatesIns', eventItem.ExchangeRatesIns);
    setMdInput('mdInpExchangeRatesInt', eventItem.ExchangeRatesInt);
    
    // บรรจุสิทธิ์ผลรักษาและเอกสารลงฟิลด์ป๊อปอัปเพื่อพร้อมอัปเดตย้อนหลัง
    setMdInput('mdInpClinician', eventItem.ClinicianReportedOutcomes);
    setMdInput('mdInpDocs', eventItem.DocumentsAttached);
};

window.closeEditModal = function () {
    document.getElementById('editCaseModal').style.display = 'none';
};
//#endregion

//งานแก้ไขและอัปเดตประวัติ
//window.executeFormUpdate = async function () {
//#region
window.executeFormUpdate = async function () {
    const backupEmpName = document.getElementById('hiddenEmpName').value;
    const backupCompany = document.getElementById('hiddenCompany').value;
    const backupInsuranceId = document.getElementById('hiddenInsuranceId').value;
    const backupSize = document.getElementById('hiddenSize').value;
    const backupLocation = document.getElementById('hiddenWorkLocation').value;
    const symptoms = document.getElementById('symptomsInput').value;

      if (!symptoms.trim()) { 
        alert("กรุณากรอกอาการป่วย"); 
        return; 
    }

    const claimStatus = document.getElementById('claimStatus');

    const payload = {
        sheetRowIndex: currentEditingRowIndex, // เลขแถวตรงเป้า (เช่น 717)
        CaseIdNew: document.getElementById('caseId').value || '-',
        autoDateTime: document.getElementById('headerDateTimeValue').innerText,
        adminName: sessionStorage.getItem('loggedInAdminName') || 'System Admin', // ดึงชื่อแอดมินลงคอลัมน์ C
        treatmentDateTime: `${document.getElementById('manualDate').value} ${document.getElementById('manualTime').value}`.trim() || '-',
        company: backupCompany !== '-' ? backupCompany : 'CALL 365',
        workLocation: backupLocation !== '-' ? backupLocation : '-',
        hospital: document.getElementById('hospitalSelect').value,
        symptoms: symptoms,
        
        // 🎯 ล็อกชื่อตัวแปรให้สะกดตรงเป้าหมายตามกระบวนการรับค่าของไฟล์เซิร์ฟเวอร์หลังบ้าน
        insuranceId: backupInsuranceId !== '-' ? backupInsuranceId : '-', 
        size: backupSize !== '-' ? backupSize : 'M', 
        employeeName: backupEmpName !== '-' ? backupEmpName : 'อาเฟย ศิรินภา', 
        
        statusText: "แก้ไขและปรับปรุงข้อมูลเคสการรักษา", 
        DentalOPD: document.getElementById('inpDentalOPD')?.value || '0',
        PPUsageOPD: document.getElementById('inpPPUsageOPD')?.value || '0',
        PPUsageIPD: document.getElementById('inpPPUsageIPD')?.value || '0',
        SLKUsageOpdThB: document.getElementById('inpSLKUsageOpdThB')?.value || '0',
        SLKUsageIpdThB: document.getElementById('inpSLKUsageIpdThB')?.value || '0',
        SLKUsageOpdLkr: document.getElementById('inpSLKUsageOpdLkr')?.value || '0',
        SLKUsageIpdLkr: document.getElementById('inpSLKUsageIpdLkr')?.value || '0',
        OverLimitCreditInsThB: document.getElementById('inpOverLimitThB')?.value || '0',
        OverLimitCreditInsLkr: document.getElementById('inpOverLimitLkr')?.value || '0',
        ExchangeRatesIns: document.getElementById('inpExchangeRatesIns')?.value || '1',
        ExchangeRatesInt: document.getElementById('inpExchangeRatesInt')?.value || '1',
        ClinicianReportedOutcomes: document.getElementById('inpClinician')?.value || document.getElementById('inpOutcomes')?.value || '-',
        DocumentsAttached: document.getElementById('inpDocs')?.value || document.getElementById('inpDocuments')?.value || '-',
        notes: document.getElementById('notesInput').value || '-'
    };

    // 🚨 [กล่องระบบตรวจสอบขั้นตอนที่ 2] พิมพ์เปิดกะละมังข้อมูลออกมากางเช็คดูความปลอดภัยก่อนยิงส่งจริง
    if (confirm(`🧪 [ระบบทดสอบขั้นตอนที่ 2 - ตรวจเช็คก้อนข้อมูล Payload ก่อนส่ง]\n\n` +
                `• เลขบรรทัดที่ระบบกำลังจะวิ่งไปเขียนทับ: แถวที่ ${payload.sheetRowIndex}\n` +
                `• ชื่อเจ้าหน้าที่ผู้บันทึกเคส: คุณ ${payload.adminName}\n` +
                `• ชื่อโรงพยาบาลเป้าหมาย: ${payload.hospital}\n` +
                `• อาการป่วยใหม่ที่กรอกแก้: ${payload.symptoms}\n\n` +
                `กรุณาตรวจสอบว่าเลขบรรทัด และ ข้อมูลครบไหม?\n` +
                `- หากถูกต้องครบถ้วน กดปุ่ม "ตกลง (OK)" เพื่อปล่อยสิทธิ์ให้ข้อมูลยิงไปหาหลังบ้าน\n` +
                `- หากไม่ถูกต้อง กด "ยกเลิก (Cancel)" เพื่อหยุดล็อกระบบไว้ก่อนครับ`)) {
        
        try {
            const response = await window.authFetch(`${API_BASE_URL}/api/update-treatment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok && result.success) {
                alert('🎉 บันทึกปรับปรุงแก้ไขข้อมูลและส่งแถวลง Google Sheets สำเร็จเรียบร้อย!');

            const editModal = document.getElementById('editCaseModal');

            if (editModal) {
                editModal.style.display = 'none';
            }

            if (typeof performSearch === 'function') {
                await performSearch();
            }

            } else { alert('❌ เกิดข้อผิดพลาดจากเซิร์ฟเวอร์: ' + result.message); }
        } catch (e) { alert('❌ ขัดข้องในการติดต่อเชื่อมต่อ API หลังบ้าน'); }
    }
};
//#endregion

//window.openEditModal = function (eventItem, domIndex) {
//#regionmodalOutcomeForm
// 🎯 จัดการโหมดแก้ไขป๊อปอัป Modal (กล่องเหลืองทอง)
window.openEditModal = function (eventItem, domIndex) {
    renderEditEvidenceEditor(eventItem);
    currentEditingRowIndex = eventItem.targetRowNumber || -1;
    currentDomRowIndex = domIndex;

    const modal = document.getElementById('editCaseModal');
    if (modal) modal.style.display = 'flex';

    function setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = (val !== undefined && val !== null) ? String(val).replace(/,/g, '').trim() : '';
    }

    setVal('mdCaseId', eventItem.CaseIdNew);
    setVal('mdHospitalSelect', eventItem.hospital);
    setVal('mdSymptomsInput', eventItem.symptoms);
    setVal('mdStatusText', eventItem.statusText || 'รอดำเนินการ');
    setVal('mdInpDentalOPD', eventItem.DentalOPD || '0');
    setVal('mdInpPPUsageOPD', eventItem.PPUsageOPD || '0');
    setVal('mdInpPPUsageIPD', eventItem.PPUsageIPD || '0');
    setVal('mdInpSLKUsageOpdThB', eventItem.SLKUsageOpdThB || '0');
    setVal('mdInpSLKUsageIpdThB', eventItem.SLKUsageIpdThB || '0');
    setVal('mdInpSLKUsageOpdLkr', eventItem.SLKUsageOpdLkr || '0');
    setVal('mdInpSLKUsageIpdLkr', eventItem.SLKUsageIpdLkr || '0');
    setVal('mdInpOverLimitThB', eventItem.OverLimitCreditInsThB || '0');
    setVal('mdInpOverLimitLkr', eventItem.OverLimitCreditInsLkr || '0');
    setVal('mdInpExchangeRatesIns', eventItem.ExchangeRatesIns || '1');
    setVal('mdInpExchangeRatesInt', eventItem.ExchangeRatesInt || '1');
    setVal('mdInpClinician', eventItem.ClinicianReportedOutcomes || '-');
    setVal('mdInpDocs', eventItem.documentsAttached || eventItem.DocumentsAttached || '-');
    setVal('mdNotesInput', eventItem.notes || '-');

    const rawDateTime = String(eventItem.treatmentDateTime || '').trim();
    const parts = rawDateTime.split(' ');
    setVal('mdManualDate', parts[0] || '');
    setVal('mdManualTime', parts[1] || '');

    const workLocation = document.getElementById('hiddenWorkLocation').value;
    const modalSlk = document.querySelectorAll('#editCaseModal .slk-column');
    modalSlk.forEach(el => el.style.display = workLocation.toUpperCase().includes('SL') ? '' : 'none');
};
//#endregion


//มัดรวมฟั่งชั่น .addEventListener('submit')
//function initHistoryModalEvents() {
//#region
function initHistoryModalEvents() {
//const editFormEl = document.getElementById('modalEditForm');
//#region
       const editFormEl = document.getElementById('modalEditForm');
        if (editFormEl) {
            editFormEl.addEventListener('submit', async (e) => {
                e.preventDefault(); // บล็อกหน้าจอไม่ให้รีเฟรชทิ้ง

                const symptoms = document.getElementById('mdSymptomsInput').value;
                if (!symptoms.trim()) {
                    alert("⚠️ กรุณากรอกรายละเอียดอาการป่วยในป๊อปอัปด้วยครับ"); 
                    document.getElementById('mdSymptomsInput').focus();
                    return;
                }

                let editedDocuments;

                try {
                    editedDocuments =
                        await collectEditedEvidenceDocuments();
                } catch (error) {
                    alert(
                        `อัปโหลดรูปสำหรับแก้ไขไม่สำเร็จ: ${error.message}`
                    );
                    return;
                }

                // รวบรวมก้อนข้อมูล Payload ทั้งหมดจากช่องฟอร์มป๊อปอัป
                const payload = {
                    sheetRowIndex: currentEditingRowIndex, 
                    CaseIdNew: document.getElementById('mdCaseId').value || '-',
                    autoDateTime: document.getElementById('headerDateTimeValue').innerText, 
                    adminName: sessionStorage.getItem('loggedInAdminName') || 'System Admin', 
                    treatmentDateTime: `${document.getElementById('mdManualDate').value} ${document.getElementById('mdManualTime').value}`.trim() || '-',
                    company: document.getElementById('hiddenCompany').value || 'CALL 365',
                    workLocation: document.getElementById('hiddenWorkLocation').value || '-',
                    hospital: document.getElementById('mdHospitalSelect').value,
                    symptoms: symptoms,
                    insuranceId: document.getElementById('hiddenInsuranceId').value || '-',
                    size: document.getElementById('hiddenSize').value || 'M',
                    employeeName: document.getElementById('hiddenEmpName').value || '-',
                    statusText:
                        document.getElementById('mdEvidenceEditor')
                            ?.dataset.originalStatus || '-',
                    
                    // ดึงยอดสิทธิ์วงเงินจากป๊อปอัป
                    DentalOPD: document.getElementById('mdInpDentalOPD').value || '0',
                    PPUsageOPD: document.getElementById('mdInpPPUsageOPD').value || '0',
                    PPUsageIPD: document.getElementById('mdInpPPUsageIPD').value || '0',
                    SLKUsageOpdThB: document.getElementById('mdInpSLKUsageOpdThB').value || '0',
                    SLKUsageIpdThB: document.getElementById('mdInpSLKUsageIpdThB').value || '0',
                    SLKUsageOpdLkr: document.getElementById('mdInpSLKUsageOpdLkr').value || '0',
                    SLKUsageIpdLkr: document.getElementById('mdInpSLKUsageIpdLkr').value || '0',
                    OverLimitCreditInsThB: document.getElementById('mdInpOverLimitThB').value || '0',
                    OverLimitCreditInsLkr: document.getElementById('mdInpOverLimitLkr').value || '0',
                    ExchangeRatesIns: document.getElementById('mdInpExchangeRatesIns').value || '1',
                    ExchangeRatesInt: document.getElementById('mdInpExchangeRatesInt').value || '1',
                    
                    ClinicianReportedOutcomes: document.getElementById('mdInpClinician').value || '-',
                    DocumentsAttached: editedDocuments,
                    previousDocumentsAttached:
                        document.getElementById('mdInpDocs').value || '-',
                    notes: document.getElementById('mdNotesInput').value || '-'
                };

                // แสดงกล่องตรวจสอบความปลอดภัย Payload ก่อนปล่อยสัญญาณยิง
                if (confirm(`🧪 [ระบบตรวจสอบ Payload ป๊อปอัปก่อนส่งจริง]\n\n• บรรทัดบนแผ่นชีต: แถวที่ ${payload.sheetRowIndex}\n• ยืนยันเคส ID: ${payload.CaseIdNew}\n• สถานพยาบาล: ${payload.hospital}\n\nกดปุ่ม "ตกลง (OK)" เพื่อส่งค่าไปอัปเดตหลังบ้านครับ`)) {
                    try {
                        const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/update-treatment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        const result = await response.json();
                        
//------------------------------------------------------------------------------------------------------//

if (response.ok && result.success) {
            alert('🎉 บันทึกปรับปรุงแก้ไขข้อมูลและส่งแถวลง Google Sheets สำเร็จเรียบร้อย!');

            if (result.driveCleanupWarning) {
                alert(
                    `ข้อมูลแก้ไขสำเร็จ แต่มีคำเตือนเรื่องรูปบน Drive: ${result.driveCleanupWarning}`
                );
            }
            
            const editModal = document.getElementById('editCaseModal');
            if (editModal) { editModal.style.setProperty('display', 'none', 'important'); }

            // 🎯 เจาะเป้าหมายตรงตัว: วิ่งไปหาบรรทัดแถวบนหน้าจอเบราว์เซอร์จริงตามพิกัดตัวแปรกลางที่จำไว้
            const targetRow = document.getElementById('tableBodyResult').parentNode.rows[currentDomRowIndex];
            
            if (targetRow) {
                // ฟังก์ชันช่วยจัดระเบียบสัญกรณ์การเงินและเศษทศนิยม 2 ตำแหน่งให้สวยงามกลมกลืน
                const fmt = (val) => {
                    if (val === undefined || val === null || val === '') return '0.00';
                    let num = parseFloat(String(val).replace(/,/g, '').replace(/\s+/g, '').trim());
                    return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                };

                // 🎯 ทำการฉีดพ่นค่าตัวเลขและคำอธิบายชุดใหม่เข้าไปสับเปลี่ยนในช่องเซลล์ตารางย่อยเดิมทันทีคาตา
                const cells = targetRow.children;

                if (cells.length >= 22) {
                    cells[1].innerText =
                        payload.treatmentDateTime || '-';

                    cells[2].innerText =
                        payload.statusText || '-';

                    cells[3].innerText =
                        payload.symptoms || '-';

                    cells[4].innerText =
                        payload.workLocation || '-';

                    cells[5].innerText =
                        payload.hospital || '-';

                    cells[6].innerText =
                        fmt(payload.DentalOPD);

                    cells[7].innerText =
                        fmt(payload.PPUsageOPD);

                    cells[8].innerText =
                        fmt(payload.PPUsageIPD);

                    cells[9].innerText =
                        fmt(payload.SLKUsageOpdThB);

                    cells[10].innerText =
                        fmt(payload.SLKUsageIpdThB);

                    cells[11].innerText =
                        fmt(payload.SLKUsageOpdLkr);

                    cells[12].innerText =
                        fmt(payload.SLKUsageIpdLkr);

                    cells[13].innerText =
                        fmt(payload.OverLimitCreditInsThB);

                    cells[14].innerText =
                        fmt(payload.OverLimitCreditInsLkr);

                    cells[15].innerText =
                        payload.ExchangeRatesIns || '1';

                    cells[16].innerText =
                        payload.ExchangeRatesInt || '1';

                    cells[17].innerText =
                        payload.ClinicianReportedOutcomes || '-';

                    cells[18].replaceWith(
                        createEvidenceDocumentsCell(
                            payload.DocumentsAttached,
                            payload.statusText
                        )
                    );

                    cells[19].innerText =
                        payload.notes || '-';

                    cells[20].innerText =
                        payload.autoDateTime || displayAutoTime;

                    cells[21].innerText =
                        payload.adminName || '-';

                    for (let index = 6; index <= 14; index++) {
                        cells[index].style.fontWeight = 'bold';
                    }
                }

                const historyIndex =
                    (window.currentIndividualHistory || [])
                        .findIndex(
                            (item) =>
                                Number(item.targetRowNumber) ===
                                Number(payload.sheetRowIndex)
                        );

                if (historyIndex >= 0) {
                    window.currentIndividualHistory[historyIndex] = {
                        ...window.currentIndividualHistory[historyIndex],
                        ...payload,
                        targetRowNumber:
                            Number(payload.sheetRowIndex)
                    };

                    renderHistoryTable(
                        window.currentIndividualHistory
                    );
                }

                   // 🎯 บันทึกครอบค่าล่าสุดฝังคืนลงไปในปุ่มแก้ไขของบรรทัดนั้นด้วย
                const editButton = targetRow.querySelector('.btn-edit-minimal');
                if (editButton) {
                    const safeJsonString = JSON.stringify({ ...payload, targetRowNumber: payload.sheetRowIndex });
                    const safeEncodedBase64 = window.btoa(unescape(encodeURIComponent(safeJsonString)));
                    editButton.setAttribute('onclick', `event.stopPropagation(); const decodedData = JSON.parse(decodeURIComponent(escape(window.atob('${safeEncodedBase64}')))); populateDataToForm(decodedData);`);
                }

                // เปลี่ยนสีแถวเป้าหมายให้เป็นสีไฮไลต์สีเขียวอ่อนกระตุ้นสายตา
                targetRow.style.backgroundColor = '#edf7ed';
                console.log(`🎯 [Direct Row Update Success] สับเปลี่ยนค่าเงินในแถวหน้าจออันดับที่ ${currentDomRowIndex} สำเร็จเสร็จสิ้น!`);
            }
        }

          } catch (error) { 
               console.error("Update Error:", error);
                alert('❌ ขัดข้องทางเทคนิคในการติดต่อเชื่อมต่อ API อัปเดตหลังบ้าน'); 
            }
        }
     });
    }
//#endregion

// const outcomeFormEl = document.getElementById('modalOutcomeForm');
//#region
        // =========================================================================================
        // 🎯 1. ระบบดักจับการกดปุ่มส่งฟอร์มเพื่อบันทึก "อัปเดตผลการรักษา" เป็นบรรทัดใหม่ต่อท้ายล่างสุด
        // =========================================================================================
        const outcomeFormEl = document.getElementById('modalOutcomeForm');
        if (outcomeFormEl) {
            outcomeFormEl.replaceWith(outcomeFormEl.cloneNode(true));
            document.getElementById('modalOutcomeForm').addEventListener('submit', async (e) => {
                e.preventDefault();

                const closeCaseInput =
                    document.getElementById('closeCaseEvidenceFile');

                if (!closeCaseInput?.files?.length) {
                    alert('กรุณาอัปโหลดรูปหลักฐานการปิดเคสก่อนยืนยัน');

                    const closeCaseLabel = document.querySelector(
                        'label[for="closeCaseEvidenceFile"]'
                    );

                    closeCaseLabel?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });

                    closeCaseLabel?.classList.add('upload-required-error');

                    setTimeout(() => {
                        closeCaseLabel?.classList.remove('upload-required-error');
                    }, 2500);

                    return;
                }

                if (!window.hasPermission('UploadFiles')) {
                    alert('บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์');
                    return;
                }

        // 1. ดึงข้อมูลพื้นฐานจากหน้าจอโมดอลสีเขียว
        const caseId = document.getElementById('ocCaseId').value;
        const empNameInput = document.getElementById('hiddenEmpName')?.value || document.getElementById('employeeName')?.value || 'Unknown';
        const cleanEmpName = empNameInput.trim().replace(/\s+/g, '_');

        
        // ====================================================================================
        // 📸 [ระบบดักจับรูปภาพปิดเคส]: แปลงไฟล์ภาพและส่งขึ้น Google Drive ผ่าน API ตัวเดิมฝั่งขวา
        // ====================================================================================
       
                let evidenceUrls = {
                receiptUrl: '',
                medicalCertificateUrl: '',
                closeCaseUrl: ''
            };

            try {
                if (typeof window.uploadAllUpdateEvidence !== 'function') {
                    throw new Error('ไม่พบฟังก์ชันอัปโหลดหลักฐาน');
                }

                evidenceUrls = await window.uploadAllUpdateEvidence();
            } catch (error) {
                console.error('Upload evidence error:', error);
                alert(`❌ อัปโหลดรูปไม่สำเร็จ: ${error.message}`);
                return;
            }

            const driveFileUrl = evidenceUrls.closeCaseUrl || '-';

        const payload = {
            sheetRowIndex: -1, 
            CaseIdNew: document.getElementById('ocCaseId').value, // ดึงเลขเคส เช่น 812
            autoDateTime: document.getElementById('headerDateTimeValue').innerText,
            adminName: sessionStorage.getItem('loggedInAdminName') || 'System Admin',
            treatmentDateTime: `${document.getElementById('ocManualDate').value} ${document.getElementById('ocManualTime').value}`.trim(),
            company: document.getElementById('hiddenCompany').value || 'CALL 365',
            workLocation: document.getElementById('hiddenWorkLocation').value || '-',
            hospital: document.getElementById('ocHospital').value,
            symptoms: document.getElementById('ocSymptoms').value,
            insuranceId: document.getElementById('hiddenInsuranceId').value || '-',
            size: document.getElementById('hiddenSize').value || 'M',
            employeeName: document.getElementById('hiddenEmpName').value || '-',

            // 🎯 แนบตัวแปรชี้ขาด ส่งสัญญาณบอกหลังบ้านว่านี่คือการเพิ่มประวัติเคสเก่า ห้ามเปลี่ยนเลขเคสเด็ดขาด!
            isTimelineUpdate: true, 

            statusText: (() => {
                const selectedStatus = document.getElementById('ocStatusSelect').value;
                if (selectedStatus === 'อื่นๆ') {
                    const extraText = document.getElementById('ocStatusOtherInput').value.trim();
                    return extraText ? `อื่นๆ - ${extraText}` : 'อื่นๆ';
                }
                return selectedStatus;
            })(),
            
            DentalOPD: document.getElementById('ocInpDentalOPD').value || '0',
            PPUsageOPD: document.getElementById('ocInpPPUsageOPD').value || '0',
            PPUsageIPD: document.getElementById('ocInpPPUsageIPD').value || '0',
            
            // ดึงสิทธิ์ค่าเงิน SLK มาฝากส่งให้ครบถ้วนป้องกันการบันทึกสูญหาย
            SLKUsageOpdThB: document.getElementById('ocInpSlkOpdThb')?.value || '0',
            SLKUsageIpdThB: document.getElementById('ocInpSlkIpdThb')?.value || '0',
            SLKUsageOpdLkr: document.getElementById('ocInpSlkOpdLkr')?.value || '0',
            SLKUsageIpdLkr: document.getElementById('ocInpSlkIpdLkr')?.value || '0',
            OverLimitCreditInsThB: document.getElementById('ocInpOverThb')?.value || '0',
            OverLimitCreditInsLkr: document.getElementById('ocInpOverLkr')?.value || '0',
            ExchangeRatesIns: document.getElementById('ocInpRateIns')?.value || '1',
            ExchangeRatesInt: document.getElementById('ocInpRateInt')?.value || '1',
            ClinicianReportedOutcomes: document.getElementById('ocInpClinician').value || '-',
            receiptImageUrl: evidenceUrls.receiptUrl || '',
            medicalCertificateImageUrl:
                evidenceUrls.medicalCertificateUrl || '',
            closeCaseImageUrl: evidenceUrls.closeCaseUrl || '',

        DocumentsAttached: [
            evidenceUrls.receiptUrl
                ? `RECEIPT|${evidenceUrls.receiptUrl}`
                : '',

            evidenceUrls.medicalCertificateUrl
                ? `MEDICAL_CERTIFICATE|${evidenceUrls.medicalCertificateUrl}`
                : '',

            evidenceUrls.closeCaseUrl
                ? `CLOSE_CASE|${evidenceUrls.closeCaseUrl}`
                : ''
        ]
            .filter(Boolean)
            .join('\n') ||
            document.getElementById('ocInpDocs')?.value ||
            '-',
            notes: document.getElementById('ocNotesInput').value || '-'
        };

        if (confirm(`💾 ยืนยันการส่งอัปเดตผลการรักษาและรูปภาพหลักฐานสำหรับ เคส ID: ${payload.CaseIdNew} ใช่หรือไม่?`)) {
            try {
                const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/save-treatment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    alert('🎉 อัปเดตผลการรักษาและแนบไฟล์รูปภาพลง Google Sheets สำเร็จเรียบร้อยตรงล็อก!');
                    
                    const outcomeModal = document.getElementById('outcomeUpdateModal');
                    if (outcomeModal) { outcomeModal.style.display = 'none'; }

                    // ล้างไฟล์ภาพค้างฟอร์มป๊อปอัปสีเขียวเมื่อทำงานสำเร็จ
                    if (document.getElementById('ocImageUpload')) document.getElementById('ocImageUpload').value = '';
                    if (document.getElementById('ocFileNameDisplay')) document.getElementById('ocFileNameDisplay').innerText = 'ยังไม่ได้เลือกไฟล์';

                    payload.updatedRowIndex = result.updatedRowIndex;
                    payload.sheetRowIndex = result.updatedRowIndex;

                    // สั่งกระตุ้นให้ตารางดาวน์โหลดรีโหลดข้อมูลเรียลไทม์ใหม่ทันที
                    if (
                        typeof window.injectNewRowToTableRealtime === 'function'
                    ) {
                        window.injectNewRowToTableRealtime(payload);
                    }

                } else { 
                    alert('❌ เซิร์ฟเวอร์หลังบ้านปฏิเสธคำขอ: ' + result.message); 
                }
            } catch (err) { 
                alert('❌ ขัดข้องทางเทคนิคในการเชื่อมต่อ API อัปเดตหลังบ้าน'); 
            }
        }
    });
}
//#endregion
}
//#endregion




//window.executeDeleteRow = async function (sheetRowIndex, caseId) {
//#region
async function executeDeleteRow(
    sheetRowIndex,
    caseId
) {
    const confirmed = confirm(
        `ยืนยันการลบรายการ Case ID ${caseId} ใช่หรือไม่?`
    );

    if (!confirmed) return false;

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/delete-treatment`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    sheetRowIndex,
                    CaseIdNew: caseId,
                    autoDateTime:
                        new Date().toISOString()
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                'ไม่สามารถลบรายการได้'
            );
        }

        if (result.driveCleanupWarning) {
            alert(
                `ลบข้อมูลสำเร็จ แต่มีคำเตือนเรื่องรูปบน Drive: ${result.driveCleanupWarning}`
            );
        }

        if (
            window.historyDisplayMode ===
            'filtered'
        ) {
            window.currentFilteredHistory =
                (
                    window.currentFilteredHistory ||
                    []
                ).filter(item =>
                    Number(item.targetRowNumber) !==
                    Number(sheetRowIndex)
                ).map((item) => ({
                    ...item,
                    targetRowNumber:
                        Number(item.targetRowNumber) >
                        Number(sheetRowIndex)
                            ? Number(item.targetRowNumber) - 1
                            : Number(item.targetRowNumber)
                }));

            renderFlatHistoryTable(
                window.currentFilteredHistory
            );

            const summary =
                document.getElementById(
                    'historyFilterSummary'
                );

            if (summary) {
                summary.textContent =
                    `พบประวัติทั้งหมด ${window.currentFilteredHistory.length} รายการ`;
            }

            const reportButton =
                document.getElementById(
                    'createHistoryReportButton'
                );

            if (reportButton) {
                reportButton.hidden =
                    window.currentFilteredHistory.length === 0 ||
                    !window.hasPermission(
                        'ExportHistoryReport'
                    );
            }
        } else {
            window.currentIndividualHistory =
                (
                    window.currentIndividualHistory ||
                    []
                ).filter(item =>
                    Number(item.targetRowNumber) !==
                    Number(sheetRowIndex)
                ).map((item) => ({
                    ...item,
                    targetRowNumber:
                        Number(item.targetRowNumber) >
                        Number(sheetRowIndex)
                            ? Number(item.targetRowNumber) - 1
                            : Number(item.targetRowNumber)
                }));

            renderHistoryTable(
                window.currentIndividualHistory
            );
        }

        return true;
    } catch (error) {
        console.error(error);

        alert(
            error.message ||
            'เกิดข้อผิดพลาดในการลบรายการ'
        );

        return false;
    }
}
//#endregion

//ทำให้ช่องวันที่เปิดปฏิทินได้
//function initHistoryFilterDates() {
//#region
function initHistoryFilterDates() {
    const startInput =
        document.getElementById('historyStartDate');

    const endInput =
        document.getElementById('historyEndDate');

    if (!startInput || !endInput) return;

    if (startInput._flatpickr) {
        startInput._flatpickr.destroy();
    }

    if (endInput._flatpickr) {
        endInput._flatpickr.destroy();
    }

    const endPicker = flatpickr(endInput, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m/Y',
        allowInput: false,
        maxDate: 'today'
    });

    const startPicker = flatpickr(startInput, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m/Y',
        allowInput: false,
        maxDate: 'today',

        onChange(selectedDates) {
            const selectedDate =
                selectedDates[0] || null;

            endPicker.set(
                'minDate',
                selectedDate
            );

            if (
                selectedDate &&
                endPicker.selectedDates[0] &&
                endPicker.selectedDates[0] < selectedDate
            ) {
                endPicker.clear();
            }
        }
    });

    endPicker.config.onChange.push(
        function (selectedDates) {
            const selectedDate =
                selectedDates[0] || null;

            startPicker.set(
                'maxDate',
                selectedDate || 'today'
            );
        }
    );
}
//#endregion

//ทำให้ Modal เปิด–ปิด และเลือกเดือนนี้/ปีนี้ได้
//function initAdvancedHistoryFilterEvents() {
//#region
function initAdvancedHistoryFilterEvents() {
    const modal =
        document.getElementById('historyFilterModal');

    const openButton =
        document.getElementById(
            'advancedHistoryFilterButton'
        );

    const closeButton =
        document.getElementById(
            'closeHistoryFilterButton'
        );

    const resetButton =
        document.getElementById(
            'resetHistoryFilterButton'
        );

    const periodPreset =
        document.getElementById(
            'historyPeriodPreset'
        );

    const startInput =
        document.getElementById('historyStartDate');

    const endInput =
        document.getElementById('historyEndDate');

    if (
        !modal ||
        !openButton ||
        !startInput ||
        !endInput
    ) {
        return;
    }

async function openModal() {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    await loadHistoryFilterOptions();
}

    function closeModal() {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    function clearAllFilters() {
        startInput._flatpickr?.clear();
        endInput._flatpickr?.clear();

        document.getElementById(
            'historyPeriodPreset'
        ).value = '';

        document.getElementById(
            'historyAreaFilter'
        ).value = '';

        document.getElementById(
            'historyTreatmentResultFilter'
        ).value = '';

        document.getElementById(
            'historyDocumentFilter'
        ).value = '';

        document.getElementById(
            'historyHospitalFilter'
        ).value = '';
    }

    openButton.addEventListener(
        'click',
        openModal
    );

    closeButton.addEventListener(
        'click',
        closeModal
    );

    resetButton.addEventListener(
        'click',
        clearAllFilters
    );

    modal.addEventListener('click', event => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (
            event.key === 'Escape' &&
            modal.classList.contains('is-open')
        ) {
            closeModal();
        }
    });

    periodPreset.addEventListener('change', () => {
        const preset = periodPreset.value;
        const today = new Date();

        if (preset === 'all' || preset === '') {
            startInput._flatpickr?.clear();
            endInput._flatpickr?.clear();
            return;
        }

        let startDate;

        if (preset === 'thisMonth') {
            startDate = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );
        }

        if (preset === 'thisYear') {
            startDate = new Date(
                today.getFullYear(),
                0,
                1
            );
        }

        if (startDate) {
            startInput._flatpickr?.setDate(
                startDate,
                true
            );

            endInput._flatpickr?.setDate(
                today,
                true
            );
        }
    });

    window.closeHistoryFilterModal =
        closeModal;
}
//#endregion

//เชื่อมปุ่มกรองกับ API หลังบ้าน
//window.currentFilteredHistory = [];
//#region
window.currentFilteredHistory = [];

function updateFilterSelectOptions(
    selectId,
    values,
    allLabel
) {
    const select =
        document.getElementById(selectId);

    if (!select) return;

    const currentValue = select.value;

    select.replaceChildren();

    const allOption =
        document.createElement('option');

    allOption.value = '';
    allOption.textContent = allLabel;
    select.appendChild(allOption);

    for (const value of values || []) {
        const option =
            document.createElement('option');

        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    }

    if (
        [...select.options]
            .some(option =>
                option.value === currentValue
            )
    ) {
        select.value = currentValue;
    }
}

let historyFilterOptionsLoaded = false;

async function loadHistoryFilterOptions() {
    if (historyFilterOptionsLoaded) return;

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/history/all`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    optionsOnly: true
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                'โหลดตัวเลือกไม่สำเร็จ'
            );
        }

        updateFilterSelectOptions(
            'historyTreatmentResultFilter',
            data.options?.treatmentResults || [],
            'ทั้งหมด'
        );

        updateFilterSelectOptions(
            'historyHospitalFilter',
            data.options?.hospitals || [],
            'ทั้งหมด'
        );

        historyFilterOptionsLoaded = true;
    } catch (error) {
        console.error(
            'Load filter options error:',
            error
        );
    }
}


async function loadFilteredAllHistory() {
    const applyButton =
        document.getElementById(
            'applyHistoryFilterButton'
        );

    const reportButton =
        document.getElementById(
            'createHistoryReportButton'
        );

    const summary =
        document.getElementById(
            'historyFilterSummary'
        );

    const filters = {
        startDate:
            document.getElementById(
                'historyStartDate'
            ).value || '',

        endDate:
            document.getElementById(
                'historyEndDate'
            ).value || '',

        area:
            document.getElementById(
                'historyAreaFilter'
            ).value || '',

        treatmentResult:
            document.getElementById(
                'historyTreatmentResultFilter'
            ).value || '',

        documentStatus:
            document.getElementById(
                'historyDocumentFilter'
            ).value || '',

        hospital:
            document.getElementById(
                'historyHospitalFilter'
            ).value || ''
    };

    try {
        applyButton.disabled = true;
        applyButton.textContent =
            'กำลังโหลดข้อมูล...';

        summary.textContent =
            'กำลังค้นหาประวัติตามเงื่อนไข...';

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/history/all`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify(filters)
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                'ไม่สามารถโหลดประวัติได้'
            );
        }

        window.currentFilteredHistory =
            data.history || [];

        updateFilterSelectOptions(
            'historyTreatmentResultFilter',
            data.options?.treatmentResults,
            'ทั้งหมด'
        );

        updateFilterSelectOptions(
            'historyHospitalFilter',
            data.options?.hospitals,
            'ทั้งหมด'
        );

        summary.textContent =
            `พบประวัติทั้งหมด ${data.total} รายการ`;

        reportButton.hidden =
            data.total === 0 ||
            !window.hasPermission(
                'ExportHistoryReport'
            );

        if (
            typeof renderFlatHistoryTable
            === 'function'
        ) {
            renderFlatHistoryTable(
                window.currentFilteredHistory
            );
            window.setSlkColumnsVisibility(
                filters.area !== 'PP'
            );
        }

        window.closeHistoryFilterModal?.();
    } catch (error) {
        console.error(error);

        summary.textContent =
            error.message ||
            'เกิดข้อผิดพลาดในการกรองข้อมูล';

        reportButton.hidden = true;
    } finally {
        applyButton.disabled = false;
        applyButton.textContent =
            'แสดงประวัติตามเงื่อนไข';
    }
}

function initHistoryFilterApplyEvent() {
    const applyButton =
        document.getElementById(
            'applyHistoryFilterButton'
        );

    if (!applyButton) return;

    applyButton.addEventListener(
        'click',
        loadFilteredAllHistory
    );
}
//#endregion


//แสดงประวัติทั้งหมดแบบแถวตรง ไม่พับข้อมูล
//function createHistoryTableCell(value,className = '') {
//#region
function createHistoryTableCell(
    value,
    className = ''
) {
    const cell = document.createElement('td');

    cell.textContent =
        value === undefined ||
        value === null ||
        value === ''
            ? '-'
            : String(value);

    if (className) {
        cell.className = className;
    }

    return cell;
}

function createHistoryActionCell(item) {
    const actionCell =
        document.createElement('td');

    actionCell.className =
        'flat-history-actions';

    if (window.hasPermission('EditTreatment')) {
        const editButton =
            document.createElement('button');

        editButton.type = 'button';
        editButton.textContent = '✏️ แก้ไข';
        editButton.className = 'btn-edit-minimal';

        editButton.addEventListener(
            'click',
            () => populateDataToForm(item)
        );

        actionCell.appendChild(editButton);
    }

    if (window.hasPermission('DeleteTreatment')) {
        const deleteButton =
            document.createElement('button');

        deleteButton.type = 'button';
        deleteButton.textContent = '🗑️ ลบ';
        deleteButton.className =
            'flat-history-delete';

        deleteButton.addEventListener(
            'click',
            async () => {
                await executeDeleteRow(
                    item.targetRowNumber,
                    item.CaseIdNew
                );

            }
        );

        actionCell.appendChild(deleteButton);
    }

    if (!actionCell.children.length) {
        actionCell.textContent = '-';
    }

    return actionCell;
}

//แก้หน้ากรองประวัติก่อน
//#region function getDriveFileId(url) {
function getDriveFileId(url) {
    const text = String(url || '').trim();

    const filePathMatch =
        text.match(/\/file\/d\/([^/?#]+)/i);

    if (filePathMatch) {
        return filePathMatch[1];
    }

    const queryMatch =
        text.match(/[?&]id=([^&#]+)/i);

    return queryMatch
        ? queryMatch[1]
        : '';
}

function getEvidencePreviewUrl(url, size = 'w320') {
    const fileId = getDriveFileId(url);

    if (!fileId) {
        return String(url || '').trim();
    }

    return (
        'https://drive.google.com/thumbnail?id=' +
        encodeURIComponent(fileId) +
        '&sz=' +
        encodeURIComponent(size)
    );
}

// แยกเอกสารแนบออกเป็นหลักฐานเปิดเคส ใบเสร็จ ใบรับรองแพทย์ และหลักฐานปิดเคส
//#region parseEvidenceDocuments
function parseEvidenceDocuments(
    rawValue,
    statusText = '',
    showCompleteCase = false
) {
    const slots = {
        openCase: {
            label: 'รูปหลักฐานการเปิดเคส',
            url: ''
        },
        receipt: {
            label: 'รูปใบเสร็จ',
            url: ''
        },
        medical: {
            label: 'ใบรับรองแพทย์',
            url: ''
        },
        closeCase: {
            label: 'รูปหลักฐานการปิดเคส',
            url: ''
        }
    };

    const rawText =
        String(rawValue || '').trim();

    const isOpeningEvent =
        /แจ้งประกัน|เปิดเคส/i.test(
            String(statusText || '')
        );

    if (!rawText || rawText === '-') {
        if (showCompleteCase) {
            return Object.values(slots);
        }

        return isOpeningEvent
            ? [slots.openCase]
            : [
                slots.receipt,
                slots.medical,
                slots.closeCase
            ];
    }

    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const unlabeledUrls = [];

    for (const line of lines) {
        const labeledMatch = line.match(
            /^(OPEN_CASE|RECEIPT|MEDICAL_CERTIFICATE|CLOSE_CASE)\|(.+)$/i
        );

        if (labeledMatch) {
            const type =
                labeledMatch[1].toUpperCase();

            const url =
                labeledMatch[2].trim();

            if (type === 'OPEN_CASE') {
                slots.openCase.url = url;
            } else if (type === 'RECEIPT') {
                slots.receipt.url = url;
            } else if (
                type === 'MEDICAL_CERTIFICATE'
            ) {
                slots.medical.url = url;
            } else if (
                type === 'CLOSE_CASE'
            ) {
                slots.closeCase.url = url;
            }

            continue;
        }

        const urls =
            line.match(/https?:\/\/[^\s]+/gi) || [];

        unlabeledUrls.push(...urls);
    }

    /*
     * รองรับข้อมูลเก่าที่ยังไม่มีชื่อประเภทกำกับ
     * URL เดี่ยวจากข้อมูลเปิดเคสรุ่นเดิมให้เป็นหลักฐานเปิดเคส
     * ส่วนข้อมูลหลาย URL รุ่นเดิมเรียงเป็น ใบเสร็จ > ใบรับรองแพทย์ > หลักฐานปิดเคส
     */
    const emptySlots = (
        unlabeledUrls.length === 1
            ? [slots.openCase]
            : [
                slots.receipt,
                slots.medical,
                slots.closeCase
            ]
    ).filter((slot) => !slot.url);

    unlabeledUrls.forEach((url, index) => {
        if (emptySlots[index]) {
            emptySlots[index].url = url;
        }
    });

    const hasOpeningEvidence =
        Boolean(slots.openCase.url);

    const hasTreatmentEvidence = [
        slots.receipt,
        slots.medical,
        slots.closeCase
    ].some((slot) => Boolean(slot.url));

    if (showCompleteCase) {
        return Object.values(slots);
    }

    if (
        isOpeningEvent ||
        (hasOpeningEvidence && !hasTreatmentEvidence)
    ) {
        return [slots.openCase];
    }

    return [
        slots.receipt,
        slots.medical,
        slots.closeCase
    ];
}
//#endregion

function combineCaseEvidenceDocuments(timelines) {
    const combined = new Map();

    for (const event of timelines || []) {
        const documents = parseEvidenceDocuments(
            event.DocumentsAttached,
            event.statusText,
            true
        );

        for (const documentItem of documents) {
            if (documentItem.url) {
                combined.set(
                    documentItem.label,
                    documentItem.url
                );
            }
        }
    }

    const labels = [
        ['รูปหลักฐานการเปิดเคส', 'OPEN_CASE'],
        ['รูปใบเสร็จ', 'RECEIPT'],
        ['ใบรับรองแพทย์', 'MEDICAL_CERTIFICATE'],
        ['รูปหลักฐานการปิดเคส', 'CLOSE_CASE']
    ];

    return labels
        .filter(([label]) => combined.has(label))
        .map(
            ([label, type]) =>
                `${type}|${combined.get(label)}`
        )
        .join('\n');
}

function createEvidenceDocumentsCell(
    rawValue,
    statusText = '',
    showCompleteCase = false
) {
    const cell = document.createElement('td');
    cell.className = 'history-evidence-cell';
    cell.dataset.evidenceRaw =
        String(rawValue || '-');

    const container = document.createElement('div');
    container.className = 'history-evidence-grid';

    const parsedDocuments =
        parseEvidenceDocuments(
            rawValue,
            statusText,
            showCompleteCase
        );

    let documents = parsedDocuments;

    if (showCompleteCase) {
        const documentsByLabel = new Map(
            parsedDocuments.map((item) => [
                item.label,
                item
            ])
        );

        documents = [
            'รูปหลักฐานการเปิดเคส',
            'รูปใบเสร็จ',
            'ใบรับรองแพทย์',
            'รูปหลักฐานการปิดเคส'
        ].map(
            (label) =>
                documentsByLabel.get(label) || {
                    label,
                    url: ''
                }
        );
    }

    container.classList.add(
        documents.length === 4
            ? 'complete-case'
            : documents.length === 3
                ? 'treatment-update'
                : 'open-case'
    );

    documents.forEach((documentItem) => {
        const section = document.createElement('div');
        section.className = 'history-evidence-item';

        const title = document.createElement('div');
        title.className = 'history-evidence-title';
        title.textContent = documentItem.label;

        section.appendChild(title);

        if (!documentItem.url) {
            const empty = document.createElement('div');
            empty.className = 'history-evidence-empty';
            empty.textContent = 'ไม่มีรูป';
            section.appendChild(empty);
        } else {
            const previewButton =
                document.createElement('button');

            previewButton.type = 'button';
            previewButton.className =
                'history-evidence-preview';
            previewButton.title =
                `ขยายดู${documentItem.label}`;

            const image = document.createElement('img');
            image.src = getEvidencePreviewUrl(
                documentItem.url,
                'w320'
            );
            image.alt = documentItem.label;
            image.loading = 'lazy';

            image.addEventListener('error', () => {
                image.style.display = 'none';
                previewButton.textContent = 'เปิดดูรูป';
            });

            previewButton.appendChild(image);

            previewButton.addEventListener(
                'click',
                (event) => {
                    event.stopPropagation();

                    const largeImageUrl =
                        getEvidencePreviewUrl(
                            documentItem.url,
                            'w1600'
                        );

                    openImageViewer(
                        largeImageUrl,
                        documentItem.label
                    );
                }
            );

            section.appendChild(previewButton);
        }

        container.appendChild(section);
    });

    cell.appendChild(container);
    return cell;
}
//#endregion


function appendHistoryDataCells(row, item) {
    const values = [
        { value: item.treatmentDateTime },
        { value: item.statusText },
        { value: item.symptoms },
        { value: getDisplayWorkLocation(item) },
        { value: item.hospital },

        { value: item.DentalOPD },
        { value: item.PPUsageOPD },
        { value: item.PPUsageIPD },

        {
            value: item.SLKUsageOpdThB,
            className: 'slk-column'
        },
        {
            value: item.SLKUsageIpdThB,
            className: 'slk-column'
        },
        {
            value: item.SLKUsageOpdLkr,
            className: 'slk-column'
        },
        {
            value: item.SLKUsageIpdLkr,
            className: 'slk-column'
        },
        {
            value: item.OverLimitCreditInsThB,
            className: 'slk-column'
        },
        {
            value: item.OverLimitCreditInsLkr,
            className: 'slk-column'
        },
        {
            value: item.ExchangeRatesIns,
            className: 'slk-column'
        },
        {
            value: item.ExchangeRatesInt,
            className: 'slk-column'
        },

        {
            value: item.ClinicianReportedOutcomes
        },
        {
            value: item.DocumentsAttached,
            type: 'evidence'
        },
        { value: item.notes },
        { value: item.autoDateTime },
        { value: item.adminName }
    ];

        for (const itemValue of values) {
        if (itemValue.type === 'evidence') {
            row.appendChild(
                createEvidenceDocumentsCell(
                    itemValue.value,
                    item.statusText
                )
            );
            continue;
        }

        row.appendChild(
            createHistoryTableCell(
                itemValue.value,
                itemValue.className || ''
            )
        );
    }

    row.appendChild(
        createHistoryActionCell(item)
    );
}

function renderFlatHistoryTable(history) {
    window.historyDisplayMode = 'filtered';
    const tableBody =
        document.getElementById('tableBodyResult');

    if (!tableBody) return;

    tableBody.replaceChildren();

    if (!Array.isArray(history) || !history.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');

        cell.colSpan = 23;
        cell.textContent =
            'ไม่พบประวัติตามเงื่อนไขที่เลือก';

        cell.style.padding = '28px';
        cell.style.textAlign = 'center';

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    const caseGroups = new Map();

    for (const item of history) {
        const caseId =
            String(item.CaseIdNew || '-').trim();

        if (!caseGroups.has(caseId)) {
            caseGroups.set(caseId, []);
        }

        caseGroups.get(caseId).push(item);
    }

    const fragment =
        document.createDocumentFragment();

    for (const [caseId, events] of caseGroups) {
        events.sort(
            (a, b) =>
                Number(a.targetRowNumber) -
                Number(b.targetRowNumber)
        );

        const latestEvent =
            events[events.length - 1];

        const parentRow =
            document.createElement('tr');

        parentRow.className =
            'flat-history-row grouped-parent-row';

        const caseCell =
            document.createElement('td');

        const caseButton =
            document.createElement('button');

        caseButton.type = 'button';
        caseButton.className =
            'history-case-toggle';

        const arrow =
            document.createElement('span');

        arrow.textContent =
            events.length > 1 ? '▶' : '•';

        const caseText =
            document.createElement('strong');

        caseText.textContent = caseId;

        caseButton.append(arrow, caseText);

        const employee =
            document.createElement('div');

        employee.className =
            'history-case-employee';

        employee.textContent =
            latestEvent.employeeName || '-';

        const area =
            document.createElement('span');

        area.className = 'history-area-badge';
        area.textContent =
            latestEvent.area || 'ไม่ระบุพื้นที่';

        caseCell.append(
            caseButton,
            employee,
            area
        );

        parentRow.appendChild(caseCell);

        appendHistoryDataCells(
            parentRow,
            latestEvent
        );

        fragment.appendChild(parentRow);

        const childRows = [];

        for (
            let index = 0;
            index < events.length - 1;
            index++
        ) {
            const eventItem = events[index];

            const childRow =
                document.createElement('tr');

            childRow.className =
                'grouped-child-row';

            childRow.hidden = true;

            const childCaseCell =
                document.createElement('td');

            childCaseCell.textContent =
                `↳ รายการก่อนหน้า ${index + 1}`;

            childCaseCell.className =
                'history-child-label';

            childRow.appendChild(childCaseCell);

            appendHistoryDataCells(
                childRow,
                eventItem
            );

            childRows.push(childRow);
            fragment.appendChild(childRow);
        }

        if (childRows.length) {
            caseButton.addEventListener(
                'click',
                () => {
                    const shouldOpen =
                        childRows[0].hidden;

                    for (const childRow of childRows) {
                        childRow.hidden =
                            !shouldOpen;
                    }

                    arrow.textContent =
                        shouldOpen ? '▼' : '▶';
                }
            );
        } else {
            caseButton.disabled = true;
        }
    }

    tableBody.appendChild(fragment);
}
//#endregion

//เชื่อมปุ่ม “สร้างรายงาน” ให้ดาวน์โหลด Excel
//async function downloadFilteredHistoryReport() {
//#region
async function downloadFilteredHistoryReport() {
    const reportButton =
        document.getElementById(
            'createHistoryReportButton'
        );

    const history =
        window.currentFilteredHistory || [];

    if (!history.length) {
        alert('ยังไม่มีข้อมูลสำหรับสร้างรายงาน');
        return;
    }

    const rowNumbers = history
        .map(item =>
            Number(item.targetRowNumber)
        )
        .filter(number =>
            Number.isInteger(number) &&
            number >= 3
        );

    if (!rowNumbers.length) {
        alert('ไม่พบรายการสำหรับสร้างรายงาน');
        return;
    }

    try {
        reportButton.disabled = true;
        reportButton.textContent =
            '⏳ กำลังสร้างรายงาน...';

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/history/export`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json'
                },
                body: JSON.stringify({
                    rowNumbers
                })
            }
        );

        if (!response.ok) {
            let message =
                'ไม่สามารถสร้างรายงานได้';

            try {
                const errorData =
                    await response.json();

                message =
                    errorData.message || message;
            } catch {
                // ใช้ข้อความเดิม
            }

            throw new Error(message);
        }

        const fileBlob =
            await response.blob();

        const downloadUrl =
            URL.createObjectURL(fileBlob);

        const link =
            document.createElement('a');

        const today =
            new Date()
                .toISOString()
                .slice(0, 10);

        link.href = downloadUrl;
        link.download =
            `history-report-${today}.xlsx`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error(error);

        alert(
            error.message ||
            'เกิดข้อผิดพลาดในการดาวน์โหลดรายงาน'
        );
    } finally {
        reportButton.disabled = false;
        reportButton.textContent =
            '📊 สร้างรายงาน';
    }
}

function initHistoryReportEvent() {
    const reportButton =
        document.getElementById(
            'createHistoryReportButton'
        );

    if (!reportButton) return;

    reportButton.addEventListener(
        'click',
        downloadFilteredHistoryReport
    );
}
//#endregion


//เพิ่มฟังก์ชันแสดงสถานที่ทำงาน
//function getDisplayWorkLocation(item) {
//#region
function getDisplayWorkLocation(item) {
    const workLocation =
        String(item?.workLocation || '').trim();

    if (
        workLocation &&
        workLocation !== '-'
    ) {
        return workLocation;
    }

    const area =
        String(item?.area || '').trim();

    return area || '-';
}
//#endregion

