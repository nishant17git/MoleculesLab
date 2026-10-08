/** "Install App" button, driven by the browser's `beforeinstallprompt` event. */
export function initInstallPrompt(button) {
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        button.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        button.hidden = true;
    });

    button.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try {
            await deferredPrompt.userChoice;
        } catch { /* user dismissed or the browser refused */ }
        deferredPrompt = null;
        button.hidden = true;
    });
}
