// accommodation.js ส่วนที่ 6/10 (บรรทัดเดิม 1297–1467) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
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
