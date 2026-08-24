// ======================================================
// Secretsource - Frontend Environment Configuration
// ======================================================

// ตรวจสอบว่าหน้าเว็บกำลังทำงานอยู่ในเครื่อง Local หรือไม่
const IS_LOCAL =
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === 'localhost';

// Backend สำหรับการพัฒนาในเครื่อง
const LOCAL_API_URL = 'http://127.0.0.1:43127';

// Backend สำหรับเว็บไซต์จริง
// ตอนนี้ยังใช้ค่าว่างไว้ก่อน จนกว่าเราจะจัดการ Production Backend
const PRODUCTION_API_URL = 'https://unless-supplemental-chuck-commentary.trycloudflare.com';

// API หลักที่ทุกหน้าในระบบจะเรียกใช้
window.APP_CONFIG = {
    API_BASE_URL: IS_LOCAL ? LOCAL_API_URL : PRODUCTION_API_URL,
    ENVIRONMENT: IS_LOCAL ? 'development' : 'production'
};

console.log(
    `[APP CONFIG] Environment: ${window.APP_CONFIG.ENVIRONMENT}`
);



//ฟังก์ชันอ่าน CSRF Token
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
                'ไม่พบ CSRF Token กรุณาเข้าสู่ระบบใหม่'
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
            'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
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

    if (data.csrfToken) {
    sessionStorage.setItem(
        'csrfToken',
        data.csrfToken
    );
        }

    if (
        !response.ok ||
        !data.success ||
        data.permissions?.[permissionKey] !== true
    ) {
        alert('บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้านี้');
        window.location.replace('portal.html');
        throw new Error('PERMISSION_DENIED');
    }

    window.USER_PERMISSIONS =
        data.permissions || {};

    return data;
};

//ฟังก์ชัน Logout กลาง
//window.performSecureLogout =
//#region
window.performSecureLogout =
    async function () {
        try {
            await fetch(
                `${window.APP_CONFIG.API_BASE_URL}/api/logout`,
                {
                    method: 'POST',
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        'X-CSRF-Token':
                            window.getCsrfToken()
                    }
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


