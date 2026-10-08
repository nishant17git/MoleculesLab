import { FONT_FACES } from '../config.js';
import { withTimeout } from './async.js';

/**
 * Web-font helpers.
 *
 * The font stylesheets in index.html load without blocking first paint
 * (`media="print"` flipped to `all` by an inline `onload`, which also records
 * `data-state`). These helpers let the boot sequence wait for them — with a time
 * limit, so a slow network never holds the app hostage.
 */

const stylesheetLinks = () => Array.from(document.querySelectorAll('link[data-font-css]'));

function settled(link) {
    return new Promise((resolve) => {
        if (link.dataset.state) return resolve();
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(), { once: true });
    });
}

/** Resolves when every font stylesheet has loaded or failed. */
export function fontStylesheetsSettled() {
    return Promise.all(stylesheetLinks().map(settled));
}

/** Requests the given faces so they download (and get cached) now rather than on first use. */
export function loadFontFaces(faces) {
    if (!document.fonts?.load) return Promise.resolve();
    return Promise.allSettled(
        faces.map(({ family, weight, sample }) =>
            document.fonts.load(`${weight} 32px "${family}"`, sample)
        )
    );
}

/** Fonts needed for the first frame. Never rejects; gives up after `timeoutMs`. */
export function loadCriticalFonts(timeoutMs) {
    return withTimeout(
        fontStylesheetsSettled().then(() => loadFontFaces(FONT_FACES.critical)),
        timeoutMs
    );
}

/** Fonts needed a little later — fetched in idle time so they are cached for offline use. */
export function loadDeferredFonts() {
    return fontStylesheetsSettled().then(() => loadFontFaces(FONT_FACES.deferred));
}
