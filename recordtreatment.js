

const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

// แสดงวันเวลาที่กึ่งกลางแถบบน เฉพาะขณะที่หน้าเปิดเคสกำลังใช้งาน
function syncTreatmentHeaderDateTimePlacement() {
    const container =
        document.getElementById('headerDateTimeContainer') ||
        window.parent.document.getElementById('headerDateTimeContainer');
    const heading = document.querySelector('.treatment-panel-heading');
    const searchTool = document.querySelector('.employee-search-tool');
    const searchRow = searchTool?.querySelector('.search-tool-row');
    const searchButton = document.getElementById('searchBtn');
    const searchFeedback = document.querySelector('.employee-search-feedback');
    const isOpenTreatmentView =
        !window.location.hash ||
        window.location.hash === '#treatment-box-placeholder';

    if (!container || !heading) return;

    if (!container.__treatmentOriginalMarker) {
        container.__treatmentOriginalMarker = document.createComment(
            'headerDateTimeContainer original position'
        );
        container.before(container.__treatmentOriginalMarker);
    }

    if (searchFeedback && !searchFeedback.__treatmentOriginalMarker) {
        searchFeedback.__treatmentOriginalMarker = document.createComment(
            'employeeSearchFeedback original position'
        );
        searchFeedback.before(searchFeedback.__treatmentOriginalMarker);
    }

    if (isOpenTreatmentView && window.parent !== window) {
        const portalTopbarActions =
            window.parent.document.querySelector('.topbar-actions');
        const systemStatus =
            window.parent.document.querySelector('.system-status');

        if (portalTopbarActions && systemStatus) {
            portalTopbarActions.insertBefore(container, systemStatus);
            Object.assign(container.style, {
                position: 'static',
                transform: 'none',
                marginRight: '-6px',
                whiteSpace: 'nowrap'
            });
        }

        if (searchTool && searchRow && searchButton && searchFeedback) {
            searchButton.after(searchFeedback);
            searchTool.style.gridColumn = '2 / -1';
            searchRow.style.gridTemplateColumns =
                'minmax(320px, 440px) auto minmax(0, 1fr)';
            Object.assign(searchFeedback.style, {
                display: 'block',
                alignSelf: 'center',
                minWidth: '0',
                padding: '0 0 0 8px',
                textAlign: 'left'
            });
        }

        return;
    }

    container.__treatmentOriginalMarker.after(container);
    container.style.position = '';
    container.style.transform = '';
    container.style.marginRight = '';
    container.style.whiteSpace = '';

    if (searchFeedback?.__treatmentOriginalMarker) {
        searchFeedback.__treatmentOriginalMarker.after(searchFeedback);
        searchTool.style.gridColumn = '';
        searchRow.style.gridTemplateColumns = '';
        searchFeedback.style.display = '';
        searchFeedback.style.alignSelf = '';
        searchFeedback.style.minWidth = '';
        searchFeedback.style.padding = '';
        searchFeedback.style.textAlign = '';
    }
}

window.addEventListener('hashchange', syncTreatmentHeaderDateTimePlacement);
window.addEventListener('pagehide', () => {
    const container = window.parent.document.getElementById(
        'headerDateTimeContainer'
    );

    if (container?.__treatmentOriginalMarker) {
        container.__treatmentOriginalMarker.after(container);
    }
});
syncTreatmentHeaderDateTimePlacement();

// อัปโหลดไฟล์
// function updateFileName() {
//#region
function updateFileName() {
    const fileInput = document.getElementById('imageUpload');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    
    if (fileInput.files.length > 0) {
        // แสดงชื่อไฟล์ที่เลือก
        fileNameDisplay.innerText = fileInput.files[0].name;
        fileNameDisplay.style.color = "#28a745"; // เปลี่ยนเป็นข้อความสีเขียวเมื่อเลือกสำเร็จ
    } else {
        fileNameDisplay.innerText = "ยังไม่ได้เลือกไฟล์";
        fileNameDisplay.style.color = "#6c757d";
    }
}
//#endregion

