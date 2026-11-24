// accommodation.js ส่วนที่ 8/10 (บรรทัดเดิม 1767–2053) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
function openRoomCancellationForm(room) {
    if (!room) return;
    openManagementModal(`ยกเลิกเช่าห้อง ${room.name || room.code}`, `
        <label>วันที่มีผล<input name="effectiveDate" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>ผู้พักปัจจุบัน<input value="${room.occupants?.length || 0} คน" disabled></label>
        <label class="full">เหตุผลการยกเลิก<textarea name="reason" required maxlength="4000" placeholder="ระบุเหตุผลเพื่อใช้ตรวจสอบย้อนหลัง"></textarea></label>
        <label class="full">หมายเหตุ/การส่งมอบห้อง<textarea name="handoverNote" maxlength="4000"></textarea></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">กลับ</button><button type="submit" class="button button-primary">ยืนยันยกเลิกเช่า</button></div>
    `, async data => {
        if (room.occupants?.length) throw new Error('ต้องย้ายผู้พักออกจากห้องให้ครบก่อนยกเลิกเช่า');
        if (!confirm(`ยืนยันยกเลิกเช่าห้อง ${room.name || room.code} ตั้งแต่วันที่ ${data.effectiveDate}?`)) return;
        await accommodationRequest(`/rooms/${room.id}`, { method: 'DELETE' });
    });
}

function openMovementForm(occupant, currentRoom) {
    const choices = allRegisteredRooms().map(room =>
        `<option value="${escapeHtml(room.id)}" ${room.id === currentRoom.id ? 'selected' : ''}>${escapeHtml(room.buildingName)} / ${escapeHtml(room.floorName)} / ${escapeHtml(room.name || room.code)} (${room.occupants.length}/${room.capacity})</option>`
    ).join('');
    openManagementModal(`ย้ายห้อง: ${occupant.employeeName}`, `
        <label class="full">ห้องปลายทาง<select name="toRoomId" required>${choices}</select></label>
        <label>วันที่มีผล<input name="effectiveDate" type="date" required value="${new Date().toISOString().slice(0,10)}"></label>
        <label class="full">เหตุผลการย้าย<textarea name="reason" required maxlength="4000"></textarea></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึกการย้าย</button></div>
    `, async data => {
        const result = await accommodationRequest('/employee-movements', { method: 'POST', body: JSON.stringify({ ...data, employeeId: occupant.employeeId }) });
        // ย้ายห้องในระบบสำเร็จเสมอถ้ามาถึงจุดนี้ (ฐานข้อมูลคือแหล่งข้อมูลหลัก) แต่ถ้าเขียน
        // กลับไปที่ Google Sheet ไม่สำเร็จ (เช่น หาแถวพนักงานไม่เจอ) จะมี sheetSyncWarning
        // ติดมาด้วย แจ้งเตือนแยกไว้ให้เห็นชัดเจน โดยไม่ทำให้การย้ายห้องดูเหมือนล้มเหลว
        if (result.movement?.sheetSyncWarning) {
            window.setTimeout(() => alert(result.movement.sheetSyncWarning), 300);
        }
    });
}

function openMaintenanceForm(room) {
    openManagementModal(`แจ้งซ่อม Room ${room.name || room.code}`, `
        <label class="full">ลักษณะปัญหาที่พบ<textarea name="problemDescription" required maxlength="4000"></textarea></label>
        <label>วันและเวลาที่สะดวก<input name="preferredServiceAt" type="datetime-local"></label>
        <label class="full">หมายเหตุ<textarea name="note" maxlength="4000"></textarea></label>
        <label class="full">1. รูปหลักฐานการแจ้งซ่อม (หน้าแชท)<input name="reportEvidence" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="full">2. รูปสิ่งที่ซ่อม<input name="repairResult" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="full">3. รูปหลักฐานการประสานงานซ่อม<input name="coordinationEvidence" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="full"><small>ไฟล์ละไม่เกิน 10 MB · JPG, PNG หรือ WEBP · จัดเก็บใน Google Drive และฐานข้อมูลเก็บเฉพาะรหัสไฟล์</small></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึกแจ้งซ่อม</button></div>
    `, async data => {
        const created = await accommodationRequest('/maintenance', {
            method: 'POST',
            body: JSON.stringify({ roomId: room.id, problemDescription: data.problemDescription, preferredServiceAt: data.preferredServiceAt, note: data.note })
        });
        const files = [
            ['REPORT_EVIDENCE', data.reportEvidence],
            ['REPAIR_RESULT', data.repairResult],
            ['COORDINATION_EVIDENCE', data.coordinationEvidence]
        ].filter(([, file]) => file instanceof File && file.size > 0);
        for (const [photoType, file] of files) {
            await uploadMaintenancePhoto(created.request.id, room, photoType, file);
        }
    });
}

