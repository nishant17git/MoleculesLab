import { QUALITY_PRESETS, ADAPTIVE_QUALITY } from '../config.js';
import { getDeviceTier } from '../utils/device.js';

/** Picks the 3D quality preset for this device. */
export function resolveQuality() {
    const tier = getDeviceTier();
    return { tier, ...QUALITY_PRESETS[tier] };
}

/**
 * Adaptive resolution.
 * Feed it every frame's duration; if the device keeps missing ~40 fps it lowers the
 * renderer's pixel ratio a step at a time (never below `minPixelRatio`). If it is
 * already at the floor and still slow, it calls `onFloor` so the UI can drop
 * its own expensive effects. It only ever reduces quality — no oscillation.
 */
export function createAdaptiveQuality({ getPixelRatio, setPixelRatio, onFloor }) {
    const cfg = ADAPTIVE_QUALITY;
    let seen = 0;
    let windowFrames = 0;
    let windowMs = 0;
    let slowWindows = 0;
    let active = true;

    return {
        sample(frameMs) {
            if (!active) return;
            if (frameMs > 250) return; // tab was hidden or the debugger paused us — not a real measurement

            seen += 1;
            if (seen <= cfg.warmupFrames) return;

            windowFrames += 1;
            windowMs += frameMs;
            if (windowFrames < cfg.windowFrames) return;

            const average = windowMs / windowFrames;
            windowFrames = 0;
            windowMs = 0;
            slowWindows = average > cfg.slowFrameMs ? slowWindows + 1 : 0;
            if (slowWindows < cfg.slowWindowsToAct) return;

            slowWindows = 0;
            const current = getPixelRatio();
            const next = Math.max(cfg.minPixelRatio, Number((current * cfg.step).toFixed(2)));
            if (next < current) {
                setPixelRatio(next);
            } else {
                active = false;
                onFloor?.();
            }
        },
    };
}
