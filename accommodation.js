const accommodationRoute =
    new URLSearchParams(
        window.location.search
    );

const accommodationState = {
    records: [],
    sites: [],
    summary: null,
    unmatchedEmployees: [],
    selectedWorkArea: '',
    selectedBuilding: null,
    activeSummaryView: 'buildings',
    expandedSummaryRecord: null,
    buildingFilter: '',
    refreshTimer: null,
    refreshInProgress: false,
    returnOverlay: null,
    routeView:
        String(
            accommodationRoute.get('view') ||
            ''
        )
            .trim()
            .toLowerCase(),
    routeArea:
        String(
            accommodationRoute.get('area') ||
            ''
        )
            .trim()
            .toUpperCase()
};

const accommodationOverlayIds = [
    'managementModal',
    'imagePreviewModal',
    'accommodationReportModal'
];

function showExclusiveOverlay(id, options = {}) {
    const current = accommodationOverlayIds.find(overlayId =>
        overlayId !== id && !document.getElementById(overlayId)?.hasAttribute('hidden')
    );
    accommodationState.returnOverlay = options.returnToPrevious ? current || null : null;
    accommodationOverlayIds.forEach(overlayId => {
        document.getElementById(overlayId)?.toggleAttribute('hidden', overlayId !== id);
    });
    document.body.style.overflow = 'hidden';
}

function closeExclusiveOverlay(id) {
    document.getElementById(id)?.setAttribute('hidden', '');
    const returnId = accommodationState.returnOverlay;
    accommodationState.returnOverlay = null;
    if (returnId && document.getElementById(returnId)) {
        showExclusiveOverlay(returnId);
        return;
    }
    const stillOpen = accommodationOverlayIds.some(overlayId =>
        !document.getElementById(overlayId)?.hasAttribute('hidden')
    );
    document.body.style.overflow = stillOpen ? 'hidden' : '';
}

document.addEventListener('DOMContentLoaded', async () => {
 

//ป้องกัน STAFF พิมพ์ URL เข้า accommodation.html โดยตรง
//try {const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/auth/session);
//#region
    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/session`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || 'Session invalid'
            );
        }

        const role =
            String(data.user?.role || '')
                .trim()
                .toUpperCase();

        const permissions = data.permissions || {};

        const canManageAccommodation =
            role === 'ADMIN' ||
            permissions.ManageAccommodation === true;

        if (!canManageAccommodation) {
            alert(
                'บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบจัดการห้องพักพนักงาน'
            );

            window.location.replace('portal.html');
            return;
        }
    } catch (error) {
        console.error(
            'Accommodation permission error:',
            error
        );

        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }
//#endregion

    document
        .getElementById('backToPortalButton')
        ?.addEventListener('click', () => {
            window.location.href = 'portal.html';
        });

    document.getElementById('roomMaintenanceButton')
        ?.addEventListener('click', openMaintenanceOverview);
    document.getElementById('createBuildingButton')
        ?.addEventListener('click', openBuildingStructureForm);
    document.getElementById('roomSearchInput')
        ?.addEventListener('input', renderRoomSearchResults);
    document.getElementById('buildingFilterInput')
        ?.addEventListener('input', event => {
            accommodationState.buildingFilter = event.currentTarget.value.trim().toLocaleLowerCase('th');
renderWorkAreaNavigation(
    Array.from(
        new Set([
            ...accommodationState.sites.map(
                site => site.code
            ),
            ...accommodationState.records.map(
                employee => employee.workArea
            )
        ].filter(Boolean))
    )
        .filter(area =>
            !accommodationState.routeArea ||
            String(area)
                .trim()
                .toUpperCase() ===
            accommodationState.routeArea
        )
        .sort((a, b) =>
            a.localeCompare(
                b,
                'th',
                { numeric: true }
            )
        )
);
        });

    document
        .getElementById('accommodationReportButton')
        ?.addEventListener('click', async () => {
            await downloadAccommodationReports();
        });

    document
        .getElementById('closeBuildingDetailButton')
        ?.addEventListener('click', () => {
            document
                .getElementById('buildingDetailSection')
                ?.setAttribute('hidden', '');
            accommodationState.selectedBuilding = null;
const areas = Array.from(
    new Set([
        ...accommodationState.sites.map(
            site => site.code
        ),
        ...accommodationState.records.map(
            employee => employee.workArea
        )
    ].filter(Boolean))
)
    .filter(area =>
        !accommodationState.routeArea ||
        String(area)
            .trim()
            .toUpperCase() ===
        accommodationState.routeArea
    )
    .sort((a, b) =>
        a.localeCompare(
            b,
            'th',
            { numeric: true }
        )
    );

renderWorkAreaNavigation(areas);
        });

    document
        .getElementById('closeReportModalButton')
        ?.addEventListener('click', () => {
            closeAccommodationReport();
        });

    document
        .getElementById('accommodationReportModal')
        ?.addEventListener('click', (event) => {
            if (
                event.target.id ===
                'accommodationReportModal'
            ) {
                closeAccommodationReport();
            }
        });

    document.getElementById('closeManagementModalButton')
        ?.addEventListener('click', closeManagementModal);
    document.getElementById('managementModal')
        ?.addEventListener('click', event => {
            if (event.target.id === 'managementModal') closeManagementModal();
        });
    document.getElementById('closeImagePreviewButton')
        ?.addEventListener('click', closeImagePreview);
    document.getElementById('imagePreviewModal')
        ?.addEventListener('click', event => {
            if (event.target.id === 'imagePreviewModal') closeImagePreview();
        });

    await loadAccommodationData();
applyAccommodationRoute();
    accommodationState.refreshTimer = window.setInterval(
        refreshAccommodationRealtime,
        5000
    );
});

function applyAccommodationRoute() {
    window.requestAnimationFrame(() => {
        if (
            accommodationState.routeView ===
            'search'
        ) {
            const searchSection =
                document.querySelector(
                    '.room-search-section'
                );
            const searchInput =
                document.getElementById(
                    'roomSearchInput'
                );

            searchSection?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            searchInput?.focus({
                preventScroll: true
            });

            return;
        }

        if (accommodationState.routeArea) {
            document
                .getElementById(
                    'workAreaNavigation'
                )
                ?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
        }
    });
}

async function refreshAccommodationRealtime() {
    if (accommodationState.refreshInProgress || document.hidden) return;
    accommodationState.refreshInProgress = true;
    try {
        await loadAccommodationData({ silent: true });
    } finally {
        accommodationState.refreshInProgress = false;
    }
}

async function loadAccommodationData(options = {}) {
    const buildingGrid = document.getElementById('workAreaNavigation');

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-management/dashboard`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                'Unable to load accommodation data'
            );
        }

        accommodationState.records = result.records || [];
        accommodationState.sites = result.sites || [];
        accommodationState.summary = result.summary || null;
        accommodationState.unmatchedEmployees =
            result.unmatchedEmployees || [];

        const registeredAreas = accommodationState.sites
            .filter(site => Array.isArray(site.buildings))
            .map(site => site.code);

        const sourceAreas = accommodationState.records.map(
            employee => employee.workArea
        );

        const workAreas = Array.from(
            new Set([...registeredAreas, ...sourceAreas].filter(Boolean))
        ).sort((a, b) =>
            a.localeCompare(b, 'th', { numeric: true })
        );

