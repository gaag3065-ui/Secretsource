// accommodation.js ส่วนที่ 4/10 (บรรทัดเดิม 757–1051) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
function renderAccommodationBuildingCard(item, expanded) {
    const { building, area, rooms, unmatched = [], areaUnmatchedCount = 0 } = item;
    const mappedEmployeeCount = rooms.reduce(
        (sum, room) => sum + (room.occupants || []).length,
        0
    );
    const sourceEmployeeCount = accommodationState.records.filter(employee =>
        employee.workArea === area &&
        normalizeBuildingName(employee.building) === normalizeBuildingName(building.name)
    ).length;
    const rentable = room =>
        !['INACTIVE', 'COMMON_AREA', 'MAINTENANCE', 'RESERVED'].includes(room.status);
    const occupiedRooms = rooms.filter(room => (room.occupants || []).length > 0);
    const vacantRooms = areaUnmatchedCount
        ? []
        : rooms.filter(room => rentable(room) && !(room.occupants || []).length);
    const otherStatusRooms = rooms.filter(room =>
        !(room.occupants || []).length && !rentable(room)
    );
    const floorCount = (building.floors || []).length;

    // ตัวกรอง 7 ปุ่มภายในการ์ดนี้ (เก็บสถานะแยกต่อตึกด้วย building.id) — ค่าเริ่มต้นเปิด
    // ให้เห็นครบทุกอย่างเหมือนเดิม กดปิดปุ่มไหนก็ซ่อนหมวดนั้นออกจากรายการห้อง/พนักงานด้านล่าง
    // "ห้องที่มีผู้พักยืนยันแล้ว" กับ "พนักงานจับคู่ห้องแล้ว" ควบคุมชุดข้อมูลเดียวกัน (ห้องที่มี
    // คนอยู่) ส่วน "พนักงานต้นทาง" กับ "รอตรวจสอบการจับคู่" ก็ควบคุมชุดเดียวกัน (คนที่ยัง
    // ไม่จับคู่ห้อง) จึงกดปุ่มไหนก็ได้ในคู่นั้นแล้วเห็นผลเหมือนกัน — ตามที่ให้ทำปุ่มครบ 7 ปุ่ม
    const filters = accommodationState.buildingCardFilters.get(building.id) || {
        floorGroup: true, otherStatus: true, occupied: true, vacant: true, unassigned: true
    };
    accommodationState.buildingCardFilters.set(building.id, filters);

    // เปลี่ยนชื่อป้าย 6 ใน 7 รายการตามที่แจ้ง (จำนวนชั้น คงชื่อเดิม) — แยกป้าย/ตัวเลขออก
    // จากกันเป็น [key, label, value] เพื่อเรนเดอร์ 2 แบบ: ตอนยังไม่กาง (plain text เน้น
    // ตัวเลข) กับตอนกางแล้ว (ปุ่มกรอบเดิม คลิกได้) ใช้ป้ายชุดเดียวกันทั้งสองแบบ
    const statItems = [
        ['floorGroup', 'จำนวนชั้น', floorCount.toLocaleString()],
        ['otherStatus', 'จำนวนห้อง', rooms.length.toLocaleString()],
        ['occupied', 'ห้องที่มีผู้พักอาศัย', occupiedRooms.length.toLocaleString()],
        ['vacant', 'ห้องว่าง', areaUnmatchedCount ? 'รอตรวจสอบ' : vacantRooms.length.toLocaleString()],
        ['occupied', 'พนักงานทั้งหมดในตึก', mappedEmployeeCount.toLocaleString()],
        ['unassigned', 'พนักงานที่ลงข้อมูลไว้', sourceEmployeeCount.toLocaleString()],
        ['unassigned', 'รอตรวจสอบ', unmatched.length.toLocaleString()]
    ];

    let bodyHtml = '';
    if (expanded) {
        const visibleRooms = [
            ...(filters.occupied ? occupiedRooms : []),
            ...(filters.vacant ? vacantRooms : []),
            ...(filters.otherStatus ? otherStatusRooms : [])
        ];

        if (filters.floorGroup) {
            const floorMap = new Map();
            visibleRooms.forEach(room => {
                const key = room.floorId || room.floorName || '-';
                if (!floorMap.has(key)) floorMap.set(key, { name: room.floorName, rooms: [] });
                floorMap.get(key).rooms.push(room);
            });
            const floorSections = Array.from(floorMap.values())
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th', { numeric: true }));
            bodyHtml += floorSections.map(section => `
                <div class="building-floor-section">
                    <h4>ชั้น ${escapeHtml(section.name || '-')}</h4>
                    <div class="building-room-grid">${section.rooms.map(renderBuildingCardRoomBox).join('')}</div>
                </div>
            `).join('');
        } else if (visibleRooms.length) {
            bodyHtml += `<div class="building-room-grid">${visibleRooms.map(renderBuildingCardRoomBox).join('')}</div>`;
        }

        if (filters.unassigned && unmatched.length) {
            bodyHtml += renderBuildingCardUnassignedBox(unmatched);
        }

        if (!bodyHtml) {
            bodyHtml = '<div class="accommodation-data-empty">ไม่พบข้อมูลตามตัวกรองที่เลือก</div>';
        }
    }

    // ยังไม่กาง: ตัวหนังสือธรรมดา ไม่มีกรอบ ไม่คลิกได้ เน้นตัวเลขเป็นหลัก (แยกป้ายกับเลข
    // ออกจากกันชัดเจน) — กางแล้ว: กลับไปเป็นปุ่มกรอบเดิมที่คลิกกรองได้ตามที่เคยทำไว้
    const statsHtml = expanded
        ? statItems.map(([key, label, value]) => `<button type="button" class="building-filter-chip${filters[key] ? ' is-active' : ''}" data-filter-key="${key}">${escapeHtml(label)} ${escapeHtml(value)}</button>`).join('')
        : statItems.map(([, label, value]) => `<span class="building-stat-preview"><span class="building-stat-preview-label">${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></span>`).join('');

    return `
        <div class="accommodation-building-card-head">
            <button type="button" class="accommodation-data-card-toggle" data-summary-card aria-expanded="${expanded}">
                <span class="accommodation-card-icon" aria-hidden="true">⌂</span>
                <span class="accommodation-card-title"><b>${escapeHtml(building.name)}</b><small>${escapeHtml(area)} · ${rooms.length.toLocaleString()} ห้อง · ${sourceEmployeeCount.toLocaleString()} พนักงานที่ลงข้อมูลไว้</small></span>
                ${areaUnmatchedCount ? `<span class="accommodation-card-badge is-warning">พื้นที่รอตรวจ ${areaUnmatchedCount}</span>` : ''}
                <span class="accommodation-card-state">${expanded ? '⌃' : '⌄'}</span>
            </button>
            <div class="accommodation-building-filters${expanded ? '' : ' is-preview'}" data-building-id="${escapeHtml(building.id)}">
                ${statsHtml}
            </div>
        </div>
        <div class="accommodation-building-expand">${bodyHtml}</div>`;
}

