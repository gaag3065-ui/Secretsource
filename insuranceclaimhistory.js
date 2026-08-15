// 🎯 วางกลุ่มนี้ไว้บนสุดของไฟล์ insuranceclaimhistory.js
let currentEditingRowIndex = -1; 
let currentDomRowIndex = -1;
let currentActiveCaseId = "";

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
const INACTIVITY_LIMIT = 5 * 60 * 1000; 
let timeoutId;

// 🔒 สเต็ปที่ 1: ตรวจเช็คทันทีทุกครั้งที่หน้าเว็บเปิดขึ้นมา (Strict Guard)
function enforceSecurityRouting() {
    const loggedInUser = sessionStorage.getItem('loggedInAdminName');

    if (!loggedInUser || loggedInUser.trim() === '') {
        sessionStorage.clear();
        window.location.replace('index.html'); // ใช้ .replace ป้องกันการกดปุ่ม Back กลับมาหน้าเดิม
        return true;
    }
    return false;
}

// 🚪 ฟังก์ชันสั่งออกจากระบบถาวร
function logoutUser() {
    sessionStorage.clear(); // ล้างความจำระบบทั้งหมดออกเกลี้ยงเครื่อง
    alert("🔒 คุณไม่มีการเคลื่อนไหวนานเกินไป ระบบได้ทำการออกจากระบบเพื่อความปลอดภัยเรียบร้อยแล้วครับ");
    window.location.replace('index.html');
}

// 🔁 รีเซ็ตเวลานับถอยหลังใหม่เมื่อขยับเมาส์
function resetTimer() {
    if (enforceSecurityRouting()) return; // หากระบบตรวจสอบพบว่าหลุดเซสชันแล้ว ให้ดีดออกทันที
    
    clearTimeout(timeoutId);
    timeoutId = setTimeout(logoutUser, INACTIVITY_LIMIT);
}


// 👁️ ดักจับพฤติกรรมการเคลื่อนไหวทั่วหน้าจอ
function setupInactivityTimer() {
    // รันตรวจเช็คสิทธิ์หน้าจอชั้นแรกสุดก่อนเปิดระบบดักจับ
    if (enforceSecurityRouting()) return;

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
function manualLogout() {
    if (confirm("🚪 คุณต้องการออกจากระบบบริหารจัดการพนักงานใช่หรือไม่?")) {
        sessionStorage.clear();
        window.location.replace('index.html');
    }
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
                    statusText: "แก้ไขและปรับปรุงข้อมูลเคสการรักษา", 
                    
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
                    DocumentsAttached: document.getElementById('mdInpDocs').value || '-',
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

                    cells[18].innerText =
                        payload.DocumentsAttached || '-';

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

                if (!window.hasPermission('UploadFiles')) {
                    alert('บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์');
                    return;
                }

                const fileInput = 
                document.getElementById('ocImageUpload');
                if (!fileInput || fileInput.files.length === 0) {
            alert("🚨 ปฏิเสธการอัปเดต: คุณยังไม่ได้อัปโหลดรูปภาพปิดเคส! \nกรุณาคลิกปุ่ม '📁 เลือกรูปภาพปิดเคส...' เพื่อแนบหลักฐานการรักษาก่อนส่งข้อมูลลงฐานข้อมูลครับ");
            
            const ocUploadLabel = document.querySelector('label[for="ocImageUpload"]');
            if (ocUploadLabel) {
                ocUploadLabel.style.borderColor = "#dc3545";
                ocUploadLabel.style.boxShadow = "0 0 0 0.2rem rgba(220, 53, 69, 0.25)";
            }
            return; // ⛔ ตัดสัญญาณหยุดทำงานทันที รูปไม่ขึ้นไดร์ฟ และข้อมูลไม่ลง Sheets 100%
        }


                
        // 1. ดึงข้อมูลพื้นฐานจากหน้าจอโมดอลสีเขียว
        const caseId = document.getElementById('ocCaseId').value;
        const empNameInput = document.getElementById('hiddenEmpName')?.value || document.getElementById('employeeName')?.value || 'Unknown';
        const cleanEmpName = empNameInput.trim().replace(/\s+/g, '_');

        
        // ====================================================================================
        // 📸 [ระบบดักจับรูปภาพปิดเคส]: แปลงไฟล์ภาพและส่งขึ้น Google Drive ผ่าน API ตัวเดิมฝั่งขวา
        // ====================================================================================
       
        let driveFileUrl = "-"; 

        if (fileInput && fileInput.files.length > 0) {
       try {
        console.log("📸 กำลังแปลงและอัปโหลดรูปภาพปิดเคสไปยัง Google Drive...");
        
        const getBase64 = (file) => new Promise((res, rej) => {
            const r = new FileReader(); 
            r.readAsDataURL(file);
            r.onload = () => res(r.result); 
            r.onerror = err => rej(err);
        });

        const file = fileInput.files[0]; // ดึงไฟล์ลำดับที่ 0 ให้ถูกต้องแม่นยำตามหลักสากล
        const base64String = await getBase64(file);
        const originalExtension = file.name.substring(file.name.lastIndexOf('.'));
        
        // 🎯 [จุดแก้ไขวิกฤต] ดึงจากตัวแปรกลางเครื่องชี้วัดโดยตรง หากไม่มีให้สกัดจากช่องหน้าจอสำรอง
        const finalCaseStr = currentActiveCaseId || document.getElementById('ocCaseId').value || '0';
        
        // 🎯 สกัดเอาเฉพาะตัวเลขรหัสเคสออกมาเพียวๆ (ตัดคำว่า Case หรือขยะออกทั้งหมด)
        const justNumberId = caseId.replace(/[^0-9]/g, ''); 
        const customFileName = `Closecase_${justNumberId}_${cleanEmpName}${originalExtension}`; 

        const imgRes = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/upload-drive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caseId: "caseId", 
                fileName: customFileName, 
                employeeName: empNameInput,
                fileData: base64String 
            })
        });

                const imgResult = await imgRes.json();
                if (imgResult.needAuth && imgResult.authUrl) {
                window.open(imgResult.authUrl, '_blank', 'noopener,noreferrer');
                alert('กรุณายืนยันสิทธิ์ Google Drive ในแท็บใหม่ แล้วกลับมาอัปโหลดอีกครั้ง');
                return;
            }


                if (imgResult.success) {
                    driveFileUrl = imgResult.fileUrl;
                    console.log("📸 อัปโหลดรูปภาพปิดเคสสำเร็จ ลิงก์ไฟล์คือ:", driveFileUrl);
                } else {
                    alert(`❌ อัปโหลดรูปภาพปิดเคสล้มเหลว: ${imgResult.message}`);
                    return;
                }
            } catch (err) {
                console.error("Upload to drive error (Outcome):", err);
                alert("❌ ระบบขัดข้อง ไม่สามารถติดต่ออัปโหลดรูปภาพปิดเคสไปยัง Google Drive ได้");
                return;
            }
        }

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
            DocumentsAttached: driveFileUrl !== "-" ? driveFileUrl : (document.getElementById('ocInpDocs').value || '-'),
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
                    if (typeof performSearch === "function") {
                        performSearch();
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
                );

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
                );

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
            value: item.DocumentsAttached
        },
        { value: item.notes },
        { value: item.autoDateTime },
        { value: item.adminName }
    ];

    for (const itemValue of values) {
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

