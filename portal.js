document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        window.location.replace('index.html');
        return;
    }

    let sessionUser = {};
    let permissions = {};

    try {
        const response = await window.authFetch(
            `${window.APP_CONFIG.API_BASE_URL}/api/session`
        );

        if (!response.ok) {
            throw new Error('Session invalid');
        }

        const data = await response.json();

        sessionUser = data.user || {};
        permissions = data.permissions || {};
    } catch (error) {
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }

    const isAdmin =
        String(sessionUser.role || '').toUpperCase() === 'ADMIN';

    const insurancePermissions = [
        'SearchData',
        'CreateTreatment',
        'ViewHistory',
        'EditTreatment',
        'DeleteTreatment',
        'UploadFiles',
        'ViewAllHistory',
        'ExportHistoryReport'
    ];

    function canAccessPage(page) {
        if (isAdmin) return true;

        if (page === 'search.html') {
            return insurancePermissions.some(
                permission => permissions[permission] === true
            );
        }

        if (page === 'accommodation.html') {
            return permissions.ManageAccommodation === true;
        }

        return false;
    }

    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('click', () => {
            const targetPage = card.dataset.page;

            const availablePages = [
                'search.html',
                'accommodation.html'
            ];

            if (availablePages.includes(targetPage)) {
                if (!canAccessPage(targetPage)) {
                    alert('บัญชีนี้ไม่มีสิทธิ์เข้าถึงส่วนงานดังกล่าว');
                    return;
                }

                window.location.href = targetPage;
                return;
            }

            const serviceName =
                card.querySelector('.service-title')
                    ?.textContent?.trim() || 'This service';

            alert(
                `${serviceName}\n\nThis service is currently under development.`
            );
        });
    });

    document
        .getElementById('portalLogoutButton')
        ?.addEventListener('click', () => {
            const confirmed = confirm(
                'Are you sure you want to sign out?'
            );

            if (!confirmed) return;

            sessionStorage.clear();
            window.location.replace('index.html');
        });
});