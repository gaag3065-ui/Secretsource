// โครงสร้างการทำงานระบบ Asset
//#region 'use strict';
'use strict';

const assetState = {
    page: 1,
    limit: 25,
    totalPages: 1,
    loading: false,

    masterData: {
        companies: [],
        statuses: [],
        categories: [],
        workAreas: []
    },
    currentAsset: null,
    scanner: {
        stream: null,
        detector: null,
        frameRequest: null,
        active: false
    },

    audit: {
        assetId: null,
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        loading: false
    }
};

document.addEventListener('DOMContentLoaded', initializeAssetPage);

async function initializeAssetPage() {
    try {
        await window.requirePagePermission('ViewAssets');

        bindAssetEvents();
        applyAssetPermissions();

        await loadAssetMasterData();
        await Promise.all([
            loadAssets(),
            loadAssetSummary()
        ]);
    } catch (error) {
        console.error('Asset page initialization error:', error);
    }
}

function bindAssetEvents() {
    document
        .getElementById('assetSearchForm')
        ?.addEventListener('submit', async (event) => {
            event.preventDefault();
            assetState.page = 1;
            await loadAssets();
        });

    document
        .getElementById('clearAssetFilterButton')
        ?.addEventListener('click', async () => {
            document.getElementById('assetSearchForm')?.reset();
            assetState.page = 1;
            await loadAssets();
        });

    document
        .getElementById('backToPortalButton')
        ?.addEventListener('click', () => {
            window.location.href = 'portal.html';
        });

    document
        .getElementById('assetLogoutButton')
        ?.addEventListener('click', logoutAssetUser);

        document
        .getElementById('createAssetButton')
        ?.addEventListener('click', openCreateAssetModal);

    document
        .getElementById('closeCreateAssetModalButton')
        ?.addEventListener('click', closeCreateAssetModal);

    document
        .getElementById('cancelCreateAssetButton')
        ?.addEventListener('click', closeCreateAssetModal);

    document
        .querySelector('[data-close-asset-modal]')
        ?.addEventListener('click', closeCreateAssetModal);

    document
        .getElementById('newAssetStatus')
        ?.addEventListener('change', updateStatusDetailVisibility);

    document
        .getElementById('createAssetForm')
        ?.addEventListener('submit', submitCreateAssetForm);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCreateAssetModal();
        }
    });
    document
    .getElementById('manageAssetLocationsButton')
    ?.addEventListener('click', openAssetLocationModal);

    document
        .getElementById('closeAssetLocationModalButton')
        ?.addEventListener('click', closeAssetLocationModal);

    document
        .getElementById('cancelAssetLocationButton')
        ?.addEventListener('click', closeAssetLocationModal);

    document
        .querySelector('[data-close-location-modal]')
        ?.addEventListener('click', closeAssetLocationModal);

    document
    .getElementById('closeAssetDetailButton')
    ?.addEventListener('click', closeAssetDetailModal);

    document
        .querySelector('[data-close-asset-detail]')
        ?.addEventListener('click', closeAssetDetailModal);

    document
    .getElementById('transferAssetButton')
    ?.addEventListener(
        'click',
        openAssetTransferModal
    );

document
    .getElementById('closeAssetTransferModalButton')
    ?.addEventListener(
        'click',
        closeAssetTransferModal
    );

document
    .getElementById('cancelAssetTransferButton')
    ?.addEventListener(
        'click',
        closeAssetTransferModal
    );

document
    .querySelector('[data-close-transfer-modal]')
    ?.addEventListener(
        'click',
        closeAssetTransferModal
    );

document
    .getElementById('assetTransferForm')
    ?.addEventListener(
        'submit',
        submitAssetTransferForm
    );

    document
    .getElementById('assetAttachmentForm')
    ?.addEventListener(
        'submit',
        submitAssetAttachmentForm
    );

document
    .getElementById('transferWorkArea')
    ?.addEventListener('change', async (event) => {
        resetLocationSelect(
            'transferBuilding',
            '-- เลือกอาคารหรือสถานที่ --'
        );

        resetLocationSelect(
            'transferRoom',
            '-- เลือกชั้นหรือห้อง --'
        );

        resetLocationSelect(
            'transferCoordinate',
            '-- เลือกพิกัด เช่น A12 --'
        );

        await loadChildLocations(
            event.target.value,
            'transferBuilding',
            '-- เลือกอาคารหรือสถานที่ --'
        );
    });

document
    .getElementById('transferBuilding')
    ?.addEventListener('change', async (event) => {
        resetLocationSelect(
            'transferRoom',
            '-- เลือกชั้นหรือห้อง --'
        );

        resetLocationSelect(
            'transferCoordinate',
            '-- เลือกพิกัด เช่น A12 --'
        );

        await loadChildLocations(
            event.target.value,
            'transferRoom',
            '-- เลือกชั้นหรือห้อง --'
        );
    });

document
    .getElementById('transferRoom')
    ?.addEventListener('change', async (event) => {
        resetLocationSelect(
            'transferCoordinate',
            '-- เลือกพิกัด เช่น A12 --'
        );

        await loadChildLocations(
            event.target.value,
            'transferCoordinate',
            '-- เลือกพิกัด เช่น A12 --'
        );
    });

    document
    .getElementById('changeAssetStatusButton')
    ?.addEventListener('click', openAssetStatusModal);

    document
        .getElementById('closeAssetStatusModalButton')
        ?.addEventListener('click', closeAssetStatusModal);

    document
        .getElementById('cancelAssetStatusButton')
        ?.addEventListener('click', closeAssetStatusModal);

    document
        .querySelector('[data-close-status-modal]')
        ?.addEventListener('click', closeAssetStatusModal);

    document
        .getElementById('statusModalNewStatus')
        ?.addEventListener(
            'change',
            updateStatusModalDetailVisibility
        );

    document
        .getElementById('assetStatusForm')
        ?.addEventListener('submit', submitAssetStatusForm);

    document
    .getElementById('uploadAssetFileButton')
    ?.addEventListener('click', openAssetAttachmentModal);

    document
        .getElementById('closeAssetAttachmentModalButton')
        ?.addEventListener('click', closeAssetAttachmentModal);

    document
        .getElementById('cancelAssetAttachmentButton')
        ?.addEventListener('click', closeAssetAttachmentModal);

    document
        .querySelector('[data-close-attachment-modal]')
        ?.addEventListener('click', closeAssetAttachmentModal);

    document
        .getElementById('assetAttachmentFile')
        ?.addEventListener('change', previewAssetAttachment);

    document
        .getElementById('editAssetButton')
        ?.addEventListener('click', () => {
            alert('ขั้นต่อไปจะสร้างระบบแก้ไขข้อมูล');
        });

    document
        .getElementById('locationMasterWorkArea')
        ?.addEventListener('change', async (event) => {
            resetLocationSelect(
                'locationMasterBuilding',
                '-- เลือกอาคาร --'
            );

            resetLocationSelect(
                'locationMasterRoom',
                '-- เลือกชั้นหรือห้อง --'
            );

            await loadMasterLocationChildren(
                event.target.value,
                'locationMasterBuilding',
                '-- เลือกอาคาร --'
            );
        });

    document
        .getElementById('locationMasterBuilding')
        ?.addEventListener('change', async (event) => {
            resetLocationSelect(
                'locationMasterRoom',
                '-- เลือกชั้นหรือห้อง --'
            );

            await loadMasterLocationChildren(
                event.target.value,
                'locationMasterRoom',
                '-- เลือกชั้นหรือห้อง --'
            );
        });

    document
        .getElementById('assetLocationForm')
        ?.addEventListener('submit', submitAssetLocationForm);

    document
        .getElementById('scanAssetButton')
        ?.addEventListener('click', openAssetScanner);

    document
        .getElementById('closeAssetScannerButton')
        ?.addEventListener('click', closeAssetScanner);

    document
        .getElementById('cancelAssetScannerButton')
        ?.addEventListener('click', closeAssetScanner);

    document
        .querySelector('[data-close-asset-scanner]')
        ?.addEventListener('click', closeAssetScanner);

    document
        .getElementById('assetScannerManualForm')
        ?.addEventListener('submit', submitManualAssetCode);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) closeAssetScanner();
    });

    document.addEventListener('keydown', (event) => {
        if (
            event.key === 'Escape' &&
            !document.getElementById('assetScannerModal')?.hidden
        ) {
            closeAssetScanner();
        }
    });

    document
    .getElementById('newAssetLocation')
    ?.addEventListener('change', async (event) => {
        resetLocationSelect(
            'newAssetBuilding',
            '-- เลือกอาคารหรือสถานที่ --'
        );
        resetLocationSelect(
            'newAssetRoom',
            '-- เลือกชั้นหรือห้อง --'
        );
        resetLocationSelect(
            'newAssetCoordinate',
            '-- เลือกพิกัด เช่น A12 --'
        );

        await loadChildLocations(
            event.target.value,
            'newAssetBuilding',
            '-- เลือกอาคารหรือสถานที่ --'
        );
    });

    document
        .getElementById('newAssetBuilding')
        ?.addEventListener('change', async (event) => {
            resetLocationSelect(
                'newAssetRoom',
                '-- เลือกชั้นหรือห้อง --'
            );
            resetLocationSelect(
                'newAssetCoordinate',
                '-- เลือกพิกัด เช่น A12 --'
            );

            await loadChildLocations(
                event.target.value,
                'newAssetRoom',
                '-- เลือกชั้นหรือห้อง --'
            );
        });

    document
        .getElementById('newAssetRoom')
        ?.addEventListener('change', async (event) => {
            resetLocationSelect(
                'newAssetCoordinate',
                '-- เลือกพิกัด เช่น A12 --'
            );

            await loadChildLocations(
                event.target.value,
                'newAssetCoordinate',
                '-- เลือกพิกัด เช่น A12 --'
            );
        });
        document
    .getElementById('loadMoreAssetAuditButton')
    ?.addEventListener('click', async () => {
        if (assetState.audit.loading) return;

        if (
            assetState.audit.page >=
            assetState.audit.totalPages
        ) {
            return;
        }

        assetState.audit.page += 1;

        await loadAssetAuditTrail(
            assetState.audit.assetId,
            {
                append: true
            }
        );
    });
    // #region Event สำหรับหน้าต่างขยายรูปภาพทรัพย์สิน