function renderBuildingCardRoomBox(room) {
    const occupants = room.occupants || [];
    const rows = occupants.length
        ? occupants.map(person => `
            <tr>
                <td>${escapeHtml(person.company || '-')}</td>
                <td>${escapeHtml(person.employeeName)}</td>
                <td>${escapeHtml(person.employeeId)}</td>
            </tr>
        `).join('')
        : `<tr><td colspan="3" class="vacant-room-label">ห้องว่าง</td></tr>`;

    return `
        <article class="building-room-box${occupants.length ? '' : ' is-vacant'}">
            <div class="building-room-box-head">
                <span>ห้อง ${escapeHtml(room.name || room.code)} · ชั้น ${escapeHtml(room.floorName || '-')}</span>
                <span class="accommodation-card-badge">${occupants.length.toLocaleString()}/${Number(room.capacity || 0).toLocaleString()} คน</span>
            </div>
            <table class="building-room-box-table">
                <thead><tr><th>บริษัท</th><th>ชื่อพนักงาน</th><th>รหัสพนักงาน</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </article>`;
}

function renderBuildingCardUnassignedBox(employees) {
    const rows = employees.map(employee => `
        <tr>
            <td>${escapeHtml(employee.company || '-')}</td>
            <td>${escapeHtml(employee.employeeName)}</td>
            <td>${escapeHtml(employee.employeeId)}</td>
        </tr>
    `).join('');

    return `
        <article class="building-room-box building-room-box-unassigned">
            <div class="building-room-box-head">
                <span>⚠ ยังไม่จับคู่ห้อง (อยู่ในคิว "รอตรวจสอบห้องพัก")</span>
                <span class="accommodation-card-badge is-warning">${employees.length.toLocaleString()} คน</span>
            </div>
            <table class="building-room-box-table">
                <thead><tr><th>บริษัท</th><th>ชื่อพนักงาน</th><th>รหัสพนักงาน</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </article>`;
}

