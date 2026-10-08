/**
 * Online/offline awareness. Used only for *informational* notices: nothing in the app
 * depends on the network once it has been opened online once.
 */
export function watchConnectivity({ onOffline, onOnline }) {
    window.addEventListener('offline', () => onOffline?.());
    window.addEventListener('online', () => onOnline?.());
    return { isOnline: () => navigator.onLine !== false };
}