// ฟังก์ชันอัปเดตนาฬิกาและวันเวลาปัจจุบัน (headerDateTimeValue)
// function setThaiDateTime() {
//#region
function setThaiDateTime() {
    const now = new Date();
    
    const day = now.getDate();
    const monthShort = now.toLocaleDateString('th-TH', { month: 'short' });
    const thaiYear = now.getFullYear() + 543; 
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const formattedDateTimeStr = `${day} ${monthShort} ${thaiYear} ${hours}:${minutes} น.`;

    // 🎯 หยอดค่าลงช่องอินพุตเดิมสำหรับส่งไปหลังบ้าน
    const autoInput =
        document.getElementById('headerDateTimeValue') ||
        window.parent.document.getElementById('headerDateTimeValue');
    if (autoInput) autoInput.value = formattedDateTimeStr;

    // 🎯 หยอดเฉพาะตัวเลขข้อความวันเวลาลงในกล่องใหม่ฝั่งขวาของหัวข้อ (แยก 2 บรรทัดอัตโนมัติ)
    const headerValueSpan =
        document.getElementById('headerDateTimeValue') ||
        window.parent.document.getElementById('headerDateTimeValue');
    if (headerValueSpan) headerValueSpan.innerText = formattedDateTimeStr;

     setTimeout(setThaiDateTime, 1000); 
}
//#endregion

//const hospitalDistanceMap = {
//#region
            // 1. 🎯 สร้างคลังข้อมูลรายชื่อคลินิกและระยะทางอ้างอิงจับคู่กันไว้
                // ระยะทางอ้างอิงมาจากรายชื่อกลาง hospitals.js (แก้ที่ไฟล์นั้นที่เดียว)
                const hospitalDistanceMap = window.HOSPITAL_DISTANCE || {};

//#endregion

