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
const PRODUCTION_API_URL = 'https://circular-patrol-review-jose.trycloudflare.com';

// API หลักที่ทุกหน้าในระบบจะเรียกใช้
window.APP_CONFIG = {
    API_BASE_URL: IS_LOCAL ? LOCAL_API_URL : PRODUCTION_API_URL,
    ENVIRONMENT: IS_LOCAL ? 'development' : 'production'
};

console.log(
    `[APP CONFIG] Environment: ${window.APP_CONFIG.ENVIRONMENT}`
);

//======= สร้างฟังก์ชันกลางสำหรับส่ง Token =======//
window.authFetch = async function (url, options = {}) {
    const token = sessionStorage.getItem('authToken');

    if (!token) {
        sessionStorage.clear();
        window.location.replace('index.html');
        throw new Error('กรุณาเข้าสู่ระบบ');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        sessionStorage.clear();
        window.location.replace('index.html');
        throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    return response;
};