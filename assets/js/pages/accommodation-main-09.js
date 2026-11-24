// accommodation.js ส่วนที่ 9/10 (บรรทัดเดิม 2054–2250) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
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
