// accommodation.js ส่วนที่ 3/10 (บรรทัดเดิม 552–756) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
function renderEmployeeSummary() {
    const summary = document.getElementById('employeeSummary');
    if (!summary) return;

    const data = getAccommodationSummaryItems();
    // เอา 3 ช่อง (ห้องรอยืนยันสถานะ/ห้องไม่พร้อมใช้งาน/รอตรวจสอบการจับคู่) ออกจากแถวสรุป
    // ภาพรวมด้านบนตามที่แจ้ง — ตัวเลขเหล่านี้ยังคำนวณได้ปกติใน getAccommodationSummaryItems()
    // และยังกดดูรายละเอียดได้ผ่าน renderAccommodationDataPanel() หากมีจุดเชื่อมอื่นอ้างถึง
    // (view นี้) เพียงแต่ไม่โชว์เป็นการ์ดตัวเลขแถวบนสุดที่ทำให้เข้าใจผิดอีกต่อไป
    const items = [
        ['buildings', 'จำนวนตึก', data.buildings.length],
        ['rooms', 'จำนวนห้อง', data.rooms.length],
        ['occupied', 'ห้องที่มีผู้พักยืนยันแล้ว', data.occupied.length],
        ['vacant', 'ห้องว่างยืนยันแล้ว', data.vacant.length],
        ['employees', 'จำนวนพนักงานต้นทาง', data.employees.length]
    ];

    summary.innerHTML = items.map(([view, label, value]) =>
        `<button type="button" class="dashboard-kpi${accommodationState.activeSummaryView === view ? ' is-active' : ''}" data-summary-view="${view}" aria-pressed="${accommodationState.activeSummaryView === view}"><b>${Number(value || 0).toLocaleString()}</b>${label}</button>`
    ).join('');

    summary.querySelectorAll('[data-summary-view]').forEach(button => {
        button.addEventListener('click', () => {
            accommodationState.activeSummaryView = button.dataset.summaryView;
            accommodationState.expandedSummaryRecord = null;
            renderEmployeeSummary();
            renderAccommodationDataPanel();
        });
    });
}

// ผ่านตัวกรองบริษัทหรือไม่ — เซตว่าง = ไม่กรอง (แสดงทุกบริษัท)
function matchesCompanyFilter(company) {
    if (accommodationState.summaryCompanyFilters.size === 0) return true;
    const normalized = normalizeCompanyLabel(company) || company;
    return accommodationState.summaryCompanyFilters.has(normalized);
}

function getAccommodationSummaryItems() {
    const selectedArea = accommodationState.summaryAreaFilter;
    const visibleSites = accommodationState.sites.filter(site =>
        selectedArea === 'ALL' || site.code === selectedArea
    );
    const unmatched = accommodationState.unmatchedEmployees.filter(employee =>
        (selectedArea === 'ALL' || employee.workArea === selectedArea) &&
        matchesCompanyFilter(employee.company)
    );

    const buildings = visibleSites.flatMap(site =>
        (site.buildings || []).map(building => {
            const buildingUnmatched = unmatched.filter(employee =>
                employee.workArea === site.code &&
                normalizeBuildingName(employee.building) ===
                    normalizeBuildingName(building.name)
            );
            const areaHasUnmatched = unmatched.some(employee =>
                employee.workArea === site.code
            );
            const rooms = (building.floors || []).flatMap(floor =>
                (floor.rooms || []).map(room => ({
                    ...room,
                    // กรองผู้พักในห้องตามตัวกรองบริษัทด้วย เพื่อให้สถานะห้อง (มีผู้พัก/ว่าง)
                    // สะท้อนเฉพาะบริษัทที่เลือกไว้ ไม่ใช่นับรวมทุกบริษัทเสมอ
                    occupants: (room.occupants || []).filter(person => matchesCompanyFilter(person.company)),
                    siteCode: site.code,
                    buildingId: building.id,
                    buildingName: building.name,
                    floorName: floor.name || floor.code,
                    floorId: floor.id,
                    hasUnresolvedOccupancy: areaHasUnmatched
                }))
            );
            return {
                building,
                area: site.code,
                rooms,
                unmatched: buildingUnmatched,
                areaUnmatchedCount: unmatched.filter(employee =>
                    employee.workArea === site.code
                ).length
            };
        })
    );
    const rooms = buildings.flatMap(item => item.rooms);
    const rentable = room =>
        !['INACTIVE', 'COMMON_AREA', 'MAINTENANCE', 'RESERVED'].includes(room.status);

    return {
        buildings,
        rooms,
        occupied: rooms.filter(room => (room.occupants || []).length > 0),
        vacant: rooms.filter(room =>
            rentable(room) &&
            !(room.occupants || []).length &&
            !room.hasUnresolvedOccupancy
        ),
        pending: rooms.filter(room =>
            rentable(room) &&
            !(room.occupants || []).length &&
            room.hasUnresolvedOccupancy
        ),
        unavailable: rooms.filter(room =>
            !(room.occupants || []).length && !rentable(room)
        ),
        employees: accommodationState.records.filter(employee =>
            (selectedArea === 'ALL' || employee.workArea === selectedArea) &&
            matchesCompanyFilter(employee.company)
        ),
        unmatched
    };
}

