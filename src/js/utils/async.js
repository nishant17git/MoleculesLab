/** Scheduling / timing helpers used to keep the main thread responsive during start-up. */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves after the browser has had a chance to paint a frame.
 * (rAF fires *before* paint, so we hop to a task afterwards.) The timer fallback keeps
 * start-up moving if the tab is in the background and rAF is paused.
 */
export function afterPaint() {
    return Promise.race([
        new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))),
        sleep(120),
    ]);
}

/** Runs `fn` when the browser is idle (or soon, on browsers without requestIdleCallback). */
export function whenIdle(fn, timeout = 2000) {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(fn, { timeout });
    } else {
        setTimeout(fn, 200);
    }
}

/** Resolves with `fallback` if `promise` takes longer than `ms`. Never rejects. */
export function withTimeout(promise, ms, fallback = undefined) {
    return Promise.race([
        Promise.resolve(promise).catch(() => fallback),
        sleep(ms).then(() => fallback),
    ]);
}