document
    .getElementById('closeAssetImageLightboxButton')
    ?.addEventListener('click', closeAssetImageLightbox);

document
    .querySelector('[data-close-asset-image]')
    ?.addEventListener('click', closeAssetImageLightbox);

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const lightbox =
        document.getElementById('assetImageLightbox');

    if (lightbox && !lightbox.hidden) {
        closeAssetImageLightbox();
    }
});

// #endregion


}

async function openAssetScanner() {
    const modal = document.getElementById('assetScannerModal');
    const manualInput =
        document.getElementById('assetScannerManualInput');

    if (!modal) return;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');
    if (manualInput) manualInput.value = '';

    if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia
    ) {
        setAssetScannerMessage(
            'อุปกรณ์นี้เปิดกล้องจากหน้าเว็บไม่ได้ กรุณากรอกรหัสด้านล่าง',
            'error'
        );
        manualInput?.focus();
        return;
    }

    if (!('BarcodeDetector' in window)) {
        setAssetScannerMessage(
            'เบราว์เซอร์นี้ยังไม่รองรับการอ่านรหัสอัตโนมัติ กรุณากรอกรหัสด้านล่าง',
            'error'
        );
        manualInput?.focus();
        return;
    }

    setAssetScannerMessage('กำลังขอสิทธิ์ใช้งานกล้อง…', 'loading');

    try {
        const supportedFormats =
            await window.BarcodeDetector.getSupportedFormats();
        const preferredFormats = [
            'qr_code',
            'code_128',
            'code_39',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'itf',
            'data_matrix'
        ].filter((format) => supportedFormats.includes(format));

        assetState.scanner.detector =
            new window.BarcodeDetector(
                preferredFormats.length
                    ? { formats: preferredFormats }
                    : undefined
            );

        assetState.scanner.stream =
            await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

        const video = document.getElementById('assetScannerVideo');
        video.srcObject = assetState.scanner.stream;
        await video.play();

        assetState.scanner.active = true;
        setAssetScannerMessage(
            'วางรหัสให้อยู่ในกรอบ ระบบจะค้นหาให้อัตโนมัติ',
            'success'
        );
        scanAssetVideoFrame();
    } catch (error) {
        console.error('Asset scanner error:', error);
        stopAssetScannerCamera();
        setAssetScannerMessage(
            getAssetScannerErrorMessage(error),
            'error'
        );
        manualInput?.focus();
    }
}

async function scanAssetVideoFrame() {
    if (!assetState.scanner.active) return;

    const video = document.getElementById('assetScannerVideo');

    try {
        if (video?.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const results =
                await assetState.scanner.detector.detect(video);
            const value = String(results?.[0]?.rawValue || '').trim();

            if (value) {
                assetState.scanner.active = false;
                applyScannedAssetCode(value);
                return;
            }
        }
    } catch (error) {
        console.error('Asset barcode detection error:', error);
    }

    assetState.scanner.frameRequest =
        window.setTimeout(scanAssetVideoFrame, 250);
}

function submitManualAssetCode(event) {
    event.preventDefault();

    const value = String(
        document.getElementById('assetScannerManualInput')?.value || ''
    ).trim();

    if (!value) {
        setAssetScannerMessage(
            'กรุณากรอกรหัสก่อนค้นหา',
            'error'
        );
        return;
    }

    applyScannedAssetCode(value);
}

function applyScannedAssetCode(value) {
    const searchInput = document.getElementById('assetSearchInput');

    if (!searchInput) return;

    searchInput.value = value.slice(0, 150);
    closeAssetScanner();
    assetState.page = 1;
    document.getElementById('assetSearchForm')?.requestSubmit();
}

function closeAssetScanner() {
    const modal = document.getElementById('assetScannerModal');

    stopAssetScannerCamera();

    if (!modal || modal.hidden) return;

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');

    if (!document.querySelector('.asset-modal:not([hidden])')) {
        document.body.classList.remove('asset-modal-open');
    }

    document.getElementById('scanAssetButton')?.focus();
}

function stopAssetScannerCamera() {
    assetState.scanner.active = false;

    if (assetState.scanner.frameRequest !== null) {
        window.clearTimeout(assetState.scanner.frameRequest);
        assetState.scanner.frameRequest = null;
    }

    assetState.scanner.stream
        ?.getTracks()
        .forEach((track) => track.stop());

    assetState.scanner.stream = null;
    assetState.scanner.detector = null;

    const video = document.getElementById('assetScannerVideo');

    if (video) {
        video.pause();
        video.srcObject = null;
    }
}

function setAssetScannerMessage(message, status = '') {
    const element = document.getElementById('assetScannerMessage');

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}

function getAssetScannerErrorMessage(error) {
    if (error?.name === 'NotAllowedError') {
        return 'ไม่ได้รับสิทธิ์ใช้กล้อง กรุณาอนุญาตกล้องหรือกรอกรหัสด้านล่าง';
    }

    if (error?.name === 'NotFoundError') {
        return 'ไม่พบกล้องบนอุปกรณ์นี้ กรุณากรอกรหัสด้านล่าง';
    }

    if (error?.name === 'NotReadableError') {
        return 'กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปนั้นแล้วลองใหม่';
    }

    return 'เปิดเครื่องสแกนไม่สำเร็จ กรุณากรอกรหัสด้านล่าง';
}

function applyAssetPermissions() {
    const permissions = window.USER_PERMISSIONS || {};

    const createButton =
        document.getElementById('createAssetButton');

    if (createButton) {
        createButton.hidden =
            permissions.CreateAssets !== true;
    }

    const locationButton =
        document.getElementById('manageAssetLocationsButton');

    if (locationButton) {
        locationButton.hidden =
            permissions.ManageAssetMasters !== true;
    }

}