async function uploadMaintenancePhoto(requestId, room, photoType, file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        throw new Error(`ไฟล์ ${file.name} ไม่ใช่รูปที่อนุญาตหรือมีขนาดเกิน 10 MB`);
    }
    const fileData = await fileToDataUrl(file);
    const uploadResponse = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/upload-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            caseId: `Maintenance_${requestId}`,
            fileName: `${photoType}_${room.code}_${file.name}`,
            fileData,
            uploadContext: 'ACCOMMODATION'
        })
    });
    const uploadResult = await uploadResponse.json();
    if (uploadResult.needAuth && uploadResult.authUrl) {
        window.open(uploadResult.authUrl, '_blank', 'noopener,noreferrer');
        throw new Error('กรุณายืนยันสิทธิ์ Google Drive แล้วอัปโหลดรูปอีกครั้ง');
    }
    if (!uploadResponse.ok || !uploadResult.success) throw new Error(uploadResult.message || 'อัปโหลดรูปไม่สำเร็จ');
    await accommodationRequest(`/maintenance/${requestId}/photos/${photoType}`, {
        method: 'PUT',
        body: JSON.stringify({
            storageKey: uploadResult.fileId,
            originalFileName: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size
        })
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`));
        reader.readAsDataURL(file);
    });
}

function openMaintenanceOverview() {
    const requests = accommodationState.sites.flatMap(site => (site.buildings || []).flatMap(building =>
        (building.maintenanceRequests || []).map(request => ({ ...request, buildingName: building.name }))
    ));
    const rows = requests.length ? requests.map(request => `<tr>
        <td>${escapeHtml(request.buildingName)}</td><td>${escapeHtml(request.roomCode || '-')}</td>
        <td>${escapeHtml(request.problemDescription)}</td><td>${escapeHtml(request.status)}</td>
        <td>${formatMoney(request.repairCost)}</td><td>${formatDate(request.createdAt)}</td>
        <td><div class="maintenance-thumbnails">${(request.photos || []).map(photo => `<button type="button" class="maintenance-thumbnail" data-photo-content="${escapeHtml(photo.contentUrl)}" aria-label="${escapeHtml(photo.type)}"><span>รูป</span></button>`).join('') || '-'}</div></td>
        <td><button type="button" class="mini-button" data-maintenance-edit="${escapeHtml(request.id)}">แก้ไข</button> <button type="button" class="mini-button" data-maintenance-delete="${escapeHtml(request.id)}">ลบ</button></td>
    </tr>`).join('') : '<tr><td colspan="8">ยังไม่มีรายการแจ้งซ่อม</td></tr>';
    openManagementModal('Room Maintenance', `
        <div class="full report-table-wrapper"><table class="report-table"><thead><tr><th>อาคาร</th><th>ห้อง</th><th>ปัญหา</th><th>สถานะ</th><th>ค่าใช้จ่าย</th><th>วันที่แจ้ง</th><th>รูป</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="form-actions"><button type="button" class="button button-primary" onclick="closeManagementModal()">ปิด</button></div>
    `, async () => {});
    document.querySelectorAll('[data-maintenance-edit]').forEach(button => {
        const request = requests.find(item => item.id === button.dataset.maintenanceEdit);
        button.addEventListener('click', () => openMaintenanceUpdateForm(request));
    });
    document.querySelectorAll('[data-maintenance-delete]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('ยืนยันลบรายการแจ้งซ่อมนี้? ระบบจะเก็บประวัติการลบไว้')) return;
            await accommodationRequest(`/maintenance/${button.dataset.maintenanceDelete}`, { method: 'DELETE' });
            closeManagementModal(); await loadAccommodationData({ silent: true });
        });
    });
    hydrateMaintenanceThumbnails();
}

async function hydrateMaintenanceThumbnails() {
    for (const button of document.querySelectorAll('[data-photo-content]')) {
        try {
            const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}${button.dataset.photoContent}`);
            if (!response.ok) continue;
            const blobUrl = URL.createObjectURL(await response.blob());
            const image = document.createElement('img');
            image.src = blobUrl;
            image.alt = button.getAttribute('aria-label') || 'รูปหลักฐาน';
            button.replaceChildren(image);
            button.addEventListener('click', () => openImagePreview(blobUrl));
        } catch (error) {
            console.warn('Unable to load maintenance thumbnail');
        }
    }
}

