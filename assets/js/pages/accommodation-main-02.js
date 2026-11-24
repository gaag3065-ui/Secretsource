// accommodation.js ส่วนที่ 2/10 (บรรทัดเดิม 271–551) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
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
    accommodationState.summaryAreaFilter =
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

renderSummaryCompanyFilters();
renderSummaryAreaFilters();
renderEmployeeSummary();
renderAccommodationDataPanel();
renderRoomSearchResults();
renderPendingReviewBadge();
if (!document.getElementById('pendingReviewModal')?.hasAttribute('hidden')) {
    renderPendingReviewList();
}
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

// ค่า company ดิบจากชีตมีหลายรูปแบบย่อยในบริษัทเดียวกัน (เช่น "ACC 800","GA 800",
// "HR 800","CALL 800","Pretty Center" ล้วนเป็นบริษัท 800) — จัดกลุ่มด้วยตรรกะเดียวกับ
// normalizeAccommodationCompany() ฝั่งเซิร์ฟเวอร์ (server.js) เพื่อให้ได้ 5 บริษัทจริง
// ตามที่แจ้งไว้ (365,147,656,88S,800) ไม่ใช่โชว์ทุกรูปแบบย่อยแยกปุ่มกัน
function normalizeCompanyLabel(value) {
    const company = String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (company.includes('365')) return 'CALL 365';
    if (company.includes('656')) return 'CALL 656';
    if (company.includes('147')) return 'CALL 147';
    if (company.includes('88S')) return 'CALL 88s';
    if (company.includes('800') || company === 'PRETTY CENTER') return 'CALL 800';
    return '';
}

// ดึงรายชื่อบริษัทที่มีอยู่จริงในข้อมูลปัจจุบันแบบอัตโนมัติ (ไม่ hardcode รายชื่อ)
// ตอนนี้มี 5 บริษัท (365,147,656,88S,800) แต่ถ้าในอนาคตมีบริษัทใหม่ที่ตรรกะข้างต้นยังไม่
// รู้จักเพิ่มเข้ามาในชีต ก็จะถูกดึงมาแสดงเป็นปุ่มกรองใหม่ (ใช้ชื่อดิบ) ให้เองทันทีที่ซิงก์ข้อมูล
function getSummaryCompanyCodes() {
    return Array.from(new Set(
        accommodationState.records
            .map(employee => normalizeCompanyLabel(employee.company) || employee.company)
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
}

function renderSummaryCompanyFilters() {
    const container = document.getElementById('summaryCompanyFilters');
    if (!container) return;

    const companies = getSummaryCompanyCodes();
    // ตัดบริษัทที่หายไปจากข้อมูล (เช่น ถูกลบ/เปลี่ยนชื่อ) ออกจากตัวกรองที่เลือกไว้เดิม
    Array.from(accommodationState.summaryCompanyFilters).forEach(company => {
        if (!companies.includes(company)) accommodationState.summaryCompanyFilters.delete(company);
    });

    if (!companies.length) { container.innerHTML = ''; return; }

    container.innerHTML = companies.map(company => `
        <button type="button"
            class="summary-company-filter${accommodationState.summaryCompanyFilters.has(company) ? ' is-active' : ''}"
            data-summary-company="${escapeHtml(company)}"
            aria-pressed="${accommodationState.summaryCompanyFilters.has(company)}">
            ${escapeHtml(company)}
        </button>
    `).join('');

    container.querySelectorAll('[data-summary-company]').forEach(button => {
        button.addEventListener('click', () => {
            const company = button.dataset.summaryCompany;
            // สลับ toggle เข้า/ออกจากชุดที่เลือกไว้ — เลือกได้พร้อมกันหลายปุ่ม ไม่ใช่เลือกได้ทีละปุ่ม
            if (accommodationState.summaryCompanyFilters.has(company)) {
                accommodationState.summaryCompanyFilters.delete(company);
            } else {
                accommodationState.summaryCompanyFilters.add(company);
            }
            accommodationState.expandedSummaryRecord = null;
            renderSummaryCompanyFilters();
            renderEmployeeSummary();
            renderAccommodationDataPanel();
        });
    });
}

function getSummaryAreaCodes() {
    return Array.from(new Set([
        ...accommodationState.sites.map(site => site.code),
        ...accommodationState.records.map(employee => employee.workArea)
    ].filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'th', { numeric: true })
    );
}

function renderSummaryAreaFilters() {
    const container = document.getElementById('summaryAreaFilters');
    if (!container) return;

    const areas = getSummaryAreaCodes();
    if (
        accommodationState.summaryAreaFilter !== 'ALL' &&
        !areas.includes(accommodationState.summaryAreaFilter)
    ) {
        accommodationState.summaryAreaFilter = 'ALL';
    }

    container.innerHTML = [
        ['ALL', 'ทุกพื้นที่'],
        ...areas.map(area => [area, area])
    ].map(([value, label]) => `
        <button type="button"
            class="summary-area-filter${accommodationState.summaryAreaFilter === value ? ' is-active' : ''}"
            data-summary-area="${escapeHtml(value)}"
            aria-pressed="${accommodationState.summaryAreaFilter === value}">
            ${escapeHtml(label)}
        </button>
    `).join('');

    container.querySelectorAll('[data-summary-area]').forEach(button => {
        button.addEventListener('click', () => {
            accommodationState.summaryAreaFilter = button.dataset.summaryArea;
            accommodationState.expandedSummaryRecord = null;
            renderSummaryAreaFilters();
            renderEmployeeSummary();
            renderAccommodationDataPanel();
        });
    });
}