const matchedRouteArea =
    accommodationState.routeArea
        ? workAreas.find(area =>
            String(area)
                .trim()
                .toUpperCase() ===
            accommodationState.routeArea
        )
        : null;

if (matchedRouteArea) {
    accommodationState.selectedWorkArea =
        matchedRouteArea;
} else if (
    !workAreas.includes(
        accommodationState.selectedWorkArea
    )
) {
    accommodationState.selectedWorkArea =
        workAreas[0] || '';
}

const visibleWorkAreas = matchedRouteArea
    ? [matchedRouteArea]
    : workAreas;

renderEmployeeSummary();
renderAccommodationDataPanel();
renderRoomSearchResults();
        if (accommodationState.selectedBuilding) {
            const refreshed = accommodationState.sites
                .flatMap(site => site.buildings || [])
                .find(building => building.id === accommodationState.selectedBuilding.id);
            if (refreshed) renderRegisteredBuildingDetails(refreshed, { scroll: !options.silent });
        }
    } catch (error) {
        console.error(
            'Load accommodation error:',
            error
        );

        if (buildingGrid) {
            buildingGrid.innerHTML = `
                <div class="empty-state">
                    ไม่สามารถโหลดข้อมูลห้องพักได้<br>
                    ${escapeHtml(error.message)}
                </div>
            `;
        }
    }
}