async function loadAssetMasterData() {
    const response = await window.authFetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/assets/master-data`,
        {
            method: 'GET',
            cache: 'no-store'
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(
            data.message || 'ไม่สามารถโหลดข้อมูลตัวเลือกได้'
        );
    }

    assetState.masterData = data.masterData;

    fillSelect(
        'assetCompanyFilter',
        data.masterData.companies,
        'ทุกบริษัท',
        'code'
    );

    fillSelect(
        'assetStatusFilter',
        data.masterData.statuses,
        'ทุกสถานะ',
        'code'
    );

    fillSelect(
        'assetWorkAreaFilter',
        data.masterData.workAreas,
        'ทุกพื้นที่',
        'id'
    );

    fillSelect(
    'newAssetCompany',
    data.masterData.companies,
    '-- เลือกบริษัท --',
    'code'
    );

    fillSelect(
        'newAssetCategory',
        data.masterData.categories,
        '-- เลือกประเภท --',
        'id'
    );

    fillSelect(
        'newAssetLocation',
        data.masterData.workAreas,
        '-- เลือกพื้นที่ --',
        'id'
    );

    fillSelect(
    'transferWorkArea',
    data.masterData.workAreas,
    '-- เลือกพื้นที่ --',
    'id'
    );

    fillSelect(
        'newAssetStatus',
        data.masterData.statuses,
        '-- เลือกสถานะ --',
        'code'
    );

    fillSelect(
    'locationMasterWorkArea',
    data.masterData.workAreas,
    '-- เลือกพื้นที่ --',
    'id'
    );

    fillSelect(
    'statusModalNewStatus',
    data.masterData.statuses,
    '-- เลือกสถานะใหม่ --',
    'code'
    );
}

function fillSelect(elementId, items, firstLabel, valueKey) {
    const select = document.getElementById(elementId);
    if (!select) return;

    select.replaceChildren();

    const firstOption = document.createElement('option');
    firstOption.value = '';
    firstOption.textContent = firstLabel;
    select.appendChild(firstOption);

    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = item.name
            ? `${item.code} — ${item.name}`
            : item.code;

        select.appendChild(option);
    });
}

async function loadAssets() {
    if (assetState.loading) return;

    assetState.loading = true;
    setAssetStatus('กำลังโหลดข้อมูลทรัพย์สิน...', 'loading');

    try {
        const query = createAssetQuery();

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets?${query}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'ไม่สามารถโหลดรายการทรัพย์สินได้'
            );
        }

        assetState.page = data.pagination.page;
        assetState.totalPages =
            Math.max(1, data.pagination.totalPages);

        renderAssetTable(data.items);
        renderAssetCards(data.items);
        renderAssetPagination(data.pagination);

        document.getElementById('assetEmptyState').hidden =
            data.items.length !== 0;

        setAssetStatus(
            `พบทรัพย์สิน ${formatNumber(data.pagination.total)} รายการ`,
            'success'
        );
    } catch (error) {
        console.error(error);
        renderAssetTable([]);
        renderAssetCards([]);
        setAssetStatus(error.message, 'error');
    } finally {
        assetState.loading = false;
    }
}

function createAssetQuery(overrides = {}) {
    const parameters = new URLSearchParams();

    const values = {
        search:
            document.getElementById('assetSearchInput')
                ?.value.trim() || '',
        companyCode:
            document.getElementById('assetCompanyFilter')
                ?.value || '',
        statusCode:
            document.getElementById('assetStatusFilter')
                ?.value || '',
        locationId:
            document.getElementById('assetWorkAreaFilter')
                ?.value || '',
        page: assetState.page,
        limit: assetState.limit,
        ...overrides
    };

    Object.entries(values).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            parameters.set(key, String(value));
        }
    });

    return parameters.toString();
}

function renderAssetTable(items) {
    const tbody = document.getElementById('assetTableBody');
    if (!tbody) return;

    tbody.replaceChildren();

    items.forEach((asset) => {
        const row = document.createElement('tr');

        appendCell(row, asset.asset_code);
        appendCell(row, asset.asset_name);
        appendCell(
            row,
            asset.company_name || asset.company_code
        );
        appendStatusCell(
            row,
            asset.status_name,
            asset.status_code
        );
        appendCell(
            row,
            asset.location_name || asset.location_code
        );
        appendCell(
            row,
            asset.assigned_employee_name || '-'
        );
        appendCell(row, formatDateTime(asset.updated_at));

        const actionCell = document.createElement('td');
        const viewButton = document.createElement('button');

        viewButton.type = 'button';
        viewButton.className = 'asset-row-action';
        viewButton.textContent = 'ดูรายละเอียด';
        viewButton.addEventListener('click', () => {
            openAssetDetail(asset.id);
        });

        actionCell.appendChild(viewButton);
        row.appendChild(actionCell);
        tbody.appendChild(row);
    });
}

function renderAssetCards(items) {
    const container = document.getElementById('assetCardList');
    if (!container) return;

    container.replaceChildren();

    items.forEach((asset) => {
        const card = document.createElement('article');
        card.className = 'asset-mobile-card';

        const heading = document.createElement('div');
        heading.className = 'asset-mobile-heading';

        const code = document.createElement('strong');
        code.textContent = asset.asset_code || '-';

        const status = createStatusBadge(
            asset.status_name,
            asset.status_code
        );

        heading.append(code, status);

        const name = document.createElement('h3');
        name.textContent = asset.asset_name || '-';

        const details = document.createElement('dl');

        appendCardDetail(
            details,
            'บริษัท',
            asset.company_name || asset.company_code
        );
        appendCardDetail(
            details,
            'ตำแหน่ง',
            asset.location_name || asset.location_code
        );
        appendCardDetail(
            details,
            'ผู้ถือครอง',
            asset.assigned_employee_name || '-'
        );
        appendCardDetail(
            details,
            'แก้ไขล่าสุด',
            formatDateTime(asset.updated_at)
        );

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'asset-card-action';
        button.textContent = 'ดูรายละเอียด';
        button.addEventListener('click', () => {
            openAssetDetail(asset.id);
        });

        card.append(heading, name, details, button);
        container.appendChild(card);
    });
}

function appendCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value || '-';
    row.appendChild(cell);
}

function appendStatusCell(row, statusName, statusCode) {
    const cell = document.createElement('td');
    cell.appendChild(createStatusBadge(statusName, statusCode));
    row.appendChild(cell);
}

function createStatusBadge(statusName, statusCode) {
    const badge = document.createElement('span');
    badge.className =
        `asset-status-badge status-${String(statusCode || '')
            .toLowerCase()
            .replaceAll('_', '-')}`;

    badge.textContent = statusName || statusCode || '-';
    return badge;
}

function appendCardDetail(container, label, value) {
    const term = document.createElement('dt');
    term.textContent = label;

    const description = document.createElement('dd');
    description.textContent = value || '-';

    container.append(term, description);
}

function renderAssetPagination(pagination) {
    const container = document.getElementById('assetPagination');
    if (!container) return;

    container.replaceChildren();

    if (pagination.totalPages <= 1) return;

    const previousButton = createPaginationButton(
        'ก่อนหน้า',
        pagination.page - 1,
        pagination.page <= 1
    );

    const pageText = document.createElement('span');
    pageText.className = 'asset-page-status';
    pageText.textContent =
        `หน้า ${pagination.page} จาก ${pagination.totalPages}`;

    const nextButton = createPaginationButton(
        'ถัดไป',
        pagination.page + 1,
        pagination.page >= pagination.totalPages
    );

    container.append(previousButton, pageText, nextButton);
}

function createPaginationButton(label, targetPage, disabled) {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;

    button.addEventListener('click', async () => {
        assetState.page = targetPage;
        await loadAssets();
        document.querySelector('.asset-content')
            ?.scrollIntoView({ behavior: 'smooth' });
    });

    return button;
}

async function loadAssetSummary() {
    try {
        const [
            allAssets,
            inUseAssets,
            spareAssets,
            disposedAssets
        ] = await Promise.all([
            fetchAssetTotal(),
            fetchAssetTotal('IN_USE'),
            fetchAssetTotal('SPARE'),
            fetchAssetTotal('DISPOSED')
        ]);

        setText('totalAssetCount', formatNumber(allAssets));
        setText('inUseAssetCount', formatNumber(inUseAssets));
        setText('spareAssetCount', formatNumber(spareAssets));

        const attention =
            Math.max(
                0,
                allAssets -
                inUseAssets -
                spareAssets -
                disposedAssets
            );

        setText(
            'attentionAssetCount',
            formatNumber(attention)
        );
    } catch (error) {
        console.error('Asset summary error:', error);

        [
            'totalAssetCount',
            'inUseAssetCount',
            'spareAssetCount',
            'attentionAssetCount'
        ].forEach((id) => setText(id, '-'));
    }
}

async function fetchAssetTotal(statusCode = '') {
    const query = new URLSearchParams({
        page: '1',
        limit: '1'
    });

    if (statusCode) {
        query.set('statusCode', statusCode);
    }

    const response = await window.authFetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/assets?${query}`,
        {
            method: 'GET',
            cache: 'no-store'
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || 'โหลดจำนวนทรัพย์สินไม่สำเร็จ');
    }

    return Number(data.pagination.total) || 0;
}

async function openAssetDetail(assetId) {
    const modal =
        document.getElementById('assetDetailModal');

    if (!modal) return;

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');

    setAssetDetailMessage(
        'กำลังโหลดรายละเอียดทรัพย์สิน...',
        'loading'
    );

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/${encodeURIComponent(assetId)}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'ไม่สามารถโหลดรายละเอียดได้'
            );
        }

        renderAssetDetail(data.asset);
        applyAssetDetailPermissions();
        setAssetDetailMessage('');
        await loadAssetAttachments(data.asset.id);

        await loadAssetAuditTrail(
            data.asset.id
        );
    } catch (error) {
        console.error('Asset detail error:', error);
        setAssetDetailMessage(error.message, 'error');
    }
}

