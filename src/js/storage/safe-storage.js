/**
 * localStorage that can never throw.
 *
 * Storage access fails in real life: Safari private mode, disabled cookies, quota
 * errors, or enterprise policies. When that happens we keep working from memory for
 * the rest of the session instead of crashing the app.
 */

const memory = new Map();

function probeLocalStorage() {
    try {
        const storage = window.localStorage;
        const probe = '__molecules_probe__';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        return storage;
    } catch {
        return null;
    }
}

const backend = probeLocalStorage();

export const safeStorage = {
    get persistent() {
        return backend !== null;
    },

    getItem(key) {
        try {
            if (backend) return backend.getItem(key);
        } catch { /* fall through to memory */ }
        return memory.has(key) ? memory.get(key) : null;
    },

    setItem(key, value) {
        memory.set(key, String(value));
        try {
            backend?.setItem(key, String(value));
        } catch { /* quota / blocked: memory copy still holds the value */ }
    },

    removeItem(key) {
        memory.delete(key);
        try {
            backend?.removeItem(key);
        } catch { /* ignore */ }
    },
};

/** Reads and parses JSON; returns `fallback` for missing or corrupt data. */
export function readJSON(key, fallback = null) {
    const raw = safeStorage.getItem(key);
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function writeJSON(key, value) {
    safeStorage.setItem(key, JSON.stringify(value));
}