async function syncInsuranceAccommodationData(options = {}) {
    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/accommodation-management/sync-insurance`,
            { method: 'POST' }
        );

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'ซิงก์ข้อมูลไม่สำเร็จ');
        }

        if (!options.silent) {
            alert(
                `ซิงก์พนักงาน ${result.employeeCount} คน\n` +
                `จับคู่ห้องแล้ว ${result.matchedCount} คน\n` +
                `รอตรวจสอบ ${result.unmatchedCount} คน`
            );
        }

        if (options.reload !== false) await loadAccommodationData({ silent: true });
    } catch (error) {
        console.error('Accommodation sync error:', error);
        if (!options.silent) alert(`ไม่สามารถซิงก์ข้อมูลได้: ${error.message}`);
    }
}

function renderEmployeeSummary() {
    const summary =
        document.getElementById('employeeSummary');

    if (!summary) return;

    const sourceMetrics = accommodationState.sites.reduce((totals, site) => {
        (site.buildings || []).forEach((building) => {
            const metrics = getBuildingSourceMetrics(building, site.code);
            const registeredRooms = (building.floors || []).reduce(
                (roomTotal, floor) => roomTotal + (floor.rooms || []).length,
                0
            );
            totals.buildingCount += 1;
            totals.roomCount += registeredRooms;
            totals.occupiedRoomCount += metrics.occupiedRoomCount;
            totals.vacantRoomCount += metrics.vacantRoomCount;
        });
        return totals;
    }, {
        buildingCount: 0,
        roomCount: 0,
        occupiedRoomCount: 0,
        vacantRoomCount: 0
    });
    const items = [
        ['buildings', 'จำนวนตึก', sourceMetrics.buildingCount],
        ['rooms', 'จำนวนห้อง', sourceMetrics.roomCount],
        ['occupied', 'ห้องที่มีผู้พักอาศัย', sourceMetrics.occupiedRoomCount],
        ['vacant', 'ห้องว่าง', sourceMetrics.vacantRoomCount],
        ['employees', 'จำนวนพนักงาน', accommodationState.summary?.employeeCount ?? accommodationState.records.length]
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

function getAccommodationSummaryItems() {
    const buildings = accommodationState.sites.flatMap(site =>
        (site.buildings || []).map(building => ({
            building,
            area: site.code,
            rooms: (building.floors || []).flatMap(floor =>
                (floor.rooms || []).map(room => ({
                    ...room,
                    siteCode: site.code,
                    buildingName: building.name,
                    floorName: floor.name || floor.code
                }))
            )
        }))
    );
    const rooms = buildings.flatMap(item => item.rooms);
    const rentable = room => !['INACTIVE', 'COMMON_AREA', 'MAINTENANCE', 'RESERVED'].includes(room.status);

    return {
        buildings,
        rooms,
        occupied: rooms.filter(room => (room.occupants || []).length > 0),
        vacant: rooms.filter(room => rentable(room) && !(room.occupants || []).length),
        employees: accommodationState.records
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
        employees: ['จำนวนพนักงาน', 'พนักงานทั้งหมด 1 กล่องต่อ 1 คน', data.employees, renderAccommodationEmployeeCard]
    }[view] || ['จำนวนตึก', 'อาคารทั้งหมด 1 กล่องต่อ 1 ตึก', data.buildings, renderAccommodationBuildingCard];

    const [heading, helper, items, renderCard] = viewConfig;
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
        grid.appendChild(card);
    });
}

function renderAccommodationBuildingCard(item, expanded) {
    const { building, area, rooms } = item;
    const source = getBuildingSourceMetrics(building, area);
    const occupied = rooms.filter(room => (room.occupants || []).length > 0).length;
    const vacant = rooms.filter(room => !['INACTIVE', 'COMMON_AREA', 'MAINTENANCE', 'RESERVED'].includes(room.status) && !(room.occupants || []).length).length;
    return `
        <button type="button" class="accommodation-data-card-toggle" data-summary-card aria-expanded="${expanded}">
            <span class="accommodation-card-icon" aria-hidden="true">⌂</span>
            <span class="accommodation-card-title"><b>${escapeHtml(building.name)}</b><small>${escapeHtml(area)} · ${rooms.length.toLocaleString()} ห้อง · ${source.employeeCount.toLocaleString()} พนักงาน</small></span>
            <span class="accommodation-card-state">${expanded ? '⌃' : '⌄'}</span>
        </button>
        <div class="accommodation-card-details">
            <div><span>จำนวนชั้น</span><b>${(building.floors || []).length.toLocaleString()}</b></div>
            <div><span>จำนวนห้อง</span><b>${rooms.length.toLocaleString()}</b></div>
            <div><span>ห้องที่มีผู้พัก</span><b>${occupied.toLocaleString()}</b></div>
            <div><span>ห้องว่าง</span><b>${vacant.toLocaleString()}</b></div>
            <div><span>จำนวนพนักงาน</span><b>${source.employeeCount.toLocaleString()}</b></div>
        </div>`;
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
                const searchable = [area, item.name, ...(item.employees || []).flatMap(employee => [employee.employeeName, employee.employeeId])]
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

function renderBuildingCards() {
    const buildingGrid =
        document.getElementById('buildingGrid');

    if (!buildingGrid) return;

    buildingGrid.replaceChildren();

    const registeredSite = accommodationState.sites.find(
        site => site.code === accommodationState.selectedWorkArea
    );

    if (registeredSite?.buildings?.length) {
        renderRegisteredBuildingCards(
            buildingGrid,
            registeredSite.buildings
        );
        return;
    }

    const areaRecords =
        accommodationState.records.filter(
            employee =>
                employee.workArea ===
                accommodationState.selectedWorkArea
        );





    const buildingGroups = groupBy(
        areaRecords,
        employee => employee.building
    );

    const buildingNames =
        Object.keys(buildingGroups).sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    'th',
                    { numeric: true }
                )
        );

    if (buildingNames.length === 0) {
        buildingGrid.innerHTML = `
            <div class="empty-state">
                ไม่พบข้อมูลตึกพักในพื้นที่นี้
            </div>
        `;

        return;
    }

    buildingNames.forEach((buildingName) => {
        const employees =
            buildingGroups[buildingName];

        const floorCount = new Set(
            employees.map(item => item.floor)
        ).size;

        const roomCount = new Set(
            employees.map(
                item => `${item.floor}::${item.room}`
            )
        ).size;

        const card = document.createElement('article');
        card.className = 'building-card';
        card.tabIndex = 0;

        card.innerHTML = `
            <div class="building-graphic">
                <div class="building-shape"></div>
            </div>

            <div class="building-card-content">
                <span class="building-name">
                    ${escapeHtml(buildingName)}
                </span>

                <div class="building-meta">
                    <span>
                        ${floorCount} Floors ·
                        ${roomCount} Rooms
                    </span>

                    <span class="employee-count">
                        ${employees.length} Employees
                    </span>
                </div>
            </div>
        `;

        const openBuilding = () => {
            renderBuildingDetails(
                buildingName,
                employees
            );
        };

        card.addEventListener('click', openBuilding);

        card.addEventListener('keydown', (event) => {
            if (
                event.key === 'Enter' ||
                event.key === ' '
            ) {
                event.preventDefault();
                openBuilding();
            }
        });

        buildingGrid.appendChild(card);
    });
}

function renderRegisteredBuildingCards(container, buildings) {
    buildings.forEach((building) => {
        const summary = building.summary;
        const source = getBuildingSourceMetrics(building);
        const card = document.createElement('article');
        card.className = 'building-card';
        card.tabIndex = 0;

        const declared = summary.declaredRooms === null
            ? 'ไม่ระบุ'
            : summary.declaredRooms.toLocaleString();

        card.innerHTML = `
            <div class="building-graphic">
                <div class="building-shape"></div>
            </div>
            <div class="building-card-content">
                <span class="building-name">
                    ${escapeHtml(building.name)}
                </span>
                <div class="building-stat-grid">
                    <span>ห้องตามทะเบียน <b>${summary.registeredRooms}</b></span>
                    <span>ห้องทั้งหมด <b>${declared}</b></span>
                    <span>มีผู้พัก <b>${summary.occupiedRooms}</b></span>
                    <span>ห้องว่าง <b>${summary.vacantRooms}</b></span>
                    <span>พนักงานต้นทาง <b>${source.employeeCount}</b></span>
                    <span>เตียงว่าง <b>${summary.availableBeds}</b></span>
                </div>
                ${source.employeeCount !== summary.people ? `<div class="registration-warning">ในทะเบียนห้องจับคู่แล้ว ${summary.people} คน · รอตรวจสอบ ${Math.abs(source.employeeCount - summary.people)} คน</div>` : ''}
                ${summary.unregisteredRooms > 0 ? `
                    <div class="registration-warning">
                        ยังไม่ได้ลงทะเบียน ${summary.unregisteredRooms} ห้อง
                    </div>
                ` : ''}
            </div>
        `;

        const openBuilding = () =>
            renderRegisteredBuildingDetails(building);

        card.addEventListener('click', openBuilding);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openBuilding();
            }
        });
        container.appendChild(card);
    });
}

function renderRegisteredBuildingDetails(building, options = {}) {
    const section = document.getElementById('buildingDetailSection');
    const title = document.getElementById('selectedBuildingTitle');
    const summary = document.getElementById('selectedBuildingSummary');
    const container = document.getElementById('floorRoomContainer');

    if (!section || !title || !summary || !container) return;

    accommodationState.selectedBuilding = building;
    section.removeAttribute('hidden');
    title.textContent = building.name;
    summary.textContent =
        `${accommodationState.selectedWorkArea} · ` +
        `${building.floors.length} Floors · ` +
        `${building.summary.registeredRooms} Registered Rooms · ` +
        `${building.summary.vacantRooms} Vacant Rooms · ` +
        `${building.summary.people} Employees`;

    container.replaceChildren();

    const overview = document.createElement('div');
    overview.innerHTML = `
        <div class="building-kpis">
            <article>พนักงานทั้งหมด<b>${building.summary.people}</b></article>
            <article>ห้องทั้งหมด<b>${building.summary.registeredRooms}</b></article>
            <article>ห้องว่าง<b>${building.summary.vacantRooms}</b></article>
            <article>งานซ่อมค้าง<b>${building.summary.maintenanceOpenCount || 0}</b></article>
            <article>ค่าซ่อมรวม<b>${formatMoney(building.summary.repairCostTotal || 0)}</b></article>
            <article>ค่าใช้จ่ายเดือนนี้<b>${formatMoney(building.summary.currentMonthExpenseTotal || 0)}</b></article>
        </div>
        ${renderBuildingAlerts(building.summary.alerts || [])}
        <div class="building-toolbar">
            <button type="button" class="button button-primary" data-action="expense">ลงข้อมูลบิลค่าใช้จ่าย</button>
            <button type="button" class="button button-secondary" data-action="contract">บันทึกร่างสัญญา</button>
            <button type="button" class="button button-secondary" data-action="edit-building">แก้ไขอาคาร</button>
            <button type="button" class="button button-secondary" data-action="delete-building">ยกเลิกอาคาร</button>
            <button type="button" class="button button-secondary" data-action="additional">กรอกรายละเอียดเพิ่มเติม</button>
        </div>
        ${renderContractPanel(building.contracts || [])}
        ${renderExpensePanel(building.expenses || [])}
    `;
    overview.querySelector('[data-action="expense"]')?.addEventListener('click', () => openExpenseForm(building));
    overview.querySelector('[data-action="contract"]')?.addEventListener('click', () => openContractForm(building));
    overview.querySelector('[data-action="edit-building"]')?.addEventListener('click', () => openBuildingEditForm(building));
    overview.querySelector('[data-action="delete-building"]')?.addEventListener('click', async () => {
        if (!confirm('ยืนยันยกเลิกอาคารนี้? ทำได้เฉพาะเมื่อไม่มีพนักงานพักอยู่')) return;
        await accommodationRequest(`/buildings/${building.id}`, { method: 'DELETE' });
        accommodationState.selectedBuilding = null;
        document.getElementById('buildingDetailSection')?.setAttribute('hidden', '');
        await loadAccommodationData({ silent: true });
    });
    overview.querySelector('[data-action="additional"]')?.addEventListener('click', () => alert('เตรียมช่องสำหรับรายละเอียดเพิ่มเติมแล้ว โดยจะกำหนดชนิดข้อมูลเมื่อได้รับข้อกำหนดจากผู้ใช้'));
    overview.querySelectorAll('[data-verify-contract]').forEach(button => button.addEventListener('click', async event => {
        if (!confirm('ยืนยันว่าตรวจข้อความกับสัญญาต้นฉบับแล้วทุกช่อง?')) return;
        await accommodationRequest(`/contracts/${event.currentTarget.dataset.verifyContract}/verification`, { method: 'POST', body: JSON.stringify({ decision: 'VERIFIED' }) });
        await loadAccommodationData({ silent: true });
    }));
    overview.querySelectorAll('[data-reject-contract]').forEach(button => button.addEventListener('click', async event => {
        if (!confirm('ปฏิเสธร่างสัญญานี้?')) return;
        await accommodationRequest(`/contracts/${event.currentTarget.dataset.rejectContract}/verification`, { method: 'POST', body: JSON.stringify({ decision: 'REJECTED' }) });
        await loadAccommodationData({ silent: true });
    }));
    overview.querySelectorAll('[data-edit-contract]').forEach(button => button.addEventListener('click', event => {
        const contract = (building.contracts || []).find(item => item.id === event.currentTarget.dataset.editContract);
        openContractForm(building, contract);
    }));
    overview.querySelectorAll('[data-delete-contract]').forEach(button => button.addEventListener('click', async event => {
        if (!confirm('ยืนยันยกเลิกสัญญานี้? ระบบจะเก็บประวัติไว้และไม่ลบถาวร')) return;
        await accommodationRequest(`/contracts/${event.currentTarget.dataset.deleteContract}`, { method: 'DELETE' });
        await loadAccommodationData({ silent: true });
    }));
    overview.querySelectorAll('[data-edit-expense]').forEach(button => {
        const expense = (building.expenses || []).find(item => item.id === button.dataset.editExpense);
        button.addEventListener('click', () => openExpenseForm(building, expense));
    });
    overview.querySelectorAll('[data-delete-expense]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('ยืนยันลบรายการค่าใช้จ่ายนี้? ระบบจะเก็บประวัติการลบไว้')) return;
            await accommodationRequest(`/expenses/${button.dataset.deleteExpense}`, { method: 'DELETE' });
            await loadAccommodationData({ silent: true });
        });
    });
    container.appendChild(overview);

    building.floors.forEach((floor) => {
        const floorSection = document.createElement('section');
        floorSection.className = 'floor-section';

        const floorTitle = document.createElement('h3');
        const people = floor.rooms.reduce(
            (total, room) => total + room.occupants.length,
            0
        );
        floorTitle.className = 'floor-title';
        floorTitle.textContent =
            `Floor ${floor.name || floor.code} · ` +
            `${floor.rooms.length} Rooms · ${people} Employees`;

        const roomGrid = document.createElement('div');
        roomGrid.className = 'room-grid';

        floor.rooms.forEach((room) => {
            const roomCard = document.createElement('article');
            roomCard.className = 'room-card';
            if (room.occupants.length === 0) {
                roomCard.classList.add('room-card-vacant');
            }

            const rows = room.occupants.length
                ? room.occupants.map(occupant => `
                    <tr>
                        <td>${escapeHtml(occupant.company)}</td>
                        <td><div class="occupant-cell"><span>${escapeHtml(occupant.employeeName)}</span><button type="button" class="mini-button" data-move-employee="${escapeHtml(occupant.employeeId)}">แก้ไข</button></div></td>
                    </tr>
                `).join('')
                : `
                    <tr>
                        <td colspan="2" class="vacant-room-label">
                            ห้องว่าง
                        </td>
                    </tr>
                `;

            roomCard.innerHTML = `
                <div class="room-title">
                    <span>Room ${escapeHtml(room.name || room.code)} · ${room.occupants.length}/${room.capacity} คน</span>
                    <span class="room-actions"><button type="button" class="mini-button" data-edit-room="${escapeHtml(room.id)}">แก้ไข</button><button type="button" class="mini-button" data-delete-room="${escapeHtml(room.id)}">ลบ</button><button type="button" class="mini-button" data-repair-room="${escapeHtml(room.id)}">แจ้งซ่อม</button></span>
                </div>
                <table class="room-table">
                    <thead><tr><th>Company</th><th>Employee</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
            roomCard.querySelector('[data-repair-room]')?.addEventListener('click', () => openMaintenanceForm(room));
            roomCard.querySelector('[data-edit-room]')?.addEventListener('click', () => openRoomEditForm(room));
            roomCard.querySelector('[data-delete-room]')?.addEventListener('click', async () => {
                if (!confirm(`ยืนยันยกเลิกห้อง ${room.name || room.code}?`)) return;
                await accommodationRequest(`/rooms/${room.id}`, { method: 'DELETE' });
                await loadAccommodationData({ silent: true });
            });
            roomCard.querySelectorAll('[data-move-employee]').forEach(button => {
                const occupant = room.occupants.find(item => item.employeeId === button.dataset.moveEmployee);
                button.addEventListener('click', () => openMovementForm(occupant, room));
            });
            roomGrid.appendChild(roomCard);
        });

        floorSection.appendChild(floorTitle);
        floorSection.appendChild(roomGrid);
        container.appendChild(floorSection);
    });

    section.removeAttribute('hidden');
    if (options.scroll !== false) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderContractPanel(contracts) {
    if (!contracts.length) {
        return `<section class="contract-panel"><h3>สรุปสัญญาเช่า</h3><p>ยังไม่มีข้อมูลสัญญาที่ผ่านการตรวจสอบ จึงยังไม่นำผล OCR มาแสดงเป็นข้อเท็จจริง</p><span class="review-badge">รอตรวจสอบโดยบุคคล</span></section>`;
    }
    return contracts.map(contract => `<section class="contract-panel">
        <h3>สรุปสัญญาเช่า <span class="review-badge">${escapeHtml(contract.verificationStatus)}</span></h3>
        <div class="contract-grid">
            <span>บริษัท: <b>${escapeHtml(contract.tenantCompanyCode || '-')}</b></span>
            <span>ยูนิต: <b>${escapeHtml(contract.unitReference || '-')}</b></span>
            <span>ผู้ให้เช่า: <b>${escapeHtml(contract.lessorName || '-')}</b></span>
            <span>ผู้เช่า: <b>${escapeHtml(contract.lesseeName || '-')}</b></span>
            <span>ผู้ลงนาม: <b>${escapeHtml(contract.signerName || '-')}</b></span>
            <span>ที่อยู่: <b>${escapeHtml(contract.propertyAddress || '-')}</b></span>
            <span>เริ่มเช่า: <b>${formatDate(contract.leaseStartDate)}</b></span>
            <span>สิ้นสุด: <b>${formatDate(contract.leaseEndDate)}</b></span>
            <span>ค่าเช่า: <b>${formatMoney(contract.monthlyRent)}</b></span>
            <span>เงินประกัน: <b>${formatMoney(contract.securityDeposit)}</b></span>
            <span>จำนวนยูนิต: <b>${contract.unitCount ?? '-'}</b></span>
            <span>เครื่องปรับอากาศ: <b>${contract.airConditionerCount ?? '-'}</b></span>
        </div>
        ${contract.importantTerms ? `<p>${escapeHtml(contract.importantTerms)}</p>` : ''}
        <div class="building-toolbar">
            <button type="button" class="mini-button" data-edit-contract="${escapeHtml(contract.id)}">แก้ไข</button>
            <button type="button" class="mini-button" data-delete-contract="${escapeHtml(contract.id)}">ยกเลิกสัญญา</button>
            ${contract.verificationStatus === 'REVIEW_REQUIRED' ? `<button type="button" class="mini-button" data-verify-contract="${escapeHtml(contract.id)}">ยืนยันว่าตรวจต้นฉบับแล้ว</button><button type="button" class="mini-button" data-reject-contract="${escapeHtml(contract.id)}">ปฏิเสธร่าง</button>` : ''}
        </div>
    </section>`).join('');
}

