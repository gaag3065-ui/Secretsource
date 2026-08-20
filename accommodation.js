const accommodationState = {
    records: [],
    selectedWorkArea: ''
};

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
            String(data.user?.role || '').toUpperCase();

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

    document
        .getElementById('accommodationReportButton')
        ?.addEventListener('click', () => {
            openAccommodationReport();
        });

    document
        .getElementById('closeBuildingDetailButton')
        ?.addEventListener('click', () => {
            document
                .getElementById('buildingDetailSection')
                ?.setAttribute('hidden', '');
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

    await loadAccommodationData();
});

async function loadAccommodationData() {
    const buildingGrid =
        document.getElementById('buildingGrid');

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/accommodation`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                'Unable to load accommodation data'
            );
        }

        accommodationState.records = result.records || [];

        const workAreas = Array.from(
            new Set(
                accommodationState.records.map(
                    employee => employee.workArea
                )
            )
        ).sort((a, b) =>
            a.localeCompare(b, 'th', { numeric: true })
        );

        accommodationState.selectedWorkArea =
            workAreas[0] || '';

        renderEmployeeSummary();
        renderWorkAreaNavigation(workAreas);
        renderBuildingCards();
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

function renderEmployeeSummary() {
    const summary =
        document.getElementById('employeeSummary');

    if (!summary) return;

    const employees =
        accommodationState.records.length;

    const buildings = new Set(
        accommodationState.records.map(
            item =>
                `${item.workArea}::${item.building}`
        )
    ).size;

    summary.textContent =
        `${employees.toLocaleString()} Employees · ` +
        `${buildings.toLocaleString()} Buildings`;
}

function renderWorkAreaNavigation(workAreas) {
    const navigation =
        document.getElementById('workAreaNavigation');

    if (!navigation) return;

    navigation.replaceChildren();

    workAreas.forEach((area) => {
        const count =
            accommodationState.records.filter(
                item => item.workArea === area
            ).length;

        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'area-button';
        button.textContent =
            `${area} (${count.toLocaleString()})`;

        if (
            area ===
            accommodationState.selectedWorkArea
        ) {
            button.classList.add('is-active');
        }

        button.addEventListener('click', () => {
            accommodationState.selectedWorkArea = area;

            navigation
                .querySelectorAll('.area-button')
                .forEach(item =>
                    item.classList.remove('is-active')
                );

            button.classList.add('is-active');

            document
                .getElementById('buildingDetailSection')
                ?.setAttribute('hidden', '');

            renderBuildingCards();
        });

        navigation.appendChild(button);
    });
}

function renderBuildingCards() {
    const buildingGrid =
        document.getElementById('buildingGrid');

    if (!buildingGrid) return;

    buildingGrid.replaceChildren();

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

    section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
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

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
}

function closeAccommodationReport() {
    const modal = document.getElementById(
        'accommodationReportModal'
    );

    modal?.setAttribute('hidden', '');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAccommodationReport();
    }
});
//#endregion