function renderAccommodationRoomCard(room, expanded) {
    const occupants = room.occupants || [];
    const occupantText = occupants.length
        ? occupants.map(person => `${escapeHtml(person.employeeName)} (${escapeHtml(person.employeeId)})`).join(', ')
        : 'ไม่มีผู้พัก';
    return `
        <button type="button" class="accommodation-data-card-toggle" data-summary-card aria-expanded="${expanded}">
            <span class="accommodation-card-icon" aria-hidden="true">▣</span>
            <span class="accommodation-card-title"><b>ห้อง ${escapeHtml(room.name || room.code)}</b><small>${escapeHtml(room.siteCode)} · ${escapeHtml(room.buildingName)} · ชั้น ${escapeHtml(room.floorName)}</small></span>
            <span class="accommodation-card-badge">${occupants.length ? `${occupants.length} ผู้พัก` : 'ห้องว่าง'}</span>
            <span class="accommodation-card-state">${expanded ? '⌃' : '⌄'}</span>
        </button>
        <div class="accommodation-card-details accommodation-room-details">
            <div><span>สถานะห้อง</span><b>${occupants.length ? 'มีผู้พักอาศัย' : 'ห้องว่าง'}</b></div>
            <div><span>ความจุ</span><b>${Number(room.capacity || 0).toLocaleString()} คน</b></div>
            <div class="accommodation-details-wide"><span>ผู้พักอาศัย</span><b>${occupantText}</b></div>
        </div>`;
}

function renderAccommodationEmployeeCard(employee, expanded) {
    return `
        <button type="button" class="accommodation-data-card-toggle" data-summary-card aria-expanded="${expanded}">
            <span class="accommodation-card-icon" aria-hidden="true">●</span>
            <span class="accommodation-card-title"><b>${escapeHtml(employee.employeeName)}</b><small>${escapeHtml(employee.company)} · ${escapeHtml(employee.workArea)}</small></span>
            <span class="accommodation-card-state">${expanded ? '⌃' : '⌄'}</span>
        </button>
        <div class="accommodation-card-details">
            <div><span>รหัสพนักงาน</span><b>${escapeHtml(employee.employeeId)}</b></div>
            <div><span>อาคาร</span><b>${escapeHtml(employee.building || '-')}</b></div>
            <div><span>ห้อง</span><b>${escapeHtml(employee.room || '-')}</b></div>
        </div>`;
}