function openImagePreview(src) {
    document.getElementById('imagePreviewElement').src = src;
    showExclusiveOverlay('imagePreviewModal', { returnToPrevious: true });
}

function closeImagePreview() {
    closeExclusiveOverlay('imagePreviewModal');
    document.getElementById('imagePreviewElement')?.removeAttribute('src');
}

function openMaintenanceUpdateForm(request) {
    const statuses = ['REPORTED','COORDINATING','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'];
    openManagementModal(`แก้ไขงานซ่อม Room ${request.roomCode || '-'}`, `
        <label>สถานะ<select name="status">${statuses.map(value => `<option value="${value}" ${value === request.status ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>ค่าซ่อม<input name="repairCost" type="number" min="0" step="0.01" value="${request.repairCost ?? ''}"></label>
        <label class="full">หมายเหตุ<textarea name="note" maxlength="4000">${escapeHtml(request.note || '')}</textarea></label>
        <label class="full">เพิ่ม/แทนที่รูปหลักฐานแจ้งซ่อม<input name="reportEvidence" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="full">เพิ่ม/แทนที่รูปสิ่งที่ซ่อม<input name="repairResult" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="full">เพิ่ม/แทนที่รูปประสานงาน<input name="coordinationEvidence" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึก</button></div>
    `, async data => {
        await accommodationRequest(`/maintenance/${request.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: data.status, repairCost: data.repairCost, note: data.note })
        });
        const room = allRegisteredRooms().find(item => item.id === request.roomId) || { code: request.roomCode || 'room' };
        const files = [
            ['REPORT_EVIDENCE', data.reportEvidence],
            ['REPAIR_RESULT', data.repairResult],
            ['COORDINATION_EVIDENCE', data.coordinationEvidence]
        ].filter(([, file]) => file instanceof File && file.size > 0);
        for (const [photoType, file] of files) await uploadMaintenancePhoto(request.id, room, photoType, file);
    });
}

