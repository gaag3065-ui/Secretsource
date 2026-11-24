// accommodation.js ส่วนที่ 7/10 (บรรทัดเดิม 1468–1766) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
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
    const query = window.AccommodationPeople.normalize(input.value);
    if (!query) {
        container.textContent = 'พิมพ์คำค้นเพื่อดูและจัดการห้องทันที';
        return;
    }
    const rooms = allRegisteredRooms().filter(room => {
        const searchable = [room.code, room.name, room.siteCode, room.buildingName, room.floorName,
            ...(room.occupants || []).map(window.AccommodationPeople.personText)];
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