function renderBuildingAlerts(alerts) {
    if (!alerts.length) return '<div class="integrity-ok">ไม่พบความผิดปกติที่ต้องดำเนินการ</div>';
    return `<section class="alert-panel"><h3>รายการที่ต้องตรวจสอบ</h3>${alerts.map(alert => `
        <div class="integrity-alert severity-${escapeHtml(String(alert.severity).toLowerCase())}">
            <b>${escapeHtml(alert.message)}</b><span>${Number(alert.count).toLocaleString()} รายการ</span>
        </div>`).join('')}</section>`;
}

function renderExpensePanel(expenses) {
    if (!expenses.length) return '<section class="contract-panel"><h3>ประวัติค่าใช้จ่าย</h3><p>ยังไม่มีรายการ</p></section>';
    const rows = expenses.slice(0, 20).map(item => `<tr>
        <td>${formatDate(item.expenseDate)}</td><td>${escapeHtml(item.expenseType)}</td>
        <td>${formatMoney(item.amount)}</td><td>${escapeHtml(item.description || '-')}</td>
        <td><button type="button" class="mini-button" data-edit-expense="${escapeHtml(item.id)}">แก้ไข</button> <button type="button" class="mini-button" data-delete-expense="${escapeHtml(item.id)}">ลบ</button></td>
    </tr>`).join('');
    return `<section class="contract-panel"><h3>ประวัติค่าใช้จ่าย</h3><div class="report-table-wrapper"><table class="report-table"><thead><tr><th>วันที่</th><th>ประเภท</th><th>จำนวนเงิน</th><th>รายละเอียด</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function openManagementModal(title, fields, onSubmit) {
    const modal = document.getElementById('managementModal');
    const form = document.getElementById('managementForm');
    document.getElementById('managementModalTitle').textContent = title;
    form.innerHTML = fields;
    form.onsubmit = async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        if (submit) submit.disabled = true;
        try {
            await onSubmit(Object.fromEntries(new FormData(form).entries()));
            closeManagementModal();
            await loadAccommodationData({ silent: true });
        }
        catch (error) { alert(error.message); }
        finally { if (submit) submit.disabled = false; }
    };
    showExclusiveOverlay('managementModal');
}

function closeManagementModal() {
    document.querySelectorAll('.maintenance-thumbnail img').forEach(image => {
        if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
    });
    closeExclusiveOverlay('managementModal');
}

async function accommodationRequest(path, options = {}) {
    const response = await window.authFetch(`${window.APP_CONFIG.API_BASE_URL}/api/accommodation-management${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || 'บันทึกข้อมูลไม่สำเร็จ');
    return result;
}