function renderWorkAreaNavigation(workAreas) {
    const navigation = document.getElementById('workAreaNavigation');

    if (!navigation) return;

    navigation.replaceChildren();

    workAreas.forEach((area) => {
        const employees = accommodationState.records.filter(item => item.workArea === area);
        const count = employees.length;
        const site = accommodationState.sites.find(item => item.code === area);
        const buildings = new Map();

        (site?.buildings || []).forEach(building => {
            const normalized = normalizeBuildingName(building.name);
            buildings.set(normalized, { name: building.name, building, employees: [] });
        });
        employees.forEach(employee => {
            const key = normalizeBuildingName(employee.building) || '__unspecified__';
            if (!buildings.has(key)) buildings.set(key, {
                name: employee.building || 'ไม่ระบุตึก',
                building: null,
                employees: []
            });
            buildings.get(key).employees.push(employee);
        });

        const visibleBuildings = Array.from(buildings.values())
            .filter(item => {
                if (!accommodationState.buildingFilter) return true;
                const searchable = [area, item.name, ...(item.employees || []).map(window.AccommodationPeople.personText)]
                    .join(' ').toLocaleLowerCase('th');
                return searchable.includes(accommodationState.buildingFilter);
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'th', { numeric: true }));

        if (!visibleBuildings.length) return;

        const areaSection = document.createElement('section');
        areaSection.className = 'catalog-area';
        areaSection.innerHTML = `<h3 class="catalog-area-title"><span>${escapeHtml(area)}</span><span>${count.toLocaleString()} คน</span></h3>`;
        const list = document.createElement('div');
        list.className = 'catalog-building-list';

        visibleBuildings.forEach(item => {
                const source = item.building
                    ? getBuildingSourceMetrics(item.building, area)
                    : { employeeCount: item.employees.length, vacantRoomCount: null };
                const roomCount = item.building
                    ? (item.building.summary.declaredRooms ?? item.building.summary.registeredRooms)
                    : new Set(item.employees.map(employee => `${employee.floor}::${employee.room}`)).size;
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'catalog-building-card';
                const isActive = item.building
                    ? accommodationState.selectedBuilding?.id === item.building.id
                    : !accommodationState.selectedBuilding && normalizeBuildingName(item.name) === normalizeBuildingName(document.getElementById('selectedBuildingTitle')?.textContent);
                card.classList.toggle('is-active', isActive);
                card.setAttribute('aria-pressed', String(isActive));
                card.innerHTML = `<b>${escapeHtml(item.name)}</b><span>ห้องทั้งหมด ${roomCount ?? '-'} · พนักงาน ${source.employeeCount} คน · ห้องว่าง ${source.vacantRoomCount ?? '-'}</span>`;
                card.addEventListener('click', () => {
                    accommodationState.selectedWorkArea = area;
                    if (item.building) renderRegisteredBuildingDetails(item.building, { scroll: false });
                    else renderBuildingDetails(item.name, item.employees);
                    renderWorkAreaNavigation(workAreas);
                });
                list.appendChild(card);
            });

        areaSection.appendChild(list);
        navigation.appendChild(areaSection);
    });

    if (!navigation.childElementCount) {
        navigation.innerHTML = '<div class="catalog-empty">ไม่พบอาคารหรือผู้พักที่ตรงกับคำค้น</div>';
    }
}

// ================== รอตรวจสอบห้องพัก ==================
// พนักงานที่ไม่มีการจับคู่ห้อง (accommodationState.unmatchedEmployees ที่ backend
// ส่งมาให้อยู่แล้วจาก /dashboard) มาแสดงเป็นคิวให้ผู้ใช้เลือกตึก/ชั้น/ห้องจากรายการ
// ที่ลงทะเบียนไว้แล้วเท่านั้น (ห้ามพิมพ์เอง กันสร้างห้อง/ตึกซ้ำซ้อนจากการพิมพ์ผิด)
// เมื่อบันทึกจะเรียก endpoint เดียวกับการย้ายห้องปกติ (ซึ่งเขียนกลับ Google Sheet
// เฉพาะ 3 คอลัมน์ตึก/ชั้น/ห้องให้อัตโนมัติอยู่แล้ว)

function renderPendingReviewBadge() {
    const button = document.getElementById('pendingReviewButton');
    const countEl = document.getElementById('pendingReviewCount');
    if (!button || !countEl) return;
    const count = accommodationState.unmatchedEmployees.length;
    countEl.textContent = count.toLocaleString();
    button.hidden = count === 0;
}

function classifyPendingEmployee(employee) {
    const site = accommodationState.sites.find(item => item.code === employee.workArea);
    if (!site) {
        return { reason: 'ไม่มีพื้นที่ทำงานนี้ในระบบ', matchedSite: null, matchedBuilding: null };
    }
    const normalizedTarget = normalizeBuildingName(employee.building);
    const matchedBuilding = normalizedTarget
        ? (site.buildings || []).find(building => normalizeBuildingName(building.name) === normalizedTarget)
        : null;
    if (!matchedBuilding) {
        return { reason: 'ไม่พบชื่อตึกนี้ในระบบ', matchedSite: site, matchedBuilding: null };
    }
    return { reason: 'พบตึกแล้ว แต่ชั้น/ห้องไม่ตรงกับทะเบียน', matchedSite: site, matchedBuilding };
}

function openPendingReviewModal() {
    renderPendingReviewList();
    showExclusiveOverlay('pendingReviewModal');
}
