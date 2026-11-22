'use strict';

(function initializePwa() {
    if (!('serviceWorker' in navigator)) {
        console.warn('[PWA] Browser does not support Service Worker.');
        return;
    }

    const isSecureContextAllowed =
        window.isSecureContext ||
        ['localhost', '127.0.0.1'].includes(
            window.location.hostname
        );

    if (!isSecureContextAllowed) {
        console.warn(
            '[PWA] Service Worker requires HTTPS or localhost.'
        );
        return;
    }

    window.addEventListener('load', async () => {
        try {
            const registration =
                await navigator.serviceWorker.register(
                    './sw.js',
                    {
                        scope: './',
                        updateViaCache: 'none'
                    }
                );

            console.info(
                '[PWA] Service Worker registered:',
                registration.scope
            );

            registration.addEventListener(
                'updatefound',
                () => {
                    const worker =
                        registration.installing;

                    if (!worker) return;

                    worker.addEventListener(
                        'statechange',
                        () => {
                            if (
                                worker.state === 'installed' &&
                                navigator.serviceWorker.controller
                            ) {
                                window.dispatchEvent(
                                    new CustomEvent(
                                        'pwa:update-available'
                                    )
                                );
                            }
                        }
                    );
                }
            );
        } catch (error) {
            console.error(
                '[PWA] Service Worker registration failed:',
                error
            );
        }
    });
})();