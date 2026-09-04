'use strict';

const CACHE_VERSION = 'ga-east-pwa-v3-mobile-layout';

const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_FILES = [
    './manifest.webmanifest',
    './responsive.css',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) => cache.addAll(STATIC_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) =>
                Promise.all(
                    cacheNames
                        .filter(
                            (cacheName) =>
                                ![
                                    STATIC_CACHE,
                                    RUNTIME_CACHE
                                ].includes(cacheName)
                        )
                        .map((cacheName) =>
                            caches.delete(cacheName)
                        )
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const requestUrl = new URL(request.url);

    // ห้าม Service Worker จัดการคำขอเขียนข้อมูล
    if (request.method !== 'GET') return;

    // ห้ามดัก API หรือทรัพยากรข้ามโดเมน
    if (requestUrl.origin !== self.location.origin) return;

    const destination = request.destination;

    // HTML, JavaScript, CSS และ config ต้องพยายามโหลดเวอร์ชันล่าสุดก่อน
    if (
        request.mode === 'navigate' ||
        destination === 'document' ||
        destination === 'script' ||
        destination === 'style' ||
        requestUrl.pathname.endsWith('.webmanifest')
    ) {
        event.respondWith(networkFirst(request));
        return;
    }

    // เก็บเฉพาะไฟล์ภาพและทรัพยากรคงที่
    if (
        destination === 'image' ||
        destination === 'font'
    ) {
        event.respondWith(cacheFirst(request));
    }
});

async function networkFirst(request) {
    try {
        const response = await fetch(request, {
            cache: 'no-store'
        });

        if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        const cachedResponse =
            await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        throw error;
    }
}

async function cacheFirst(request) {
    const cachedResponse =
        await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    const response = await fetch(request);

    if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
    }

    return response;
}