function allRegisteredRooms() {
    return accommodationState.sites.flatMap(site => (site.buildings || []).flatMap(building =>
        (building.floors || []).flatMap(floor => (floor.rooms || []).map(room => ({
            ...room,
            siteCode: site.code,
            buildingName: building.name,
            floorName: floor.name || floor.code
        })))
    ));
}

function renderRoomSearchResults() {
    const input = document.getElementById('roomSearchInput');
    const container = document.getElementById('roomSearchResults');
    if (!input || !container) return;
    const query = input.value.trim().toLocaleLowerCase('th');
    if (!query) {
        container.textContent = 'พิมพ์คำค้นเพื่อดูและจัดการห้องทันที';
        return;
    }
    const rooms = allRegisteredRooms().filter(room => {
        const searchable = [room.code, room.name, room.siteCode, room.buildingName, room.floorName,
            ...(room.occupants || []).flatMap(person => [person.employeeName, person.employeeId])];
        return searchable.some(value => String(value || '').toLocaleLowerCase('th').includes(query));
    }).slice(0, 30);
    if (!rooms.length) {
        container.innerHTML = '<div class="empty-state">ไม่พบห้อง อาคาร หรือผู้เข้าพักที่ตรงกับคำค้น</div>';
        return;
    }
    container.innerHTML = rooms.map(room => {
        const occupants = room.occupants || [];
        const occupantSummary = occupants.length
            ? `ผู้พัก: ${occupants.slice(0, 2).map(person => `${escapeHtml(person.employeeName)} (${escapeHtml(person.employeeId)})`).join(', ')}${occupants.length > 2 ? ` +${occupants.length - 2}` : ''}`
            : '<span class="room-vacant">ห้องว่าง</span>';
        return `
        <article class="room-search-result room-search-result-compact">
            <strong>ห้อง ${escapeHtml(room.name || room.code)}</strong>
            <p>${escapeHtml(room.siteCode)} · ${escapeHtml(room.buildingName)} · ชั้น ${escapeHtml(room.floorName)}</p>
            <div class="room-occupants">${occupantSummary}</div>
            <div class="room-result-actions">
                <button type="button" class="mini-button" data-search-edit="${escapeHtml(room.id)}">แก้ไข</button>
                <button type="button" class="mini-button" data-search-repair="${escapeHtml(room.id)}">แจ้งซ่อม</button>
                <button type="button" class="mini-button" data-search-cancel="${escapeHtml(room.id)}">ยกเลิกเช่า</button>
            </div>
        </article>`;
    }).join('');
    container.querySelectorAll('[data-search-edit]').forEach(button =>
        button.addEventListener('click', () => openRoomEditForm(rooms.find(room => room.id === button.dataset.searchEdit)))
    );
    container.querySelectorAll('[data-search-repair]').forEach(button =>
        button.addEventListener('click', () => openMaintenanceForm(rooms.find(room => room.id === button.dataset.searchRepair)))
    );
    container.querySelectorAll('[data-search-cancel]').forEach(button =>
        button.addEventListener('click', () => openRoomCancellationForm(rooms.find(room => room.id === button.dataset.searchCancel)))
    );
}

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
    `, data => accommodationRequest('/employee-movements', { method: 'POST', body: JSON.stringify({ ...data, employeeId: occupant.employeeId }) }));
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

//function renderBuildingDetails(
//#region
function renderBuildingDetails(
    buildingName,
    employees
) {
    const section = document.getElementById(
        'buildingDetailSection'
    );

    const title = document.getElementById(
        'selectedBuildingTitle'
    );

    const summary = document.getElementById(
        'selectedBuildingSummary'
    );

    const container = document.getElementById(
        'floorRoomContainer'
    );

    if (!section || !title || !summary || !container) {
        return;
    }

    accommodationState.selectedBuilding = null;
    section.removeAttribute('hidden');

    title.textContent = buildingName;

    const floorGroups = groupBy(
        employees,
        employee => employee.floor
    );

    const floorNames = Object.keys(floorGroups).sort(
        (a, b) =>
            a.localeCompare(
                b,
                'th',
                { numeric: true }
            )
    );

    const roomTotal = new Set(
        employees.map(
            employee =>
                `${employee.floor}::${employee.room}`
        )
    ).size;

    summary.textContent =
        `${accommodationState.selectedWorkArea} · ` +
        `${floorNames.length} Floors · ` +
        `${roomTotal} Rooms · ` +
        `${employees.length} Employees`;

    container.replaceChildren();

    floorNames.forEach((floorName) => {
        const floorEmployees =
            floorGroups[floorName];

        const floorSection =
            document.createElement('section');

        floorSection.className = 'floor-section';

        const floorTitle =
            document.createElement('h3');

        floorTitle.className = 'floor-title';
        floorTitle.textContent =
            `Floor ${floorName} · ` +
            `${floorEmployees.length} Employees`;

        const roomGrid =
            document.createElement('div');

        roomGrid.className = 'room-grid';

        const roomGroups = groupBy(
            floorEmployees,
            employee => employee.room
        );

        const roomNames =
            Object.keys(roomGroups).sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        'th',
                        { numeric: true }
                    )
            );

        roomNames.forEach((roomName) => {
            const roomEmployees =
                roomGroups[roomName].sort(
                    (a, b) =>
                        a.company.localeCompare(
                            b.company,
                            'th'
                        ) ||
                        a.employeeName.localeCompare(
                            b.employeeName,
                            'th'
                        )
                );

            const roomCard =
                document.createElement('article');

            roomCard.className = 'room-card';

            const rows = roomEmployees
                .map((employee) => `
                    <tr>
                        <td>
                            ${escapeHtml(employee.company)}
                        </td>

                        <td>
                            ${escapeHtml(
                                employee.employeeName
                            )}
                        </td>
                    </tr>
                `)
                .join('');

            roomCard.innerHTML = `
                <div class="room-title">
                    Room ${escapeHtml(roomName)}
                    · ${roomEmployees.length} Employees
                </div>

                <table class="room-table">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Employee Name</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;

            roomGrid.appendChild(roomCard);
        });

        floorSection.appendChild(floorTitle);
        floorSection.appendChild(roomGrid);
        container.appendChild(floorSection);
    });

    section.removeAttribute('hidden');

    if (window.innerWidth <= 900) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}