function closeAssetDetailModal() {
    const modal =
        document.getElementById('assetDetailModal');

    if (!modal || modal.hidden) return;

    if (
        modal.contains(document.activeElement) &&
        typeof document.activeElement.blur === 'function'
    ) {
        document.activeElement.blur();
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('asset-modal-open');
    setAssetDetailMessage('');
    assetState.audit.assetId = null;
    assetState.audit.page = 1;
    assetState.audit.total = 0;
    assetState.audit.totalPages = 0;
    assetState.audit.loading = false;

    document
        .getElementById('assetAuditList')
        ?.replaceChildren();

    setText('assetAuditTotal', '0 รายการ');
    setAssetAuditMessage('');
}

function renderAssetDetail(asset) {
    assetState.currentAsset = asset;
    setText('detailAssetCode', asset.asset_code || '-');
    setText('detailAssetName', asset.asset_name || '-');

    setText(
        'detailAssetCompany',
        asset.company_name || asset.company_code || '-'
    );

    const category =
        assetState.masterData.categories.find(
            (item) => item.id === asset.category_id
        );

    setText(
        'detailAssetCategory',
        category
            ? `${category.code} — ${category.name}`
            : '-'
    );

    setText('detailAssetBarcode', asset.barcode || '-');

    setText(
        'detailAssetBrandModel',
        [asset.brand, asset.model]
            .filter(Boolean)
            .join(' / ') || '-'
    );

    setText(
        'detailAssetSerial',
        asset.serial_number || '-'
    );

    setText(
        'detailAssetLocation',
        asset.location_name ||
        asset.location_code ||
        '-'
    );

    setText(
        'detailAssetEmployee',
        [
            asset.assigned_employee_id,
            asset.assigned_employee_name
        ]
            .filter(Boolean)
            .join(' — ') || '-'
    );

    setText(
        'detailAssetPurchaseDate',
        formatDate(asset.purchase_date)
    );

    setText(
        'detailAssetPurchasePrice',
        formatMoney(
            asset.purchase_price,
            asset.currency
        )
    );

    setText(
        'detailAssetStatusDetail',
        asset.status_detail || '-'
    );

    setText(
        'detailAssetUpdatedAt',
        formatDateTime(asset.updated_at)
    );

    setText('detailAssetNote', asset.note || '-');

    const statusElement =
        document.getElementById('detailAssetStatus');

    if (statusElement) {
        statusElement.className =
            `asset-status-badge status-${String(
                asset.status_code || ''
            )
                .toLowerCase()
                .replaceAll('_', '-')}`;

        statusElement.textContent =
            asset.status_name ||
            asset.status_code ||
            '-';
    }

    const modal = document.getElementById('assetDetailModal');

    if (modal) {
        modal.dataset.assetId = asset.id;
        modal.dataset.recordVersion =
            String(asset.record_version || 1);
    }
}

function applyAssetDetailPermissions() {
    const permissions = window.USER_PERMISSIONS || {};

    setButtonPermission(
        'transferAssetButton',
        permissions.TransferAssets === true
    );

    setButtonPermission(
        'changeAssetStatusButton',
        permissions.ChangeAssetStatus === true
    );

    setButtonPermission(
        'uploadAssetFileButton',
        permissions.UploadAssetFiles === true
    );

    setButtonPermission(
        'editAssetButton',
        permissions.UpdateAssets === true
    );
}

function setButtonPermission(buttonId, allowed) {
    const button = document.getElementById(buttonId);

    if (button) {
        button.hidden = !allowed;
    }
}

function setAssetDetailMessage(message, status = '') {
    const element =
        document.getElementById('assetDetailMessage');

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}

function formatDate(value) {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium'
    }).format(date);
}

function formatMoney(value, currency = 'THB') {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '-';
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) return '-';

    try {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: currency || 'THB'
        }).format(amount);
    } catch {
        return `${formatNumber(amount)} ${currency || 'THB'}`;
    }
}