function openExpenseForm(building, existing = null) {
    const types = {
        RENT:'ค่าเช่า',COMMON_FEE:'ค่าส่วนกลาง',ELECTRICITY:'ค่าไฟฟ้า',ELECTRICITY_FLAT:'ค่าไฟเหมา',
        WATER:'ค่าน้ำ',WATER_FLAT:'ค่าน้ำเหมา',REPAIR:'ค่าซ่อม',REPAIR_FLAT:'ค่าซ่อมเหมา',
        WASTE:'ค่าขยะ',WASTE_FLAT:'ค่าขยะเหมา',INTERNET:'ค่าอินเทอร์เน็ต',OTHER:'ค่าอื่นๆ'
    };
    openManagementModal(`${existing ? 'แก้ไข' : 'ลง'}ข้อมูลบิลค่าใช้จ่าย: ${building.name}`, `
        <label>ประเภทรายการ<select name="expenseType" required>${Object.entries(types).map(([value,label]) => `<option value="${value}" ${existing?.expenseType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>จำนวนเงิน<input name="amount" type="number" min="0" step="0.01" required value="${existing?.amount ?? ''}"></label>
        <label>วันที่รายการ<input name="expenseDate" type="date" required value="${existing?.expenseDate ? String(existing.expenseDate).slice(0,10) : new Date().toISOString().slice(0,10)}"></label>
        <label>ผู้ให้บริการ/ผู้รับเงิน<input name="vendorName" maxlength="250" value="${escapeHtml(existing?.vendorName || '')}"></label>
        <label>เริ่มรอบบิล<input name="billingPeriodStart" type="date"></label>
        <label>สิ้นสุดรอบบิล<input name="billingPeriodEnd" type="date"></label>
        <label class="full">รายละเอียด<textarea name="description" maxlength="4000">${escapeHtml(existing?.description || '')}</textarea></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึกค่าใช้จ่าย</button></div>
    `, data => accommodationRequest(existing ? `/expenses/${existing.id}` : '/expenses', { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ ...data, buildingId: building.id }) }));
}

function openBuildingStructureForm() {
    openManagementModal('สร้างทะเบียนอาคารและห้อง', `
        <label>พื้นที่<select name="siteCode" required><option value="SL">SL</option><option value="PP">PP</option></select></label>
        <label>รหัสอาคาร<input name="code" required maxlength="80"></label>
        <label class="full">ชื่ออาคาร<input name="name" required maxlength="250"></label>
        <label>จำนวนห้องทั้งหมด<input name="declaredRoomCount" type="number" min="1" max="2000" required></label>
        <label class="full">ที่อยู่<textarea name="address" maxlength="4000"></textarea></label>
        <label class="full">รายการห้อง — หนึ่งบรรทัดต่อหนึ่งห้อง รูปแบบ ชั้น | ห้อง | ความจุ<textarea name="roomLines" required placeholder="1 | 101 | 2&#10;1 | 102 | 2&#10;2 | 201 | 1"></textarea></label>
        <label class="full">หมายเหตุ<textarea name="note" maxlength="4000"></textarea></label>
        <label class="full"><span><input name="confirmedAgainstSource" type="checkbox" value="true" required> ฉันตรวจจำนวนและหมายเลขห้องกับเอกสารต้นฉบับแล้ว</span></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">สร้างทะเบียน</button></div>
    `, data => {
        const floorMap = new Map();
        String(data.roomLines || '').split(/\r?\n/).filter(line => line.trim()).forEach((line, index) => {
            const [floorCode, roomCode, capacityText = '1'] = line.split('|').map(value => value.trim());
            if (!floorCode || !roomCode) throw new Error(`บรรทัดห้องที่ ${index + 1} ไม่ครบ`);
            if (!floorMap.has(floorCode)) floorMap.set(floorCode, { code: floorCode, name: floorCode, rooms: [] });
            floorMap.get(floorCode).rooms.push({ code: roomCode, name: roomCode, capacity: Number(capacityText) });
        });
        return accommodationRequest('/buildings', {
            method: 'POST', body: JSON.stringify({ ...data, confirmedAgainstSource: data.confirmedAgainstSource === 'true', roomLines: undefined, floors: Array.from(floorMap.values()) })
        });
    });
}

function openBuildingEditForm(building) {
    const statuses = ['ACTIVE','INACTIVE','MAINTENANCE','PLANNED'];
    openManagementModal(`แก้ไขอาคาร: ${building.name}`, `
        <label>รหัสอาคาร<input name="code" required maxlength="80" value="${escapeHtml(building.code)}"></label>
        <label>สถานะ<select name="status">${statuses.map(value => `<option value="${value}" ${building.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label class="full">ชื่ออาคาร<input name="name" required maxlength="250" value="${escapeHtml(building.name)}"></label>
        <label>จำนวนห้องตามทะเบียน<input name="declaredRoomCount" type="number" min="0" required value="${building.declaredRoomCount ?? building.summary.registeredRooms}"></label>
        <label class="full">ที่อยู่<textarea name="address" maxlength="4000">${escapeHtml(building.address || '')}</textarea></label>
        <label class="full">หมายเหตุ<textarea name="note" maxlength="4000">${escapeHtml(building.note || '')}</textarea></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึก</button></div>
    `, data => accommodationRequest(`/buildings/${building.id}`, { method: 'PUT', body: JSON.stringify(data) }));
}

function openRoomEditForm(room) {
    const statuses = ['AVAILABLE','OCCUPIED','MAINTENANCE','RESERVED','INACTIVE','COMMON_AREA'];
    openManagementModal(`แก้ไขห้อง ${room.name || room.code}`, `
        <label>ชื่อแสดง<input name="name" maxlength="150" value="${escapeHtml(room.name || '')}"></label>
        <label>ความจุ<input name="capacity" type="number" min="1" max="100" required value="${room.capacity}"></label>
        <label>สถานะ<select name="status">${statuses.map(value => `<option value="${value}" ${room.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>ค่าเช่ารายเดือน<input name="monthlyRent" type="number" min="0" step="0.01" value="${room.monthlyRent ?? ''}"></label>
        <label class="full">หมายเหตุ<textarea name="note" maxlength="4000">${escapeHtml(room.note || '')}</textarea></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึก</button></div>
    `, data => accommodationRequest(`/rooms/${room.id}`, { method: 'PUT', body: JSON.stringify(data) }));
}

function openContractForm(building, existing = null) {
    const value = key => escapeHtml(existing?.[key] ?? '');
    const dateValue = key => existing?.[key] ? String(existing[key]).slice(0, 10) : '';
    openManagementModal(`${existing ? 'แก้ไข' : 'บันทึกร่าง'}สัญญา: ${building.name}`, `
        <label>เลขอ้างอิงสัญญา<input name="reference" maxlength="150" value="${value('reference')}"></label>
        <label>ชื่อไฟล์ต้นฉบับ<input name="sourceDocumentName" maxlength="500" value="${value('sourceDocumentName')}"></label>
        <label>ผู้ให้เช่า<input name="lessorName" maxlength="250" value="${value('lessorName')}"></label>
        <label>ผู้เช่า<input name="lesseeName" maxlength="250" value="${value('lesseeName')}"></label>
        <label>ผู้ลงนาม<input name="signerName" maxlength="250" value="${value('signerName')}"></label>
        <label>จำนวนยูนิต<input name="unitCount" type="number" min="0" value="${value('unitCount')}"></label>
        <label class="full">ที่อยู่ทรัพย์สิน<textarea name="propertyAddress">${value('propertyAddress')}</textarea></label>
        <label>วันที่เริ่มเช่า<input name="leaseStartDate" type="date" value="${dateValue('leaseStartDate')}"></label>
        <label>วันที่สิ้นสุด<input name="leaseEndDate" type="date" value="${dateValue('leaseEndDate')}"></label>
        <label>ค่าเช่ารายเดือน<input name="monthlyRent" type="number" min="0" step="0.01" value="${value('monthlyRent')}"></label>
        <label>เงินประกัน<input name="securityDeposit" type="number" min="0" step="0.01" value="${value('securityDeposit')}"></label>
        <label>ค่าส่วนกลาง<input name="commonFee" type="number" min="0" step="0.01" value="${value('commonFee')}"></label>
        <label>จำนวนเครื่องปรับอากาศ<input name="airConditionerCount" type="number" min="0" value="${value('airConditionerCount')}"></label>
        <label class="full">เงื่อนไขการชำระเงิน<textarea name="paymentTerms">${value('paymentTerms')}</textarea></label>
        <label class="full">เงื่อนไขค่าสาธารณูปโภค<textarea name="utilityTerms">${value('utilityTerms')}</textarea></label>
        <label class="full">เงื่อนไขซ่อมบำรุง<textarea name="maintenanceTerms">${value('maintenanceTerms')}</textarea></label>
        <label class="full">การบอกเลิกสัญญา<textarea name="terminationTerms">${value('terminationTerms')}</textarea></label>
        <label class="full">เงื่อนไขสำคัญอื่น<textarea name="importantTerms">${value('importantTerms')}</textarea></label>
        <div class="form-actions"><button type="button" class="button button-secondary" onclick="closeManagementModal()">ยกเลิก</button><button type="submit" class="button button-primary">บันทึกเป็นร่างรอตรวจ</button></div>
    `, data => accommodationRequest(existing ? `/contracts/${existing.id}` : '/contracts', { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ ...data, buildingId: building.id }) }));
}

function formatMoney(value) {
    if (value === null || value === undefined || value === '') return '-';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 }).format(Number(value));
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}
