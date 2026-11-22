// ระบบ Cache กลางฝั่งหน้าเว็บ (Stale-While-Revalidate) — ใช้ร่วมกันทุกหน้า
//   เปิดหน้า → แสดงข้อมูลที่เก็บไว้ทันที (ไม่รอเครือข่าย) แล้วดึงข้อมูลใหม่เบื้องหลัง เสร็จแล้วอัปเดตหน้าให้เอง
//
// ความปลอดภัย (ตกลงไว้):
//   • ผูกกับผู้ใช้ที่ล็อกอินอยู่ (คีย์ขึ้นต้นด้วยชื่อผู้ใช้) — ไม่มีผู้ใช้ = ไม่เก็บอะไรเลย
//   • ล้างทั้งหมดอัตโนมัติตอน Logout / เซสชันหมดอายุ (config.js เรียก ApiCache.clearAll())
//   • มีอายุ (TTL) — เกินอายุถือว่าไม่มี และถูกลบ · เปลี่ยนเวอร์ชันระบบ = ทิ้งของเก่า
//   • ผู้เรียกต้องส่ง project() เลือกเก็บ "เฉพาะรายการย่อที่ใช้แสดงตาราง/ค้นหา" — ห้ามเก็บเอกสารส่วนตัว/รูป/ไฟล์
//
// ใช้:  await ApiCache.swr('staff:employees', () => fetchFresh(), {
//           maxAgeMs: 12 * 3600e3, project: data => ({ ...ย่อ... }),
//           onCached: (data, meta) => แสดงทันที, onFresh: (data, meta) => อัปเดตเมื่อได้ข้อมูลใหม่ })
(() => {
    if (window.ApiCache) return;
    const DB_NAME = 'ga-api-cache', STORE = 'entries';
    const DEFAULT_MAX_AGE = 12 * 3600e3;
    const memory = new Map();
    const inflight = new Map();
    const stats = [];

    const scope = () => { try { return String(sessionStorage.getItem('loggedInAdminName') || '').trim(); } catch { return ''; } };
    const version = () => String(window.APP_VERSION || '');
    const fullKey = key => `${scope()}|${key}`;

    let dbPromise = null;
    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(resolve => {
            try {
                const request = indexedDB.open(DB_NAME, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'k' });
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
                request.onblocked = () => resolve(null);
            } catch { resolve(null); }
        });
        return dbPromise;
    }
    const tx = async (mode, run) => {
        const db = await openDb();
        if (!db) return undefined;
        return new Promise(resolve => {
            try {
                const store = db.transaction(STORE, mode).objectStore(STORE);
                const request = run(store);
                if (!request) return resolve(undefined);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(undefined);
            } catch { resolve(undefined); }
        });
    };

    const valid = (entry, maxAgeMs) => entry && entry.v === version() && entry.u === scope() && Date.now() - entry.at <= (maxAgeMs || DEFAULT_MAX_AGE);

    async function read(key, { maxAgeMs } = {}) {
        if (!scope()) return null;
        const k = fullKey(key);
        let entry = memory.get(k);
        if (!entry) {
            entry = await tx('readonly', store => store.get(k));
            if (entry) memory.set(k, entry);
        }
        if (!valid(entry, maxAgeMs)) {
            if (entry) { memory.delete(k); void tx('readwrite', store => store.delete(k)); }
            return null;
        }
        return { data: entry.data, at: entry.at };
    }

    async function write(key, data) {
        if (!scope()) return;   // ไม่มีผู้ใช้ = ไม่เก็บ
        const k = fullKey(key);
        const entry = { k, u: scope(), v: version(), at: Date.now(), data };
        memory.set(k, entry);
        await tx('readwrite', store => store.put(entry));
    }

    async function remove(key) {
        const k = fullKey(key);
        memory.delete(k);
        await tx('readwrite', store => store.delete(k));
    }

    // ล้างทั้งหมด (Logout / เซสชันหมดอายุ): ความจำ + IndexedDB
    async function clearAll() {
        memory.clear();
        inflight.clear();
        try { await tx('readwrite', store => store.clear()); } catch { /* ไม่เป็นไร */ }
    }

    // เริ่มหน้า: ลบรายการหมดอายุ / ของผู้ใช้อื่น / ของเวอร์ชันเก่า
    async function purge() {
        const db = await openDb();
        if (!db) return;
        try {
            const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
            const cursor = store.openCursor();
            cursor.onsuccess = () => {
                const item = cursor.result;
                if (!item) return;
                if (!valid(item.value, 7 * 24 * 3600e3)) item.delete();
                item.continue();
            };
        } catch { /* ไม่เป็นไร */ }
    }

    // Stale-While-Revalidate: แสดงของเก็บไว้ทันที แล้วดึงใหม่เบื้องหลัง · คำขอเดียวกันที่กำลังดึงอยู่ใช้ร่วมกัน
    async function swr(key, fetcher, { maxAgeMs, project, onCached, onFresh, onError } = {}) {
        const t0 = performance.now();
        let cached = null;
        try { cached = await read(key, { maxAgeMs }); } catch { cached = null; }
        const cacheMs = Math.round(performance.now() - t0);
        if (cached) { try { onCached?.(cached.data, { at: cached.at, ms: cacheMs }); } catch (error) { console.error('ApiCache onCached error:', error); } }

        const run = inflight.get(key) || (() => {
            const promise = Promise.resolve().then(fetcher).finally(() => inflight.delete(key));
            inflight.set(key, promise);
            return promise;
        })();
        try {
            const fresh = await run;
            const freshMs = Math.round(performance.now() - t0);
            stats.push({ key, hit: Boolean(cached), cacheMs, freshMs, at: Date.now() });
            if (stats.length > 100) stats.shift();
            try { void write(key, project ? project(fresh) : fresh); } catch { /* เก็บไม่ได้ไม่เป็นไร */ }
            onFresh?.(fresh, { cached: Boolean(cached), ms: freshMs });
            return fresh;
        } catch (error) {
            if (cached) { onError?.(error, { hadCache: true }); return cached.data; }   // ดึงใหม่ไม่ได้: ยังมีของเก่าให้ดู
            onError?.(error, { hadCache: false });
            throw error;
        }
    }

    window.ApiCache = { swr, read, write, remove, clearAll, purge, stats: () => stats.slice() };
    window.addEventListener('pageshow', () => { void purge(); }, { once: true });
})();