async function logoutAssetUser() {
    const confirmed = confirm('ต้องการออกจากระบบใช่หรือไม่?');
    if (!confirmed) return;

    try {
        await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/logout`,
            { method: 'POST' }
        );
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        sessionStorage.clear();
        window.location.replace('index.html');
    }
}

function setAssetStatus(message, type = '') {
    const element = document.getElementById('assetStatusMessage');
    if (!element) return;

    element.textContent = message;
    element.dataset.status = type;
}

function setText(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
}

function formatNumber(value) {
    return new Intl.NumberFormat('th-TH').format(
        Number(value) || 0
    );
}

function formatDateTime(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
}
//#endregion

// เชื่อมปุ่ม เปิด–ปิดหน้าต่าง เติมตัวเลือก และบันทึกลง Neon
//#region function openCreateAssetModal() {
function openCreateAssetModal() {
    const modal = document.getElementById('createAssetModal');
    const form = document.getElementById('createAssetForm');

    if (!modal || !form) return;

    form.reset();

        resetLocationSelect(
        'newAssetBuilding',
        '-- เลือกอาคารหรือสถานที่ --'
    );

    resetLocationSelect(
        'newAssetRoom',
        '-- เลือกชั้นหรือห้อง --'
    );

    resetLocationSelect(
        'newAssetCoordinate',
        '-- เลือกพิกัด เช่น A12 --'
    );

    document.getElementById('newAssetCurrency').value = 'THB';
    document.getElementById('newAssetStatus').value = 'SPARE';

    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('newAssetReceivedDate').value = today;

    setCreateAssetMessage('');
    updateStatusDetailVisibility();

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');

    window.setTimeout(() => {
        document.getElementById('newAssetCode')?.focus();
    }, 50);
}

function closeCreateAssetModal() {
    const modal = document.getElementById('createAssetModal');

    if (!modal || modal.hidden) return;

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('asset-modal-open');
    setCreateAssetMessage('');
}

function updateStatusDetailVisibility() {
    const statusSelect =
        document.getElementById('newAssetStatus');

    const detailField =
        document.getElementById('newAssetStatusDetailField');

    const detailInput =
        document.getElementById('newAssetStatusDetail');

    if (!statusSelect || !detailField || !detailInput) return;

    const selectedStatus =
        assetState.masterData.statuses.find(
            (status) => status.code === statusSelect.value
        );

    const detailRequired =
        statusSelect.value === 'OTHER' ||
        selectedStatus?.requires_detail === true;

    detailField.hidden = !detailRequired;
    detailInput.required = detailRequired;

    if (!detailRequired) {
        detailInput.value = '';
    }
}

async function submitCreateAssetForm(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton =
        document.getElementById('submitCreateAssetButton');

    if (!form.reportValidity()) return;

    const payload = Object.fromEntries(
        new FormData(form).entries()
    );

    payload.locationId =
    document.getElementById('newAssetCoordinate')?.value ||
    document.getElementById('newAssetRoom')?.value ||
    document.getElementById('newAssetBuilding')?.value ||
    document.getElementById('newAssetLocation')?.value ||
    '';

    payload.purchasePrice =
        payload.purchasePrice === ''
            ? null
            : Number(payload.purchasePrice);

    const confirmed = confirm(
        `ยืนยันรับทรัพย์สินรหัส ${payload.assetCode} เข้าระบบใช่หรือไม่?`
    );

    if (!confirmed) return;

    submitButton.disabled = true;
    setCreateAssetFormDisabled(form, true);
    setCreateAssetMessage(
        'กำลังบันทึกทรัพย์สินลงระบบ...',
        'loading'
    );

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': crypto.randomUUID(),
                    'X-Client-Source':
                        window.matchMedia(
                            '(display-mode: standalone)'
                        ).matches
                            ? 'PWA'
                            : 'WEB'
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'บันทึกทรัพย์สินไม่สำเร็จ'
            );
        }

        setCreateAssetMessage(
            'บันทึกทรัพย์สินสำเร็จ',
            'success'
        );

        assetState.page = 1;

        await Promise.all([
            loadAssets(),
            loadAssetSummary()
        ]);

        window.setTimeout(() => {
            closeCreateAssetModal();
        }, 500);
    } catch (error) {
        console.error('Create asset error:', error);

        setCreateAssetMessage(
            error.message || 'เกิดข้อผิดพลาดในการบันทึก',
            'error'
        );
    } finally {
        setCreateAssetFormDisabled(form, false);
        submitButton.disabled = false;
    }
}

function setCreateAssetFormDisabled(form, disabled) {
    form
        .querySelectorAll('input, select, textarea, button')
        .forEach((element) => {
            element.disabled = disabled;
        });
}

function setCreateAssetMessage(message, status = '') {
    const element =
        document.getElementById('createAssetFormMessage');

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}
//#endregion

//เพิ่มช่องตำแหน่งย่อยในหน้าต่างรับทรัพย์สิน
//#region async function loadChildLocations(
async function loadChildLocations(
    parentId,
    selectId,
    placeholder
) {
    const select = document.getElementById(selectId);
    if (!select) return;

    resetLocationSelect(selectId, 'กำลังโหลด...');

    if (!parentId) {
        resetLocationSelect(selectId, placeholder);
        return;
    }

    try {
        const query = new URLSearchParams({
            parentId
        });

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/locations?${query}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'โหลดตำแหน่งย่อยไม่สำเร็จ'
            );
        }

        select.replaceChildren();

        const firstOption = document.createElement('option');
        firstOption.value = '';
        firstOption.textContent = data.locations.length
            ? placeholder
            : '-- ไม่มีตำแหน่งย่อย --';

        select.appendChild(firstOption);

        data.locations.forEach((location) => {
            const option = document.createElement('option');

            option.value = location.id;
            option.textContent =
                `${location.code} — ${location.name}`;

            select.appendChild(option);
        });

        select.disabled = data.locations.length === 0;
    } catch (error) {
        console.error('Load child locations error:', error);

        resetLocationSelect(
            selectId,
            '-- โหลดตำแหน่งไม่สำเร็จ --'
        );

        setCreateAssetMessage(error.message, 'error');
    }
}

function resetLocationSelect(selectId, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.replaceChildren();

    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;

    select.appendChild(option);
    select.disabled = true;
}
//#endregion

//สร้างหน้าต่างจัดการพื้นที่ อาคาร ห้อง และพิกัด  
//#region function openAssetLocationModal() {
function openAssetLocationModal() {
    const modal =
        document.getElementById('assetLocationModal');

    const form =
        document.getElementById('assetLocationForm');

    if (!modal || !form) return;

    form.reset();

    resetLocationSelect(
        'locationMasterBuilding',
        '-- เลือกอาคาร --'
    );

    resetLocationSelect(
        'locationMasterRoom',
        '-- เลือกชั้นหรือห้อง --'
    );

    setAssetLocationMessage('');

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');
}

function closeAssetLocationModal() {
    const modal =
        document.getElementById('assetLocationModal');

    if (!modal || modal.hidden) return;

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('asset-modal-open');
    setAssetLocationMessage('');
}

async function loadMasterLocationChildren(
    parentId,
    selectId,
    placeholder
) {
    const select = document.getElementById(selectId);
    if (!select) return;

    resetLocationSelect(selectId, 'กำลังโหลด...');

    if (!parentId) {
        resetLocationSelect(selectId, placeholder);
        return;
    }

    try {
        const query = new URLSearchParams({ parentId });

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/locations?${query}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'โหลดตำแหน่งไม่สำเร็จ'
            );
        }

        select.replaceChildren();

        const firstOption = document.createElement('option');
        firstOption.value = '';
        firstOption.textContent = data.locations.length
            ? placeholder
            : '-- ยังไม่มีข้อมูล --';

        select.appendChild(firstOption);

        data.locations.forEach((location) => {
            const option = document.createElement('option');

            option.value = location.id;
            option.dataset.locationType =
                location.location_type;

            option.textContent =
                `${location.code} — ${location.name}`;

            select.appendChild(option);
        });

        select.disabled = data.locations.length === 0;
    } catch (error) {
        console.error(error);
        resetLocationSelect(
            selectId,
            '-- โหลดตำแหน่งไม่สำเร็จ --'
        );
        setAssetLocationMessage(error.message, 'error');
    }
}

async function submitAssetLocationForm(event) {
    event.preventDefault();

    const type =
        document.getElementById('locationMasterType').value;

    const workAreaId =
        document.getElementById('locationMasterWorkArea').value;

    const buildingSelect =
        document.getElementById('locationMasterBuilding');

    const roomSelect =
        document.getElementById('locationMasterRoom');

    const buildingId = buildingSelect.value;
    const roomId = roomSelect.value;

    const roomType =
        roomSelect.selectedOptions[0]
            ?.dataset.locationType || '';

    let parentId = '';

    if (type === 'BUILDING') {
        parentId = workAreaId;
    } else if (type === 'FLOOR') {
        parentId = buildingId;
    } else if (type === 'ROOM') {
        parentId =
            roomId && roomType === 'FLOOR'
                ? roomId
                : buildingId;
    } else if (type === 'POSITION') {
        if (roomType !== 'ROOM') {
            setAssetLocationMessage(
                'การสร้างพิกัดต้องเลือกห้องก่อน',
                'error'
            );
            return;
        }

        parentId = roomId;
    }

    if (!parentId) {
        setAssetLocationMessage(
            'กรุณาเลือกตำแหน่งหลักให้ครบตามประเภท',
            'error'
        );
        return;
    }

    const payload = {
        parentId,
        locationType: type,
        code:
            document.getElementById('locationMasterCode')
                .value.trim(),
        name:
            document.getElementById('locationMasterName')
                .value.trim()
    };

    const submitButton =
        document.getElementById('submitAssetLocationButton');

    submitButton.disabled = true;
    setAssetLocationMessage(
        'กำลังบันทึกตำแหน่ง...',
        'loading'
    );

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/locations`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'บันทึกตำแหน่งไม่สำเร็จ'
            );
        }

        setAssetLocationMessage(
            'บันทึกตำแหน่งสำเร็จ',
            'success'
        );

        document.getElementById('locationMasterCode').value = '';
        document.getElementById('locationMasterName').value = '';

        await refreshLocationMasterAfterCreate(
            type,
            workAreaId,
            buildingId
        );
    } catch (error) {
        console.error('Create location error:', error);
        setAssetLocationMessage(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function refreshLocationMasterAfterCreate(
    type,
    workAreaId,
    buildingId
) {
    if (type === 'BUILDING') {
        await loadMasterLocationChildren(
            workAreaId,
            'locationMasterBuilding',
            '-- เลือกอาคาร --'
        );
    } else if (
        type === 'FLOOR' ||
        type === 'ROOM'
    ) {
        await loadMasterLocationChildren(
            buildingId,
            'locationMasterRoom',
            '-- เลือกชั้นหรือห้อง --'
        );
    }
}

function setAssetLocationMessage(message, status = '') {
    const element =
        document.getElementById('assetLocationFormMessage');

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}
//#endregion

//สร้างหน้าต่างเปลี่ยนสถานะ  
//#region function openAssetStatusModal() {
function openAssetStatusModal() {
    const asset = assetState.currentAsset;
    const modal =
        document.getElementById('assetStatusModal');

    const form =
        document.getElementById('assetStatusForm');

    if (!asset || !modal || !form) return;

    form.reset();

    setText(
        'statusModalAssetCode',
        asset.asset_code || '-'
    );

    setText(
        'statusModalCurrentStatus',
        asset.status_name ||
        asset.status_code ||
        '-'
    );

    const statusSelect =
        document.getElementById('statusModalNewStatus');

    statusSelect.value = '';

    Array.from(statusSelect.options).forEach((option) => {
        option.disabled =
            option.value === asset.status_code;
    });

    updateStatusModalDetailVisibility();
    setAssetStatusFormMessage('');

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');
}

function closeAssetStatusModal() {
    const modal =
        document.getElementById('assetStatusModal');

    if (!modal || modal.hidden) return;

    if (
        modal.contains(document.activeElement) &&
        typeof document.activeElement.blur === 'function'
    ) {
        document.activeElement.blur();
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    setAssetStatusFormMessage('');

    const detailModal =
        document.getElementById('assetDetailModal');

    if (!detailModal || detailModal.hidden) {
        document.body.classList.remove('asset-modal-open');
    }
}

function updateStatusModalDetailVisibility() {
    const statusCode =
        document.getElementById('statusModalNewStatus')
            ?.value || '';

    const field =
        document.getElementById('statusModalDetailField');

    const input =
        document.getElementById('statusModalDetail');

    if (!field || !input) return;

    const status =
        assetState.masterData.statuses.find(
            (item) => item.code === statusCode
        );

    const required =
        status?.requires_detail === true;

    field.hidden = !required;
    input.required = required;

    if (!required) {
        input.value = '';
    }
}

async function submitAssetStatusForm(event) {
    event.preventDefault();

    const asset = assetState.currentAsset;

    if (!asset) {
        setAssetStatusFormMessage(
            'ไม่พบข้อมูลทรัพย์สิน',
            'error'
        );
        return;
    }

    const statusCode =
        document.getElementById('statusModalNewStatus')
            .value;

    const statusDetail =
        document.getElementById('statusModalDetail')
            .value.trim();

    const actionDetail =
        document.getElementById(
            'statusModalActionDetail'
        ).value.trim();

    const submitButton =
        document.getElementById(
            'submitAssetStatusButton'
        );

    const confirmed = confirm(
        `ยืนยันเปลี่ยนสถานะทรัพย์สิน ${asset.asset_code} ใช่หรือไม่?`
    );

    if (!confirmed) return;

    submitButton.disabled = true;

    setAssetStatusFormMessage(
        'กำลังเปลี่ยนสถานะ...',
        'loading'
    );

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/${encodeURIComponent(asset.id)}/status`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': crypto.randomUUID(),
                    'X-Client-Source':
                        window.matchMedia(
                            '(display-mode: standalone)'
                        ).matches
                            ? 'PWA'
                            : 'WEB'
                },
                body: JSON.stringify({
                    statusCode,
                    statusDetail,
                    actionDetail,
                    recordVersion: asset.record_version
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'เปลี่ยนสถานะไม่สำเร็จ'
            );
        }

        setAssetStatusFormMessage(
            'เปลี่ยนสถานะสำเร็จ',
            'success'
        );

        await Promise.all([
            loadAssets(),
            loadAssetSummary()
        ]);

        closeAssetStatusModal();

        await openAssetDetail(asset.id);
    } catch (error) {
        console.error('Change asset status error:', error);

        setAssetStatusFormMessage(
            error.message || 'เปลี่ยนสถานะไม่สำเร็จ',
            'error'
        );
    } finally {
        submitButton.disabled = false;
    }
}

function setAssetStatusFormMessage(message, status = '') {
    const element =
        document.getElementById('assetStatusFormMessage');

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}
//#endregion 

//ฟังก์ชันโหลดและแสดง Audit Trail  
//#region Asset Audit Trail
async function loadAssetAuditTrail(
    assetId,
    { append = false } = {}
) {
    if (!assetId || assetState.audit.loading) return;

    if (!append) {
        assetState.audit.assetId = assetId;
        assetState.audit.page = 1;
        assetState.audit.total = 0;
        assetState.audit.totalPages = 0;

        document
            .getElementById('assetAuditList')
            ?.replaceChildren();
    }

    assetState.audit.loading = true;
    setAssetAuditMessage('กำลังโหลดประวัติ...', 'loading');

    const loadMoreButton =
        document.getElementById(
            'loadMoreAssetAuditButton'
        );

    if (loadMoreButton) {
        loadMoreButton.disabled = true;
    }

    try {
        const parameters = new URLSearchParams({
            page: String(assetState.audit.page),
            limit: String(assetState.audit.limit)
        });

        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/${encodeURIComponent(assetId)}/transactions?${parameters.toString()}`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                'ไม่สามารถโหลดประวัติการดำเนินการได้'
            );
        }

        assetState.audit.total =
            Number(data.pagination?.total) || 0;

        assetState.audit.totalPages =
            Number(data.pagination?.totalPages) || 0;

        renderAssetAuditTrail(
            data.transactions || [],
            append
        );

        setText(
            'assetAuditTotal',
            `${assetState.audit.total.toLocaleString('th-TH')} รายการ`
        );

        const emptyElement =
            document.getElementById('assetAuditEmpty');

        if (emptyElement) {
            emptyElement.hidden =
                assetState.audit.total > 0;
        }

        if (loadMoreButton) {
            loadMoreButton.hidden =
                assetState.audit.page >=
                assetState.audit.totalPages;
        }

        setAssetAuditMessage('');
    } catch (error) {
        console.error('Asset audit trail error:', error);

        if (append && assetState.audit.page > 1) {
            assetState.audit.page -= 1;
        }

        setAssetAuditMessage(
            error.message ||
            'โหลดประวัติการดำเนินการไม่สำเร็จ',
            'error'
        );
    } finally {
        assetState.audit.loading = false;

        if (loadMoreButton) {
            loadMoreButton.disabled = false;
        }
    }
}

