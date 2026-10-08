/**
 * Central configuration — every tunable lives here so behaviour can be adjusted
 * without hunting through feature modules.
 */

/** The two modes of the app. */
export const MODES = Object.freeze({
    COIN: 'coin',
    YES_NO: 'yesno',
});

/** localStorage keys. `molecules_stats` is unchanged so existing users keep their counts. */
export const STORAGE_KEYS = Object.freeze({
    stats: 'molecules_stats',
    offlineReadyShown: 'molecules_offline_ready_shown',
});

/** Loader timing (seconds unless noted). */
export const LOADER = Object.freeze({
    /** Shortest time the counter takes to reach 100 — keeps the intro feeling intentional. */
    minDurationMs: 1400,
    /** Same, for people who prefer reduced motion. */
    minDurationReducedMs: 400,
    /** How long to wait for web fonts before showing the counter with fallback fonts. */
    fontWaitMs: 900,
    /** Status line shown at each progress threshold (0–100). */
    statuses: [
        { from: 0, label: 'Initializing' },
        { from: 15, label: 'Isolating Variables' },
        { from: 45, label: 'Calculating Chance' },
        { from: 80, label: 'Awaiting Input' },
    ],
});

/** 3D quality presets, picked from the device tier (see utils/device.js). */
export const QUALITY_PRESETS = Object.freeze({
    low: {
        maxPixelRatio: 1.25,
        textureSize: 512,
        anisotropy: 2,
        torusRadialSegments: 12,
        torusTubularSegments: 96,
    },
    mid: {
        maxPixelRatio: 1.5,
        textureSize: 1024,
        anisotropy: 4,
        torusRadialSegments: 16,
        torusTubularSegments: 128,
    },
    high: {
        maxPixelRatio: 2,
        textureSize: 1024,
        anisotropy: 8,
        torusRadialSegments: 24,
        torusTubularSegments: 128,
    },
});

/** Adaptive resolution: if frames stay slow, the renderer quietly lowers its pixel ratio. */
export const ADAPTIVE_QUALITY = Object.freeze({
    /** Frames ignored after the loop starts (shader/texture warm-up spikes). */
    warmupFrames: 30,
    /** Frames per measurement window. */
    windowFrames: 40,
    /** Average frame time (ms) above which a window counts as "slow" (~40 fps). */
    slowFrameMs: 25,
    /** Consecutive slow windows required before reducing quality. */
    slowWindowsToAct: 2,
    /** Multiplier applied to the pixel ratio on each reduction. */
    step: 0.8,
    minPixelRatio: 1,
});

/** Web fonts that must be fetched at least once while online so they can be cached. */
export const FONT_FACES = Object.freeze({
    /** Needed for the first frame. */
    critical: [
        { family: 'Clash Display', weight: 600, sample: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.' },
        { family: 'Inter', weight: 400, sample: 'Install Reset Heads Tails' },
        { family: 'Inter', weight: 500, sample: 'COIN YES NO' },
        { family: 'Space Grotesk', weight: 700, sample: '0123456789' },
        { family: 'Syne', weight: 700, sample: 'HTOSSASK' },
    ],
    /** Needed soon after; fetched in idle time so they are cached for offline use. */
    deferred: [
        { family: 'Syne', weight: 800, sample: 'HEADSTAILYNO' },
        { family: 'Matangi', weight: 500, sample: 'संशय की यह कोठरी मन भटकावे नीत' },
        { family: 'Matangi', weight: 600, sample: 'भ्रम निवारक' },
    ],
});

/** Service worker. */
export const PWA = Object.freeze({
    scriptUrl: 'sw.js',
    /** Minimum gap between background update checks while the app stays open. */
    updateCheckIntervalMs: 30 * 60 * 1000,
    toastMs: 2600,
});