function renderAccommodationDataPanel() {
    const panel = document.getElementById('accommodationDataPanel');
    const title = document.getElementById('accommodationDataTitle');
    const description = document.getElementById('accommodationDataDescription');
    const grid = document.getElementById('accommodationDataGrid');
    if (!panel || !title || !description || !grid) return;

    const data = getAccommodationSummaryItems();
    const view = accommodationState.activeSummaryView;
    const viewConfig = {
        buildings: ['จำนวนตึก', 'อาคารทั้งหมด 1 กล่องต่อ 1 ตึก', data.buildings, renderAccommodationBuildingCard],
        rooms: ['จำนวนห้อง', 'ห้องทั้งหมด 1 กล่องต่อ 1 ห้อง', data.rooms, renderAccommodationRoomCard],
        occupied: ['ห้องที่มีผู้พักอาศัย', 'ห้องที่มีผู้พักอาศัย 1 กล่องต่อ 1 ห้อง', data.occupied, renderAccommodationRoomCard],
        vacant: ['ห้องว่าง', 'ห้องว่างพร้อมใช้งาน 1 กล่องต่อ 1 ห้อง', data.vacant, renderAccommodationRoomCard],
        pending: ['ห้องรอยืนยันสถานะ', 'ห้องที่ยังสรุปว่าว่างไม่ได้เพราะมีพนักงานรอจับคู่ในพื้นที่', data.pending, renderAccommodationRoomCard],
        unavailable: ['ห้องไม่พร้อมใช้งาน', 'ห้องซ่อม จอง ปิดใช้งาน หรือพื้นที่ส่วนกลาง', data.unavailable, renderAccommodationRoomCard],
        employees: ['จำนวนพนักงาน', 'พนักงานจากข้อมูลต้นทาง 1 กล่องต่อ 1 คน', data.employees, renderAccommodationEmployeeCard],
        unmatched: ['รอตรวจสอบการจับคู่', 'พนักงานที่ยังจับคู่กับทะเบียนห้องไม่ได้', data.unmatched, renderAccommodationEmployeeCard]
    }[view] || ['จำนวนตึก', 'อาคารทั้งหมด 1 กล่องต่อ 1 ตึก', data.buildings, renderAccommodationBuildingCard];

    const [heading, helper, allItems, renderCard] = viewConfig;
    const items = view === 'buildings' ? allItems.filter(matchesHeaderFilter) : allItems;
    title.textContent = heading;
    description.textContent = `${helper} · พบ ${items.length.toLocaleString()} รายการ`;
    grid.replaceChildren();

    if (!items.length) {
        grid.innerHTML = '<div class="accommodation-data-empty">ไม่พบข้อมูลในหมวดนี้</div>';
        return;
    }

    items.forEach((item, index) => {
        const recordKey = `${view}-${index}`;
        const card = document.createElement('article');
        card.className = `accommodation-data-card${accommodationState.expandedSummaryRecord === recordKey ? ' is-expanded' : ''}`;
        card.innerHTML = renderCard(item, accommodationState.expandedSummaryRecord === recordKey);
        card.querySelector('[data-summary-card]')?.addEventListener('click', () => {
            accommodationState.expandedSummaryRecord = accommodationState.expandedSummaryRecord === recordKey ? null : recordKey;
            renderAccommodationDataPanel();
        });
        // ปุ่มตัวกรองในการ์ดตึก (จำนวนชั้น/ห้องทะเบียน/ห้องมีผู้พัก/ห้องว่าง/พนักงานจับคู่แล้ว/
        // พนักงานต้นทาง/รอตรวจสอบ) — เลือกได้พร้อมกันหลายปุ่ม ไม่ใช่แบบเลือกได้ทีละปุ่ม
        // คลิกปุ่มไหนก็เปิดการ์ดให้กางออกด้วยเลย เพื่อให้เห็นผลของตัวกรองทันที
        if (view === 'buildings') {
            card.querySelectorAll('[data-filter-key]').forEach(chip => {
                chip.addEventListener('click', () => {
                    const buildingId = chip.closest('[data-building-id]')?.dataset.buildingId;
                    const filters = accommodationState.buildingCardFilters.get(buildingId) ||
                        { floorGroup: true, otherStatus: true, occupied: true, vacant: true, unassigned: true };
                    const key = chip.dataset.filterKey;
                    filters[key] = !filters[key];
                    accommodationState.buildingCardFilters.set(buildingId, filters);
                    accommodationState.expandedSummaryRecord = recordKey;
                    renderAccommodationDataPanel();
                });
            });
        }
        grid.appendChild(card);
    });
}

// การ์ดตึกผ่านตัวกรองบนหัวหน้าหรือไม่ — นับพนักงานแบบเดียวกับในการ์ด (ต้นทาง หรือที่จับคู่ห้องแล้ว)
function matchesHeaderFilter(item) {
    const { building, area, rooms } = item;
    const sameBuilding = employee => employee.workArea === area &&
        normalizeBuildingName(employee.building) === normalizeBuildingName(building.name);
    const occupants = rooms.flatMap(room => room.occupants || []);
    const people = [...occupants, ...accommodationState.records.filter(sameBuilding)];
    const status = accommodationState.headerStatus;
    if (status === 'has' && !people.length) return false;
    if (status === 'empty' && people.length) return false;
    const query = window.AccommodationPeople.normalize(accommodationState.headerSearch);
    if (!query) return true;
    return [building.name, ...people.map(window.AccommodationPeople.personText)]
        .some(text => String(text || '').normalize('NFKC').toLowerCase().includes(query));
}

// ให้หัวหน้า (accommodation-header.js) สั่งกรองการ์ดตึกได้: { area, status, search }
window.applyAccommodationHeaderFilter = ({ area, status, search } = {}) => {
    if (area !== undefined) accommodationState.summaryAreaFilter = area === 'all' ? 'ALL' : area;
    if (status !== undefined) accommodationState.headerStatus = status;
    if (search !== undefined) accommodationState.headerSearch = search;
    accommodationState.activeSummaryView = 'buildings';
    accommodationState.expandedSummaryRecord = null;
    renderAccommodationDataPanel();
};

window.addEventListener('ro-data', () => {
    if (!accommodationState.summary) return;
    renderAccommodationDataPanel();
    renderRoomSearchResults();
});