function renderAssetAuditTrail(
    transactions,
    append = false
) {
    const list =
        document.getElementById('assetAuditList');

    if (!list) return;

    if (!append) {
        list.replaceChildren();
    }

    transactions.forEach((transaction) => {
        const item = document.createElement('li');
        item.className = 'asset-audit-item';

        const marker = document.createElement('span');
        marker.className = 'asset-audit-marker';
        marker.setAttribute('aria-hidden', 'true');

        const card = document.createElement('article');
        card.className = 'asset-audit-card';

        const header = document.createElement('div');
        header.className = 'asset-audit-card-header';

        const action = document.createElement('strong');
        action.className = 'asset-audit-action';
        action.textContent =
            getAssetAuditActionLabel(
                transaction.action_type
            );

        const time = document.createElement('time');
        time.className = 'asset-audit-time';
        time.textContent =
            formatAssetAuditDate(
                transaction.action_at
            );

        header.append(action, time);
        card.appendChild(header);

        if (transaction.action_detail) {
            const detail = document.createElement('p');
            detail.className = 'asset-audit-detail';
            detail.textContent =
                transaction.action_detail;

            card.appendChild(detail);
        }

        if (
            transaction.previous_status_code ||
            transaction.new_status_code
        ) {
            const statusChange =
                document.createElement('div');

            statusChange.className =
                'asset-audit-status-change';

            const previous =
                document.createElement('span');

            previous.className =
                'asset-audit-status-value';

            previous.textContent =
                transaction.previous_status_name ||
                transaction.previous_status_code ||
                'ไม่ระบุ';

            const arrow =
                document.createElement('span');

            arrow.className = 'asset-audit-arrow';
            arrow.textContent = '→';

            const next =
                document.createElement('span');

            next.className =
                'asset-audit-status-value';

            next.textContent =
                transaction.new_status_name ||
                transaction.new_status_code ||
                'ไม่ระบุ';

            statusChange.append(
                previous,
                arrow,
                next
            );

            card.appendChild(statusChange);
        }

        const meta = document.createElement('div');
        meta.className = 'asset-audit-meta';

        const actor = document.createElement('span');
        actor.textContent =
            `ผู้ดำเนินการ: ${transaction.action_by || '-'}`;

        const source = document.createElement('span');
        source.textContent =
            `ช่องทาง: ${transaction.source || '-'}`;

        meta.append(actor, source);
        card.appendChild(meta);

        item.append(marker, card);
        list.appendChild(item);
    });
}

function getAssetAuditActionLabel(actionType) {
    const labels = {
        CREATE: 'รับทรัพย์สินเข้าระบบ',
        UPDATE: 'แก้ไขข้อมูลทรัพย์สิน',
        TRANSFER: 'โยกย้ายทรัพย์สิน',
        ASSIGN: 'มอบหมายให้พนักงาน',
        UNASSIGN: 'ยกเลิกการมอบหมาย',
        CLAIM: 'ส่งเคลม',
        MARK_DAMAGED: 'แจ้งทรัพย์สินชำรุด',
        DISPOSE: 'แจ้งทำลายทรัพย์สิน',
        INSPECT: 'ดำเนินการตรวจสอบ',
        STATUS_CHANGE: 'เปลี่ยนสถานะ',
        OTHER: 'ดำเนินการอื่นๆ'
    };

    return labels[actionType] ||
        actionType ||
        'ไม่ระบุรายการ';
}

function formatAssetAuditDate(value) {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat(
        'th-TH',
        {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Bangkok'
        }
    ).format(date);
}

function setAssetAuditMessage(
    message,
    status = ''
) {
    const element =
        document.getElementById('assetAuditMessage');

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}
//#endregion

//ฟังก์ชันเปิด ปิด และบันทึกการโยกย้าย
//#region function openAssetTransferModal() {
function openAssetTransferModal() {
    const asset = assetState.currentAsset;

    const modal =
        document.getElementById('assetTransferModal');

    const form =
        document.getElementById('assetTransferForm');

    if (!asset || !modal || !form) return;
    closeAssetDetailModal();

    form.reset();

    resetLocationSelect(
        'transferBuilding',
        '-- เลือกอาคารหรือสถานที่ --'
    );

    resetLocationSelect(
        'transferRoom',
        '-- เลือกชั้นหรือห้อง --'
    );

    resetLocationSelect(
        'transferCoordinate',
        '-- เลือกพิกัด เช่น A12 --'
    );

    setText(
        'transferModalAssetCode',
        asset.asset_code || '-'
    );

    setText(
        'transferModalCurrentLocation',
        asset.location_path ||
        asset.location_name ||
        asset.location_code ||
        '-'
    );

    setAssetTransferFormMessage('');

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');

    document
        .getElementById('transferWorkArea')
        ?.focus();
}

