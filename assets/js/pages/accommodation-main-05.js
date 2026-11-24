// accommodation.js ส่วนที่ 5/10 (บรรทัดเดิม 1052–1296) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
function renderPendingReviewList() {
    const container = document.getElementById('pendingReviewList');
    if (!container) return;
    const employees = accommodationState.unmatchedEmployees;

    if (!employees.length) {
        container.innerHTML = '<div class="pending-review-empty">ไม่มีรายการที่ต้องตรวจสอบแล้ว ✅</div>';
        return;
    }

    container.innerHTML = employees.map((employee, index) => {
        const { reason, matchedSite, matchedBuilding } = classifyPendingEmployee(employee);
        const siteOptions = accommodationState.sites.map(site =>
            `<option value="${escapeHtml(site.code)}" ${matchedSite?.code === site.code ? 'selected' : ''}>${escapeHtml(site.code)} — ${escapeHtml(site.name)}</option>`
        ).join('');

        return `
            <article class="pending-review-card" data-pending-index="${index}">
                <div class="pending-review-card-head">
                    <div>
                        <b>${escapeHtml(employee.employeeName)}</b>
                        <small>${escapeHtml(employee.company || '-')} · รหัสพนักงาน ${escapeHtml(employee.employeeId)}</small>
                    </div>
                    <span class="pending-review-reason">${escapeHtml(reason)}</span>
                </div>
                <p class="pending-review-source">
                    ข้อมูลที่กรอกไว้ต้นทาง — <b>พื้นที่</b> ${escapeHtml(employee.workArea || '-')}
                    &nbsp;·&nbsp;<b>ตึก</b> ${escapeHtml(employee.building || '-')}
                    &nbsp;·&nbsp;<b>ชั้น</b> ${escapeHtml(employee.floor || '-')}
                    &nbsp;·&nbsp;<b>ห้อง</b> ${escapeHtml(employee.room || '-')}
                </p>
                <div class="pending-review-picker">
                    <label>พื้นที่
                        <select data-role="site">
                            <option value="">-- เลือกพื้นที่ --</option>
                            ${siteOptions}
                        </select>
                    </label>
                    <label>ตึก
                        <select data-role="building" disabled>
                            <option value="">-- เลือกตึก --</option>
                        </select>
                    </label>
                    <label>ชั้น
                        <select data-role="floor" disabled>
                            <option value="">-- เลือกชั้น --</option>
                        </select>
                    </label>
                    <label>ห้อง
                        <select data-role="room" disabled>
                            <option value="">-- เลือกห้อง --</option>
                        </select>
                    </label>
                    <button type="button" class="pending-review-save" data-role="save" disabled>บันทึก</button>
                </div>
            </article>
        `;
    }).join('');

    container.querySelectorAll('.pending-review-card').forEach(card => {
        const index = Number(card.dataset.pendingIndex);
        wirePendingReviewCard(card, employees[index]);
        const { matchedSite, matchedBuilding } = classifyPendingEmployee(employees[index]);
        const siteSelect = card.querySelector('[data-role="site"]');
        if (matchedSite) {
            populateBuildingOptions(card, matchedSite);
            if (matchedBuilding) {
                const buildingSelect = card.querySelector('[data-role="building"]');
                buildingSelect.value = matchedBuilding.id;
                populateFloorOptions(card, matchedBuilding);
            }
        }
    });
}

