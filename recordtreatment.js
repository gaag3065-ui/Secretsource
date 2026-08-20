

const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

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
    const autoInput = document.getElementById('headerDateTimeValue');
    if (autoInput) autoInput.value = formattedDateTimeStr;

    // 🎯 หยอดเฉพาะตัวเลขข้อความวันเวลาลงในกล่องใหม่ฝั่งขวาของหัวข้อ (แยก 2 บรรทัดอัตโนมัติ)
    const headerValueSpan = document.getElementById('headerDateTimeValue');
    if (headerValueSpan) headerValueSpan.innerText = formattedDateTimeStr;

     setTimeout(setThaiDateTime, 1000); 
}
//#endregion

//const hospitalDistanceMap = {
//#region
            // 1. 🎯 สร้างคลังข้อมูลรายชื่อคลินิกและระยะทางอ้างอิงจับคู่กันไว้
                const hospitalDistanceMap = {
                    "รอยัล อังกอร์": "1.7 กม.",               
                    "จัสมิน คลินิก": "1.4 กม.",
                    "เทวิน ข้างฮุยเกียร์": "1 กม.",
                    "คลินิกโซน 3": "4.2 กม.",
                    "คลินิก สุวิสา": "1  กม.",
                    "คลินิกไทยช่าง (ท้ายคลัง)": "3.2 กม.",
                    "คลินิกวงเทพ": "2.5 กม.",
                    "คลินิกโอเคทินนา": "2.6 กม.",
                    "คลินิกอิลิแก้นต์": "2.3 กม.",
                    "คลินิกกาแล็คซี่": "2.7 กม.",
                    "Durdans hospital": "300 ม.",
                    "Clinic Dr. Menghong": "1.5 กม.",
                    "Akea Thmey Clinic": "3.3 กม.",
                    "Dermall Dental Clinic": "1.4 กม.",
                    "king hospital": "4.9 กม.",
                    "Nawaloka Hospital": "2.9 กม.",
                    "TPR DENTAL CARE": "1.7 กม.",
                    "คลินิกทำฟันอื่นๆ PP": "2.0 กม.",
                    "อื่นๆ กรุงเทพและปริมณฑล": "ภาคกลาง",
                    "อื่นๆ ต่างจังหวัด": "ตามภูมิลำเนา"
                };

//#endregion