//#endregion


//function groupBy(items, getKey) {
//#region
function groupBy(items, getKey) {
    return items.reduce((groups, item) => {
        const key = String(getKey(item) || '-');

        if (!groups[key]) {
            groups[key] = [];
        }

        groups[key].push(item);
        return groups;
    }, {});
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
//#endregion

//function openAccommodationReport() {
//#region
function openAccommodationReport() {
    const modal = document.getElementById(
        'accommodationReportModal'
    );

    const reportBody = document.getElementById(
        'accommodationReportBody'
    );

    if (!modal || !reportBody) return;

    reportBody.replaceChildren();

    const companyGroups = groupBy(
        accommodationState.records,
        employee => employee.company
    );

    const companyNames =
        Object.keys(companyGroups).sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    'th',
                    { numeric: true }
                )
        );

    if (companyNames.length === 0) {
        const emptyRow =
            document.createElement('tr');

        const emptyCell =
            document.createElement('td');

        emptyCell.colSpan = 6;
        emptyCell.textContent =
            'No accommodation data';

        emptyRow.appendChild(emptyCell);
        reportBody.appendChild(emptyRow);
    }

    companyNames.forEach((companyName) => {
        const employees =
            companyGroups[companyName].sort(
                (a, b) =>
                    a.workArea.localeCompare(
                        b.workArea,
                        'th',
                        { numeric: true }
                    ) ||
                    a.building.localeCompare(
                        b.building,
                        'th',
                        { numeric: true }
                    ) ||
                    a.floor.localeCompare(
                        b.floor,
                        'th',
                        { numeric: true }
                    ) ||
                    a.room.localeCompare(
                        b.room,
                        'th',
                        { numeric: true }
                    ) ||
                    a.employeeName.localeCompare(
                        b.employeeName,
                        'th'
                    )
            );

        employees.forEach((employee, index) => {
            const row = document.createElement('tr');

            if (index === 0) {
                row.classList.add(
                    'company-group-start'
                );

                const companyCell =
                    document.createElement('td');

                companyCell.rowSpan =
                    employees.length;

                companyCell.className =
                    'report-company-cell';

                companyCell.textContent =
                    `${companyName} ` +
                    `(${employees.length})`;

                row.appendChild(companyCell);
            }

            [
                employee.employeeName,
                employee.workArea,
                employee.building,
                employee.floor,
                employee.room
            ].forEach((value) => {
                const cell =
                    document.createElement('td');

                cell.textContent = value || '-';
                row.appendChild(cell);
            });

            reportBody.appendChild(row);
        });
    });

    showExclusiveOverlay('accommodationReportModal');
}

