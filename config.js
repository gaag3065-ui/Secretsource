// ======================================================
// Secretsource - Frontend Environment Configuration
// ======================================================

// เธ•เธฃเธงเธเธชเธญเธเธงเนเธฒเธซเธเนเธฒเน€เธงเนเธเธเธณเธฅเธฑเธเธ—เธณเธเธฒเธเธญเธขเธนเนเนเธเน€เธเธฃเธทเนเธญเธ Local เธซเธฃเธทเธญเนเธกเน
const IS_LOCAL =
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost';

// Backend เธชเธณเธซเธฃเธฑเธเธเธฒเธฃเธเธฑเธ’เธเธฒเนเธเน€เธเธฃเธทเนเธญเธ เธฃเธญเธเธฃเธฑเธเธเธณเธซเธเธ”เธเธญเธฃเนเธ•เน€เธเธเธฒเธฐเธเธฒเธฃเธ—เธ”เธชเธญเธเธเธ localhost
const localApiPortParameter = new URLSearchParams(
    window.location.search
).get('apiPort');
const localApiPort = /^\d{4,5}$/.test(localApiPortParameter || '')
    ? localApiPortParameter
    : '43127';
const LOCAL_API_URL = `http://127.0.0.1:${localApiPort}`;



const PRODUCTION_API_URL = 'https://gnu-states-mpg-vhs.trycloudflare.com';



window.APP_CONFIG = {
    API_BASE_URL: IS_LOCAL ? LOCAL_API_URL : PRODUCTION_API_URL,
    ENVIRONMENT: IS_LOCAL ? 'development' : 'production'
};

console.log(
    `[APP CONFIG] Environment: ${window.APP_CONFIG.ENVIRONMENT}`
);



//เธเธฑเธเธเนเธเธฑเธเธญเนเธฒเธ CSRF Token
//window.getCsrfToken = function () {
//#region
window.getCsrfToken = function () {

    const storedToken =
    sessionStorage.getItem('csrfToken');

    if (storedToken) {
        return storedToken;
    }
    const cookieNames = [
        '__Host-ga_csrf',
        'ga_csrf'
    ];

    for (const name of cookieNames) {
        const prefix = `${name}=`;

        const cookie = document.cookie
            .split('; ')
            .find(item =>
                item.startsWith(prefix)
            );

        if (cookie) {
            return decodeURIComponent(
                cookie.slice(prefix.length)
            );
        }
    }

    return '';
};
//#endregion



window.authFetch = async function (url, options = {}) {
    const headers = new Headers(
        options.headers || {}
    );
    const method =
        String(options.method || 'GET').toUpperCase();
    const accessToken =
        sessionStorage.getItem('accessToken');

    if (accessToken) {
        headers.set(
            'Authorization',
            'Bearer ' + accessToken
        );
    }

    const unsafeMethods = new Set([
        'POST',
        'PUT',
        'PATCH',
        'DELETE'
    ]);

    if (unsafeMethods.has(method)) {
        const csrfToken =
            window.getCsrfToken();

        if (!csrfToken) {
            throw new Error(
                'เนเธกเนเธเธ CSRF Token เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธซเธกเน'
            );
        }

        headers.set(
            'X-CSRF-Token',
            csrfToken
        );
    }


    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });

    if (response.status === 401) {
        sessionStorage.clear();
        window.location.replace('index.html');

        throw new Error(
            'เน€เธเธชเธเธฑเธเธซเธกเธ”เธญเธฒเธขเธธ เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธเนเธซเธกเน'
        );
    }

    return response;
};

window.requirePagePermission = async function (
    permissionKey
) {
    const response = await window.authFetch(
        `${window.APP_CONFIG.API_BASE_URL}/api/session`,
        {
            method: 'GET',
            cache: 'no-store'
        }
    );

    const data = await response.json();

    const isAdmin =
        String(data.user?.role || '')
            .trim()
            .toUpperCase() === 'ADMIN';

    if (data.csrfToken) {
    sessionStorage.setItem(
        'csrfToken',
        data.csrfToken
    );
        }

    if (
        !response.ok ||
        !data.success ||
        (
            !isAdmin &&
            data.permissions?.[permissionKey] !== true
        )
    ) {
        alert('เธเธฑเธเธเธตเธเธตเนเนเธกเนเธกเธตเธชเธดเธ—เธเธดเนเน€เธเนเธฒเธ–เธถเธเธซเธเนเธฒเธเธตเน');
        window.location.replace('portal.html');
        throw new Error('PERMISSION_DENIED');
    }

    window.USER_PERMISSIONS =
        data.permissions || {};

    window.CURRENT_SESSION_USER = data.user || {};
    window.isCurrentUserAdmin = isAdmin;

    return data;
};

//เธเธฑเธเธเนเธเธฑเธ Logout เธเธฅเธฒเธ
//window.performSecureLogout =
//#region
window.performSecureLogout =
    async function () {
        try {
            const headers = {
                'X-CSRF-Token':
                    window.getCsrfToken()
            };
            const accessToken =
                sessionStorage.getItem('accessToken');

            if (accessToken) {
                headers.Authorization =
                    'Bearer ' + accessToken;
            }

            await fetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/logout`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers
                }
            );
        } catch (error) {
            console.error(
                'Logout request error:',
                error
            );
        } finally {
            sessionStorage.clear();
            window.location.replace('index.html');
        }
    };
//#endregion





