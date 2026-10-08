/* global gsap */
import { LOADER } from '../config.js';
import { prefersReducedMotion } from '../utils/device.js';

/**
 * The intro / loading screen.
 *
 * How it stays smooth on low-end phones
 * - Progress is *real*: the boot sequence reports each finished step via `setProgress`,
 *   and the counter never overtakes actual readiness. A short minimum duration keeps the
 *   sequence feeling deliberate when the device is fast.
 * - DOM work per frame is tiny: text is only written when the integer changes.
 * - Heavy GPU/shader work is done in separate tasks *before* the exit animation, so the
 *   wipe never competes with it.
 */
export function createLoaderScreen(root) {
    const strokeDigits = Array.from(root.querySelectorAll('#loader-stroke .loader__digit'));
    const solidLayer = root.querySelector('#loader-solid');
    const solidDigits = Array.from(solidLayer.querySelectorAll('.loader__digit'));
    const statusEl = root.querySelector('#loader-status');
    const labels = Array.from(root.querySelectorAll('.loader__label'));
    const errorTitle = root.querySelector('#loader-error-title');
    const errorMessage = root.querySelector('#loader-error-message');
    const retryButton = root.querySelector('#loader-retry');

    const minDuration = prefersReducedMotion() ? LOADER.minDurationReducedMs : LOADER.minDurationMs;

    let target = 0;       // real readiness, 0..1
    let shown = 0;        // what the counter currently displays, 0..1
    let lastValue = -1;
    let lastStatus = '';
    let startedAt = 0;
    let lastTick = 0;
    let rafId = 0;
    let finishedResolve = null;
    const finished = new Promise((resolve) => { finishedResolve = resolve; });

    function statusFor(value) {
        let label = LOADER.statuses[0].label;
        for (const step of LOADER.statuses) if (value >= step.from) label = step.label;
        return label;
    }

    function paint(value) {
        const text = String(value).padStart(3, '0');
        for (let i = 0; i < 3; i++) {
            if (strokeDigits[i].textContent !== text[i]) {
                strokeDigits[i].textContent = text[i];
                solidDigits[i].textContent = text[i];
            }
        }
        solidLayer.style.clipPath = `inset(${100 - value}% 0 0 0)`;

        const label = statusFor(value);
        if (label !== lastStatus) {
            statusEl.textContent = label;
            lastStatus = label;
        }
    }

    function tick(now) {
        rafId = requestAnimationFrame(tick);
        const dt = Math.min(0.1, (now - lastTick) / 1000);
        lastTick = now;

        const elapsed = Math.min(1, (now - startedAt) / minDuration);
        const scheduled = 1 - Math.pow(1 - elapsed, 2.2); // quick start, soft landing
        const goal = Math.min(scheduled, target);

        shown += (goal - shown) * Math.min(1, dt * 10);
        if (goal - shown < 0.0015) shown = goal;

        const value = Math.min(100, Math.floor(shown * 100 + 1e-6));
        if (value !== lastValue) {
            lastValue = value;
            paint(value);
        }

        if (value >= 100 && elapsed >= 1) {
            cancelAnimationFrame(rafId);
            finishedResolve();
        }
    }

    /** Measures the widest digit in the loaded font so the number doesn't jitter sideways. */
    function measureDigits() {
        try {
            const style = getComputedStyle(strokeDigits[0].parentElement);
            const context = document.createElement('canvas').getContext('2d');
            context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            let widest = 0;
            for (let d = 0; d <= 9; d++) widest = Math.max(widest, context.measureText(String(d)).width);
            if (widest > 0) root.style.setProperty('--digit-width', `${widest.toFixed(2)}px`);
        } catch { /* keep the CSS default */ }
    }

    return {
        /** Begins the counter. */
        start() {
            startedAt = lastTick = performance.now();
            rafId = requestAnimationFrame(tick);
        },

        /** Reveals the big number (call once fonts are ready or the wait has timed out). */
        showCounter() {
            measureDigits();
            root.classList.add('is-counting');
        },

        /** @param {number} fraction real readiness between 0 and 1 (only ever moves forward) */
        setProgress(fraction) {
            target = Math.max(target, Math.min(1, fraction));
        },

        /** Resolves once the counter has reached 100. */
        finished() {
            target = 1;
            return finished;
        },

        /**
         * Plays the exit. `onOpen` fires as the screen starts to open, so the app can start
         * revealing itself underneath. Resolves when the loader is gone from the DOM.
         */
        exit({ onOpen } = {}) {
            return new Promise((resolve) => {
                const done = () => {
                    root.remove();
                    resolve();
                };

                if (typeof gsap === 'undefined' || prefersReducedMotion()) {
                    root.style.transition = 'opacity 0.3s ease-out';
                    root.style.opacity = '0';
                    onOpen?.();
                    setTimeout(done, 320);
                    return;
                }

                // Note: the original also animated letter-spacing here, which forces text
                // re-layout every frame. Scale alone looks the same and stays on the compositor.
                gsap.timeline({ onComplete: done })
                    .to([strokeDigits[0].parentElement, solidLayer], { scale: 1.05, duration: 0.35, ease: 'power3.inOut' }, 0)
                    .to(labels, { y: '-100%', opacity: 0, duration: 0.4, ease: 'expo.in', stagger: 0.04 }, 0)
                    .call(() => onOpen?.(), [], 0.2)
                    .fromTo(
                        root,
                        { clipPath: 'inset(0% 0% 0% 0%)' },
                        { clipPath: 'inset(50% 0% 50% 0%)', duration: 0.6, ease: 'expo.inOut' },
                        0.2
                    );
            });
        },

        /** Replaces the counter with a message and a retry button. */
        fail({ title, message, onRetry }) {
            cancelAnimationFrame(rafId);
            errorTitle.textContent = title;
            errorMessage.textContent = message;
            retryButton.onclick = onRetry ?? (() => window.location.reload());
            root.classList.add('is-failed');
            statusEl.textContent = 'Stopped';
        },
    };
}