function closeAccommodationReport() {
    const modal = document.getElementById(
        'accommodationReportModal'
    );

    closeExclusiveOverlay('accommodationReportModal');
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (!document.getElementById('imagePreviewModal')?.hasAttribute('hidden')) closeImagePreview();
        else if (!document.getElementById('managementModal')?.hasAttribute('hidden')) closeManagementModal();
        else if (!document.getElementById('accommodationReportModal')?.hasAttribute('hidden')) closeAccommodationReport();
    }
});
//#endregion

//#region downloadAccommodationReports — ดาวน์โหลดรายงานห้องพักแยกบริษัท
async function downloadAccommodationReports() {
    const button =
        document.getElementById('accommodationReportButton');

    try {
        if (button?.disabled) return;

        if (button) {
            button.disabled = true;
            button.textContent = 'กำลังสร้างรายงาน...';
        }

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/accommodation/reports`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || 'ไม่สามารถสร้างรายงานได้'
            );
        }

        if (!Array.isArray(result.files) || !result.files.length) {
            throw new Error('ไม่พบข้อมูลพนักงาน ON WORK สำหรับสร้างรายงาน');
        }

        for (const file of result.files) {
            const binaryText = atob(file.contentBase64);
            const bytes = new Uint8Array(binaryText.length);

            for (let index = 0; index < binaryText.length; index += 1) {
                bytes[index] = binaryText.charCodeAt(index);
            }

            const blob = new Blob(
                [bytes],
                {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            );

            const fileUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');

            downloadLink.href = fileUrl;
            downloadLink.download = file.fileName;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();

            setTimeout(() => {
                URL.revokeObjectURL(fileUrl);
            }, 1000);

            await new Promise(resolve => {
                setTimeout(resolve, 350);
            });
        }

        alert(
            `สร้างรายงานสำเร็จ ${result.fileCount} ไฟล์\n` +
            `ประจำเดือน ${result.reportMonth} ${result.reportYear}`
        );
    } catch (error) {
        console.error('Download accommodation reports error:', error);
        alert(`ไม่สามารถสร้างรายงานได้: ${error.message}`);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'จัดทำรายงานส่งส่วนกลาง';
        }
    }
}
//#endregion downloadAccommodationReports
