import { STORAGE_KEYS } from '../config.js';
import { readJSON, writeJSON } from './safe-storage.js';

/**
 * Persistent coin-toss statistics.
 * Storage format is `{ heads: number, tails: number }` under `molecules_stats`
 * (unchanged from earlier versions, so existing counts carry over).
 */

const toCount = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);

function normalise(raw) {
    return {
        heads: toCount(raw?.heads),
        tails: toCount(raw?.tails),
    };
}

export function createStatsStore() {
    let stats = normalise(readJSON(STORAGE_KEYS.stats));

    const persist = () => writeJSON(STORAGE_KEYS.stats, stats);

    return {
        /** @returns {{heads: number, tails: number}} a copy, safe to mutate */
        get: () => ({ ...stats }),

        /** @param {'heads' | 'tails'} side */
        increment(side) {
            if (side !== 'heads' && side !== 'tails') return;
            stats[side] += 1;
            persist();
        },

        reset() {
            stats = { heads: 0, tails: 0 };
            persist();
        },
    };
}
