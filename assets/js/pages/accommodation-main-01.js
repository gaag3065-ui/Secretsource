// accommodation.js ส่วนที่ 1/10 (บรรทัดเดิม 1–270) — โหลดเป็น classic script ตามลำดับ ใช้ตัวแปร/ฟังก์ชันร่วมกันกับส่วนอื่นเหมือนเดิม
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
    summaryAreaFilter: 'ALL',
    // ตัวกรองบริษัท (ชั้นเพิ่มเติมเหนือตัวกรองพื้นที่) — เลือกได้พร้อมกันหลายบริษัท
    // ว่างเปล่า = ไม่กรอง (แสดงทุกบริษัท) ดึงรายชื่อบริษัทอัตโนมัติจากข้อมูลจริงใน records
    summaryCompanyFilters: new Set(),
    // ตัวกรองภายในการ์ดแต่ละตึก (จำนวนชั้น/ห้องทะเบียน/ห้องมีผู้พัก/ห้องว่าง/พนักงาน
    // จับคู่แล้ว/พนักงานต้นทาง/รอตรวจสอบ) แยกสถานะต่อตึก คีย์ = building.id
    buildingCardFilters: new Map(),
    // ตัวกรองจากหัวหน้า (หัวแบบ Google Sheet ใน accommodation-header.js): มี/ไม่มีพนักงาน + คำค้น
    headerStatus: 'all',
    headerSearch: '',
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
    'accommodationReportModal',
    'pendingReviewModal'
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

    document.getElementById('syncAccommodationButton')
        ?.addEventListener('click', async event => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'กำลังซิงก์...';
            try {
                await syncInsuranceAccommodationData();
            } finally {
                button.disabled = false;
                button.textContent = 'ซิงก์ข้อมูลล่าสุด';
            }
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

    document.getElementById('pendingReviewButton')
        ?.addEventListener('click', openPendingReviewModal);
    document.getElementById('closePendingReviewModalButton')
        ?.addEventListener('click', () => closeExclusiveOverlay('pendingReviewModal'));
    document.getElementById('pendingReviewModal')
        ?.addEventListener('click', event => {
            if (event.target.id === 'pendingReviewModal') closeExclusiveOverlay('pendingReviewModal');
        });

    await loadAccommodationData();
applyAccommodationRoute();
    accommodationState.refreshTimer = window.setInterval(
        refreshAccommodationRealtime,
        5000
    );
});