function closeAssetTransferModal() {
    const modal =
        document.getElementById('assetTransferModal');

    if (!modal || modal.hidden) return;

    if (
        modal.contains(document.activeElement) &&
        typeof document.activeElement.blur === 'function'
    ) {
        document.activeElement.blur();
    }

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');

    const detailModal =
        document.getElementById('assetDetailModal');

    if (!detailModal || detailModal.hidden) {
        document.body.classList.remove(
            'asset-modal-open'
        );
    }

    setAssetTransferFormMessage('');
}

async function submitAssetTransferForm(event) {
    event.preventDefault();

    const asset = assetState.currentAsset;

    if (!asset) {
        setAssetTransferFormMessage(
            'ไม่พบข้อมูลทรัพย์สิน',
            'error'
        );
        return;
    }

    const locationId =
        document
            .getElementById('transferCoordinate')
            ?.value ||
        document
            .getElementById('transferRoom')
            ?.value ||
        '';

    const actionDetail =
        document
            .getElementById('transferActionDetail')
            ?.value.trim() ||
        '';

    if (!locationId) {
        setAssetTransferFormMessage(
            'กรุณาเลือกตำแหน่งปลายทางระดับห้องหรือพิกัด',
            'error'
        );
        return;
    }

    if (!actionDetail) {
        setAssetTransferFormMessage(
            'กรุณาระบุเหตุผลหรือรายละเอียดการโยกย้าย',
            'error'
        );
        return;
    }

    const confirmed = confirm(
        `ยืนยันโยกย้ายทรัพย์สิน ${asset.asset_code} ใช่หรือไม่?`
    );

    if (!confirmed) return;

    const submitButton =
        document.getElementById(
            'submitAssetTransferButton'
        );

    submitButton.disabled = true;

    setAssetTransferFormMessage(
        'กำลังบันทึกการโยกย้าย...',
        'loading'
    );

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/${encodeURIComponent(asset.id)}/transfer`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type':
                        'application/json',

                    'X-Idempotency-Key':
                        crypto.randomUUID(),

                    'X-Client-Source':
                        window.matchMedia(
                            '(display-mode: standalone)'
                        ).matches
                            ? 'PWA'
                            : 'WEB'
                },
                body: JSON.stringify({
                    locationId,
                    actionDetail,
                    recordVersion:
                        asset.record_version
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message ||
                'โยกย้ายทรัพย์สินไม่สำเร็จ'
            );
        }

        closeAssetTransferModal();

        await Promise.all([
            loadAssets(),
            loadAssetSummary()
        ]);

        await openAssetDetail(asset.id);
    } catch (error) {
        console.error(
            'Transfer asset error:',
            error
        );

        setAssetTransferFormMessage(
            error.message ||
            'โยกย้ายทรัพย์สินไม่สำเร็จ',
            'error'
        );
    } finally {
        submitButton.disabled = false;
    }
}

function setAssetTransferFormMessage(
    message,
    status = ''
) {
    const element =
        document.getElementById(
            'assetTransferFormMessage'
        );

    if (!element) return;

    element.textContent = message;
    element.dataset.status = status;
}
//#endregion

//เชื่อมการเปิด–ปิดหน้าต่างและ Preview
// #region Asset attachments
function openAssetAttachmentModal() {
    const asset = assetState.currentAsset;
    const modal =
        document.getElementById('assetAttachmentModal');
    const form =
        document.getElementById('assetAttachmentForm');

    if (!asset || !modal || !form) return;

    closeAssetDetailModal();
    form.reset();
    clearAssetAttachmentPreview();
    setAssetAttachmentFormMessage('');

    setText(
        'attachmentModalAssetCode',
        asset.asset_code || '-'
    );

    setText(
        'attachmentModalAssetName',
        asset.asset_name || '-'
    );

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');
}

function closeAssetAttachmentModal() {
    const modal =
        document.getElementById('assetAttachmentModal');

    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('asset-modal-open');

    clearAssetAttachmentPreview();
}

function previewAssetAttachment(event) {
    const file = event.target.files?.[0];

    clearAssetAttachmentPreview();

    if (!file) return;

    const allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
    ]);

    if (!allowedTypes.has(file.type)) {
        event.target.value = '';

        setAssetAttachmentFormMessage(
            'รองรับเฉพาะ JPG, PNG, WEBP และ PDF',
            'error'
        );
        return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (file.size > maximumSize) {
        event.target.value = '';

        setAssetAttachmentFormMessage(
            'ไฟล์ต้องมีขนาดไม่เกิน 10 MB',
            'error'
        );
        return;
    }

    const preview =
        document.getElementById('assetAttachmentPreview');
    const image =
        document.getElementById('assetAttachmentPreviewImage');
    const pdf =
        document.getElementById('assetAttachmentPdfPreview');

    setText(
        'assetAttachmentFileName',
        `${file.name} (${formatAttachmentFileSize(file.size)})`
    );

    if (file.type === 'application/pdf') {
        pdf.hidden = false;
    } else {
        const objectUrl = URL.createObjectURL(file);

        assetState.attachmentPreviewUrl = objectUrl;
        image.src = objectUrl;
        image.hidden = false;

        image.onclick = () => {
            window.open(objectUrl, '_blank', 'noopener,noreferrer');
        };
    }

    preview.hidden = false;
    setAssetAttachmentFormMessage('');
}

function clearAssetAttachmentPreview() {
    if (assetState.attachmentPreviewUrl) {
        URL.revokeObjectURL(
            assetState.attachmentPreviewUrl
        );

        assetState.attachmentPreviewUrl = null;
    }

    const preview =
        document.getElementById('assetAttachmentPreview');
    const image =
        document.getElementById('assetAttachmentPreviewImage');
    const pdf =
        document.getElementById('assetAttachmentPdfPreview');

    if (preview) preview.hidden = true;

    if (image) {
        image.hidden = true;
        image.removeAttribute('src');
        image.onclick = null;
    }

    if (pdf) pdf.hidden = true;

    setText('assetAttachmentFileName', '');
}

function formatAttachmentFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setAssetAttachmentFormMessage(
    message,
    status = ''
) {
    const element =
        document.getElementById('assetAttachmentFormMessage');

    if (!element) return;

    element.textContent = message;
    element.className =
        `asset-form-message ${status}`.trim();
}

async function submitAssetAttachmentForm(event) {
    event.preventDefault();

    const asset = assetState.currentAsset;
    const form = event.currentTarget;
    const submitButton =
        document.getElementById(
            'submitAssetAttachmentButton'
        );

    const attachmentType =
        document.getElementById(
            'assetAttachmentType'
        )?.value;

    const file =
        document.getElementById(
            'assetAttachmentFile'
        )?.files?.[0];

    if (!asset?.id) {
        setAssetAttachmentFormMessage(
            'ไม่พบข้อมูลทรัพย์สิน',
            'error'
        );
        return;
    }

    if (!attachmentType || !file) {
        setAssetAttachmentFormMessage(
            'กรุณาเลือกประเภทเอกสารและไฟล์',
            'error'
        );
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'กำลังอัปโหลด...';

    setAssetAttachmentFormMessage(
        'กำลังตรวจสอบและอัปโหลดไฟล์...',
        'loading'
    );

    try {
        const fileData =
            await readAssetFileAsDataUrl(file);

        const checksumSha256 =
            await calculateAssetFileChecksum(file);

        const safeAssetCode =
            String(asset.asset_code || 'ASSET')
                .replace(/[^A-Za-z0-9_-]/g, '_');

        const safeOriginalName =
            String(file.name)
                .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                .replace(/\.\.+/g, '.')
                .slice(0, 120);

        const storedFileName =
            `Asset_${attachmentType}_${safeAssetCode}_${Date.now()}_${safeOriginalName}`;

        const uploadResponse =
            await window.authFetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/upload-drive`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Client-Source':
                            window.matchMedia(
                                '(display-mode: standalone)'
                            ).matches
                                ? 'PWA'
                                : 'WEB'
                    },
                    body: JSON.stringify({
                        caseId: safeAssetCode,
                        fileName: storedFileName,
                        fileData,
                        uploadContext: 'ASSET'
                    })
                }
            );

        const uploadResult =
            await uploadResponse.json();

        if (
            uploadResponse.status === 428 &&
            uploadResult.needAuth &&
            uploadResult.authUrl
        ) {
            window.open(
                uploadResult.authUrl,
                '_blank',
                'noopener,noreferrer'
            );

            throw new Error(
                'กรุณายืนยันสิทธิ์ Google Drive แล้วลองอัปโหลดอีกครั้ง'
            );
        }

        if (!uploadResponse.ok || !uploadResult.success) {
            throw new Error(
                uploadResult.message ||
                'อัปโหลดไฟล์ขึ้น Google Drive ไม่สำเร็จ'
            );
        }

        setAssetAttachmentFormMessage(
            'อัปโหลดสำเร็จ กำลังบันทึกข้อมูล...',
            'loading'
        );

        const registerResponse =
            await window.authFetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/assets/${encodeURIComponent(asset.id)}/attachments`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key':
                            crypto.randomUUID(),
                        'X-Client-Source':
                            window.matchMedia(
                                '(display-mode: standalone)'
                            ).matches
                                ? 'PWA'
                                : 'WEB'
                    },
                    body: JSON.stringify({
                        attachmentType,
                        originalFileName: file.name,
                        storedFileName,
                        storageFileId:
                            uploadResult.fileId,
                        fileUrl:
                            uploadResult.fileUrl,
                        mimeType: file.type,
                        fileSize: file.size,
                        checksumSha256
                    })
                }
            );

        const registerResult =
            await registerResponse.json();

        if (
            !registerResponse.ok ||
            !registerResult.success
        ) {
            throw new Error(
                registerResult.message ||
                'บันทึกข้อมูลไฟล์แนบไม่สำเร็จ'
            );
        }

        form.reset();
        clearAssetAttachmentPreview();

        setAssetAttachmentFormMessage(
            'อัปโหลดและบันทึกไฟล์สำเร็จ',
            'success'
        );

        setTimeout(async () => {
            closeAssetAttachmentModal();
            await openAssetDetail(asset.id);
        }, 700);
    } catch (error) {
        console.error(
            'Asset attachment upload error:',
            error
        );

        setAssetAttachmentFormMessage(
            error.message || 'อัปโหลดไฟล์ไม่สำเร็จ',
            'error'
        );
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'อัปโหลดไฟล์';
    }
}

function readAssetFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.onerror = () => {
            reject(
                new Error('ไม่สามารถอ่านไฟล์ที่เลือกได้')
            );
        };

        reader.readAsDataURL(file);
    });
}

async function calculateAssetFileChecksum(file) {
    const buffer = await file.arrayBuffer();

    const digest =
        await crypto.subtle.digest(
            'SHA-256',
            buffer
        );

    return Array.from(new Uint8Array(digest))
        .map(byte =>
            byte.toString(16).padStart(2, '0')
        )
        .join('');
}
// #endregion


// #region จัดการหน่วยความจำ URL ของไฟล์แนบทรัพย์สิน
const assetAttachmentObjectUrls = new Set();

function registerAssetAttachmentObjectUrl(blob) {
    const objectUrl = URL.createObjectURL(blob);
    assetAttachmentObjectUrls.add(objectUrl);
    return objectUrl;
}

function releaseAssetAttachmentObjectUrls() {
    assetAttachmentObjectUrls.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
    });

    assetAttachmentObjectUrls.clear();
}
// #endregion



//โหลดและแสดงรูปภาพหรือเอกสารของทรัพย์สิน
// #region async function loadAssetAttachments(assetId) {
async function loadAssetAttachments(assetId) {
    releaseAssetAttachmentObjectUrls();
    const list =
        document.getElementById('assetAttachmentList');
    const empty =
        document.getElementById('assetAttachmentEmpty');
    const total =
        document.getElementById('assetAttachmentTotal');

    if (!list || !empty || !total) return;

    list.replaceChildren();
    empty.hidden = true;
    total.textContent = 'กำลังโหลด...';

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/assets/${encodeURIComponent(assetId)}/attachments`,
            {
                method: 'GET',
                cache: 'no-store'
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || 'โหลดไฟล์แนบไม่สำเร็จ'
            );
        }

        const attachments =
            Array.isArray(data.attachments)
                ? data.attachments
                : [];

        total.textContent = `${attachments.length} รายการ`;
        empty.hidden = attachments.length !== 0;

        for (const attachment of attachments) {
            list.appendChild(
                createAssetAttachmentCard(attachment)
            );
        }
    } catch (error) {
        console.error('Load asset attachments:', error);
        total.textContent = '0 รายการ';
        empty.hidden = false;
        empty.textContent = error.message;
        
    }
}

