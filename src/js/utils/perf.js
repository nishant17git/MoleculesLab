/**
 * Start-up milestones. They cost nothing at runtime and show up as labelled markers in the
 * browser's Performance panel (and `performance.getEntriesByType('mark')`) when profiling.
 */
export function mark(name) {
    try {
        performance.mark(`molecules:${name}`);
    } catch { /* performance API unavailable */ }
}