// 2. ฟังก์ชันดักจับการเปลี่ยนค่าโรงพยาบาล เพื่อดึงระยะทางและเปลี่ยนแผนที่ /แทรกอัปโหลดรูปด้วย
//function initHospitalEvents() {
//#region
function initHospitalEvents() {
// const hospitalSelect = document.getElementById('hospitalSelect');

    const hospitalSelect = document.getElementById('hospitalSelect');
    if (hospitalSelect) {
        window.fillHospitalSelect?.(hospitalSelect, { placeholder: '-- กรุณาเลือกสถานพยาบาล --' });
        // ล้าง Event เก่าออกก่อนเพื่อป้องกันการทำงานซ้ำซ้อน
        hospitalSelect.replaceWith(hospitalSelect.cloneNode(true));

        // ผูก Event ตัวใหม่เข้าไป
        document.getElementById('hospitalSelect').addEventListener('change', (e) => {
            const hospitalName = e.target.value;
            const distanceInput = document.getElementById('distanceInput');
            const mapFrame = document.getElementById('hospitalMapFrame');
            
            if (hospitalName && hospitalDistanceMap[hospitalName]) {
                distanceInput.value = hospitalDistanceMap[hospitalName];
                if (mapFrame) {
                    mapFrame.src = `https://google.com{encodeURIComponent(hospitalName)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
                }
            } else {
                distanceInput.value = "-";
            }
        });

    }
}
//#endregion


let isClaimSubmissionInProgress = false;

// ================================================================ บันทึกเคสแบบเบื้องหลัง (Optimistic UI)
// กด "บันทึก" → ตรวจข้อมูลในหน้านี้ → เคลียร์ฟอร์มพร้อมรับเคสถัดไปทันที
// ส่วนที่ช้า (จองเลขเคส · อัปโหลดรูป · บันทึกลงชีต) ทำต่อเบื้องหลังทีละงานตามลำดับ แล้วแจ้งผลด้วย toast
// ล้มเหลว → มีปุ่ม "ลองบันทึกอีกครั้ง" ที่ทำต่อจากขั้นที่ค้าง (ไม่อัปโหลดรูปซ้ำ) ข้อมูลไม่หาย
const claimJobs = { queue: Promise.resolve(), pending: 0, active: '', failed: [] };
const claimToast = (message, type = 'success', duration) => window.showInsuranceToast?.(message, type, duration);

// แสดงสถานะรวม: งานที่กำลังทำ + งานที่ล้มเหลวแต่ละงาน (มีปุ่มลองใหม่ของตัวเอง ไม่ถูกทับด้วยงานอื่น)
function paintClaimStatus() {
    const box = document.getElementById('claimStatus');
    if (!box) return;
    const rows = [];
    if (claimJobs.pending > 0) {
        const line = document.createElement('div');
        line.textContent = `⏳ กำลังบันทึกเคสเบื้องหลัง ${claimJobs.pending} รายการ${claimJobs.active ? ` — ${claimJobs.active}` : ''} (ทำเคสถัดไปต่อได้เลย)`;
        line.style.color = '#b26a00';
        rows.push(line);
    }
    for (const failed of claimJobs.failed) {
        const line = document.createElement('div');
        line.style.color = 'red';
        const text = document.createElement('span');
        text.textContent = `❌ บันทึกเคสของ ${failed.job.employeeName} ไม่สำเร็จ: ${failed.message} `;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = '🔁 ลองบันทึกอีกครั้ง';
        retry.style.cssText = 'margin-left:8px;padding:4px 10px;border:1px solid #dc3545;background:#fff;color:#dc3545;border-radius:6px;cursor:pointer;';
        retry.addEventListener('click', () => {
            claimJobs.failed = claimJobs.failed.filter(item => item !== failed);
            enqueueClaimJob(failed.job);
        });
        line.append(text, retry);
        rows.push(line);
    }
    box.replaceChildren(...rows);
}
// ปิดแท็บ/ออกจากหน้าขณะยังมีงานค้างหรือล้มเหลว → เตือนก่อน (ข้อมูลเคสยังไม่ถูกบันทึก)
window.addEventListener('beforeunload', (event) => {
    if (claimJobs.pending > 0 || claimJobs.failed.length) { event.preventDefault(); event.returnValue = ''; }
});

// ตั้งวันที่/เวลา "ตอนนี้" ให้ฟอร์มเอง — ถ้าผู้ใช้เลือกเอง (แตะ/พิมพ์ช่องนั้น) จะไม่ทับ
function applyTreatmentTimeDefaults(reset = false) {
    const now = new Date();
    for (const id of ['manualDate', 'manualTime']) {
        const input = document.getElementById(id);
        if (!input) continue;
        if (!input.__editWatch) {
            input.__editWatch = true;
            const mark = () => { input.dataset.userEdited = '1'; };
            input.addEventListener('keydown', mark);
            input.addEventListener('pointerdown', mark);
        }
        if (reset) delete input.dataset.userEdited;
        if (input.dataset.userEdited === '1') continue;
        if (input._flatpickr) input._flatpickr.setDate(now, false);
        else if (id === 'manualDate') input.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        else input.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}
window.applyTreatmentTimeDefaults = applyTreatmentTimeDefaults;

function clearTreatmentFormForNextCase() {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('hospitalSelect', '');
    set('distanceInput', '-');
    set('symptomsInput', '');
    set('notesInput', '');
    set('contactInput', '');
    set('imageUpload', '');
    const fileName = document.getElementById('fileNameDisplay');
    if (fileName) { fileName.innerText = 'ยังไม่ได้เลือกไฟล์'; fileName.style.color = '#6c757d'; }
    document.getElementById('openCasePreview')?.replaceChildren();
    window.AdditionalEvidence?.clear(document.getElementById('openCaseAdditional'));
    const uploadLabel = document.querySelector('label[for="imageUpload"]');
    if (uploadLabel) { uploadLabel.style.borderColor = ''; uploadLabel.style.boxShadow = ''; }
    applyTreatmentTimeDefaults(true);
}

async function runClaimJob(job) {
    const state = job.state;
    const API = window.APP_CONFIG.API_BASE_URL;
    claimJobs.active = job.employeeName;
    paintClaimStatus();
    try {
        // 1) จองเลขเคส
        if (!state.caseId) {
            const reserveRes = await window.authFetch(`${API}/api/reserve-case-id`, { method: 'POST', cache: 'no-store', gaSilent: true });
            const reserveResult = await reserveRes.json().catch(() => ({}));
            if (!reserveRes.ok || !reserveResult.success || !reserveResult.caseId) {
                throw new Error(reserveResult.message || 'ไม่สามารถจอง Case ID ได้');
            }
            state.caseId = String(reserveResult.caseId);
        }
        const caseId = state.caseId;
        const numericCaseId = caseId.replace(/[^0-9]/g, '');
        const cleanEmpName = job.employeeName.trim().replace(/\s+/g, '_');

        // 2) รูปหลักฐานเปิดเคส (ย่อรูปก่อนส่ง)
        if (job.openCaseFile && !state.driveFileUrl) {
            const file = await window.compressImageFile(job.openCaseFile);
            const extension = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
            const base64String = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const imgRes = await window.authFetch(`${API}/api/upload-drive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                gaSilent: true,
                body: JSON.stringify({
                    caseId: ' ',
                    fileName: `Opencase ${numericCaseId}_${cleanEmpName}${extension}`,
                    employeeName: job.employeeName,
                    fileData: base64String
                })
            });
            const imgResult = await imgRes.json().catch(() => ({}));
            if (imgResult.needAuth && imgResult.authUrl) {
                window.open(imgResult.authUrl, '_blank', 'noopener,noreferrer');
                (window.SystemHealth || window.parent?.SystemHealth)?.check();
                throw new Error(`${imgResult.message || 'สิทธิ์ Google Drive หมดอายุ'} — เมื่อผู้ดูแลเชื่อมต่อ Google Drive แล้ว กด "ลองบันทึกอีกครั้ง" ได้เลย (ข้อมูลยังอยู่ครบ)`);
            }
            if (!imgRes.ok || !imgResult.success) throw new Error(`อัปโหลดรูปภาพล้มเหลว: ${imgResult.message || imgRes.status}`);
            state.driveFileUrl = imgResult.fileUrl;
        }

        // 3) รูปเพิ่มเติม (Additional)
        if (job.additionalFiles.length && !state.additionalUrls) {
            state.additionalUrls = await window.AdditionalEvidence.upload(job.additionalFiles, {
                caseId: ' ',
                employeeName: job.employeeName,
                silent: true,
                buildName: (n, ext) => `Opencase ${numericCaseId}_${cleanEmpName}_Additional_${n}.${ext}`
            });
        }
        const additionalUrls = state.additionalUrls || [];

        // 4) บันทึกลงชีต
        const payload = {
            sheetRowIndex: typeof currentEditingRowIndex !== 'undefined' ? currentEditingRowIndex : -1,
            CaseIdNew: caseId,
            autoDateTime: job.autoDateTime,
            adminName: job.adminName,
            treatmentDateTime: job.treatmentDateTime,
            company: job.company,
            workLocation: job.workLocation,
            hospital: job.hospital,
            symptoms: job.symptoms,
            insuranceId: job.insuranceId,
            size: job.size,
            employeeName: job.employeeName,
            statusText: 'เปิดเคสและแจ้งประกันแล้ว รอเข้ารับการรักษา',
            DocumentsAttached: [
                state.driveFileUrl ? `OPEN_CASE|${state.driveFileUrl}` : '',
                ...additionalUrls.map(url => `ADDITIONAL|${url}`),
                ...job.intakeLinks.map(url => `ADDITIONAL|${url}`)
            ].filter(Boolean).join('\n') || '-',
            notes: job.notes
        };
        const response = await window.authFetch(`${API}/api/save-treatment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            gaSilent: true,
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.message || 'บันทึกไม่สำเร็จ');

        // สำเร็จ
        const finalCaseId = result.finalCaseId || caseId;
        window.TreatmentIntake?.linkCase(finalCaseId, job.intake);
        claimToast(`✅ บันทึกเคส #${finalCaseId} ของ ${job.employeeName} สำเร็จ`, 'success', 5000);
        payload.CaseIdNew = result.finalCaseId;
        payload.sheetRowIndex = result.updatedRowIndex;
        // เพิ่มแถวในตารางประวัติเฉพาะเมื่อยังเปิดพนักงานคนเดิมอยู่ (กันแถวไปโผล่ในตารางของคนอื่น)
        if (typeof injectNewRowToTableRealtime === 'function'
            && String(document.getElementById('hiddenInsuranceId')?.value || '') === String(job.insuranceId || '')) {
            injectNewRowToTableRealtime(payload);
        }
        void window.refreshContinuitySummary?.();
        void fetchNextCaseId();
        void window.refreshSelectedTreatmentLimits?.(job.insuranceId);
        return true;
    } catch (error) {
        console.error('Claim background save error:', error);
        const reason = error.message || 'เกิดข้อผิดพลาด';
        claimToast(`❌ บันทึกเคสของ ${job.employeeName} ไม่สำเร็จ: ${reason}`, 'error', 12000);
        claimJobs.failed.push({ job, message: reason });
        return false;
    } finally {
        claimJobs.active = '';
    }
}

function enqueueClaimJob(job) {
    claimJobs.pending += 1;
    paintClaimStatus();
    claimJobs.queue = claimJobs.queue
        .then(() => runClaimJob(job))
        .catch(() => false)
        .then(() => {
            claimJobs.pending -= 1;
            paintClaimStatus();
        });
}

// ปุ่มบันทึก: ตรวจข้อมูล → ใส่คิวเบื้องหลัง → เคลียร์ฟอร์มทันที (ไม่รอเครือข่ายเลย)
document.getElementById('claimForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isClaimSubmissionInProgress) {
        return;
    }

    isClaimSubmissionInProgress = true;

    try {
        if (!window.hasPermission('UploadFiles')) {
            alert('บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์');
            return;
        }

        // 🔒 ต้องมีรูปหลักฐานเปิดเคส (เคสที่พนักงานแจ้งเข้ามาเองพร้อมรูป ใช้หลักฐานของพนักงานแทนได้)
        const fileInput = document.getElementById('imageUpload');
        const intake = window.__treatmentIntake || null;
        const intakeLinks = intake?.links || [];
        if ((!fileInput || fileInput.files.length === 0) && !intakeLinks.length) {
            alert("🚨 ปฏิเสธการบันทึก: คุณยังไม่ได้อัปโหลดรูปภาพเพิ่มเติม! \nกรุณาคลิกปุ่ม '📁 เลือกรูปภาพ...' เพื่อแนบหลักฐานเข้าสู่ระบบก่อนครับ");
            const uploadLabel = document.querySelector('label[for="imageUpload"]');
            if (uploadLabel) {
                uploadLabel.style.borderColor = "#dc3545";
                uploadLabel.style.boxShadow = "0 0 0 0.2rem rgba(220, 53, 69, 0.25)";
            }
            return;
        }

        const symptoms = document.getElementById('symptomsInput').value;
        if (!symptoms.trim()) {
            alert("⚠️ กรุณากรอกรายละเอียดอาการป่วยก่อนบันทึกข้อมูลครับ");
            document.getElementById('symptomsInput').focus();
            return;
        }

        const value = id => document.getElementById(id)?.value || '';
        if (!value('hiddenInsuranceId').trim()) {
            alert('⚠️ กรุณาค้นหาและเลือกพนักงานก่อนบันทึกเคสครับ');
            return;
        }
        const employeeName = value('hiddenEmpName') || value('employeeName') || 'Unknown';
        const manualDate = value('manualDate');
        const manualTime = value('manualTime');
        const headerTime = document.getElementById('headerDateTimeValue') || window.parent.document.getElementById('headerDateTimeValue');

        // สำเนาข้อมูลทั้งหมด ณ ตอนกด — เคลียร์ฟอร์ม/เปลี่ยนพนักงานต่อได้โดยไม่กระทบงานที่รออยู่
        const job = {
            employeeName,
            company: value('hiddenCompany'),
            workLocation: value('hiddenWorkLocation'),
            insuranceId: value('hiddenInsuranceId'),
            size: value('hiddenSize'),
            hospital: value('hospitalSelect'),
            symptoms,
            notes: value('notesInput'),
            treatmentDateTime: `${manualDate} ${manualTime}`.trim() || '-',
            autoDateTime: headerTime?.innerText || '',
            adminName: sessionStorage.getItem('loggedInAdminName') || 'System Admin',
            openCaseFile: fileInput?.files?.[0] || null,
            additionalFiles: [...(window.AdditionalEvidence?.files(document.getElementById('openCaseAdditional')) || [])],
            intake,
            intakeLinks: [...intakeLinks],
            state: {}
        };

        enqueueClaimJob(job);
        window.__treatmentIntake = null;   // รายการแจ้งของพนักงานนี้ถูกโอนเข้างานเบื้องหลังแล้ว (job.intake) — กันรูปแนบของ intake เก่าติดไปกับเคสคนถัดไป
        clearTreatmentFormForNextCase();
        claimToast(`📥 รับเคสของ ${employeeName} แล้ว — กำลังบันทึกเบื้องหลัง`, 'success', 2500);
    } catch (error) {
        console.error('Claim submission error:', error);
        const claimStatus = document.getElementById('claimStatus');
        if (claimStatus) {
            claimStatus.innerText = `❌ ${error.message || 'ไม่สามารถบันทึกข้อมูลได้'}`;
            claimStatus.style.color = 'red';
        }
    } finally {
        isClaimSubmissionInProgress = false;
    }

//const INACTIVITY_LIMIT = 5 * 60 * 1000; // ⏳ ตัวอย่างนี้ตั้งไว้ที่ 5 นาที (ปรับตัวเลขได้ตามใจชอบ)
//#region
    // ------------------------------------------------------------------------------------------------------------------------- //
    // ตั้งค่าให้ออกจากระบบเมื่อถึงเวลาที่ต้องการ                                                                             //
    // ------------------------------------------------------------------------------------------------------------------------- //
// 🎯 ตั้งค่าเวลาที่ต้องการให้ระบบรอ (หน่วยเป็นมิลลิวินาที: 1 วินาที = 1000)
const INACTIVITY_LIMIT = 60 * 60 * 1000; // ⏳ ตัวอย่างนี้ตั้งไว้ที่ 5 นาที (ปรับตัวเลขได้ตามใจชอบ)

let timeoutId;

// 🚪 ฟังก์ชันสั่งออกจากระบบอัตโนมัติ
async function logoutUser() {
    alert(
        'ไม่มีการใช้งานระบบเกินเวลาที่กำหนด ระบบจะออกจากระบบเพื่อความปลอดภัย'
    );

    await window.performSecureLogout();
}

// 🔁 ฟังก์ชันรีเซ็ตเวลานับถอยหลังใหม่ทุกครั้งที่มีการขยับ
function resetTimer() {
    clearTimeout(timeoutId); // ล้างเวลานับถอยหลังเดิมทิ้ง
    timeoutId = setTimeout(logoutUser, INACTIVITY_LIMIT); // เริ่มนับถอยหลังใหม่
}

// 👁️ ดักจับพฤติกรรมการขยับทุกรูปแบบบนหน้าเว็บ
function setupInactivityTimer() {
    window.onload = resetTimer;
    window.onmousemove = resetTimer; // ขยับเมาส์
    window.onmousedown = resetTimer; // คลิกเมาส์
    window.ontouchstart = resetTimer;// แตะหน้าจอ (กรณีใช้มือถือ/แท็บเล็ต)
    window.onclick = resetTimer;      // คลิกปุ่มต่างๆ
    window.onkeypress = resetTimer;   // พิมพ์คีย์บอร์ด
    window.addEventListener('scroll', resetTimer, true); // เลื่อนหน้าจอซ้ายขวาบนล่าง
}

// 🚀 เริ่มเปิดใช้งานระบบนับถอยหลังดักจับค่าว่าง
setupInactivityTimer();
//#endregion

});
//#endregion