// 2. ฟังก์ชันดักจับการเปลี่ยนค่าโรงพยาบาล เพื่อดึงระยะทางและเปลี่ยนแผนที่ /แทรกอัปโหลดรูปด้วย
//function initHospitalEvents() {
//#region
function initHospitalEvents() {
// const hospitalSelect = document.getElementById('hospitalSelect');

    const hospitalSelect = document.getElementById('hospitalSelect');
    if (hospitalSelect) {
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

//ฟังก์ชันดักจับปุ่มบันทึกข้อมูลและส่งฟอร์ม (claimForm Submit Listener)
//document.getElementById('claimForm').addEventListener('submit', async (e) => {
//#region
   document.getElementById('claimForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!window.hasPermission('UploadFiles')) {
            alert('บัญชีนี้ไม่มีสิทธิ์อัปโหลดไฟล์');
            return;
        }
        
         // 🔒 [ตัวล็อกกรณีที่ 1]: ตรวจเช็คการแนบรูปภาพก่อนเปิดเคสใหม่เข้าสู่ระบบ
        const fileInput = document.getElementById('imageUpload');
        if (!fileInput || fileInput.files.length === 0) {
        alert("🚨 ปฏิเสธการบันทึก: คุณยังไม่ได้อัปโหลดรูปภาพเพิ่มเติม! \nกรุณาคลิกปุ่ม '📁 เลือกรูปภาพ...' เพื่อแนบหลักฐานเข้าสู่ระบบก่อนครับ");
        
        // ขยับสายตาพาแอดมินไปโฟกัสที่ปุ่มอัปโหลดทันที
        const uploadLabel = document.querySelector('label[for="imageUpload"]');
        if (uploadLabel) {
            uploadLabel.style.borderColor = "#dc3545";
            uploadLabel.style.boxShadow = "0 0 0 0.2rem rgba(220, 53, 69, 0.25)";
        }
        return; // ⛔ ตัดสัญญาณหยุดทำงานทันที ข้อมูลไม่วิ่งไปหลังบ้านแน่นอน
    }



        const symptoms = document.getElementById('symptomsInput').value;
        const claimStatus = document.getElementById('claimStatus');

        if (!symptoms.trim()) {
            alert("⚠️ กรุณากรอกรายละเอียดอาการป่วยก่อนบันทึกข้อมูลครับ");
            document.getElementById('symptomsInput').focus();
            return;
        }


//-- ============================================================ อัปโหลดรูป ============================================================== -//
    claimStatus.innerText = 'กำลังตรวจสอบและอัปโหลดรูปภาพ...';
    claimStatus.style.color = 'orange';

    // ========================================================
    // 📸 [จุดเพิ่มใหม่ที่ 1]: โดดไปรันสคริปต์ส่งรูปภาพเข้า Google Drive ก่อน
    // ========================================================
                
// ========================================================
// 🎫 จอง Case ID จริงจาก Backend ก่อนอัปโหลดรูป
// ========================================================
claimStatus.innerText = 'กำลังจองเลขเคส...';
claimStatus.style.color = 'orange';

const reserveRes = await window.authFetch(
    `${window.APP_CONFIG.API_BASE_URL}/api/reserve-case-id`
);

const reserveResult = await reserveRes.json();

if (!reserveRes.ok || !reserveResult.success || !reserveResult.caseId) {
    throw new Error(
        reserveResult.message || 'ไม่สามารถจอง Case ID ได้'
    );
}

const caseId = String(reserveResult.caseId);

// แสดงเลขที่จองจริงบนหน้าจอทันที
const caseIdInput = document.getElementById('caseId');

if (caseIdInput) {
    caseIdInput.value = caseId;
}

console.log(`🎫 Frontend จอง Case ID สำเร็จ: ${caseId}`);
    
                const empNameInput = document.getElementById('hiddenEmpName')?.value || document.getElementById('employeeName')?.value || 'Unknown';

                // 🎯 1. ทำความสะอาดชื่อพนักงาน ลบช่องว่างเป็นขีดล่างตามปกติ
                const cleanEmpName = empNameInput.trim().replace(/\s+/g, '_'); 

            if (fileInput && fileInput.files.length > 0) {
            try {
                const getBase64 = (file) => new Promise((res, rej) => {
                    const r = new FileReader(); 
                    r.readAsDataURL(file);
                    r.onload = () => res(r.result); 
                    r.onerror = e => rej(e);
                });

                const file = fileInput.files[0]; // ดึงไฟล์ลำดับที่ 0 ให้ถูกต้องตามหลักสากล
                const base64String = await getBase64(file);

                const originalExtension = file.name.substring(file.name.lastIndexOf('.'));
                
                const justNumberId = caseId.replace(/[^0-9]/g, ''); 
                
                // 🎯 2. [จุดแก้ไขหลัก] ส่งแค่ชื่อพนักงานกับนามสกุลไฟล์ ไม่ต้องใส่ ${caseId}_ นำหน้าแล้วครับ
                const customFileName = `Opencase ${justNumberId}_${cleanEmpName}${originalExtension}`;

                const imgRes = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/upload-drive`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        caseId: " ",
                        fileName: customFileName, // 👈 หลังบ้านจะเอาค่านี้ไปประกบกับ Case ID ของมันเองอัตโนมัติ
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
                    console.log("📸 อัปโหลดรูปสำเร็จ ลิงก์ไฟล์คือ:", driveFileUrl);
                } else {
                    alert(`❌ อัปโหลดรูปภาพล้มเหลว: ${imgResult.message}`);
                    claimStatus.innerText = '❌ อัปโหลดรูปภาพล้มเหลว บันทึกระบบหยุดทำงาน';
                    claimStatus.style.color = 'red';
                    return;
                }
                // ========================================================

            } catch (err) {
                console.error("Upload to drive error:", err);
                alert("❌ ระบบขัดข้อง ไม่สามารถติดต่ออัปโหลดรูปภาพไปยัง Google Drive ได้");
                claimStatus.innerText = '❌ เชื่อมต่อ Google Drive ล้มเหลว';
                claimStatus.style.color = 'red';
                return;
            }
        }
//-- ============================================================ อัปโหลดรูป ============================================================== -//



        claimStatus.innerText = 'กำลังบันทึกข้อมูลลงฐานข้อมูล...';
        claimStatus.style.color = 'blue';

        const manualDate = document.getElementById('manualDate').value;
        const manualTime = document.getElementById('manualTime').value;
        const treatmentDateTime = `${manualDate} ${manualTime}`.trim() || '-';

        const payload = {
            sheetRowIndex: currentEditingRowIndex, 
            CaseIdNew: caseId,
            autoDateTime: document.getElementById('headerDateTimeValue').innerText, 
            adminName: sessionStorage.getItem('loggedInAdminName') || 'System Admin',
            treatmentDateTime: treatmentDateTime,
            company: document.getElementById('hiddenCompany').value,
            workLocation: document.getElementById('hiddenWorkLocation').value,
            hospital: document.getElementById('hospitalSelect').value,
            symptoms: symptoms,
            insuranceId: document.getElementById('hiddenInsuranceId').value,
            size: document.getElementById('hiddenSize').value,
            employeeName: document.getElementById('hiddenEmpName').value,
            statusText: "แจ้งประกัน กำลังเข้ารับการรักษา",
            notes: document.getElementById('notesInput').value
        };

        try {
            const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/save-treatment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            if (response.ok && result.success) {
                claimStatus.innerText = `✅ ${result.message}`;
                claimStatus.style.color = 'green';

                alert(result.message);

                payload.CaseIdNew = result.finalCaseId;
                payload.sheetRowIndex = result.updatedRowIndex;

                if (document.getElementById('hospitalSelect')) document.getElementById('hospitalSelect').value = ''; 
                if (document.getElementById('distanceInput')) document.getElementById('distanceInput').value = '-'; 
                if (document.getElementById('symptomsInput')) document.getElementById('symptomsInput').value = ''; 
                if (document.getElementById('notesInput')) document.getElementById('notesInput').value = ''; 

                if (document.getElementById('imageUpload')) document.getElementById('imageUpload').value = '';
                if (document.getElementById('fileNameDisplay')) document.getElementById('fileNameDisplay').innerText = 'ยังไม่ได้เลือกไฟล์';

                // 🎯 [แก้ไขจุดบั๊กที่ 1]: สั่งรันฟังก์ชันกลางในการฟอร์แมตวันเวลาไทย เพื่อคงรูปเล่ม วัน เดือน ปี ไว้ให้เหมือนเดิม ไม่หดสั้นเหลือแค่เวลา
                setThaiDateTime();

                if (typeof injectNewRowToTableRealtime === "function") {
                    injectNewRowToTableRealtime(payload);
                }

                if (typeof fetchNextCaseId === "function") {
                    fetchNextCaseId();
                }

            } else {
                claimStatus.innerText = `❌ ${result.message || 'บันทึกไม่สำเร็จ'}`;
                claimStatus.style.color = 'red';
            }
        } catch (error) {
            console.error(error);
            claimStatus.innerText = '❌ เกิดข้อผิดพลาดร้ายแรงในการเชื่อมต่อเซิร์ฟเวอร์';
            claimStatus.style.color = 'red';
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

    async function fetchNextCaseId() {
                try {
                    const res = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/next-caseid`);
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

                fetchNextCaseId(); 
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

        // 🎯 3. ประกอบร่างข้อความเรียงแถวตามโครงสร้างระเบียบโจทย์
        const templateText = 
`ระบุเวลาที่เข้ารับการรักษา : ${treatmentTimeStr}
บริษัท : ${company}
ชื่อ : ${empName}
SIZE : ${empSize}
InsuranceId : ${insuranceId}
อาการป่วย : ${symptoms}
คลินิกหรือสถานพยาบาล : ${hospital}
เบอร์โทรติดต่อพนักงาน : 
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

if (typeof fetchNextCaseId === 'function') {
    fetchNextCaseId();
}



