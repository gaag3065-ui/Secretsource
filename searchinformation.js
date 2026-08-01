
// function initSearchBoxEvents() {
//#region
function initSearchBoxEvents() {
    // 👁️ ใช้เมาส์คลิกปุ่มค้นหา
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.onclick = function() {
            console.log("🔍 [System Trigger] ปุ่มค้นหากล่องฝั่งซ้ายตื่นขึ้นมาทำงานแล้ว!");
            performSearch();
        };
    }

    // 👁️ กดปุ่ม Enter บนคีย์บอร์ดในช่องกรอก
    const keywordInput = document.getElementById('keywordInput');
    if (keywordInput) {
        keywordInput.onkeypress = function(e) {
            if (e.key === 'Enter') {
                console.log("⌨️ [System Trigger] ตรวจพบการกดปุ่ม Enter ในช่องกรอก!");
                performSearch();
            }
        };
    }
    console.log("🔒 บันทึกสิทธิ์สำเร็จ: ปุ่มค้นหากล่องฝั่งซ้ายพร้อมสั่งการแล้วครับ");
}
//#endregion

// async function performSearch() {
//#region
    async function performSearch() {
        const keyword = document.getElementById('keywordInput').value;
        const messageDiv = document.getElementById('message');
        const resultsList = document.getElementById('resultsList');
        const tableBody = document.getElementById('tableBodyResult');
        
        resultsList.innerHTML = '';
        if (tableBody) tableBody.innerHTML = '';

        if (!keyword.trim()) { 
            messageDiv.innerText = 'กรุณากรอกคำที่ต้องการค้นหา'; 
            messageDiv.style.color = 'red'; 
            return; 
        }
        
        messageDiv.innerText = 'กำลังค้นหาข้อมูล...'; 
        messageDiv.style.color = 'black';

        try {
            const response = await fetch(`${API_BASE_URL}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword })
            });

            const data = await response.json();

            // 🎯 ปรับตรรกะเช็ควัตถุก้อนพนักงานตามแบบแผนใหม่
            if (response.ok && data.success && data.employee) {
                messageDiv.innerText = `พบข้อมูลพนักงานเรียบร้อยแล้ว`; 
                messageDiv.style.color = 'green';

                

                // ตัวแปรที่วิ่งไปปลดล็อกให้ช่องเป็นสีขาว
                 const inputsToEnable = [
                'manualDate', 'manualTime', 'hospitalSelect', 'symptomsInput', 'notesInput', 'submitBtn',
                'inpDentalOPD', 'inpPPUsageOPD', 'inpPPUsageIPD', 'inpSLKUsageOpdThB', 'inpSLKUsageIpdThB', 
                'inpSLKUsageOpdLkr', 'inpSLKUsageIpdLkr', 'inpOverLimitThB', 'inpOverLimitLkr', 
                'inpExchangeRatesIns', 'inpExchangeRatesInt', 'inpClinician', 'inpDocs'
               ];
                inputsToEnable.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.disabled = false;
                        if (id === 'submitBtn') el.style.backgroundColor = '#198754';
                        else el.style.backgroundColor = '#ffffff';
                        el.style.cursor = 'pointer';
                    }
                });

                // หยอดค่าพนักงานเข้า Hidden Inputs ฝากไปใช้งานต่อตอนกดบันทึก ไปยังฝั่ง recordtreatment
                const emp = data.employee;
                document.getElementById('hiddenEmpName').value = emp.colG || '-';
                document.getElementById('hiddenCompany').value = emp.colB || '-';
                document.getElementById('hiddenSize').value = emp.colD || '-';
                document.getElementById('hiddenWorkLocation').value = emp.colJ || '-';
                document.getElementById('hiddenInsuranceId').value = emp.colC || '-'; 

                // =======================================================================
                // 🔐 [ระบบควบคุมซ่อน-แสดง คอลัมน์ประกัน SLK อัตโนมัติตามสถานที่ทำงาน]
                // =======================================================================
                const workLocation = (data && data.employee) ? (data.employee.colJ || '') : '';
                const slkElements = document.querySelectorAll('.slk-column');

                // ตรวจสอบว่าในสถานที่ทำงานมีคำว่า "SL" หรือไม่ (แปลงเป็นตัวพิมพ์ใหญ่เพื่อความแม่นยำ)
                if (workLocation.toUpperCase().includes('SL')) {
                    // 🟢 กรณีเจอคำว่า SL -> ให้แสดงกลุ่มคอลัมน์ SLK ตามปกติ
                    slkElements.forEach(el => {
                        el.style.display = ''; 
                    });
                } else {
                    // 🔴 กรณีเป็นพนักงาน PP หรืออื่นๆ ที่ไม่มีคำว่า SL -> สั่งซ่อนคอลัมน์ SLK ทิ้งทันที!
                    slkElements.forEach(el => {
                        el.style.display = 'none';
                    });
                }

                // สร้างการ์ดข้อมูลพนักงานฝั่งซ้ายมือ
                const card = document.createElement('div');
                card.className = 'result-item';
                card.innerHTML = `
                    <p style="color: #28a745; font-weight: bold; font-size: 15px; margin: 0 0 10px 0;"> ผลลัพธ์:เจอ (แถวที่ ${emp.foundRow})</p>
                    <div class="info-row"><span class="label-text">ชื่อ :</span><span class="value-text">${emp.colG}</span></div>
                    <div class="info-row"><span class="label-text">บริษัท :</span><span class="value-text">${emp.colB}</span></div>
                    <div class="info-row"><span class="label-text">รหัสพนักงาน :</span><span class="value-text">${emp.colE}</span></div>
                    <div class="info-row"><span class="label-text">SIZE :</span><span class="value-text">${emp.colD}</span></div>
                    <div class="info-row"><span class="label-text">InsuranceId :</span><span class="value-text">${emp.colC}</span></div>                                    
                    <div class="info-row"><span class="label-text">สถานที่ทำงาน :</span><span class="value-text">${emp.colK}</span></div>
                    <div class="info-row"><span class="label-text">วงเงิน OPD :</span><span class="value-text">${emp.colAV || '-'}</span></div>
                    <div class="info-row"><span class="label-text">วงเงิน IPD :</span><span class="value-text">${emp.colAW || '-'}</span></div>
                    <div class="info-row"><span class="label-text">วงเงิน OPD คงเหลือ :</span><span class="value-text">${emp.colBB || '-'}</span></div>
                    <div class="info-row"><span class="label-text">วงเงิน IPD คงเหลือ :</span><span class="value-text">${emp.colBA || '-'}</span></div>
                `;
                resultsList.appendChild(card);

                renderHistoryTable(data.history);
       

            } else {
                messageDiv.innerText = data.message || 'ไม่พบข้อมูลในระบบ'; 
                messageDiv.style.color = 'red';
            }
        } catch (error) { 
            console.error(error);
            messageDiv.innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'; 
            messageDiv.style.color = 'red'; 
        }
    }
//#endregion