function populateBuildingOptions(card, site) {
    const buildingSelect = card.querySelector('[data-role="building"]');
    const buildings = (site?.buildings || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true }));
    buildingSelect.innerHTML = '<option value="">-- เลือกตึก --</option>' +
        buildings.map(building => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)}</option>`).join('');
    buildingSelect.disabled = buildings.length === 0;
    resetPendingSelect(card, 'floor', 'เลือกชั้น');
    resetPendingSelect(card, 'room', 'เลือกห้อง');
    updatePendingSaveState(card);
}

function populateFloorOptions(card, building) {
    const floorSelect = card.querySelector('[data-role="floor"]');
    const floors = (building?.floors || []).slice().sort((a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name || a.code || '').localeCompare(b.name || b.code || '', 'th', { numeric: true })
    );
    floorSelect.innerHTML = '<option value="">-- เลือกชั้น --</option>' +
        floors.map(floor => `<option value="${escapeHtml(floor.id)}">${escapeHtml(floor.name || floor.code)}</option>`).join('');
    floorSelect.disabled = floors.length === 0;
    resetPendingSelect(card, 'room', 'เลือกห้อง');
    updatePendingSaveState(card);
}

function populateRoomOptions(card, floor) {
    const roomSelect = card.querySelector('[data-role="room"]');
    const rooms = (floor?.rooms || []).slice().sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', 'th', { numeric: true }));
    roomSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>' +
        rooms.map(room => {
            const occupied = (room.occupants || []).length;
            return `<option value="${escapeHtml(room.id)}">${escapeHtml(room.name || room.code)} (${occupied}/${room.capacity} คน)</option>`;
        }).join('');
    roomSelect.disabled = rooms.length === 0;
    updatePendingSaveState(card);
}

function resetPendingSelect(card, role, placeholderLabel) {
    const select = card.querySelector(`[data-role="${role}"]`);
    select.innerHTML = `<option value="">-- ${escapeHtml(placeholderLabel)} --</option>`;
    select.disabled = true;
}

function updatePendingSaveState(card) {
    const roomSelect = card.querySelector('[data-role="room"]');
    const saveButton = card.querySelector('[data-role="save"]');
    saveButton.disabled = !roomSelect.value;
}

function wirePendingReviewCard(card, employee) {
    const siteSelect = card.querySelector('[data-role="site"]');
    const buildingSelect = card.querySelector('[data-role="building"]');
    const floorSelect = card.querySelector('[data-role="floor"]');
    const roomSelect = card.querySelector('[data-role="room"]');
    const saveButton = card.querySelector('[data-role="save"]');

    siteSelect.addEventListener('change', () => {
        const site = accommodationState.sites.find(item => item.code === siteSelect.value);
        if (site) populateBuildingOptions(card, site);
        else {
            resetPendingSelect(card, 'building', 'เลือกตึก');
            resetPendingSelect(card, 'floor', 'เลือกชั้น');
            resetPendingSelect(card, 'room', 'เลือกห้อง');
            updatePendingSaveState(card);
        }
    });

    buildingSelect.addEventListener('change', () => {
        const site = accommodationState.sites.find(item => item.code === siteSelect.value);
        const building = (site?.buildings || []).find(item => item.id === buildingSelect.value);
        if (building) populateFloorOptions(card, building);
        else {
            resetPendingSelect(card, 'floor', 'เลือกชั้น');
            resetPendingSelect(card, 'room', 'เลือกห้อง');
            updatePendingSaveState(card);
        }
    });

    floorSelect.addEventListener('change', () => {
        const site = accommodationState.sites.find(item => item.code === siteSelect.value);
        const building = (site?.buildings || []).find(item => item.id === buildingSelect.value);
        const floor = (building?.floors || []).find(item => item.id === floorSelect.value);
        if (floor) populateRoomOptions(card, floor);
        else {
            resetPendingSelect(card, 'room', 'เลือกห้อง');
            updatePendingSaveState(card);
        }
    });

    roomSelect.addEventListener('change', () => updatePendingSaveState(card));

    saveButton.addEventListener('click', async () => {
        if (!roomSelect.value) return;
        saveButton.disabled = true;
        saveButton.textContent = 'กำลังบันทึก...';
        try {
            const result = await accommodationRequest('/employee-movements', {
                method: 'POST',
                body: JSON.stringify({
                    employeeId: employee.employeeId,
                    toRoomId: roomSelect.value,
                    effectiveDate: new Date().toISOString().slice(0, 10),
                    reason: 'ยืนยันห้องพักจากคิวรอตรวจสอบห้องพัก'
                })
            });
            if (result.movement?.sheetSyncWarning) {
                alert(result.movement.sheetSyncWarning);
            }
            await loadAccommodationData({ silent: true });
        } catch (error) {
            alert(error.message);
            saveButton.disabled = false;
            saveButton.textContent = 'บันทึก';
        }
    });
}

function normalizeBuildingName(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase('th')
        .replace(/^\s*(?:ตึก|อาคาร|building)\s*/u, '')
        .replace(/[^\p{L}\p{N}]/gu, '');
}

function normalizeLocationPart(value) {
    return String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase('th')
        .replace(/^\s*(?:ชั้น|ห้อง|floor|room)\s*/u, '')
        .replace(/[^\p{L}\p{N}]/gu, '');
}

function getBuildingSourceMetrics(building, areaCode = accommodationState.selectedWorkArea) {
    const registeredRoomKeys = new Set();
    const rentableRoomKeys = new Set();
    const roomsByCode = new Map();
    (building.floors || []).forEach(floor => (floor.rooms || []).forEach(room => {
        const floorKey = normalizeLocationPart(floor.name || floor.code);
        const roomKey = normalizeLocationPart(room.name || room.code);
        const key = `${floorKey}::${roomKey}`;
        registeredRoomKeys.add(key);
        if (!['INACTIVE', 'COMMON_AREA', 'MAINTENANCE', 'RESERVED'].includes(room.status)) rentableRoomKeys.add(key);
        if (!roomsByCode.has(roomKey)) roomsByCode.set(roomKey, []);
        roomsByCode.get(roomKey).push(key);
    }));

    const employees = accommodationState.records.filter(employee =>
        employee.workArea === areaCode &&
        normalizeBuildingName(employee.building) === normalizeBuildingName(building.name)
    );
    const occupiedRoomKeys = new Set();
    let unmatchedEmployeeCount = 0;
    employees.forEach(employee => {
        const floorRoomKey = `${normalizeLocationPart(employee.floor)}::${normalizeLocationPart(employee.room)}`;
        if (registeredRoomKeys.has(floorRoomKey)) {
            occupiedRoomKeys.add(floorRoomKey);
            return;
        }
        const sameCodeRooms = roomsByCode.get(normalizeLocationPart(employee.room)) || [];
        if (sameCodeRooms.length === 1) occupiedRoomKeys.add(sameCodeRooms[0]);
        else unmatchedEmployeeCount += 1;
    });

    return {
        employeeCount: employees.length,
        occupiedRoomCount: occupiedRoomKeys.size,
        vacantRoomCount: Math.max(rentableRoomKeys.size - Array.from(occupiedRoomKeys).filter(key => rentableRoomKeys.has(key)).length, 0),
        unmatchedEmployeeCount
    };
}
