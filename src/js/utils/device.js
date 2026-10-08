/** Device / environment capability checks. */

/**
 * Rough performance tier used to pick 3D quality presets.
 * `deviceMemory` is Chromium-only; elsewhere we fall back to core count.
 * The renderer additionally adapts at runtime, so a wrong guess here self-corrects.
 *
 * @returns {'low' | 'mid' | 'high'}
 */
export function getDeviceTier() {
    try {
        const memory = navigator.deviceMemory; // GB, rounded down to a power of two
        const cores = navigator.hardwareConcurrency || 4;

        if ((memory && memory <= 2) || cores <= 2) return 'low';
        if ((memory && memory <= 4) || cores <= 4) return 'mid';
        return 'high';
    } catch {
        return 'mid'; // can't tell — pick the middle preset; adaptive quality corrects it if needed
    }
}

export const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const hasFinePointer = () => window.matchMedia('(pointer: fine)').matches;

/** True when running as an installed app (all major platforms). */
export const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
