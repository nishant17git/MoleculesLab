import { PWA, STORAGE_KEYS } from '../config.js';
import { safeStorage } from '../storage/safe-storage.js';
import { isStandalone } from '../utils/device.js';

/**
 * Page-side half of the offline system (the other half is /sw.js).
 *
 *  - registers the service worker (after the app has finished starting up)
 *  - tells the user when the app is ready for offline use, and when an update is waiting
 *  - applies updates only when the user asks (never reloads the page unprompted)
 *  - hands the service worker the third-party files this page actually used (web fonts)
 *    so they get cached too
 *  - re-checks for updates when the app returns to the foreground or comes back online
 */
export function createServiceWorkerClient({ onOfflineReady, onUpdateReady }) {
    if (!('serviceWorker' in navigator)) {
        return { register() {}, checkForUpdate() {}, verifyOfflineCache() {} };
    }

    const container = navigator.serviceWorker;
    let registration = null;
    let reloadRequested = false;
    let lastUpdateCheck = Date.now();

    /* ---- messages to / from the worker ---- */

    function post(message) {
        const worker = container.controller || registration?.active;
        worker?.postMessage(message);
    }

    /** Files from other origins that this page has loaded so far (fonts, CDN scripts). */
    function thirdPartyUrls() {
        return performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((url) => url.startsWith('https://') && new URL(url).origin !== location.origin);
    }

    /** Ask the worker to cache the third-party files this page used, then report its status. */
    function verifyOfflineCache() {
        post({ type: 'CACHE_URLS', urls: thirdPartyUrls() });
        post({ type: 'GET_STATUS' });
    }

    container.addEventListener('message', (event) => {
        const data = event.data;
        if (data?.type !== 'STATUS' || !data.ready) return;
        if (safeStorage.getItem(STORAGE_KEYS.offlineReadyShown)) return;
        safeStorage.setItem(STORAGE_KEYS.offlineReadyShown, '1');
        onOfflineReady?.();
    });

    /* ---- update flow ---- */

    function applyUpdate() {
        reloadRequested = true;
        if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        else window.location.reload();
    }

    // A new worker finished installing while an old one controls the page → update is ready.
    function watchInstalling(worker) {
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && container.controller) onUpdateReady?.(applyUpdate);
        });
    }

    container.addEventListener('controllerchange', () => {
        if (reloadRequested) {
            window.location.reload(); // the user asked for the update
        } else {
            verifyOfflineCache(); // first install took control: make sure everything is cached
        }
    });

    function checkForUpdate() {
        lastUpdateCheck = Date.now();
        registration?.update().catch(() => { /* offline: nothing to check */ });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastUpdateCheck > PWA.updateCheckIntervalMs) {
            checkForUpdate();
        }
    });

    /* ---- registration ---- */

    async function register() {
        try {
            registration = await container.register(PWA.scriptUrl, { scope: './', updateViaCache: 'none' });
        } catch (error) {
            console.warn('[pwa] service worker registration failed:', error);
            return;
        }
        if (!registration) return; // registration refused by the environment (e.g. blocked by policy)

        if (registration.waiting && container.controller) onUpdateReady?.(applyUpdate);
        if (registration.installing) watchInstalling(registration.installing);
        registration.addEventListener('updatefound', () => {
            if (registration.installing) watchInstalling(registration.installing);
        });

        if (container.controller) verifyOfflineCache();

        // Installed apps are expected to stay persistent; browsers grant this silently in that case.
        if (isStandalone() && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    }

    return { register, checkForUpdate, verifyOfflineCache };
}