//async function fetchNextCaseId() {
//#region

    let nextCaseIdRequest = null;
    function fetchNextCaseId() {
        // ยิงครั้งเดียวต่อรอบ (เรียกซ้ำพร้อมกันได้ ไม่ทำให้อ่านชีตซ้ำ) และไม่ขึ้นป๊อปอัปล็อกจอ
        if (!nextCaseIdRequest) nextCaseIdRequest = fetchNextCaseIdOnce().finally(() => { nextCaseIdRequest = null; });
        return nextCaseIdRequest;
    }
    async function fetchNextCaseIdOnce() {
                try {
                    const res = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/next-caseid`, { gaSilent: true });
                    const data = await res.json();

                    if (data.success) {
                        document.getElementById('caseId').value = data.nextId;

                } else {
                    // 🎯 ถ้าหลังบ้านตอบกลับมาว่าไม่สำเร็จให้โชว์ข้อความเตือน
                    document.getElementById('caseId').value = "ข้อผิดพลาดจากเซิร์ฟเวอร์";
                }
                } catch (e) {
                    // 🎯 ถ้าเซิร์ฟเวอร์ล่มหรือติดต่อไม่ได้เลย ให้โชว์ข้อความนี้
                    console.error("ดูสาเหตุบั๊กในความจำเบราว์เซอร์:", e);
                    document.getElementById('caseId').value = "เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว";
            }
}

//#endregion

// function copyClaimDetailsToClipboard() {
//#region
// ========================================================================================================================= //
// 📋 ฟังก์ชันรวบรวมข้อมูลข้ามฟอร์ม ซ้าย-ขวา เพื่อคัดลอกข้อความเตรียมส่งรายงานประกันภัยพนักงาน
// ========================================================================================================================= //
function copyClaimDetailsToClipboard() {
    try {
        // 🔍 1. สกัดข้อมูลจากฝั่งซ้าย (อ้างอิงตามข้อความบนหน้าจอปัจจุบัน)
        const empName = document.getElementById('hiddenEmpName')?.value || document.getElementById('employeeName')?.value || '-';
        const company = document.getElementById('hiddenCompany')?.value || document.getElementById('companySelect')?.value || '-';
        const empSize = document.getElementById('hiddenSize')?.value || '-';
        const insuranceId = document.getElementById('hiddenInsuranceId')?.value || '-';

        // 🔍 2. สกัดข้อมูลอินพุตจากฟอร์มฝั่งขวาปัจจุบัน
        const manualDate = document.getElementById('manualDate')?.value || '';
        const manualTime = document.getElementById('manualTime')?.value || '';
        const treatmentTimeStr = `${manualDate} ${manualTime}`.trim() || '-';
        
        const hospital = document.getElementById('hospitalSelect')?.value || '-';
        const symptoms = document.getElementById('symptomsInput')?.value || '-';
        const notes = document.getElementById('notesInput')?.value || '-';
        const contact = document.getElementById('contactInput')?.value.trim() || '';

        // 🎯 3. ประกอบร่างข้อความเรียงแถวตามโครงสร้างระเบียบโจทย์
        const templateText = 
`ระบุเวลาที่เข้ารับการรักษา : ${treatmentTimeStr}
บริษัท : ${company}
ชื่อ : ${empName}
SIZE : ${empSize}
InsuranceId : ${insuranceId}
อาการป่วย : ${symptoms}
คลินิกหรือสถานพยาบาล : ${hospital}
เบอร์โทรติดต่อพนักงานหรือ ID Line : ${contact}
หมายเหตุ : ${notes}`;

        // 🚀 4. สั่งสั่งงานยัดก้อนข้อความเข้าสู่หน่วยความจำเบราว์เซอร์จริง (Clipboard API)
        navigator.clipboard.writeText(templateText).then(() => {
            // แจ้งเตือนแอดมินให้รับสิทธิ์ทราบ และเปลี่ยนสีกระตุ้นสายตาชั่วคราวบอกความสำเร็จ
            const copyBtn = document.getElementById('btnCopyToClaim');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.style.backgroundColor = "#198754";
                copyBtn.innerText = "✅ คัดลอกข้อความสำเร็จ!";
                
                setTimeout(() => {
                    copyBtn.style.backgroundColor = "#0d6efd";
                    copyBtn.innerHTML = originalText;
                }, 2000);
            }
        }).catch(err => {
            alert("❌ ตัวเบราว์เซอร์ปฏิเสธสิทธิ์การเข้าถึงคลิปบอร์ด กรุณาลองกรอกเองครับ");
        });

    } catch (error) {
        console.error("Copy text error:", error);
        alert("❌ เกิดข้อผิดพลาดทางเทคนิคในการประมวลผลคำนวณข้อความข้ามโมดูล");
    }
}
//#endregion