// #region เปิดและปิดหน้าต่างขยายรูปภาพทรัพย์สิน

function openAssetImageLightbox(imageUrl, fileName = 'รูปภาพทรัพย์สิน') {
    const lightbox =
        document.getElementById('assetImageLightbox');

    const image =
        document.getElementById('assetImageLightboxImage');

    const title =
        document.getElementById('assetImageLightboxTitle');

    const fileNameElement =
        document.getElementById('assetImageLightboxFileName');

    if (!lightbox || !image) return;

    image.src = imageUrl;
    image.alt = fileName;

    if (title) {
        title.textContent = fileName;
    }

    if (fileNameElement) {
        fileNameElement.textContent = fileName;
    }

    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('asset-modal-open');
}

function closeAssetImageLightbox() {
    const lightbox =
        document.getElementById('assetImageLightbox');

    const image =
        document.getElementById('assetImageLightboxImage');

    if (!lightbox) return;

    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');

    if (image) {
        image.removeAttribute('src');
    }

    document.body.classList.remove('asset-modal-open');
}

// #endregion


// #region โหลดไฟล์แนบทรัพย์สินผ่าน API ที่ยืนยันตัวตน

async function loadSecureAssetAttachmentUrl(attachment) {
    const assetId =
        String(attachment.asset_id || '').trim();

    const attachmentId =
        String(attachment.id || '').trim();

    if (!assetId || !attachmentId) {
        throw new Error(
            'ข้อมูลอ้างอิงไฟล์แนบไม่ครบถ้วน'
        );
    }

    const endpoint =
        `${window.APP_CONFIG.API_BASE_URL}` +
        `/api/assets/${encodeURIComponent(assetId)}` +
        `/attachments/${encodeURIComponent(attachmentId)}` +
        `/content`;

    const response = await window.authFetch(
        endpoint,
        {
            method: 'GET',
            cache: 'no-store'
        }
    );

    if (!response.ok) {
        let message = 'ไม่สามารถโหลดไฟล์แนบได้';

        try {
            const errorData = await response.json();
            message = errorData.message || message;
        } catch (_) {
            // ข้อมูลตอบกลับไม่ใช่ JSON
        }

        throw new Error(message);
    }

    const fileBlob = await response.blob();

    if (!fileBlob.size) {
        throw new Error('ไฟล์แนบไม่มีข้อมูล');
    }

    return registerAssetAttachmentObjectUrl(fileBlob);
}

// #endregion

// #region สร้างการ์ดไฟล์แนบและเปิดรูปภายใน Lightbox อย่างปลอดภัย

function createAssetAttachmentCard(attachment) {
    const card = document.createElement('article');
    card.className = 'asset-attachment-card';

    const mimeType =
        String(attachment.mime_type || '').toLowerCase();

    const fileName =
        attachment.original_file_name ||
        attachment.file_name ||
        'ไฟล์แนบ';

    const isImage = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ].includes(mimeType);

    const previewButton =
        document.createElement('button');

    previewButton.type = 'button';
    previewButton.className =
        'asset-attachment-preview-button';

    const name = document.createElement('strong');
    name.textContent = fileName;

    const type = document.createElement('small');
    type.textContent =
        attachment.attachment_type || 'OTHER';

    if (isImage) {
        const image = document.createElement('img');

        image.alt = fileName;
        image.loading = 'lazy';

        const loadingText =
            document.createElement('span');

        loadingText.className =
            'asset-attachment-loading';

        loadingText.textContent =
            'กำลังโหลดรูป...';

        previewButton.disabled = true;
        previewButton.appendChild(loadingText);

        loadSecureAssetAttachmentUrl(attachment)
            .then((secureImageUrl) => {
                previewButton.replaceChildren(image);
                previewButton.disabled = false;

                image.src = secureImageUrl;

                previewButton.addEventListener(
                    'click',
                    () => {
                        openAssetImageLightbox(
                            secureImageUrl,
                            fileName
                        );
                    }
                );
            })
            .catch((error) => {
                console.error(
                    'Attachment preview error:',
                    error
                );

                loadingText.textContent =
                    'ไม่สามารถแสดงรูปได้';

                previewButton.title =
                    error.message;
            });
    } else {
        const fileIcon =
            document.createElement('div');

        fileIcon.className =
            'asset-attachment-file-icon';

        fileIcon.textContent = '📄';

        previewButton.appendChild(fileIcon);

        previewButton.addEventListener(
            'click',
            async () => {
                previewButton.disabled = true;

                try {
                    const secureFileUrl =
                        await loadSecureAssetAttachmentUrl(
                            attachment
                        );

                    window.open(
                        secureFileUrl,
                        '_blank',
                        'noopener,noreferrer'
                    );
                } catch (error) {
                    alert(error.message);
                } finally {
                    previewButton.disabled = false;
                }
            }
        );
    }

    card.append(
        previewButton,
        name,
        type
    );

    return card;
}

// #endregion




// #endregion 



